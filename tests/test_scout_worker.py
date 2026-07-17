"""Scout worker: registry loading, feed parsing, deterministic attachment, clustering.

The scout is the noticing half of the self-learning loop - these tests pin the
properties that keep it honest: sources gate on env keys, parsing never raises,
attachment is conservative (two-letter tickers never match bare), and only signal that
recurs across INDEPENDENT sources becomes an idea candidate.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from workers.scout.attach import attach, detect_symbols
from workers.scout.cluster import IdeaCandidate, cluster_unmapped, drumbeats
from workers.scout.outcomes import load_stoplist, stamp_outcomes
from workers.scout.providers import ScoutItem, demo_items, item_id, parse_feed_xml
from workers.scout.sources import ScoutSource, active_sources, load_sources


def src(**over) -> ScoutSource:
    base = dict(
        id="rss-test", kind="rss", name="Test", target="https://example.com/feed",
        niches=("broad",), why="", access="open", cadence="nightly",
    )
    base.update(over)
    return ScoutSource(**base)


def item(title: str, summary: str = "", source_id: str = "s1") -> ScoutItem:
    return ScoutItem(
        id=item_id(None, title), source_id=source_id, source_kind="rss", url=None,
        title=title, summary=summary, published_at=datetime.now(tz=timezone.utc),
    )


class TestSources:
    def test_registry_loads_and_every_row_is_valid(self):
        sources = load_sources()
        assert len(sources) >= 50  # the curated registry is substantial
        for s in sources:
            assert s.kind in {"api", "rss", "x", "crawl"}
            assert s.id.startswith(f"{s.kind}-")

    def test_open_sources_active_env_gated_sources_wait(self, monkeypatch):
        monkeypatch.delenv("SOME_FAKE_KEY", raising=False)
        rows = [src(id="rss-a"), src(id="api-b", kind="api", access="env:SOME_FAKE_KEY"), src(id="x-c", kind="x", access="gated:x-api")]
        assert [s.id for s in active_sources(rows)] == ["rss-a"]
        monkeypatch.setenv("SOME_FAKE_KEY", "k")
        assert [s.id for s in active_sources(rows)] == ["rss-a", "api-b"]

    def test_x_sources_never_activate_without_credentials(self):
        rows = [src(id="x-someone", kind="x", access="gated:x-api")]
        assert active_sources(rows) == []


class TestFeedParsing:
    def test_rss2(self):
        xml = """<rss version="2.0"><channel><item>
          <title>DOE announces award</title><link>https://x.test/a</link>
          <description>Funding news.</description>
          <pubDate>Wed, 16 Jul 2026 10:00:00 GMT</pubDate>
        </item></channel></rss>"""
        items = parse_feed_xml(xml, src())
        assert len(items) == 1
        assert items[0].title == "DOE announces award"
        assert items[0].published_at is not None

    def test_atom(self):
        xml = """<feed xmlns="http://www.w3.org/2005/Atom"><entry>
          <title>Atom entry</title><link href="https://x.test/b"/>
          <summary>Body.</summary><updated>2026-07-16T10:00:00Z</updated>
        </entry></feed>"""
        items = parse_feed_xml(xml, src())
        assert len(items) == 1
        assert items[0].url == "https://x.test/b"

    def test_garbage_degrades_to_empty(self):
        assert parse_feed_xml("not xml at all", src()) == []

    def test_untitled_entries_are_skipped(self):
        xml = "<rss><channel><item><description>no title</description></item></channel></rss>"
        assert parse_feed_xml(xml, src()) == []


class TestAttach:
    def test_theme_phrase_attaches(self):
        a = attach("Uranium enrichment capacity expands", "New centrifuge cascades online.")
        assert "nuclear-uranium" in a.matched_themes

    def test_unrelated_text_is_unmapped(self):
        a = attach("Local bakery wins pie contest", "The crust was praised by judges.")
        assert a.unmapped

    def test_two_letter_ticker_never_matches_bare(self):
        # EU (enCore Energy) as the political entity must not attach as a ticker.
        assert "EU" not in detect_symbols("The EU announced new trade policy today")

    def test_dollar_prefixed_ticker_matches(self):
        assert "EU" in detect_symbols("Watching $EU after the uranium contract news")

    def test_known_long_symbol_matches_bare(self):
        syms = detect_symbols("POWL reported record backlog this quarter")
        assert "POWL" in syms


class TestCluster:
    def test_recurring_entity_across_sources_promotes(self):
        items = [
            item("Commonwealth Fusion Systems raises new round", source_id="s1"),
            item("Commonwealth Fusion Systems signs utility deal", source_id="s2"),
            item("Milestone for Commonwealth Fusion Systems plant", source_id="s3"),
        ]
        out = cluster_unmapped(items)
        assert len(out) == 1
        assert "Commonwealth Fusion Systems" in out[0].title
        assert out[0].dedupe_key.startswith("scout-vertical-")
        assert len(out[0].evidence) == 3
        assert 0 < out[0].confidence <= 90

    def test_single_source_drumbeat_is_ignored(self):
        items = [item(f"Commonwealth Fusion Systems item {i}", source_id="s1") for i in range(5)]
        assert cluster_unmapped(items) == []

    def test_below_min_items_is_ignored(self):
        items = [
            item("Commonwealth Fusion Systems raises", source_id="s1"),
            item("Commonwealth Fusion Systems signs", source_id="s2"),
        ]
        assert cluster_unmapped(items) == []

    def test_demo_items_exercise_the_loop_shape(self):
        assert len(demo_items()) >= 3


class TestDeterminism:
    def test_item_id_is_stable(self):
        assert item_id("https://a.test/x", "Title") == item_id("https://a.test/x", "Title")
        assert item_id("https://a.test/x", "Title") != item_id("https://a.test/y", "Title")


class TestDrumbeats:
    """Below-bar clusters made visible - the feed's 'building signals' list."""

    def test_building_entity_reports_what_it_still_needs(self):
        items = [
            item("Commonwealth Fusion Systems raises new round", source_id="s1"),
            item("Commonwealth Fusion Systems milestone update", source_id="s1"),
        ]
        out = drumbeats(items)
        assert len(out) == 1
        beat = out[0]
        assert beat["entity"] == "Commonwealth Fusion Systems"
        assert beat["items"] == 2 and beat["sources"] == 1
        assert beat["needItems"] == 1 and beat["needSources"] == 1
        assert beat["latest"]["title"]

    def test_promoted_entities_never_appear_as_drumbeats(self):
        items = [
            item("Commonwealth Fusion Systems raises new round", source_id="s1"),
            item("Commonwealth Fusion Systems signs utility deal", source_id="s2"),
            item("Milestone for Commonwealth Fusion Systems plant", source_id="s3"),
        ]
        promoted = cluster_unmapped(items)
        assert len(promoted) == 1
        assert drumbeats(items, promoted=promoted) == []

    def test_bar_clearers_are_candidates_not_drumbeats(self):
        # Even with no promoted list passed, an above-bar cluster is not a drumbeat.
        items = [
            item("Commonwealth Fusion Systems raises new round", source_id="s1"),
            item("Commonwealth Fusion Systems signs utility deal", source_id="s2"),
            item("Milestone for Commonwealth Fusion Systems plant", source_id="s3"),
        ]
        assert drumbeats(items) == []

    def test_single_mentions_are_not_drumbeats(self):
        assert drumbeats([item("Commonwealth Fusion Systems raises", source_id="s1")]) == []


