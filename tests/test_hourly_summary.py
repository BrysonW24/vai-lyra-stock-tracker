"""The hourly read: engine-computed facts, one message per completed bar, honest ledger, bounded spend."""
from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest

import workers.stock_scanner.hourly_summary as hs
from workers.stock_scanner.config import Settings
from workers.stock_scanner.telegram import TelegramResult

NY = ZoneInfo("America/New_York")
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
        enable_hourly_digest=True,
        enable_market_hours_guard=False,
        force_scan=False,
        default_user_id="user-1",
    )
    base.update(overrides)
    return Settings(**base)


def _ny(day: str, hour: int, minute: int = 30) -> datetime:
    return datetime.fromisoformat(f"{day}T{hour:02d}:{minute:02d}:00").replace(tzinfo=NY).astimezone(UTC)


def _row(symbol, category, bar, score, previous, status, closes, *, volume_ratio=1.0):
    """closes: list of (candle_time, close), newest first."""
    return {
        "symbol": symbol,
        "company_name": symbol,
        "category": category,
        "stock_signals": [
            {
                "candle_time": bar.isoformat(),
                "signal_score": score,
                "previous_signal_score": previous,
                "signal_status": status,
                "volume_ratio": volume_ratio,
            }
        ],
        "stock_candles": [{"candle_time": when.isoformat(), "close": close} for when, close in closes],
    }


DAY = "2026-10-02"
PRIOR = "2026-10-01"
BAR = _ny(DAY, 11)  # 11:30-12:30 New York


def _session(day: str, upto_hour: int, base: float, step: float):
    """Hourly closes for one session up to `upto_hour`, newest first, rising by `step` a bar."""
    bars = []
    for hour in range(9, upto_hour + 1):
        bars.append((_ny(day, hour), base + step * (hour - 9)))
    return list(reversed(bars))


def _universe():
    nvda = _session(DAY, 11, 100.0, 1.0) + [(_ny(PRIOR, 15), 98.0), (_ny(PRIOR, 14), 97.0)]  # 102 vs 101: +0.99%, day vs 98: +4.08%
    amd = _session(DAY, 11, 50.0, -0.5) + [(_ny(PRIOR, 15), 51.0), (_ny(PRIOR, 14), 50.5)]  # 49 vs 49.5: -1.01%
    snow = _session(DAY, 11, 200.0, 0.0) + [(_ny(PRIOR, 15), 200.0)]  # flat
    # GAPPY has no 10:30 bar: its "previous" candle is 9:30, which is not the universe's reference bar
    gappy = [(_ny(DAY, 11), 30.0), (_ny(DAY, 9), 20.0), (_ny(PRIOR, 15), 25.0)]
    return [
        _row("NVDA", "semiconductor", BAR, 82, 70, "strong_setup", nvda, volume_ratio=3.5),
        _row("AMD", "semiconductor", BAR, 40, 77, "invalidated", amd),
        _row("SNOW", "software", BAR, 65, 40, "watchlist_setup", snow),
        _row("GAPPY", "software", BAR, 30, 50, "weakening", gappy),
        _row("OLD", "software", _ny(PRIOR, 15), 55, 55, "no_signal", [(_ny(PRIOR, 15), 10.0)]),
    ]


