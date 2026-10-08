"""The daily read: engine-computed session facts, one message per session at the reader's hour, honest ledger, bounded spend."""
from __future__ import annotations

from datetime import date, datetime, time as clock_time, timedelta, timezone
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest

import workers.stock_scanner.daily_read as dr
from workers.stock_scanner.config import Settings
from workers.stock_scanner.telegram import TelegramResult

NY = ZoneInfo("America/New_York")
SYDNEY = ZoneInfo("Australia/Sydney")
UTC = timezone.utc


def _settings(**overrides) -> Settings:
    base = dict(
        supabase_url="https://example.supabase.co",
        supabase_service_role_key="service-key",
        telegram_bot_token="",
        telegram_chat_id="",
        market_data_provider="yfinance",
        ticker_symbols=(),
        default_timeframe="1h",
        lookback_period_days=180,
        alert_score_threshold=75,
        watchlist_score_threshold=60,
        signal_change_threshold=8,
        enable_telegram_alerts=True,
        enable_watchlist_alerts=False,
        enable_hourly_digest=False,
        enable_market_hours_guard=False,
        force_scan=False,
        default_user_id="user-1",
        enable_daily_read=True,
    )
    base.update(overrides)
    return Settings(**base)


def _ny(day: str, hour: int, minute: int = 30) -> datetime:
    return datetime.fromisoformat(f"{day}T{hour:02d}:{minute:02d}:00").replace(tzinfo=NY).astimezone(UTC)


DAY = "2026-10-06"
PRIOR = "2026-10-05"
HOURS = [9, 10, 11, 12, 13, 14, 15]


def _row(symbol, category, closes, scores, statuses, *, prior_score=50.0, prior_status="no_signal", prior_closes=(100.0, 99.0), day=DAY, hours=HOURS):
    """closes/scores/statuses: one per session bar, oldest first. prior_closes: (15:30, 14:30) of the prior session."""
    signals = [
        {"candle_time": _ny(day, hour).isoformat(), "signal_score": score, "signal_status": status, "volume_ratio": 1.0}
        for hour, score, status in zip(hours, scores, statuses)
    ]
    signals.append({"candle_time": _ny(PRIOR, 15).isoformat(), "signal_score": prior_score, "signal_status": prior_status, "volume_ratio": 1.0})
    candles = [{"candle_time": _ny(day, hour).isoformat(), "close": close} for hour, close in zip(hours, closes)]
    candles += [{"candle_time": _ny(PRIOR, 15).isoformat(), "close": prior_closes[0]}, {"candle_time": _ny(PRIOR, 14).isoformat(), "close": prior_closes[1]}]
    return {"symbol": symbol, "company_name": symbol, "category": category, "stock_signals": list(reversed(signals)), "stock_candles": list(reversed(candles))}


def _universe():
    flat7 = ["no_signal"] * 7
    return [
        # NVDA: opens +2% then grinds to +4% on the day, becomes strong at the close (prior 50 -> 82)
        _row("NVDA", "semiconductor", [102, 102.5, 103, 103, 103.5, 104, 104], [55, 58, 60, 65, 70, 72, 82], flat7[:6] + ["strong_setup"]),
        # AMD: was strong (77), invalidated at 11:30 and never came back: closes -3% at no signal
        _row("AMD", "semiconductor", [99, 98.5, 55 and 98, 97.5, 97, 97, 97], [77, 70, 40, 42, 45, 45, 45], ["strong_setup", "watchlist_setup", "invalidated", "no_signal", "no_signal", "no_signal", "no_signal"], prior_score=77.0, prior_status="strong_setup"),
        # SNOW: invalidated mid-session but strong again by the close - not "still out"
        _row("SNOW", "software", [101, 100, 99, 99, 100, 101, 101], [80, 50, 40, 60, 70, 76, 80], ["strong_setup", "invalidated", "no_signal", "watchlist_setup", "watchlist_setup", "strong_setup", "strong_setup"], prior_score=80.0, prior_status="strong_setup"),
        # GAPPY: scored only through 13:30 - on the session, but not through to its last bar
        _row("GAPPY", "software", [100, 100, 100, 100, 100], [30, 30, 30, 30, 30], ["no_signal"] * 5, hours=HOURS[:5]),
        # OLD: last scored on the prior session
        _row("OLD", "software", [10.0], [55], ["no_signal"], day=PRIOR, hours=[15], prior_closes=(10.0, 10.0)),
    ]


