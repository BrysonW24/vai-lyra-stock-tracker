"""The accumulator wave: component efficacy, chat gap-mining, attach exceptions.

These are the LEARNING seams - each test pins the property that keeps a ledger honest:
efficacy is a pure deterministic rebuild, gap cards carry counts and never chat content,
and a recorded attach correction is enforced forever.
"""

from __future__ import annotations

from workers.scout import attach as attach_mod
from workers.scout import gapminer
from workers.scout.outcomes import _stoplist_entity
from workers.stock_scanner.efficacy_job import band_of, build_efficacy_rows


class _FakeResult:
    def __init__(self, data):
        self.data = data


class _FakeQuery:
    def __init__(self, db, name):
        self._db = db
        self._name = name
        self._op = "select"
        self._payload = None

    def select(self, *a, **k):
        return self

    def eq(self, *a):
        return self

    def gte(self, *a):
        return self

    def limit(self, n):
        return self

    def upsert(self, record, on_conflict=None):
        self._op = "upsert"
        self._payload = record
        return self

    def execute(self):
        if self._op == "select":
            return _FakeResult(self._db.rows.get(self._name, []))
        self._db.log.append((self._op, self._name, self._payload))
        return _FakeResult(None)


class _FakeDb:
    def __init__(self, rows=None):
        self.rows = rows or {}
        self.log = []

    def table(self, name):
        return _FakeQuery(self, name)


class _DbRepo:
    def __init__(self, rows=None):
        self.client = _FakeDb(rows)


class TestComponentEfficacy:
    def test_pure_rebuild_aggregates_by_component_band_horizon(self):
        outcomes = [
            {"symbol": "AAAA", "signal_candle_time": "t1", "return_5d": 2.0, "return_20d": 5.0},
            {"symbol": "BBBB", "signal_candle_time": "t2", "return_5d": -1.0, "return_20d": None},
        ]
        scores = [
            {"symbol": "AAAA", "candle_time": "t1", "strategy_code": "s1", "rsi_score": 20.0,
             "macd_score": 10.0, "price_location_score": 5.0, "trend_score": 5.0, "volume_score": 5.0},
            {"symbol": "BBBB", "candle_time": "t2", "strategy_code": "s1", "rsi_score": 5.0,
             "macd_score": 10.0, "price_location_score": 5.0, "trend_score": 5.0, "volume_score": 5.0},
        ]
        rows = build_efficacy_rows(outcomes, scores)
        # rsi splits into two bands (20 high, 5 low); macd sits in one band with both outcomes.
        rsi_high_5d = next(r for r in rows if r["component"] == "rsi" and r["band"] == "high" and r["horizon"] == "5d")
        assert rsi_high_5d["n"] == 1 and rsi_high_5d["win_rate"] == 1.0 and rsi_high_5d["avg_return"] == 2.0
        rsi_low_5d = next(r for r in rows if r["component"] == "rsi" and r["band"] == "low" and r["horizon"] == "5d")
        assert rsi_low_5d["win_rate"] == 0.0
        macd_5d = next(r for r in rows if r["component"] == "macd" and r["horizon"] == "5d")
        assert macd_5d["n"] == 2 and macd_5d["win_rate"] == 0.5
        # Null returns are skipped, never counted as losses.
        assert all(r["n"] == 1 for r in rows if r["horizon"] == "20d")

    def test_unmatched_outcomes_are_skipped_not_guessed(self):
        rows = build_efficacy_rows(
            [{"symbol": "GONE", "signal_candle_time": "t9", "return_5d": 1.0, "return_20d": 1.0}], []
        )
        assert rows == []

    def test_banding_is_deterministic_terciles(self):
        assert band_of(0.0, 0.0, 30.0) == "low"
        assert band_of(15.0, 0.0, 30.0) == "mid"
        assert band_of(29.0, 0.0, 30.0) == "high"
        assert band_of(7.0, 7.0, 7.0) == "mid"  # degenerate range never crashes


class TestGapMiner:
    def _turns(self, entity, n_turns, n_users):
        return [
            {"user_id": f"u{i % n_users}", "content": f"What do you think about {entity} lately?"}
            for i in range(n_turns)
        ]

    def test_recurring_cross_user_topic_files_a_counts_only_card(self, monkeypatch):
        monkeypatch.setattr(gapminer, "attach", lambda *a, **k: type("A", (), {"unmapped": True})())
        repo = _DbRepo({"chat_turns": self._turns("Orbital Solar Arrays", 4, 3)})
        assert gapminer.mine_content_gaps(repo) == 1
        (_, table, card) = repo.client.log[0]
        assert table == "community_ideas"
        assert card["kind"] == "content-gap" and card["origin"] == "scout"
        assert card["dedupe_key"] == "scout-gap-orbital-solar-arrays"
        # PRIVACY: the card and its evidence carry counts only - never chat content,
        # never a user id. The topic entity is the only thing that leaves the miner.
        assert "What do you think" not in card["description"]
        assert all("u0" not in str(v) and "u1" not in str(v) for v in card.values())
        assert card["evidence"][0]["sourceName"] == "Copilot questions (aggregate)"

    def test_single_user_drumbeat_never_files(self, monkeypatch):
        monkeypatch.setattr(gapminer, "attach", lambda *a, **k: type("A", (), {"unmapped": True})())
        repo = _DbRepo({"chat_turns": self._turns("Orbital Solar Arrays", 5, 1)})
        assert gapminer.mine_content_gaps(repo) == 0

    def test_topics_the_map_covers_are_not_gaps(self, monkeypatch):
        monkeypatch.setattr(gapminer, "attach", lambda *a, **k: type("A", (), {"unmapped": False})())
        repo = _DbRepo({"chat_turns": self._turns("Quantum Computing", 6, 3)})
        assert gapminer.mine_content_gaps(repo) == 0


class TestAttachExceptions:
    def test_recorded_correction_is_enforced(self, monkeypatch):
        monkeypatch.setattr(attach_mod, "build_index", lambda: {"quantweave": frozenset({"quantum-computing"})})
        assert "quantum-computing" in attach_mod.attach("Quantweave raises a round", "").matched_themes
        corrected = attach_mod.attach(
            "Quantweave raises a round", "",
            exceptions=frozenset({("quantum-computing", "quantweave")}),
        )
        assert corrected.unmapped

    def test_exception_is_theme_scoped_not_global(self, monkeypatch):
        monkeypatch.setattr(
            attach_mod, "build_index",
            lambda: {"quantweave systems": frozenset({"quantum-computing", "robotics-automation"})},
        )
        a = attach_mod.attach(
            "Quantweave Systems ships", "",
            exceptions=frozenset({("quantum-computing", "quantweave systems")}),
        )
        assert a.matched_themes == ("robotics-automation",)


class TestGapCardStoplisting:
    def test_declined_gap_card_joins_the_stoplist(self):
        repo = _DbRepo()
        out = {"stoplisted": 0}
        _stoplist_entity(
            repo,
            {"dedupe_key": "scout-gap-orbital-solar-arrays", "title": "Content gap: Orbital Solar Arrays"},
            out,
        )
        assert out["stoplisted"] == 1
        (_, table, row) = repo.client.log[0]
        assert table == "scout_stoplist"
        assert row["slug"] == "orbital-solar-arrays" and row["entity"] == "Orbital Solar Arrays"