def test_facts_come_from_the_rows_and_the_universe_agrees_on_reference_bars():
    facts = hs.build_facts(_universe(), _settings())
    assert facts is not None
    assert facts.bar == BAR and facts.bar_end == BAR + timedelta(hours=1)
    assert not facts.first_bar_of_session and not facts.closing_bar
    assert facts.scored == 5 and len(facts.tickers) == 4  # OLD is not on this bar
    by = {t.symbol: t for t in facts.tickers}
    assert round(by["NVDA"].hour_pct, 2) == 0.99 and round(by["NVDA"].day_pct, 2) == 4.08
    assert round(by["AMD"].hour_pct, 2) == -1.01
    assert by["SNOW"].hour_pct == 0.0
    assert by["GAPPY"].hour_pct is None, "a two-hour span must not be reported as a one-hour move"
    assert round(by["GAPPY"].day_pct, 6) == 20.0  # its prior-session bar is the shared one, so the day move stands
    assert (facts.up, facts.down, facts.flat) == (1, 1, 1)
    assert facts.previous_breadth == (1, 1)  # NVDA up, AMD down over the 10:30 bar; SNOW flat
    assert [t.symbol for t in facts.leaders] == ["NVDA"] and [t.symbol for t in facts.laggards] == ["AMD"]
    assert facts.heavy_volume[0].symbol == "NVDA"
    assert facts.status_counts == {"strong_setup": 1, "invalidated": 1, "watchlist_setup": 1, "weakening": 1}
    assert [t.symbol for t in facts.newly_strong] == ["NVDA"]
    assert [t.symbol for t in facts.lost_strong] == ["AMD"] and [t.symbol for t in facts.invalidated] == ["AMD"]
    assert [t.symbol for t in facts.newly_watch] == ["SNOW"]
    assert [t.symbol for t in facts.weakening] == ["GAPPY"]
    assert (facts.previous_strong, facts.previous_watch) == (1, 1)  # AMD was strong, NVDA was on watch
    assert facts.groups == []  # no group has three names with a move


def test_first_bar_of_session_is_measured_from_the_prior_close():
    first = _ny(DAY, 9)
    rows = [
        _row("NVDA", "semiconductor", first, 50, 50, "no_signal", [(first, 103.0), (_ny(PRIOR, 15), 100.0), (_ny(PRIOR, 14), 99.0)]),
        _row("AMD", "semiconductor", first, 50, 50, "no_signal", [(first, 49.0), (_ny(PRIOR, 15), 50.0), (_ny(PRIOR, 14), 51.0)]),
    ]
    facts = hs.build_facts(rows, _settings())
    assert facts.first_bar_of_session
    assert facts.previous_breadth is None  # the previous "bar" was the prior session's close
    assert round(facts.tickers[0].hour_pct, 1) == 3.0
    sheet = hs.build_sheet(facts)
    assert "first bar of the US session" in sheet.text and "since the last close" in sheet.text
    assert "Since the last close" in hs.figure_lines(facts)[0]


def test_closing_bar_is_half_an_hour_and_says_so():
    close = _ny(DAY, 15)
    rows = [_row("NVDA", "semiconductor", close, 50, 50, "no_signal", [(close, 101.0), (_ny(DAY, 14), 100.0), (_ny(PRIOR, 15), 90.0)])]
    facts = hs.build_facts(rows, _settings())
    assert facts.closing_bar and facts.bar_end == _ny(DAY, 16, 0)
    assert "last half hour" in hs.build_sheet(facts).text
    message = hs.compose_message(facts, None, now=_ny(DAY, 16, 50), month_to_date=0, budget=10, reader_zone=ZoneInfo("Australia/Sydney"))
    assert message.startswith("Lyra - US tech, closing half hour 3:30pm-4:00pm New York, Fri 2 Oct")
    assert "Sydney" in message and "closed since" not in message


def test_coverage_guard_and_stale_label():
    facts = hs.build_facts(_universe(), _settings())
    assert hs.coverage(facts) == 0.8
    message = hs.compose_message(facts, None, now=BAR + timedelta(days=2), month_to_date=0, budget=10, reader_zone=ZoneInfo("Australia/Sydney"))
    assert "The latest completed bar - the market has been closed since." in message
    assert message.rstrip().endswith("Figures only this hour.\nResearch, not advice.")