def test_session_facts_come_from_the_rows():
    facts = dr.build_facts(_universe(), _settings())
    assert facts is not None
    assert facts.session == date(2026, 10, 6) and facts.close_bar == _ny(DAY, 15) and facts.bars == 7 and facts.complete
    assert facts.scored == 5 and len(facts.tickers) == 3  # OLD is on the prior session; GAPPY was not scored through to the close
    by = {t.symbol: t for t in facts.tickers}
    assert "GAPPY" not in by
    assert round(by["NVDA"].day_pct, 2) == 4.0 and round(by["NVDA"].open_pct, 2) == 2.0 and round(by["NVDA"].late_pct, 2) == 1.96
    assert round(by["AMD"].day_pct, 2) == -3.0 and round(by["AMD"].open_pct, 2) == -1.0
    assert (facts.up, facts.down, facts.flat) == (2, 1, 0)
    assert (facts.open_up, facts.open_down) == (2, 1)
    assert (facts.late_up, facts.late_down) == (1, 1)  # NVDA on, AMD off, SNOW flat (101 -> 101)
    assert [t.symbol for t in facts.leaders] == ["NVDA", "SNOW"] and [t.symbol for t in facts.laggards] == ["AMD"]
    assert round(facts.median_day_pct, 6) == 1.0
    assert facts.status_counts == {"strong_setup": 2, "no_signal": 1}
    assert (facts.prior_strong, facts.prior_watch) == (2, 0)
    assert [t.symbol for t in facts.newly_strong] == ["NVDA"]
    assert [t.symbol for t in facts.lost_strong] == ["AMD"]
    assert [t.symbol for t in facts.invalidated] == ["AMD"], "SNOW failed mid-session but was strong again at the close"
    assert [t.symbol for t in facts.score_risers] == ["NVDA"] and [t.symbol for t in facts.score_fallers] == ["AMD"]
    assert facts.groups == []


def test_partial_session_is_labelled():
    rows = [_row("NVDA", "semiconductor", [102, 103], [50, 50], ["no_signal"] * 2, hours=HOURS[:2])]
    facts = dr.build_facts(rows, _settings())
    assert facts.bars == 2 and not facts.complete
    assert "only the first 2 hourly bars" in dr.build_sheet(facts).text
    message = dr.compose_message(facts, None, month_to_date=0, budget=10, reader_zone=SYDNEY)
    assert "US session of Tue 6 Oct (first 2 bars only)" in message


def test_sheet_registers_every_figure_with_its_owner():
    facts = dr.build_facts(_universe(), _settings())
    sheet = dr.build_sheet(facts)
    assert "4.0%" in sheet.by_symbol["NVDA"] and sheet.directions[("NVDA", "4.0%")] == {1}
    assert "3.0%" in sheet.by_symbol["AMD"] and sheet.directions[("AMD", "3.0%")] == {-1}
    assert "82" in sheet.by_symbol["NVDA"] and "50" in sheet.by_symbol["NVDA"]
    assert {"3", "7", "2", "1"} <= sheet.general_figures  # names scanned, bars, breadth
    assert "full US session of 7 hourly bars" in sheet.text
    assert "No setup changed status" not in sheet.text