class TestEvidenceShape:
    def test_candidate_evidence_carries_published_at(self):
        items = [
            item("Commonwealth Fusion Systems raises new round", source_id="s1"),
            item("Commonwealth Fusion Systems signs utility deal", source_id="s2"),
            item("Milestone for Commonwealth Fusion Systems plant", source_id="s3"),
        ]
        out = cluster_unmapped(items)
        assert all("publishedAt" in ev and ev["publishedAt"] for ev in out[0].evidence)


class _LogTable:
    def __init__(self, log, name):
        self._log = log
        self._name = name

    def upsert(self, record, on_conflict=None):
        self._log.append(("upsert", self._name, record, on_conflict))
        return self

    def insert(self, record):
        self._log.append(("insert", self._name, record))
        return self

    def execute(self):
        return None


class _LogClient:
    def __init__(self):
        self.log = []

    def table(self, name):
        return _LogTable(self.log, name)


class _LogRepo:
    def __init__(self):
        self.client = _LogClient()


class _FakeResult:
    def __init__(self, data):
        self.data = data


class _FakeQuery:
    """Chainable read/write fake: selects serve the table's preset rows; writes log."""

    def __init__(self, db, name):
        self._db = db
        self._name = name
        self._op = "select"
        self._payload = None
        self._maybe = False

    def select(self, *a, **k):
        return self

    def eq(self, *a):
        return self

    def is_(self, *a):
        return self

    def in_(self, *a):
        return self

    def limit(self, n):
        return self

    def maybe_single(self):
        self._maybe = True
        return self

    def upsert(self, record, on_conflict=None):
        self._op = "upsert"
        self._payload = record
        return self

    def update(self, record):
        self._op = "update"
        self._payload = record
        return self

    def execute(self):
        if self._op == "select":
            rows = self._db.rows.get(self._name, [])
            return _FakeResult(rows[0] if self._maybe and rows else None if self._maybe else rows)
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