def test_sheet_registers_every_figure_with_its_owner():
    facts = hs.build_facts(_universe(), _settings())
    sheet = hs.build_sheet(facts)
    assert "1.0%" in sheet.by_symbol["NVDA"] and "82" in sheet.by_symbol["NVDA"] and "70" in sheet.by_symbol["NVDA"]
    assert sheet.directions[("NVDA", "1.0%")] == {1}
    assert "1.0%" in sheet.by_symbol["AMD"] and sheet.directions[("AMD", "1.0%")] == {-1}
    assert {"4", "1", "0"} <= sheet.general_figures  # scanned, breadth
    assert "GAPPY" in sheet.text and "weakening" in sheet.text
    assert "No setup changed status" not in sheet.text


def test_holdings_combine_lots_on_cost_and_never_show_dollars():
    facts = hs.build_facts(_universe(), _settings())
    overlays = [
        {"symbol": "NVDA", "candle_time": BAR.isoformat(), "unrealised_pl": 100.0, "unrealised_pl_pct": 10.0, "market_value": 1100.0},
        {"symbol": "NVDA", "candle_time": BAR.isoformat(), "unrealised_pl": -50.0, "unrealised_pl_pct": -5.0, "market_value": 950.0},
        {"symbol": "NVDA", "candle_time": (BAR - timedelta(hours=1)).isoformat(), "unrealised_pl": 999.0, "unrealised_pl_pct": 99.0, "market_value": 1.0},
        {"symbol": "AMD", "candle_time": BAR.isoformat(), "unrealised_pl": -20.0, "unrealised_pl_pct": -2.5, "market_value": 780.0},
        {"symbol": "ZZZ", "candle_time": BAR.isoformat(), "unrealised_pl": 1.0, "unrealised_pl_pct": 1.0, "market_value": 10.0},
    ]
    lines = dict(hs.holdings_facts(overlays, facts))
    assert lines["NVDA"] == "NVDA: up 1.0% this bar, up 4.1% on the day, score 82 (strong setup), position up 2.5% overall"  # 50 / 2000
    assert lines["AMD"].endswith("position down 2.5% overall")
    assert lines["ZZZ"] == "ZZZ: not in this bar's scan"
    assert "$" not in " ".join(lines.values()) and "1100" not in " ".join(lines.values())


def test_watchlist_only_reports_names_at_or_near_a_trigger():
    facts = hs.build_facts(_universe(), _settings())
    overlays = [
        {"symbol": "SNOW", "candle_time": BAR.isoformat(), "watchlist_trigger_state": "triggered"},
        {"symbol": "NVDA", "candle_time": BAR.isoformat(), "watchlist_trigger_state": "not_ready"},
        {"symbol": "AMD", "candle_time": (BAR - timedelta(hours=1)).isoformat(), "watchlist_trigger_state": "approaching"},
        {"symbol": "AMD", "candle_time": BAR.isoformat(), "watchlist_trigger_state": "not_ready"},
    ]
    assert hs.watchlist_facts(overlays, facts) == [("SNOW", "SNOW: triggered (score 65, watchlist setup)")]


def test_macro_is_used_only_for_the_bars_own_session():
    payload = {"us_session_date": DAY, "sp500_change_pct": 0.734, "nasdaq_change_pct": 1.19, "vix_price": 15.31, "yield_10y": 5.277, "audusd_price": 0.6929, "fear_greed_index": 70, "regime": "neutral"}
    macro = hs.macro_for_bar({"captured_at": BAR.isoformat(), "payload": payload}, BAR)
    assert set(macro) == {"sp500_change_pct", "nasdaq_change_pct", "vix_price", "yield_10y", "audusd_price"}
    assert hs.macro_text(macro) == "S&P 500 up 0.7% on the day, Nasdaq up 1.2% on the day, VIX at 15.3, US 10-year yield 5.28%, AUD/USD 0.6929"
    assert hs.macro_for_bar({"captured_at": BAR.isoformat(), "payload": {**payload, "us_session_date": PRIOR}}, BAR) == {}
    assert hs.macro_for_bar({"captured_at": BAR.isoformat(), "payload": {"sp500_change_pct": 0.9}}, BAR) == {}, "snapshots without a session date are not guessed about"
    assert hs.macro_for_bar(None, BAR) == {}