def test_holdings_list_every_position_and_watchlist_only_triggers():
    facts = dr.build_facts(_universe(), _settings())
    close = _ny(DAY, 15).isoformat()
    positions = [{"symbol": "NVDA"}, {"symbol": "AMD"}, {"symbol": "QQQ"}]
    overlays = [
        {"symbol": "NVDA", "candle_time": close, "unrealised_pl": 100.0, "unrealised_pl_pct": 10.0, "market_value": 1100.0},
        {"symbol": "NVDA", "candle_time": close, "unrealised_pl": -50.0, "unrealised_pl_pct": -5.0, "market_value": 950.0},
        {"symbol": "AMD", "candle_time": close, "unrealised_pl": -20.0, "unrealised_pl_pct": -2.5, "market_value": 780.0},
    ]
    lines = {line.symbol: line for line in dr.holdings_facts(positions, overlays, facts)}
    assert list(lines) == ["AMD", "NVDA", "QQQ"]
    assert lines["NVDA"].sheet_text() == "NVDA: up 4.0% on the session, score 82 at the close (strong setup), position up 2.5% overall"
    assert lines["NVDA"].reader_text() == "NVDA +4.0% session · score 82 strong setup · position +2.5%"
    assert lines["QQQ"].reader_text() == "QQQ · not scanned" and lines["QQQ"].sheet_text() == "QQQ: not covered by the scan"
    everything = " ".join(line.sheet_text() + line.reader_text() for line in lines.values())
    assert "$" not in everything and "1100" not in everything
    watch = dr.watchlist_facts(
        [{"symbol": "SNOW"}, {"symbol": "NVDA"}],
        [
            {"symbol": "SNOW", "candle_time": close, "watchlist_trigger_state": "triggered"},
            {"symbol": "NVDA", "candle_time": close, "watchlist_trigger_state": "not_ready"},
            {"symbol": "AMD", "candle_time": close, "watchlist_trigger_state": "triggered"},  # not on the list
        ],
        facts,
    )
    assert [line.reader_text() for line in watch] == ["SNOW triggered · score 80 strong setup"]


def test_macro_only_for_the_sessions_own_snapshot():
    payload = {"us_session_date": DAY, "sp500_change_pct": 0.66, "nasdaq_change_pct": 1.05, "vix_price": 15.31, "yield_10y": 5.311, "audusd_price": 0.6984, "fear_greed_index": 70}
    macro = dr.macro_for_session({"captured_at": "x", "payload": payload}, date(2026, 10, 6))
    assert dr.macro_text(macro) == "S&P 500 up 0.7% on the session, Nasdaq up 1.1% on the session, VIX at 15.3, US 10-year yield 5.31%, AUD/USD 0.6984"
    assert dr.macro_for_session({"captured_at": "x", "payload": {**payload, "us_session_date": PRIOR}}, date(2026, 10, 6)) == {}
    assert dr.macro_for_session({"captured_at": "x", "payload": {"sp500_change_pct": 0.9}}, date(2026, 10, 6)) == {}
    assert dr.macro_for_session(None, date(2026, 10, 6)) == {}


def test_send_time_and_quiet_hours_in_the_readers_clock():
    assert dr.parse_clock("20:00", clock_time(0, 0)) == clock_time(20, 0)
    assert dr.parse_clock("7:30", clock_time(0, 0)) == clock_time(7, 30)
    assert dr.parse_clock("nonsense", clock_time(20, 0)) == clock_time(20, 0)
    assert dr.due(datetime(2026, 10, 7, 20, 5, tzinfo=SYDNEY), clock_time(20, 0))
    assert dr.due(datetime(2026, 10, 7, 23, 59, tzinfo=SYDNEY), clock_time(20, 0))
    assert not dr.due(datetime(2026, 10, 7, 19, 55, tzinfo=SYDNEY), clock_time(20, 0))
    assert not dr.quiet_now("22-7", datetime(2026, 10, 7, 20, 5, tzinfo=SYDNEY))
    assert dr.quiet_now("22-7", datetime(2026, 10, 7, 2, 0, tzinfo=SYDNEY))
    assert not dr.quiet_now("off", datetime(2026, 10, 7, 2, 0, tzinfo=SYDNEY))