class TestOutcomeStamping:
    """v3: verdicts become deterministic feedback, each card exactly once."""

    def test_accepted_card_credits_its_sources_and_stamps(self):
        repo = _DbRepo({
            "community_ideas": [{
                "id": "card-1", "title": "Emerging signal: Test Co", "status": "planned",
                "kind": "vertical", "dedupe_key": "scout-vertical-test-co",
                "evidence": [
                    {"sourceId": "rss-a", "title": "t1"},
                    {"sourceId": "rss-a", "title": "t2"},
                    {"sourceId": "rss-b", "title": "t3"},
                ],
            }],
        })
        out = stamp_outcomes(repo)
        assert out == {"stamped": 1, "credited": 3, "debited": 0, "stoplisted": 0}
        scores = [p for op, name, p in repo.client.log if op == "upsert" and name == "scout_source_scores"]
        by_source = {p["source_id"]: p for p in scores}
        assert by_source["rss-a"]["accepted"] == 2 and by_source["rss-a"]["declined"] == 0
        assert by_source["rss-b"]["accepted"] == 1
        stamps = [p for op, name, p in repo.client.log if op == "update" and name == "community_ideas"]
        assert len(stamps) == 1 and stamps[0]["stamped_at"]

    def test_declined_vertical_debits_and_joins_the_stoplist(self):
        repo = _DbRepo({
            "community_ideas": [{
                "id": "card-2", "title": "Emerging signal: Noise Term", "status": "declined",
                "kind": "vertical", "dedupe_key": "scout-vertical-noise-term",
                "evidence": [{"sourceId": "rss-junk", "title": "t"}],
            }],
        })
        out = stamp_outcomes(repo)
        assert out["debited"] == 1 and out["stoplisted"] == 1 and out["stamped"] == 1
        stop = [p for op, name, p in repo.client.log if name == "scout_stoplist"]
        assert stop[0]["slug"] == "noise-term" and stop[0]["entity"] == "Noise Term"

    def test_load_stoplist_returns_slugs(self):
        repo = _DbRepo({"scout_stoplist": [{"slug": "noise-term"}, {"slug": "other"}]})
        assert load_stoplist(repo) == {"noise-term", "other"}


class TestStoplistEnforcement:
    def test_stoplisted_entity_never_promotes_or_drumbeats(self):
        """A human declined it once - the same entity must not re-file OR reappear as a
        building drumbeat, however loud its coverage gets."""
        items = [
            item("Commonwealth Fusion Systems raises new round", source_id="s1"),
            item("Commonwealth Fusion Systems signs utility deal", source_id="s2"),
            item("Milestone for Commonwealth Fusion Systems plant", source_id="s3"),
        ]
        stop = {"commonwealth-fusion-systems"}
        assert cluster_unmapped(items, stoplist=stop) == []
        assert drumbeats(items, stoplist=stop) == []


class TestFilingAndLedger:
    def test_file_ideas_enriches_evidence_with_source_names(self):
        """The card must be self-verifying: '2 independent sources' means NAMING them.
        Evidence rows gain sourceName from the registry at filing time; unknown ids
        fall back to the raw id rather than dropping the row."""
        from workers.scout import main as scout_main

        real = load_sources()[0]
        cand = IdeaCandidate(
            dedupe_key="scout-vertical-test-entity",
            title="Emerging signal: Test Entity",
            description="d",
            confidence=50,
            evidence=(
                {"itemId": "i1", "title": "t1", "url": None, "sourceId": real.id, "publishedAt": None},
                {"itemId": "i2", "title": "t2", "url": None, "sourceId": "not-in-registry", "publishedAt": None},
            ),
        )
        repo = _LogRepo()
        assert scout_main._file_ideas(repo, [cand]) == 1
        (_, table, record, on_conflict) = repo.client.log[0]
        assert table == "community_ideas" and on_conflict == "dedupe_key"
        assert record["evidence"][0]["sourceName"] == real.name
        assert record["evidence"][1]["sourceName"] == "not-in-registry"

    def test_record_run_writes_the_ledger_row(self):
        from workers.scout import main as scout_main

        repo = _LogRepo()
        summary = {
            "items_fetched": 400, "items_persisted": 400, "items_unmapped": 110,
            "ideas_filed": 0, "sources_active": 36, "sources_gated": 64,
            "window_saturated": False,
        }
        beats = [{"entity": "Test Co", "items": 2, "sources": 1, "needItems": 1, "needSources": 1, "latest": {"title": "t", "url": None}}]
        scout_main._record_run(repo, summary, {"agi-infrastructure": 96}, beats)
        (_, table, record) = repo.client.log[0]
        assert table == "scout_runs"
        assert record["items_fetched"] == 400
        assert record["theme_counts"] == {"agi-infrastructure": 96}
        assert record["drumbeats"] == beats