def test_quiet_hours_wrap_midnight_in_the_readers_clock():
    sydney = ZoneInfo("Australia/Sydney")
    assert hs.quiet_now("22-7", datetime(2026, 10, 6, 2, 0, tzinfo=sydney))
    assert hs.quiet_now("22-7", datetime(2026, 10, 6, 23, 0, tzinfo=sydney))
    assert not hs.quiet_now("22-7", datetime(2026, 10, 6, 7, 0, tzinfo=sydney))
    assert not hs.quiet_now("22-7", datetime(2026, 10, 6, 12, 0, tzinfo=sydney))
    assert hs.quiet_now("9-17", datetime(2026, 10, 6, 12, 0, tzinfo=sydney))
    assert not hs.quiet_now("off", datetime(2026, 10, 6, 2, 0, tzinfo=sydney))
    assert not hs.quiet_now("", datetime(2026, 10, 6, 2, 0, tzinfo=sydney))
    assert not hs.quiet_now("nonsense", datetime(2026, 10, 6, 2, 0, tzinfo=sydney))


def test_cost_is_list_price_or_dearer_and_sums_fallback_attempts():
    assert hs.cost_usd("claude-opus-5-5", 1_000_000, 1_000_000) == 24.0
    assert hs.cost_usd("some-new-model", 1_000_000, 0) == 10.0, "an unknown model is priced at the dearest row"
    plain = SimpleNamespace(input_tokens=1000, output_tokens=500, cache_creation_input_tokens=0, cache_read_input_tokens=0, iterations=None)
    assert hs.billable_tokens(plain) == (1000, 500)
    cached = SimpleNamespace(input_tokens=1000, output_tokens=500, cache_creation_input_tokens=400, cache_read_input_tokens=100, iterations=None)
    assert hs.billable_tokens(cached) == (1600, 500)
    with_fallback = SimpleNamespace(
        input_tokens=1000,
        output_tokens=500,
        cache_creation_input_tokens=0,
        cache_read_input_tokens=0,
        iterations=[SimpleNamespace(type="message", input_tokens=1000, output_tokens=50), SimpleNamespace(type="fallback_message", input_tokens=1000, output_tokens=500)],
    )
    assert hs.billable_tokens(with_fallback) == (2000, 550)


def test_effort_steps_down_only_when_the_measured_cost_would_not_last_the_month():
    now = datetime(2026, 10, 6, 12, 0, tzinfo=UTC)  # 19 weekdays left in October incl. today -> 133 reads expected
    runs_cheap = [{"started_at": now.isoformat(), "status": "success", "payload": {"ai": True, "effort": "high", "cost_usd": 0.04}}] * 5
    assert hs.choose_effort("high", runs_cheap, 10.0, now) == "high"  # 0.2 spent, 133 x 0.04 = 5.3 needed
    runs_dear = [{"started_at": now.isoformat(), "status": "success", "payload": {"ai": True, "effort": "high", "cost_usd": 0.09}}] * 5
    assert hs.choose_effort("high", runs_dear, 10.0, now) == "medium"  # 0.45 spent, 133 x 0.09 = 12 needed
    assert hs.choose_effort("high", [], 10.0, now) == "high", "nothing measured yet runs the configured level"
    assert hs.choose_effort("low", runs_dear, 10.0, now) == "low"
    assert hs.choose_effort("silly", runs_dear, 10.0, now) == "high"
    assert hs.weekdays_remaining(datetime(2026, 10, 31).date()) == 0  # a Saturday
    assert hs.weekdays_remaining(datetime(2026, 10, 30).date()) == 1


# ------------------------------------------------------------------------------------------
# run(): the whole loop against a fake database.