def test_cost_is_list_price_or_dearer_and_sums_fallback_attempts():
    assert dr.cost_usd("claude-opus-5-5", 1_000_000, 1_000_000) == 24.0
    assert dr.cost_usd("some-new-model", 1_000_000, 0) == 10.0
    plain = SimpleNamespace(input_tokens=1000, output_tokens=500, cache_creation_input_tokens=0, cache_read_input_tokens=0, iterations=None)
    assert dr.billable_tokens(plain) == (1000, 500)
    with_fallback = SimpleNamespace(
        input_tokens=1000, output_tokens=500, cache_creation_input_tokens=400, cache_read_input_tokens=100,
        iterations=[SimpleNamespace(type="message", input_tokens=1000, output_tokens=50), SimpleNamespace(type="fallback_message", input_tokens=1000, output_tokens=500)],
    )
    assert dr.billable_tokens(with_fallback) == (2000, 550)


def test_effort_steps_down_only_when_the_measured_cost_would_not_last_the_month():
    now = datetime(2026, 10, 7, 9, 0, tzinfo=UTC)  # 18 weekdays left in October incl. today
    cheap = [{"started_at": now.isoformat(), "status": "success", "payload": {"ai": True, "effort": "high", "cost_usd": 0.04}}] * 3
    assert dr.choose_effort("high", cheap, 10.0, now) == "high"
    dear = [{"started_at": now.isoformat(), "status": "success", "payload": {"ai": True, "effort": "high", "cost_usd": 0.6}}] * 3
    assert dr.choose_effort("high", dear, 10.0, now) == "medium"  # 1.8 spent, 18 x 0.6 = 10.8 needed
    assert dr.choose_effort("high", [], 10.0, now) == "high"
    assert dr.choose_effort("low", dear, 10.0, now) == "low"
    assert dr.choose_effort("silly", dear, 10.0, now) == "high"
    assert dr.weekdays_remaining(date(2026, 10, 31)) == 0 and dr.weekdays_remaining(date(2026, 10, 30)) == 1


def test_message_layout_is_sectioned_html():
    facts = dr.build_facts(_universe(), _settings())
    facts.macro = {"sp500_change_pct": 0.66, "vix_price": 15.0}
    facts.holdings = dr.holdings_facts([{"symbol": "NVDA"}, {"symbol": "QQQ"}], [], facts)
    narration = dr.Narration("NVDA led, up 4.0% on the session.\n\nAMD dropped out of strong setup.", "claude-opus-5-5", "high", 2000, 1500, 0.038)
    message = dr.compose_message(facts, narration, month_to_date=0.07, budget=10, reader_zone=SYDNEY)
    assert message.startswith("📈 <b>Lyra daily read</b>\nUS session of Tue 6 Oct\nClosed 7:00am Sydney, Wed 7 Oct\n\n🧠 <b>The read</b>\nNVDA led, up 4.0% on the session.\n\nAMD dropped out of strong setup.")
    assert "🌐 <b>Market</b>\nS&amp;P 500 up 0.7% · VIX at 15.0" in message
    assert "📊 <b>Session · 3 names</b>\n🟢 2 up · 🔴 1 down · median +1.0%\nFirst hour: 2 up · 1 down → then 1 up · 1 down into the close\n🚀 NVDA +4.0% · SNOW +1.0%\n🐌 AMD -3.0%" in message
    assert "🎯 <b>Setups at the close · 2 strong · 0 on watch</b>\nPrevious close: 2 strong · 0 on watch\n⬆️ New strong: NVDA\n⬇️ Left strong: AMD\n❌ Invalidated: AMD\n📈 Score up: NVDA 50→82\n📉 Score down: AMD 77→45" in message
    assert "💼 <b>Your book</b>\nNVDA +4.0% session · score 82 strong setup\nQQQ · not scanned" in message
    assert message.endswith("🤖 Claude Opus 5.5 at high effort · $0.038 this read · $0.07 of $10 this month\nResearch, not advice.")
    figures_only = dr.compose_message(facts, dr.Narration(None, "claude-opus-5-5", "high", note="no Anthropic API key is configured", reason="no_key"), month_to_date=0, budget=10, reader_zone=SYDNEY)
    assert "<b>The read</b>" not in figures_only and figures_only.endswith("🤖 Figures only today - no Anthropic API key is configured.\nResearch, not advice.")