class TestOrchestratorDemoPath:
    def test_run_scout_worker_demo_mode_completes(self, monkeypatch):
        """The full orchestrator must run clean with NO Supabase client - the demo
        promise. Pinned because a refactor once left the demo branch referencing a
        variable only computed on the live path (UnboundLocalError on every keyless run)."""
        from workers.scout import main as scout_main

        class NoRepo:
            client = None

        # Keep the demo path off the network: no active sources -> demo_items().
        monkeypatch.setattr(scout_main, "active_sources", lambda registry=None: [])
        summary = scout_main.run_scout_worker(object(), NoRepo())
        assert summary["status"] == "ok"
        assert summary["items_fetched"] >= 3
        assert summary["items_persisted"] == 0


class FakeLiveRepo:
    client = object()  # truthy is all the orchestrator checks


class TestOrchestratorLivePath:
    """Live-path plumbing with the sinks monkeypatched out - pins the window, the
    saturation flag, retention pruning, and the single shared cluster path."""

    def _run(self, monkeypatch, window):
        from workers.scout import main as scout_main

        monkeypatch.setattr(scout_main, "active_sources", lambda registry=None: [])
        monkeypatch.setattr(scout_main, "_persist_items", lambda repo, items, attachments: len(items))
        monkeypatch.setattr(scout_main, "_prune_old_items", lambda repo: 0)
        monkeypatch.setattr(scout_main, "_load_recent_unmapped", lambda repo, days=14: window)
        monkeypatch.setattr(scout_main, "_file_ideas", lambda repo, candidates: len(candidates))
        return scout_main.run_scout_worker(object(), FakeLiveRepo())

    def test_window_saturation_is_loud_not_silent(self, monkeypatch, caplog):
        """A window read that fills WINDOW_LIMIT means the oldest signal is being dropped.
        That must flag the summary and land an ERROR in the nightly log - silent
        truncation weakens clustering with no red anywhere (the pattern HARNESS.md bans)."""
        from workers.scout import main as scout_main

        window = [item(f"Filler entry {i}", source_id=f"s{i % 7}") for i in range(scout_main.WINDOW_LIMIT)]
        with caplog.at_level(logging.ERROR):
            summary = self._run(monkeypatch, window)
        assert summary["window_saturated"] is True
        assert any("SATURATED" in r.message for r in caplog.records)

    def test_unsaturated_window_stays_quiet(self, monkeypatch):
        summary = self._run(monkeypatch, [])
        assert summary["status"] == "ok"
        assert summary["window_saturated"] is False
        assert summary["items_pruned"] == 0

    def test_live_and_demo_share_one_cluster_path(self, monkeypatch):
        """The same drumbeat that promotes in TestCluster must flow through the live
        orchestrator into ideas_filed - one pipeline, where mode only changes the
        window and the sinks. Guards against the two-path fork ever reappearing."""
        window = [
            item("Commonwealth Fusion Systems raises new round", source_id="s1"),
            item("Commonwealth Fusion Systems signs utility deal", source_id="s2"),
            item("Milestone for Commonwealth Fusion Systems plant", source_id="s3"),
        ]
        summary = self._run(monkeypatch, window)
        assert summary["idea_candidates"] == 1
        assert summary["ideas_filed"] == 1

    def test_prune_runs_on_the_live_path(self, monkeypatch):
        from workers.scout import main as scout_main

        pruned_with: list[object] = []

        def fake_prune(repo):
            pruned_with.append(repo)
            return 42

        monkeypatch.setattr(scout_main, "active_sources", lambda registry=None: [])
        monkeypatch.setattr(scout_main, "_persist_items", lambda repo, items, attachments: len(items))
        monkeypatch.setattr(scout_main, "_prune_old_items", fake_prune)
        monkeypatch.setattr(scout_main, "_load_recent_unmapped", lambda repo, days=14: [])
        monkeypatch.setattr(scout_main, "_file_ideas", lambda repo, candidates: 0)
        summary = scout_main.run_scout_worker(object(), FakeLiveRepo())
        assert summary["items_pruned"] == 42
        assert len(pruned_with) == 1