class _FakeQuery:
    def __init__(self, db, table):
        self.db, self.table_name, self.filters, self._update = db, table, {}, None

    def select(self, *_a, **_k):
        return self

    def eq(self, column, value):
        self.filters[column] = value
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
            run_id = self.filters.get("id")
            for row in self.db["stock_scanner_runs"]:
                if row["id"] == run_id:
                    row.update(self._update)
            self.db["writes"].append(dict(self._update))
            return SimpleNamespace(data=[])
        if getattr(self, "_insert", None) is not None:
            row = {"id": f"run-{len(self.db['stock_scanner_runs']) + 1}", **self._insert}
            self.db["stock_scanner_runs"].append(row)
            return SimpleNamespace(data=[row])
        rows = self.db.get(self.table_name, [])
        if self.table_name == "stock_scanner_runs":
            rows = [r for r in rows if r.get("job_name") == self.filters.get("job_name")]
        self.db["reads"].append(self.table_name)
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
        "reads": [],
        "writes": [],
    }
    sent: list[dict] = []
    calls: list[dict] = []
    monkeypatch.setattr(hs, "load_settings", lambda: _settings())
    monkeypatch.setattr(hs, "SupabaseRepository", lambda settings: SimpleNamespace(client=_FakeClient(db), create_run=lambda job, tf: _FakeQuery(db, "stock_scanner_runs").insert({"job_name": job, "timeframe": tf, "status": "running"}).execute().data[0]["id"]))
    monkeypatch.setattr(hs.time, "sleep", lambda *_: None)

    def fake_narrate(sheet, *, model, effort):
        calls.append({"model": model, "effort": effort, "facts": sheet.text})
        return hs.Narration("NVDA led, up 1.0% on the bar. AMD lost its strong setup.", model, effort, 2000, 1200, 0.032)

    monkeypatch.setattr(hs, "narrate", fake_narrate)

    def fake_send(message, settings, chat_id=None, *, silent=False):
        sent.append({"message": message, "chat_id": chat_id, "silent": silent, "token": settings.telegram_bot_token})
        return db.get("telegram_result") or TelegramResult(sent_status="sent")

    monkeypatch.setattr(hs, "send_telegram_message", fake_send)
    for name, value in {
        "SUMMARY_TELEGRAM_BOT_TOKEN": "bot-token",
        "SUMMARY_TELEGRAM_CHAT_ID": "chat-1",
        "ANTHROPIC_API_KEY": "sk-test",
        "SUMMARY_TIMEZONE": "Australia/Sydney",
    }.items():
        monkeypatch.setenv(name, value)
    for name in ("SUMMARY_FORCE", "SUMMARY_MODEL", "SUMMARY_EFFORT", "SUMMARY_MONTHLY_BUDGET_USD", "SUMMARY_QUIET_HOURS"):
        monkeypatch.delenv(name, raising=False)
    return SimpleNamespace(db=db, sent=sent, calls=calls)


NOW = BAR + timedelta(minutes=80)  # the :47 firing after the bar completed, 03:50 Sydney


def test_run_sends_one_read_per_new_bar_and_records_the_bar_only_when_delivered(harness):
    assert hs.run(now=NOW) == 0
    assert len(harness.sent) == 1 and len(harness.calls) == 1
    message = harness.sent[0]["message"]
    assert message.startswith("Lyra - US tech, the hour 11:30am-12:30pm New York, Fri 2 Oct")
    assert "NVDA led, up 1.0% on the bar." in message
    assert "Read by Claude Opus 5.5 at high effort" in message and "$0.032 this read, $0.03 of $10 this month" in message
    assert harness.sent[0]["silent"] is True, "03:50 Sydney is inside the default quiet hours"
    assert harness.sent[0]["chat_id"] == "chat-1" and harness.sent[0]["token"] == "bot-token"
    assert harness.calls[0]["effort"] == "high" and harness.calls[0]["model"] == "claude-opus-5-5"
    run_row = harness.db["stock_scanner_runs"][0]
    assert run_row["status"] == "success" and run_row["alerts_sent"] == 1
    assert run_row["payload"]["bar"] == BAR.isoformat() and run_row["payload"]["cost_usd"] == 0.032
    assert run_row["payload"]["ai"] is True and run_row["payload"]["reason"] == "ok" and run_row["payload"]["silent"] is True
    # the spend was on the ledger before the send
    assert harness.db["writes"][0]["status"] == "running" and harness.db["writes"][0]["payload"]["cost_usd"] == 0.032 and harness.db["writes"][0]["payload"]["bar"] is None

    # the next firing sees the same bar: nothing sent, no model call, no new ledger row
    assert hs.run(now=NOW + timedelta(minutes=30)) == 0
    assert len(harness.sent) == 1 and len(harness.calls) == 1 and len(harness.db["stock_scanner_runs"]) == 1