# ------------------------------------------------------------------------------------------
# run(): the whole loop against a fake database.


class _FakeQuery:
    def __init__(self, db, table):
        self.db, self.table_name, self.filters, self._update, self._insert = db, table, {}, None, None

    def select(self, *_a, **_k):
        return self

    def eq(self, column, value):
        self.filters[column] = value
        return self

    def in_(self, column, values):
        self.filters[column] = tuple(values)
        return self

    def gte(self, *_a, **_k):
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def insert(self, row):
        self._insert = row
        return self

    def update(self, row, **_k):
        self._update = row
        return self

    def execute(self):
        if self._update is not None:
            # An update lands on the row of ITS table with the filtered id (the run ledger, a
            # briefing subscriber's delivery stamp); every write is also logged for the asserts.
            for row in self.db.get(self.table_name, []):
                if row.get("id") == self.filters.get("id"):
                    row.update(self._update)
            self.db["writes"].append(dict(self._update))
            return SimpleNamespace(data=[])
        if self._insert is not None:
            row = {"id": f"run-{len(self.db['stock_scanner_runs']) + 1}", **self._insert}
            self.db["stock_scanner_runs"].append(row)
            return SimpleNamespace(data=[row])
        rows = self.db.get(self.table_name, [])
        if self.table_name == "stock_scanner_runs":
            wanted = self.filters.get("job_name")
            rows = [r for r in rows if r.get("job_name") in (wanted if isinstance(wanted, tuple) else (wanted,))]
        return SimpleNamespace(data=rows)


class _FakeClient:
    def __init__(self, db):
        self.db = db

    def table(self, name):
        return _FakeQuery(self.db, name)


@pytest.fixture
def harness(monkeypatch):
    db = {
        "stock_tickers": _universe(),
        "stock_scanner_runs": [],
        "market_context_snapshots": [],
        "portfolio_signal_overlay": [],
        "watchlist_signal_overlay": [],
        "portfolio_positions": [],
        "watchlist_items": [],
        "writes": [],
    }
    sent: list[dict] = []
    calls: list[dict] = []
    monkeypatch.setattr(dr, "load_settings", lambda: _settings())
    monkeypatch.setattr(dr, "SupabaseRepository", lambda settings: SimpleNamespace(client=_FakeClient(db), create_run=lambda job, tf: _FakeQuery(db, "stock_scanner_runs").insert({"job_name": job, "timeframe": tf, "status": "running"}).execute().data[0]["id"]))
    monkeypatch.setattr(dr.time, "sleep", lambda *_: None)

    def fake_narrate(sheet, *, model, effort):
        calls.append({"model": model, "effort": effort, "facts": sheet.text})
        return dr.Narration("NVDA led, up 4.0% on the session.\n\nAMD dropped out of strong setup.", model, effort, 2000, 1500, 0.038)

    monkeypatch.setattr(dr, "narrate", fake_narrate)

    def fake_send(message, settings, chat_id=None, *, silent=False, parse_mode=None):
        sent.append({"message": message, "chat_id": chat_id, "silent": silent, "token": settings.telegram_bot_token, "parse_mode": parse_mode})
        return db.get("telegram_result") or TelegramResult(sent_status="sent")

    monkeypatch.setattr(dr, "send_telegram_message", fake_send)
    for name, value in {"SUMMARY_TELEGRAM_BOT_TOKEN": "bot-token", "SUMMARY_TELEGRAM_CHAT_ID": "chat-1", "ANTHROPIC_API_KEY": "sk-test", "SUMMARY_TIMEZONE": "Australia/Sydney"}.items():
        monkeypatch.setenv(name, value)
    for name in ("SUMMARY_FORCE", "SUMMARY_MODEL", "SUMMARY_EFFORT", "SUMMARY_MONTHLY_BUDGET_USD", "SUMMARY_QUIET_HOURS", "SUMMARY_SEND_AT"):
        monkeypatch.delenv(name, raising=False)
    return SimpleNamespace(db=db, sent=sent, calls=calls)


