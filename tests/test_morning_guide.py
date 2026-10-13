"""The morning guide: the founder's layout, filled from the reader's book, the scanner, the calendar and Yahoo."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest

import workers.stock_scanner.daily_read as dr
import workers.stock_scanner.morning_guide as mg
from tests.test_daily_read import HOURS, UTC, _FakeClient, _FakeQuery, _row, _settings, _universe
from workers.stock_scanner.telegram import TelegramResult

SYDNEY = ZoneInfo("Australia/Sydney")
MORNING = datetime(2026, 10, 7, 8, 35, tzinfo=SYDNEY).astimezone(UTC)  # Wednesday 08:35 AEDT = 21:35 UTC Tuesday
CLOSE_TS = datetime(2026, 10, 6, 16, 0, tzinfo=dr.NEW_YORK).timestamp()


def _facts():
    facts = dr.build_facts(_universe(), _settings())
    facts.macro = {"sp500_change_pct": 0.6, "nasdaq_change_pct": 0.4, "vix_price": 15.0}
    return facts


def _inputs(**overrides):
    base = dict(
        today=date(2026, 10, 7),
        first_name="Bryson",
        facts=_facts(),
        holdings=[mg.Holding("AMD"), mg.Holding("NVDA", stop=101.5), mg.Holding("QQQ")],
        watchlist=[mg.WatchItem("META", target=700.0, reference=650.0)],
        quotes={
            "AMD": mg.Quote("AMD", 97.0, -3.0, date(2026, 10, 6), True),
            "NVDA": mg.Quote("NVDA", 104.0, 4.0, date(2026, 10, 6), False),
            "QQQ": mg.Quote("QQQ", 745.98, -0.7, date(2026, 10, 6), True),
            "META": mg.Quote("META", 690.0, -1.1, date(2026, 10, 6), True),
        },
        earnings={"NVDA": date(2026, 10, 12), "AMD": date(2026, 11, 3)},
        events=[mg.CalendarEvent(date(2026, 10, 7), "RBA Board Minutes (11:30am Sydney)"), mg.CalendarEvent(date(2026, 10, 9), "US CPI")],
        ai_last_night={"daily_read": "billing", "ai_briefing": "billing"},
        reader_zone=SYDNEY,
        now=MORNING,
    )
    base.update(overrides)
    return mg.GuideInputs(**base)


def test_the_guide_keeps_the_founders_layout_section_by_section():
    message = mg.compose_guide(_inputs())
    sections = message.split("\n\n")
    assert sections[0] == "☀️ <b>Morning, Bryson.</b> Wednesday 7 October, Sydney time."
    assert [s.split("\n")[0] for s in sections[1:4]] == ["<b>Your priorities</b>", "<b>Today in the market</b>", "<b>Loose ends</b>"]
    assert sections[4].startswith("<i>Closing quotes for 2 of 3 holdings; earnings dates from Yahoo for 2 of 3 companies.") and sections[4].endswith("Lyra cannot see your inbox or diary.</i>")
    assert sections[5].split("\n")[:2] == ["<b>US markets · Tuesday 6 October, USD</b>", "The regular session has closed. NVDA is still settling, so that reading is preliminary:"]
    assert "- AMD: $97.00, -3.0% · closing quote" in sections[5] and "- NVDA: $104.00, about +4.0% · preliminary" in sections[5]
    assert "- QQQ: $745.98, -0.7% · closing quote" in sections[5] and "S&amp;P 500 +0.6% · Nasdaq +0.4% · VIX 15.0" in sections[5]
    assert sections[-1] == "Lyra's engine, no AI · Research, not advice."
    assert "—" not in message and "–" not in message


def test_priorities_rank_what_needs_attention_and_use_words_not_scores():
    lines = mg.priorities(_inputs())
    assert lines[0].startswith("NVDA is expected to report earnings on Mon 12 Oct, in 5 days."), lines
    assert "NVDA closed at $104.00, 2.5% above the $101.50 stop you set." in lines
    assert "META closed at $690.00, at or under the $700.00 buy level on your watchlist." in lines
    amd = next(line for line in lines if line.startswith("AMD"))
    assert amd == "AMD fell 3.0% on the session, and its strong setup failed during the session."
    nvda_move = next(line for line in lines if line.startswith("NVDA rose"))
    assert nvda_move.endswith("and it turned into a strong setup, Lyra's highest early-turn reading.")
    assert lines.index(amd) < lines.index(nvda_move), "a fall in the book outranks a rise"
    assert len(lines) <= mg.MAX_PRIORITIES and not any("score" in line for line in lines)
    quiet = mg.priorities(_inputs(holdings=[mg.Holding("QQQ")], watchlist=[], earnings={}))
    assert quiet == ["Nothing in your book needs attention this morning."]


def test_a_holdings_move_is_set_against_its_group_when_the_group_is_big_enough():
    facts = _facts()
    facts.group_moves = [dr.GroupMove("semiconductor", 0.5, 3, 2, 1)]
    (line,) = [line for line in mg.priorities(_inputs(facts=facts, holdings=[mg.Holding("AMD")], earnings={}, watchlist=[])) if line.startswith("AMD")]
    assert line == "AMD fell 3.0% on the session (semiconductors +0.5% on average), and its strong setup failed during the session."


def test_a_stop_breached_or_a_take_profit_reached_comes_first():
    lines = mg.priorities(_inputs(holdings=[mg.Holding("AMD", stop=98.0), mg.Holding("QQQ", target=700.0)], earnings={}))
    assert lines[0] == "AMD closed at $97.00, at or below the $98.00 stop you set."
    assert "QQQ closed at $745.98, at or above the $700.00 take-profit level you set." in lines


def test_today_lists_the_calendar_the_next_us_open_and_a_holiday():
    lines = mg.market_today(_inputs())
    assert lines[0] == "RBA Board Minutes (11:30am Sydney)."
    assert lines[-1] == "The next US session opens at 12:30am Thu 8 Oct Sydney time (9:30am Wed 7 Oct in New York)."
    thanksgiving_eve = datetime(2026, 11, 26, 8, 35, tzinfo=SYDNEY).astimezone(UTC)  # Wed 25 Nov, 4:35pm New York
    lines = mg.market_today(_inputs(today=date(2026, 11, 26), now=thanksgiving_eve, events=[], earnings={}))
    assert lines[0] == "US markets are closed on Thu 26 Nov for Thanksgiving."
    assert lines[1] == "The next US session opens at 1:30am Sat 28 Nov Sydney time (9:30am Fri 27 Nov in New York). It closes early, at 1:00pm in New York (5:00am Sat 28 Nov Sydney time)."


def test_loose_ends_name_unscanned_holdings_missing_quotes_and_a_night_without_ai():
    lines = mg.loose_ends(_inputs())
    assert lines[0] == "QQQ is in your book but not in Lyra's scan, so there is a quote below and no setup reading."
    assert "Last night the AI briefing and the daily read's prose did not run: the Anthropic credit balance is too low." in lines
    lines = mg.loose_ends(_inputs(quotes={}, ai_last_night={"ai_briefing": "budget", "daily_read": "billing"}))
    assert "No quote came back for AMD, NVDA and QQQ this morning." in lines
    assert "Last night the AI briefing did not run: this month's AI budget is used up." in lines
    assert "2 scanned names are missing the session's final bar." in mg.loose_ends(_inputs()), "the fixture's GAPPY and OLD"
    complete = dr.build_facts([row for row in _universe() if row["symbol"] in ("NVDA", "AMD", "SNOW")], _settings())
    assert mg.loose_ends(_inputs(facts=complete, holdings=[mg.Holding("NVDA")], ai_last_night={})) == ["Nothing outstanding."]


def test_a_quote_is_closing_only_when_the_last_trade_is_at_the_close_and_the_close_has_settled():
    def chart(traded, period_end=CLOSE_TS):
        return {
            "meta": {"regularMarketPrice": 104.0, "regularMarketTime": traded, "gmtoffset": -14400, "currentTradingPeriod": {"regular": {"end": period_end}}},
            "timestamp": [int(CLOSE_TS - 86400 - 23400), int(CLOSE_TS - 23400)],
            "indicators": {"quote": [{"close": [100.0, 104.0]}]},
        }

    settled = datetime.fromtimestamp(CLOSE_TS + 20 * 60, UTC)
    unsettled_bar = chart(CLOSE_TS + 1)
    unsettled_bar["indicators"]["quote"][0]["close"] = [100.0, None]
    pending = mg.quote_from_chart("NVDA", unsettled_bar, settled)
    assert pending.final is False and pending.session == date(2026, 10, 6) and pending.change_pct == pytest.approx(4.0), "a null daily bar is still reconciling"
    quote = mg.quote_from_chart("NVDA", chart(CLOSE_TS + 1), settled)
    assert quote == mg.Quote("NVDA", 104.0, pytest.approx(4.0), date(2026, 10, 6), True)
    assert mg.quote_from_chart("NVDA", chart(CLOSE_TS + 1), datetime.fromtimestamp(CLOSE_TS + 5 * 60, UTC)).final is False, "too soon after the close"
    assert mg.quote_from_chart("NVDA", chart(CLOSE_TS - 600), settled).final is False, "the last trade was before the close"
    # Yahoo rolls currentTradingPeriod to the next trading day hours after the close; the close is
    # the session's own 16:00, so a settled close stays final.
    rolled = mg.quote_from_chart("NVDA", chart(CLOSE_TS + 1, period_end=CLOSE_TS + 86_400), datetime.fromtimestamp(CLOSE_TS + 6 * 3600, UTC))
    assert rolled.final is True
    fund = chart(CLOSE_TS + 1)
    fund["meta"]["instrumentType"] = "ETF"
    assert mg.quote_from_chart("QQQ", fund, settled).fund is True and quote.fund is False


def test_ai_last_night_reads_only_the_latest_real_evening_runs():
    since = datetime(2026, 10, 6, 12, 0, tzinfo=SYDNEY)
    runs = [
        {"job_name": "daily_read", "started_at": "2026-10-06T09:05:00+00:00", "payload": {"ai": False, "reason": "billing"}},
        {"job_name": "daily_read", "started_at": "2026-10-06T10:05:00+00:00", "payload": {"ai": True, "reason": "ok"}},
        {"job_name": "ai_briefing", "started_at": "2026-10-06T09:20:00+00:00", "payload": {"ai": False, "reason": "billing"}},
        {"job_name": "ai_briefing", "started_at": "2026-10-06T09:30:00+00:00", "payload": {"ai": False, "reason": "billing", "rehearsal": True}},
        {"job_name": "ai_briefing", "started_at": "2026-10-05T09:20:00+00:00", "payload": {"ai": False, "reason": "no_key"}},
    ]
    assert mg.ai_last_night(runs, since) == {"ai_briefing": "billing"}


# ------------------------------------------------------------------------------------------
# run(): once per morning, after a new session, on the record, with buttons.


@pytest.fixture
def harness(monkeypatch):
    db = {
        "stock_tickers": _universe(),
        "stock_scanner_runs": [],
        "market_context_snapshots": [],
        "portfolio_signal_overlay": [],
        "watchlist_signal_overlay": [],
        "portfolio_positions": [{"symbol": "NVDA", "stop_loss_price": 101.5, "take_profit_price": None, "user_id": "user-1", "is_active": True}, {"symbol": "QQQ", "user_id": "user-1", "is_active": True}],
        "watchlist_items": [],
        "profiles": [{"id": "user-1", "display_name": "Bryson Walter"}],
        "market_calendar_events": [{"event_date": "2026-10-07", "title": "RBA Board Minutes (11:30am Sydney)"}],
        "writes": [],
    }
    sent: list[dict] = []
    monkeypatch.setattr(mg, "load_settings", lambda: _settings(telegram_bot_token="bot-token"))
    monkeypatch.setattr(mg, "SupabaseRepository", lambda settings: SimpleNamespace(client=_FakeClient(db), create_run=lambda job, tf: _FakeQuery(db, "stock_scanner_runs").insert({"job_name": job, "timeframe": tf, "status": "running", "started_at": MORNING.isoformat()}).execute().data[0]["id"]))
    monkeypatch.setattr(dr.time, "sleep", lambda *_: None)

    def fake_send(message, settings, chat_id=None, *, silent=False, parse_mode=None, reply_markup=None):
        sent.append({"message": message, "chat_id": chat_id, "silent": silent, "parse_mode": parse_mode, "reply_markup": reply_markup, "token": settings.telegram_bot_token})
        return TelegramResult(sent_status="sent", message_id=77)

    monkeypatch.setattr(mg, "send_telegram_message", fake_send)
    import workers.stock_scanner.feedback as feedback

    monkeypatch.setattr(feedback, "webhook_takes_taps", lambda token: True)  # the live probe has its own tests
    for name, value in {"SUMMARY_TELEGRAM_BOT_TOKEN": "bot-token", "SUMMARY_TELEGRAM_CHAT_ID": "chat-1", "SUMMARY_TIMEZONE": "Australia/Sydney", "ENABLE_MORNING_GUIDE": "true"}.items():
        monkeypatch.setenv(name, value)
    for name in ("MORNING_FORCE", "MORNING_SEND_AT", "SUMMARY_QUIET_HOURS", "LYRA_REHEARSAL"):
        monkeypatch.delenv(name, raising=False)
    quotes = {"NVDA": mg.Quote("NVDA", 104.0, 4.0, date(2026, 10, 6), True), "QQQ": mg.Quote("QQQ", 745.98, -0.7, date(2026, 10, 6), True)}
    return SimpleNamespace(db=db, sent=sent, quote=lambda symbol, now: quotes.get(symbol), earnings=lambda symbol, today: None)


def test_run_sends_one_guide_a_morning_on_the_record_with_buttons(harness):
    early = datetime(2026, 10, 7, 8, 0, tzinfo=SYDNEY).astimezone(UTC)
    assert mg.run(now=early, quote_fn=harness.quote, earnings_fn=harness.earnings) == 0 and harness.sent == [], "08:00 is before the send time"

    assert mg.run(now=MORNING, quote_fn=harness.quote, earnings_fn=harness.earnings) == 0
    (sent,) = harness.sent
    assert sent["message"].startswith("☀️ <b>Morning, Bryson.</b> Wednesday 7 October, Sydney time.")
    assert sent["chat_id"] == "chat-1" and sent["parse_mode"] == "HTML" and sent["silent"] is False
    (record,) = harness.db["ai_runs"]
    assert record["agent_name"] == "morning_guide" and record["user_id"] == "user-1" and record["model_name"] is None and record["status"] == "ok"
    assert record["output_payload"]["text"] == sent["message"] and record["prompt_version"] == mg.PROMPT_VERSION
    assert sent["reply_markup"]["inline_keyboard"][0][0]["callback_data"] == f"fb:{record['id']}:u"
    ledger = harness.db["stock_scanner_runs"][0]
    assert ledger["status"] == "success" and ledger["payload"]["date"] == "2026-10-07" and ledger["payload"]["session"] == "2026-10-06"
    assert ledger["payload"]["generation_id"] == record["id"] and ledger["payload"]["telegram_message_id"] == 77

    assert mg.run(now=MORNING + timedelta(hours=1), quote_fn=harness.quote, earnings_fn=harness.earnings) == 0
    assert len(harness.sent) == 1, "one guide a morning"
    next_day = MORNING + timedelta(days=1)
    assert mg.run(now=next_day, quote_fn=harness.quote, earnings_fn=harness.earnings) == 0
    assert len(harness.sent) == 1, "no new US session since the last guide (the fixture's newest is still 6 Oct)"


def test_run_is_off_without_the_flag_and_a_rehearsal_never_sends(harness, monkeypatch, tmp_path):
    monkeypatch.delenv("ENABLE_MORNING_GUIDE")
    assert mg.run(now=MORNING, quote_fn=harness.quote, earnings_fn=harness.earnings) == 0 and harness.sent == []
    out = tmp_path / "guide.html"
    monkeypatch.setenv("LYRA_REHEARSAL", "1")
    monkeypatch.setenv("LYRA_REHEARSAL_OUT", str(out))
    assert mg.run(now=MORNING, quote_fn=harness.quote, earnings_fn=harness.earnings) == 0
    assert harness.sent == [] and out.read_text().startswith("☀️ <b>Morning, Bryson.</b>")
    ledger = harness.db["stock_scanner_runs"][0]
    assert ledger["payload"]["rehearsal"] is True and ledger["payload"]["date"] is None
    assert harness.db["ai_runs"][0]["output_payload"]["mode"] == "rehearsal"


def test_a_watchlist_buy_level_is_reached_from_above_whatever_the_reference():
    above = mg.priorities(_inputs(holdings=[], earnings={}, watchlist=[mg.WatchItem("META", target=700.0, reference=None)], quotes={"META": mg.Quote("META", 712.5, 1.0, date(2026, 10, 6), True)}))
    assert above == ["Nothing in your book needs attention this morning."], "above the buy level is not reached"
    under = mg.priorities(_inputs(holdings=[], earnings={}, watchlist=[mg.WatchItem("META", target=700.0, reference=None)], quotes={"META": mg.Quote("META", 690.0, -1.0, date(2026, 10, 6), True)}))
    assert under == ["META closed at $690.00, at or under the $700.00 buy level on your watchlist."]


def test_the_session_move_comes_from_the_closing_quote_when_there_is_one():
    lines = mg.priorities(_inputs(holdings=[mg.Holding("AMD")], earnings={}, watchlist=[], quotes={"AMD": mg.Quote("AMD", 97.9, -2.1, date(2026, 10, 6), True)}))
    assert not any(line.startswith("AMD fell 3.0%") for line in lines), "the scanner's hourly figure is not the close"
    assert any(line.startswith("AMD") and "strong setup failed" in line for line in lines)


def test_half_days_expect_four_bars_and_a_lagging_holding_is_named_as_lagging():
    half = dr.build_facts([_row("NVDA", "semiconductor", [100, 101, 102, 103], [50, 50, 50, 50], ["no_signal"] * 4, day="2026-11-27", hours=[9, 10, 11, 12])], _settings())
    assert mg.session_complete(half) and mg.expected_bars(half.session) == 4
    assert not any("hourly bars" in line for line in mg.loose_ends(_inputs(facts=half, holdings=[mg.Holding("NVDA")], ai_last_night={})))
    lines = mg.loose_ends(_inputs(holdings=[mg.Holding("GAPPY"), mg.Holding("QQQ")], universe=frozenset({"NVDA", "AMD", "SNOW", "GAPPY", "OLD"}), ai_last_night={}))
    assert "QQQ is in your book but not in Lyra's scan, so there is a quote below and no setup reading." in lines
    assert "GAPPY is missing the session's final bar in Lyra's data, so the setup reading is not current." in lines


def test_a_big_book_is_named_as_cut_in_the_coverage_line():
    line = mg.coverage_line(_inputs(total_holdings=52))
    assert "Your book has 52 holdings; the first 3 alphabetically were checked." in line


def test_the_judges_missed_night_joins_the_loose_ends():
    since = datetime(2026, 10, 6, 12, 0, tzinfo=SYDNEY)
    runs = [{"job_name": "content_judge", "started_at": "2026-10-06T11:40:00+00:00", "payload": {"ai": False, "reason": "budget"}}]
    assert mg.ai_last_night(runs, since) == {"content_judge": "budget"}
    assert "Last night the nightly content review did not run: this month's AI budget is used up." in mg.loose_ends(_inputs(ai_last_night={"content_judge": "budget"}))


def test_run_waits_for_the_closing_bar_and_the_last_firing_sends_anyway(harness):
    """November to March the 08:41 AEDT firing comes before the scanner has scored the closing bar."""
    harness.db["stock_tickers"] = [
        _row("NVDA", "semiconductor", [102, 102.5, 103, 103, 103.5, 104], [55, 58, 60, 65, 70, 72], ["no_signal"] * 6, day="2026-11-02", hours=HOURS[:6]),
        _row("AMD", "semiconductor", [99, 98.5, 98, 97.5, 97, 97], [60, 60, 60, 60, 60, 60], ["no_signal"] * 6, day="2026-11-02", hours=HOURS[:6]),
    ]
    first = datetime(2026, 11, 3, 8, 41, tzinfo=SYDNEY).astimezone(UTC)
    assert mg.run(now=first, quote_fn=harness.quote, earnings_fn=harness.earnings) == 0
    assert harness.sent == [] and harness.db["stock_scanner_runs"] == [], "held: nothing sent, nothing claimed"
    last = datetime(2026, 11, 3, 10, 13, tzinfo=SYDNEY).astimezone(UTC)
    assert mg.run(now=last, quote_fn=harness.quote, earnings_fn=harness.earnings) == 0
    assert len(harness.sent) == 1 and "Only 6 of the session's 7 hourly bars are in Lyra's data" in harness.sent[0]["message"]


def test_a_fund_is_not_counted_as_a_missing_earnings_date():
    quotes = {"NVDA": mg.Quote("NVDA", 104.0, 4.0, date(2026, 10, 6), True), "QQQ": mg.Quote("QQQ", 745.98, -0.7, date(2026, 10, 6), True, fund=True)}
    line = mg.coverage_line(_inputs(holdings=[mg.Holding("NVDA"), mg.Holding("QQQ")], quotes=quotes, earnings={"NVDA": date(2026, 11, 18)}))
    assert line.startswith("Closing quotes for 2 of 2 holdings; earnings dates from Yahoo for 1 of 1 company.")