def test_run_resends_when_forced_and_counts_the_month(harness, monkeypatch):
    assert hs.run(now=NOW) == 0
    monkeypatch.setenv("SUMMARY_FORCE", "true")
    assert hs.run(now=NOW + timedelta(minutes=30)) == 0
    assert len(harness.sent) == 2
    assert "$0.06 of $10 this month" in harness.sent[1]["message"]


def test_run_sends_the_figures_when_the_ai_cannot_run(harness, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY")
    assert hs.run(now=NOW) == 0
    message = harness.sent[0]["message"]
    assert harness.calls == []
    assert "Figures only this hour - no Anthropic API key is configured." in message
    assert "This hour (4 names): 1 up, 1 down, 1 flat" in message
    assert harness.db["stock_scanner_runs"][0]["payload"]["reason"] == "no_key"


def test_run_stops_calling_the_model_once_the_budget_is_spent(harness, monkeypatch):
    harness.db["stock_scanner_runs"].append(
        {"id": "old", "job_name": "hourly_summary", "status": "success", "started_at": (NOW - timedelta(days=1)).isoformat(), "payload": {"bar": (BAR - timedelta(hours=1)).isoformat(), "cost_usd": 10.0, "ai": True, "effort": "high"}}
    )
    monkeypatch.setenv("SUMMARY_MONTHLY_BUDGET_USD", "10")
    assert hs.run(now=NOW) == 0
    assert harness.calls == []
    assert "this month's $10 AI budget is used up" in harness.sent[0]["message"]


def test_run_pages_when_telegram_fails_and_leaves_the_bar_unrecorded(harness):
    harness.db["telegram_result"] = TelegramResult(sent_status="failed", error_message="Telegram API HTTP 502")
    assert hs.run(now=NOW) == 1
    run_row = harness.db["stock_scanner_runs"][0]
    assert run_row["status"] == "failed" and run_row["payload"]["bar"] is None and run_row["error_message"] == "Telegram API HTTP 502"
    assert run_row["payload"]["cost_usd"] == 0.032, "the model call is still paid for and still on the ledger"
    # the next firing retries the same bar
    harness.db["telegram_result"] = TelegramResult(sent_status="sent")
    assert hs.run(now=NOW + timedelta(minutes=30)) == 0
    assert len(harness.sent) == 2 and harness.db["stock_scanner_runs"][1]["payload"]["bar"] == BAR.isoformat()


def test_run_waits_when_most_names_are_not_on_the_newest_bar(harness):
    tickers = harness.db["stock_tickers"]
    for row in tickers[1:]:
        row["stock_signals"][0]["candle_time"] = (BAR - timedelta(hours=1)).isoformat()
    assert hs.run(now=NOW) == 0
    assert harness.sent == [] and harness.calls == [] and harness.db["stock_scanner_runs"] == []


def test_run_is_silent_outside_quiet_hours_only_when_told(harness, monkeypatch):
    monkeypatch.setenv("SUMMARY_QUIET_HOURS", "off")
    assert hs.run(now=NOW) == 0
    assert harness.sent[0]["silent"] is False


def test_run_noops_without_feature_flag_or_telegram(harness, monkeypatch):
    monkeypatch.setattr(hs, "load_settings", lambda: _settings(enable_hourly_digest=False))
    assert hs.run(now=NOW) == 0 and harness.sent == []
    monkeypatch.setattr(hs, "load_settings", lambda: _settings())
    monkeypatch.delenv("SUMMARY_TELEGRAM_CHAT_ID")
    assert hs.run(now=NOW) == 0 and harness.sent == []


def test_run_includes_the_book_and_the_sessions_macro(harness):
    harness.db["market_context_snapshots"] = [{"captured_at": NOW.isoformat(), "payload": {"us_session_date": DAY, "sp500_change_pct": 0.5, "vix_price": 16.0}}]
    harness.db["portfolio_signal_overlay"] = [{"symbol": "NVDA", "candle_time": BAR.isoformat(), "unrealised_pl": 10.0, "unrealised_pl_pct": 5.0, "market_value": 210.0}]
    harness.db["watchlist_signal_overlay"] = [{"symbol": "SNOW", "candle_time": BAR.isoformat(), "watchlist_trigger_state": "approaching"}]
    assert hs.run(now=NOW) == 0
    facts_text = harness.calls[0]["facts"]
    assert "S&P 500 up 0.5% on the day, VIX at 16.0" in facts_text
    assert "NVDA: up 1.0% this bar, up 4.1% on the day, score 82 (strong setup), position up 5.0% overall" in facts_text
    assert "SNOW: approaching (score 65, watchlist setup)" in facts_text
    message = harness.sent[0]["message"]
    assert "Market at scan time: S&P 500 up 0.5% on the day, VIX at 16.0" in message
    assert "Your holdings: NVDA:" in message and "Your watchlist: SNOW: approaching" in message


# ------------------------------------------------------------------------------------------
# The column manifest the schema gate reads must be what the code actually names - a manifest
# maintained by hand beside the code is how a phantom column slips through.


class _RecordingQuery:
    def __init__(self, log, table):
        self.log, self.table_name = log, table

    def _col(self, name, foreign_table=None):
        self.log.setdefault(foreign_table or self.table_name, set()).add(name.split(".")[-1] if "." not in name else name.split(".")[-1])
        if "." in name:  # "stock_signals.timeframe" filters the embedded table
            self.log.setdefault(name.split(".")[0], set()).add(name.split(".")[1])
            self.log[foreign_table or self.table_name].discard(name.split(".")[-1])
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
        if not item or item in self.log and item in self.log.get("", set()):
            return
        column = item.split(":", 1)[1] if ":" in item else item
        column = column.split("->", 1)[0].strip()
        if column:
            self.log.setdefault(table, set()).add(column)

    def eq(self, column, _value):
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
    hs.newest_bar(client, "1h")
    hs.load_universe(client, "1h")
    hs._universe_query(client, "1h", hs._SIGNAL_SELECT_FULL, hs.CANDLES_PER_TICKER).execute()
    hs.load_summary_runs(client, NOW)
    hs.load_market_snapshot(client)
    hs.load_overlays(client, "portfolio_signal_overlay", "symbol,candle_time,unrealised_pl,unrealised_pl_pct,market_value", "user-1", NOW)
    hs.load_overlays(client, "watchlist_signal_overlay", "symbol,candle_time,watchlist_trigger_state", "user-1", NOW)
    hs._record(client, "run-1", "success", {}, delivered=True)
    named = {table: columns - {"id", "finished_at", "alerts_sent", "error_message"} for table, columns in client.log.items()}
    missing = {table: sorted(columns - set(hs.COLUMNS.get(table, []))) for table, columns in named.items()}
    missing = {table: columns for table, columns in missing.items() if columns}
    assert missing == {}, f"named in code but not in summary_columns.json: {missing}"
    assert set(named) == set(hs.COLUMNS), "the manifest lists a table the code never reads"