EVENING = datetime(2026, 10, 7, 20, 5, tzinfo=SYDNEY).astimezone(UTC)  # 20:05 AEDT = 09:05 UTC, the first cron
EARLY = datetime(2026, 10, 7, 19, 5, tzinfo=SYDNEY).astimezone(UTC)  # what the 09:05 UTC cron is during AEST


def test_run_sends_once_per_session_at_or_after_the_readers_hour(harness):
    assert dr.run(now=EARLY) == 0
    assert harness.sent == [] and harness.calls == [] and harness.db["stock_scanner_runs"] == [], "19:05 local is before the send time"

    assert dr.run(now=EVENING) == 0
    assert len(harness.sent) == 1 and len(harness.calls) == 1
    message = harness.sent[0]["message"]
    assert message.startswith("📈 <b>Lyra daily read</b>\nUS session of Tue 6 Oct\nClosed 7:00am Sydney, Wed 7 Oct")
    assert "🧠 <b>The read</b>\nNVDA led, up 4.0% on the session.\n\nAMD dropped out of strong setup." in message
    assert harness.sent[0]["silent"] is False and harness.sent[0]["parse_mode"] == "HTML" and harness.sent[0]["chat_id"] == "chat-1"
    assert harness.calls[0] == {"model": "claude-opus-5-5", "effort": "high", "facts": harness.calls[0]["facts"]}
    run_row = harness.db["stock_scanner_runs"][0]
    assert run_row["status"] == "success" and run_row["alerts_sent"] == 1
    assert run_row["payload"]["session"] == DAY and run_row["payload"]["bars"] == 7 and run_row["payload"]["cost_usd"] == 0.038
    assert harness.db["writes"][0]["status"] == "running" and harness.db["writes"][0]["payload"]["session"] is None, "spend is on the ledger before the send"

    # the second cron an hour later: the session is already on the ledger
    assert dr.run(now=EVENING + timedelta(hours=1)) == 0
    assert len(harness.sent) == 1 and len(harness.calls) == 1 and len(harness.db["stock_scanner_runs"]) == 1


def test_run_honours_a_different_send_time_and_force(harness, monkeypatch):
    monkeypatch.setenv("SUMMARY_SEND_AT", "07:30")
    assert dr.run(now=datetime(2026, 10, 7, 7, 20, tzinfo=SYDNEY).astimezone(UTC)) == 0 and harness.sent == []
    assert dr.run(now=datetime(2026, 10, 7, 7, 35, tzinfo=SYDNEY).astimezone(UTC)) == 0 and len(harness.sent) == 1
    monkeypatch.setenv("SUMMARY_FORCE", "true")
    assert dr.run(now=datetime(2026, 10, 7, 2, 0, tzinfo=SYDNEY).astimezone(UTC)) == 0
    assert len(harness.sent) == 2 and harness.sent[1]["silent"] is True, "a forced read at 2am is still silent"
    assert "$0.08 of $10 this month" in harness.sent[1]["message"]


def test_run_sends_the_figures_when_the_ai_cannot_run(harness, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY")
    assert dr.run(now=EVENING) == 0
    assert harness.calls == []
    message = harness.sent[0]["message"]
    assert "🤖 Figures only today - no Anthropic API key is configured." in message and "<b>The read</b>" not in message
    assert harness.db["stock_scanner_runs"][0]["payload"]["reason"] == "no_key"


def test_run_counts_the_hourly_reads_spend_and_stops_at_the_budget(harness, monkeypatch):
    harness.db["stock_scanner_runs"].append(
        {"id": "old", "job_name": "hourly_summary", "status": "success", "started_at": (EVENING - timedelta(days=1)).isoformat(), "payload": {"bar": "x", "cost_usd": 9.97, "ai": True, "effort": "high"}}
    )
    assert dr.run(now=EVENING) == 0
    assert len(harness.calls) == 1 and "$10.01 of $10 this month" in harness.sent[0]["message"]
    harness.db["stock_tickers"] = [r for r in harness.db["stock_tickers"]]  # same session, but force a new read
    monkeypatch.setenv("SUMMARY_FORCE", "true")
    assert dr.run(now=EVENING + timedelta(minutes=5)) == 0
    assert len(harness.calls) == 1, "over budget: no model call"
    assert "this month's $10 AI budget is used up" in harness.sent[1]["message"]


def test_run_pages_when_telegram_fails_and_retries_the_session(harness):
    harness.db["telegram_result"] = TelegramResult(sent_status="failed", error_message="Telegram API HTTP 502")
    assert dr.run(now=EVENING) == 1
    row = harness.db["stock_scanner_runs"][0]
    assert row["status"] == "failed" and row["payload"]["session"] is None and row["error_message"] == "Telegram API HTTP 502"
    assert row["payload"]["cost_usd"] == 0.038, "the model call is still paid for and still on the ledger"
    harness.db["telegram_result"] = TelegramResult(sent_status="sent")
    assert dr.run(now=EVENING + timedelta(hours=1)) == 0
    assert len(harness.sent) == 2 and harness.db["stock_scanner_runs"][1]["payload"]["session"] == DAY


def test_run_waits_when_most_names_are_not_on_the_newest_session(harness):
    for row in harness.db["stock_tickers"][1:]:
        for signal in row["stock_signals"]:
            signal["candle_time"] = _ny(PRIOR, 15).isoformat()
    assert dr.run(now=EVENING) == 0
    assert harness.sent == [] and harness.calls == []


def test_run_noops_without_feature_flag_or_telegram(harness, monkeypatch):
    monkeypatch.setattr(dr, "load_settings", lambda: _settings(enable_daily_read=False))
    assert dr.run(now=EVENING) == 0 and harness.sent == []
    monkeypatch.setattr(dr, "load_settings", lambda: _settings())
    monkeypatch.delenv("SUMMARY_TELEGRAM_CHAT_ID")
    assert dr.run(now=EVENING) == 0 and harness.sent == []


def test_run_includes_the_book_and_the_sessions_macro(harness):
    close = _ny(DAY, 15).isoformat()
    harness.db["market_context_snapshots"] = [{"captured_at": EVENING.isoformat(), "payload": {"us_session_date": DAY, "sp500_change_pct": 0.5, "vix_price": 16.0}}]
    harness.db["portfolio_positions"] = [{"symbol": "NVDA"}, {"symbol": "QQQ"}]
    harness.db["watchlist_items"] = [{"symbol": "SNOW"}]
    harness.db["portfolio_signal_overlay"] = [{"symbol": "NVDA", "candle_time": close, "unrealised_pl": 10.0, "unrealised_pl_pct": 5.0, "market_value": 210.0}]
    harness.db["watchlist_signal_overlay"] = [{"symbol": "SNOW", "candle_time": close, "watchlist_trigger_state": "approaching"}]
    assert dr.run(now=EVENING) == 0
    facts_text = harness.calls[0]["facts"]
    assert "S&P 500 up 0.5% on the session, VIX at 16.0" in facts_text
    assert "NVDA: up 4.0% on the session, score 82 at the close (strong setup), position up 5.0% overall; QQQ: not covered by the scan" in facts_text
    assert "SNOW: approaching on the reader's watchlist, score 80 at the close (strong setup)" in facts_text
    message = harness.sent[0]["message"]
    assert "🌐 <b>Market</b>\nS&amp;P 500 up 0.5% · VIX at 16.0" in message
    assert "💼 <b>Your book</b>\nNVDA +4.0% session · score 82 strong setup · position +5.0%\nQQQ · not scanned\n🔔 SNOW approaching · score 80 strong setup" in message


# ------------------------------------------------------------------------------------------
# The column manifest the schema gate reads must be what the code actually names.


class _RecordingQuery:
    def __init__(self, log, table):
        self.log, self.table_name = log, table

    def _col(self, name, foreign_table=None):
        if "." in name:
            table, column = name.split(".", 1)
            self.log.setdefault(table, set()).add(column)
        else:
            self.log.setdefault(foreign_table or self.table_name, set()).add(name)
        return self

    def select(self, columns, *_a, **_k):
        depth, current, table = 0, "", self.table_name
        for char in columns + ",":
            if char == "(":
                table, current, depth = current.strip(), "", depth + 1
            elif char == ")":
                self._note(table, current)
                current, depth, table = "", depth - 1, self.table_name
            elif char == ",":
                self._note(table, current)
                current = ""
            else:
                current += char
        return self

    def _note(self, table, item):
        item = item.strip()
        if not item:
            return
        column = item.split(":", 1)[1] if ":" in item else item
        column = column.split("->", 1)[0].strip()
        if column:
            self.log.setdefault(table, set()).add(column)

    def eq(self, column, _value):
        return self._col(column)

    def in_(self, column, _values):
        return self._col(column)

    def gte(self, column, _value):
        return self._col(column)

    def order(self, column, *, desc=False, foreign_table=None):
        return self._col(column, foreign_table)

    def limit(self, *_a, **_k):
        return self

    def update(self, row, **_k):
        for key in row:
            self.log.setdefault(self.table_name, set()).add(key)
        return self

    def execute(self):
        return SimpleNamespace(data=[])


class _RecordingClient:
    def __init__(self):
        self.log = {}

    def table(self, name):
        return _RecordingQuery(self.log, name)


def test_every_column_the_code_names_is_in_the_manifest():
    client = _RecordingClient()
    dr.newest_session(client, "1h")
    dr.load_universe(client, "1h")
    dr._universe_query(client, "1h", dr._SIGNAL_SELECT_FULL, dr.SIGNALS_PER_TICKER, dr.CANDLES_PER_TICKER).execute()
    dr.load_read_runs(client, EVENING)
    dr.load_market_snapshot(client)
    dr.load_overlays(client, "portfolio_signal_overlay", "symbol,candle_time,unrealised_pl,unrealised_pl_pct,market_value", "user-1", EVENING)
    dr.load_overlays(client, "watchlist_signal_overlay", "symbol,candle_time,watchlist_trigger_state", "user-1", EVENING)
    dr.load_active(client, "portfolio_positions", "user-1")
    dr.load_active(client, "watchlist_items", "user-1")
    dr._record(client, "run-1", "success", {}, delivered=True)
    # The AI briefing (ai_briefing.py) shares this manifest; its reads count towards the same check.
    import workers.stock_scanner.ai_briefing as ab

    ab.load_briefing_runs(client, EVENING)
    ab.load_universe_symbols(client)
    ab.load_user_ids(client, SimpleNamespace(load_active_user_ids=lambda: []), "user-1")
    # The subscribe-by-link audience (briefing_subscribers.py) reads and stamps its own table.
    import workers.stock_scanner.briefing_subscribers as bs

    bs.load_subscribers(client)
    subscriber = bs.Subscriber(id="sub-1", token="t", channel="telegram", email="", chat_id="1", topics=(), holdings=())
    bs.mark_sent(client, subscriber, date(2026, 10, 7))
    bs.mark_failed(client, subscriber, "Telegram API HTTP 400")
    bs.mark_unsubscribed(client, subscriber, "blocked")
    named = {table: columns - {"id", "finished_at", "alerts_sent", "error_message"} for table, columns in client.log.items()}
    missing = {table: sorted(columns - set(dr.COLUMNS.get(table, []))) for table, columns in named.items()}
    missing = {table: columns for table, columns in missing.items() if columns}
    assert missing == {}, f"named in code but not in summary_columns.json: {missing}"
    assert set(named) == set(dr.COLUMNS), "the manifest lists a table neither the read nor the briefing reads"
