"""The morning guide - a trader's daily guide in the founder's own layout, before the ASX opens.

The founder (2026-10-13) sent a morning note from another assistant and asked for "something to
this effect in the morning ... copy this exact structure - this is like the traders daily guide":

    Morning, Bryson. Tuesday 13 October, Sydney time.
    Your priorities          - what needs attention today
    Today's ... activity     - what is on
    Loose ends               - what is unfinished
    <one line on what the guide could and could not see>
    US markets · Monday 12 October, USD
    The regular session has closed. <which readings are still preliminary>
    - GOOGL: $353.05, about +0.4% - preliminary

Lyra cannot see an inbox or a calendar, so the sections are filled from what Lyra does know about
the reader's money: their holdings and watchlist (with the stops, targets and levels they set),
the scanner's reading of the last US session, Lyra's macro calendar, earnings dates and closing
quotes from Yahoo, and whether last night's AI jobs ran. Every line is built by code from those
figures - no model call, so it costs nothing and still goes out on a night the AI cannot run.

Once per Sydney morning, at or after MORNING_SEND_AT (08:30 by default; the ASX opens at 10:00), and
only for a US session no guide has covered yet: Saturday's covers Friday, and Monday morning has
nothing new. The US close lands at 6:00am (AEST) to 8:00am (AEDT with New York on EST, November to
March) Sydney time, and the scanner scores the closing bar about 50 minutes after it - so a firing
that finds the session's last bar not yet scored waits for the next one; a firing 90 minutes or
more past the send time sends whatever it has and says so (morning-guide.yml fires three times). Delivered to the operator's chat
through the app's bot with the feedback buttons; on the record like every message
(generation_record.py), owned by the operator because it carries their book.

Run: python -m workers.stock_scanner.morning_guide   (scheduled by .github/workflows/morning-guide.yml)
Logs carry counts only - never a symbol, a price or the text - because the Actions logs are public.
"""

from __future__ import annotations

import html
import logging
import os
import sys
from dataclasses import dataclass, field, replace
from datetime import date, datetime, time as clock_time, timedelta, timezone
from typing import Any, Callable
from zoneinfo import ZoneInfo

import requests

from workers.stock_scanner.config import Settings, load_settings
from workers.stock_scanner.daily_read import (
    DEFAULT_TIMEZONE,
    GROUP_NAMES,
    NEW_YORK,
    SESSION_CLOSE,
    STATUS_WORDS,
    SessionFacts,
    _number,
    _parse_time,
    _record,
    _truthy,
    _write_rehearsal,
    build_facts,
    coverage,
    due,
    fmt_clock,
    fmt_pct,
    holdings_facts,
    load_market_snapshot,
    load_overlays,
    load_universe,
    macro_for_session,
    newest_session,
    parse_clock,
    quiet_now,
    watchlist_facts,
)
from workers.stock_scanner.feedback import buttons_live, vote_keyboard
from workers.stock_scanner.generation_record import PRODUCTION, REHEARSAL, Generation, prompt_version, record_generation
from workers.stock_scanner.logger import get_logger
from workers.stock_scanner.market_context import YAHOO_HEADERS, YAHOO_URL, _session_change
from workers.stock_scanner.supabase_repo import SupabaseRepository
from workers.stock_scanner.telegram import send_telegram_message

LOGGER = get_logger("stock_scanner.morning_guide")
# yfinance logs a failed lookup at ERROR with Yahoo's response body, which names the symbol - and
# with no handler of its own the record reaches stderr, the public Actions log. The guide reports a
# missing earnings date by count, never by symbol, so the library is kept quiet.
_YF_LOGGER = logging.getLogger("yfinance")
_YF_LOGGER.setLevel(logging.CRITICAL)
_YF_LOGGER.propagate = False
_YF_LOGGER.addHandler(logging.NullHandler())

JOB_NAME = "morning_guide"
DEFAULT_SEND_AT = "08:30"
DEFAULT_QUIET_HOURS = "22-7"
MAX_PRIORITIES = 5
MAX_HOLDINGS = 40  # checked and quoted; a bigger book is named as cut, never silently
LATE_AFTER = timedelta(minutes=90)  # past the send time by this much, a guide goes out even on an unfinished session
EARNINGS_SOON_DAYS = 7
BIG_MOVE_PCT = 3.0
NEAR_LEVEL_PCT = 3.0  # a stop or target this close (on the reader's own level) is a priority
FINAL_GRACE_SECONDS = 15 * 60  # a quote is a closing quote once the close is this far behind us
QUOTE_TIMEOUT = 10
# The layout's version: stored on the record, so a change in the reviews can be traced to it.
LAYOUT = "morning-guide/1: greeting, priorities, today in the market, loose ends, coverage, US markets"
PROMPT_VERSION = prompt_version(JOB_NAME, LAYOUT)

# NYSE full closures and 1:00pm early closes, as nyse.com lists them (read 2026-10-13). Extend
# the table each year; a date past its end is treated as an ordinary weekday.
NYSE_HOLIDAYS: dict[date, str] = {
    date(2026, 1, 1): "New Year's Day", date(2026, 1, 19): "Martin Luther King Jr. Day", date(2026, 2, 16): "Washington's Birthday",
    date(2026, 4, 3): "Good Friday", date(2026, 5, 25): "Memorial Day", date(2026, 6, 19): "Juneteenth", date(2026, 7, 3): "Independence Day",
    date(2026, 9, 7): "Labor Day", date(2026, 11, 26): "Thanksgiving", date(2026, 12, 25): "Christmas Day",
    date(2027, 1, 1): "New Year's Day", date(2027, 1, 18): "Martin Luther King Jr. Day", date(2027, 2, 15): "Washington's Birthday",
    date(2027, 3, 26): "Good Friday", date(2027, 5, 31): "Memorial Day", date(2027, 6, 18): "Juneteenth", date(2027, 7, 5): "Independence Day",
    date(2027, 9, 6): "Labor Day", date(2027, 11, 25): "Thanksgiving", date(2027, 12, 24): "Christmas Day",
    date(2028, 1, 17): "Martin Luther King Jr. Day", date(2028, 2, 21): "Washington's Birthday", date(2028, 4, 14): "Good Friday",
    date(2028, 5, 29): "Memorial Day", date(2028, 6, 19): "Juneteenth", date(2028, 7, 4): "Independence Day", date(2028, 9, 4): "Labor Day",
    date(2028, 11, 23): "Thanksgiving", date(2028, 12, 25): "Christmas Day",
}
NYSE_EARLY_CLOSES: set[date] = {date(2026, 11, 27), date(2026, 12, 24), date(2027, 11, 26), date(2028, 7, 3), date(2028, 11, 24)}

AI_REASONS = {
    "billing": "the Anthropic credit balance is too low",
    "budget": "this month's AI budget is used up",
    "no_key": "no Anthropic key is configured",
    "auth": "the Anthropic key was rejected",
    "connection": "the Anthropic API could not be reached",
    "rate_limit": "the Anthropic API was rate limited",
}


# --------------------------------------------------------------------------------------------
# Inputs.


@dataclass(frozen=True)
class Quote:
    symbol: str
    price: float | None
    change_pct: float | None
    session: date | None
    final: bool  # a closing quote, not a reading the feed may still revise


@dataclass(frozen=True)
class Holding:
    symbol: str
    stop: float | None = None  # the nearest stop the reader set (the highest)
    target: float | None = None  # the nearest take-profit the reader set (the lowest)


@dataclass(frozen=True)
class WatchItem:
    symbol: str
    target: float | None = None
    reference: float | None = None  # the price when it was added: below it, the target is a dip to wait for


@dataclass(frozen=True)
class CalendarEvent:
    day: date
    title: str


@dataclass
class GuideInputs:
    today: date  # the reader's date
    first_name: str
    facts: SessionFacts | None  # the scanner's reading of the last US session (None when there is none)
    holdings: list[Holding]
    watchlist: list[WatchItem]
    quotes: dict[str, Quote]
    earnings: dict[str, date]  # next earnings date per holding, where Yahoo has one
    events: list[CalendarEvent]
    ai_last_night: dict[str, str]  # job -> reason, for the evening jobs that ran without the model
    reader_zone: ZoneInfo = field(default_factory=lambda: ZoneInfo(DEFAULT_TIMEZONE))
    total_holdings: int = 0  # the whole book; holdings is the part checked (at most MAX_HOLDINGS)
    universe: frozenset[str] = frozenset()  # every symbol the scanner scores, on this session or not
    now: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


def quote_from_chart(symbol: str, result: dict[str, Any], now: datetime) -> Quote:
    """Price and one-session change from a Yahoo v8 chart result (market_context's correct change,
    never meta.chartPreviousClose), and whether it is final: the last regular-session trade is at
    the close and the close is FINAL_GRACE_SECONDS behind us. Anything else is preliminary."""
    moved = _session_change(result)
    meta = result.get("meta") or {}
    regular = ((meta.get("currentTradingPeriod") or {}).get("regular") or {}) if isinstance(meta.get("currentTradingPeriod"), dict) else {}
    end, traded = _number(regular.get("end")), _number(meta.get("regularMarketTime"))
    final = bool(end and traded and traded >= end - 60 and now.timestamp() >= end + FINAL_GRACE_SECONDS)
    session = date.fromisoformat(moved["session_date"]) if moved.get("session_date") else None
    return Quote(symbol, _number(moved.get("price")), _number(moved.get("change_pct")), session, final)


def fetch_quote(symbol: str, now: datetime) -> Quote | None:
    try:
        response = requests.get(YAHOO_URL.format(symbol), headers=YAHOO_HEADERS, timeout=QUOTE_TIMEOUT)
        response.raise_for_status()
        return quote_from_chart(symbol, response.json()["chart"]["result"][0], now)
    except Exception:  # noqa: BLE001 - one missing quote is a loose end, not a failed guide
        return None


def fetch_earnings(symbol: str, today: date) -> date | None:
    """The next earnings date Yahoo lists for a symbol, today or later; None when it has none."""
    try:
        import yfinance as yf

        calendar = yf.Ticker(symbol).calendar
    except Exception:  # noqa: BLE001 - an earnings date is an extra
        return None
    raw = calendar.get("Earnings Date") if isinstance(calendar, dict) else None
    days = [value.date() if isinstance(value, datetime) else value for value in (raw or []) if isinstance(value, (date, datetime))]
    upcoming = sorted(day for day in days if day >= today)
    return upcoming[0] if upcoming else None


# --------------------------------------------------------------------------------------------
# Words. Plain sentences with the reader's own figures; Telegram HTML, every value escaped.


def _h(text: str) -> str:
    return html.escape(text, quote=False)


def long_day(day: date) -> str:
    return f"{day.strftime('%A')} {day.day} {day.strftime('%B')}"


def short_day(day: date) -> str:
    return f"{day.strftime('%a')} {day.day} {day.strftime('%b')}"


def money(value: float) -> str:
    return f"${value:,.2f}"


def _status_words(status: str) -> str:
    return STATUS_WORDS.get(status, status.replace("_", " "))


def _distance_pct(price: float, level: float) -> float:
    return abs(price - level) / level * 100


def expected_bars(session: date) -> int:
    """Hourly bars in a full session: seven, or four on an NYSE 1:00pm early close."""
    return 4 if session in NYSE_EARLY_CLOSES else 7


def session_complete(facts: SessionFacts) -> bool:
    """The scanner has scored the session's last bar (15:30 New York, 12:30 on an early close)."""
    last = clock_time(12, 30) if facts.session in NYSE_EARLY_CLOSES else clock_time(15, 30)
    return facts.close_bar.astimezone(NEW_YORK).time() >= last


def priorities(inputs: GuideInputs) -> list[str]:
    """What in the reader's book needs attention today, most pressing first, at most five."""
    ranked: list[tuple[int, float, str]] = []
    facts = inputs.facts
    by_symbol = {t.symbol: t for t in facts.tickers} if facts else {}
    group_of = {g.category: g for g in facts.group_moves} if facts else {}
    transitions: dict[str, str] = {}
    if facts:
        for label, items in (
            ("invalidated", facts.invalidated),
            ("lost", facts.lost_strong),
            ("strong", facts.newly_strong),
            ("watch", facts.newly_watch),
        ):
            for item in items:
                transitions.setdefault(item.symbol, label)

    for holding in inputs.holdings:
        symbol = holding.symbol
        quote = inputs.quotes.get(symbol)
        price = quote.price if quote else None
        when = inputs.earnings.get(symbol)
        if when is not None and (when - inputs.today).days <= EARNINGS_SOON_DAYS:
            days = (when - inputs.today).days
            away = "today (US date)" if days == 0 else ("tomorrow (US date)" if days == 1 else f"in {days} days")
            ranked.append((0, 0.0, f"{symbol} is expected to report earnings on {short_day(when)}, {away}. Results can move a share sharply; Lyra's setup reading does not include them."))
        if price is not None and holding.stop:
            if price <= holding.stop:
                ranked.append((0, 99.0, f"{symbol} closed at {money(price)}, at or below the {money(holding.stop)} stop you set."))
            elif _distance_pct(price, holding.stop) <= NEAR_LEVEL_PCT:
                ranked.append((1, 0.0, f"{symbol} closed at {money(price)}, {_distance_pct(price, holding.stop):.1f}% above the {money(holding.stop)} stop you set."))
        if price is not None and holding.target and price >= holding.target:
            ranked.append((1, 0.0, f"{symbol} closed at {money(price)}, at or above the {money(holding.target)} take-profit level you set."))
        ticker = by_symbol.get(symbol)
        # The session's move from the closing quote when there is one - the scanner's hourly bars can
        # be a bar short of the close - and from the scanner's reading otherwise.
        if quote is not None and quote.final and quote.change_pct is not None:
            change = quote.change_pct
        else:
            change = ticker.day_pct if ticker and ticker.day_pct is not None else (quote.change_pct if quote else None)
        moved = change is not None and abs(change) >= BIG_MOVE_PCT
        label = transitions.get(symbol)
        if not (label or moved):
            continue
        setup = {
            "invalidated": "its strong setup failed during the session",
            "lost": f"its setup faded from strong to {_status_words(ticker.status) if ticker else 'a weaker reading'}",
            "strong": "it turned into a strong setup, Lyra's highest early-turn reading",
            "watch": "a setup started forming on it",
        }.get(label or "", "")
        if moved:
            sentence = f"{symbol} {'rose' if change > 0 else 'fell'} {abs(change):.1f}% on the session"
            group = group_of.get(ticker.category) if ticker else None
            if group is not None and group.names >= 3:
                sentence += f" ({GROUP_NAMES.get(ticker.category, ticker.category.replace('_', ' '))} {fmt_pct(group.mean_pct)} on average)"
            sentence += f", and {setup}." if setup else "."
        else:
            sentence = {
                "invalidated": f"{symbol}'s strong setup failed during the session.",
                "lost": f"{symbol}'s setup faded from strong to {_status_words(ticker.status) if ticker else 'a weaker reading'}.",
                "strong": f"{symbol} turned into a strong setup, Lyra's highest early-turn reading.",
                "watch": f"A setup started forming on {symbol}.",
            }[label]
        falling = label in ("invalidated", "lost") or (moved and change < 0)
        ranked.append((2 if falling else 3, abs(change or 0.0), sentence))

    for item in inputs.watchlist:
        quote = inputs.quotes.get(item.symbol)
        price = quote.price if quote else None
        if price is None or not item.target:
            continue
        # A watchlist target is Lyra's "Buy under" level (watchlist_engine: price at or under it), so it
        # is reached from above, whatever price the name was added at.
        if price <= item.target:
            ranked.append((1, 0.0, f"{item.symbol} closed at {money(price)}, at or under the {money(item.target)} buy level on your watchlist."))

    ranked.sort(key=lambda entry: (entry[0], -entry[1]))
    seen: set[str] = set()
    lines = []
    for _rank, _size, line in ranked:
        if line not in seen:
            seen.add(line)
            lines.append(line)
    return lines[:MAX_PRIORITIES] or ["Nothing in your book needs attention this morning."]


def market_today(inputs: GuideInputs) -> list[str]:
    """What is on today: Lyra's calendar for the reader's date, a US holiday or early close, the
    holdings that report in the next session, and when that session opens in the reader's time."""
    lines = [event.title.rstrip(".") + "." for event in inputs.events if event.day == inputs.today]
    place = str(inputs.reader_zone.key).rsplit("/", 1)[-1].replace("_", " ")
    tonight = _us_day_ahead(inputs.now)
    session = _next_us_session(inputs.now)
    if tonight in NYSE_HOLIDAYS:
        lines.append(f"US markets are closed on {short_day(tonight)} for {NYSE_HOLIDAYS[tonight]}.")
    for symbol, when in sorted(inputs.earnings.items()):
        if when == session:
            lines.append(f"{symbol} reports earnings around the {short_day(session)} US session.")
    opens = datetime.combine(session, clock_time(9, 30), tzinfo=NEW_YORK).astimezone(inputs.reader_zone)
    # Both days, because they differ: Monday's 9:30am in New York is Tuesday's small hours in Sydney.
    line = f"The next US session opens at {fmt_clock(opens)} {short_day(opens.date())} {place} time (9:30am {short_day(session)} in New York)."
    if session in NYSE_EARLY_CLOSES:
        closes = datetime.combine(session, clock_time(13, 0), tzinfo=NEW_YORK).astimezone(inputs.reader_zone)
        line += f" It closes early, at 1:00pm in New York ({fmt_clock(closes)} {short_day(closes.date())} {place} time)."
    lines.append(line)
    return lines


def _us_day_ahead(now: datetime) -> date:
    """The New York date of the next opening bell's day, holidays included (weekends skipped)."""
    local = now.astimezone(NEW_YORK)
    day = local.date() if local.time() < clock_time(9, 30) else local.date() + timedelta(days=1)
    while day.weekday() >= 5:
        day += timedelta(days=1)
    return day


def _next_us_session(now: datetime) -> date:
    """The next New York trading day whose open is still ahead: weekends and NYSE holidays skipped."""
    day = _us_day_ahead(now)
    while day.weekday() >= 5 or day in NYSE_HOLIDAYS:
        day += timedelta(days=1)
    return day


def loose_ends(inputs: GuideInputs) -> list[str]:
    lines = []
    on_session = inputs.facts.symbols if inputs.facts else set()
    unscanned = [h.symbol for h in inputs.holdings if h.symbol not in inputs.universe and h.symbol not in on_session]
    lagging = [h.symbol for h in inputs.holdings if h.symbol in inputs.universe and h.symbol not in on_session]
    if unscanned:
        names = _join(unscanned)
        verb = "is" if len(unscanned) == 1 else "are"
        lines.append(f"{names} {verb} in your book but not in Lyra's scan, so there is a quote below and no setup reading.")
    if lagging:
        verb = "is" if len(lagging) == 1 else "are"
        lines.append(f"{_join(lagging)} {verb} missing the session's final bar in Lyra's data, so the setup reading is not current.")
    missing = [h.symbol for h in inputs.holdings if inputs.quotes.get(h.symbol) is None or inputs.quotes[h.symbol].price is None]
    if missing:
        lines.append(f"No quote came back for {_join(missing)} this morning.")
    if inputs.facts is not None:
        expected = expected_bars(inputs.facts.session)
        if inputs.facts.bars < expected:
            lines.append(f"Only {inputs.facts.bars} of the session's {expected} hourly bars are in Lyra's data, so the setup readings are not final.")
        elif coverage(inputs.facts) < 0.95:
            lines.append(f"{inputs.facts.scored - len(inputs.facts.tickers)} scanned names are missing the session's final bar.")
    reasons = {job: AI_REASONS.get(reason, f"it stopped ({reason})") for job, reason in inputs.ai_last_night.items()}
    if reasons:
        names = {"daily_read": "the daily read's prose", "ai_briefing": "the AI briefing", "content_judge": "the nightly content review"}
        if len(set(reasons.values())) == 1:
            jobs = _join([names.get(job, job) for job in sorted(reasons)])
            lines.append(f"Last night {jobs} did not run: {next(iter(reasons.values()))}.")
        else:
            for job, why in sorted(reasons.items()):
                lines.append(f"Last night {names.get(job, job)} did not run: {why}.")
    return lines or ["Nothing outstanding."]


def coverage_line(inputs: GuideInputs) -> str:
    held = len(inputs.holdings)
    if not held:
        return "No holdings in Lyra yet, so there is nothing of yours to guide - add positions under Portfolio."
    cut = f" Your book has {inputs.total_holdings} holdings; the first {held} alphabetically were checked." if inputs.total_holdings > held else ""
    final = sum(1 for h in inputs.holdings if (q := inputs.quotes.get(h.symbol)) and q.price is not None and q.final)
    dated = sum(1 for h in inputs.holdings if h.symbol in inputs.earnings)
    week = sum(1 for e in inputs.events if 0 <= (e.day - inputs.today).days < 7)
    return (
        f"Closing quotes for {final} of {held} holdings; earnings dates from Yahoo for {dated} of {held}. "
        f"Lyra's calendar lists {week} event{'s' if week != 1 else ''} this week.{cut} Lyra cannot see your inbox or diary."
    )


def us_markets(inputs: GuideInputs) -> tuple[str, list[str]]:
    sessions = [q.session for q in inputs.quotes.values() if q and q.session]
    session = max(sessions) if sessions else (inputs.facts.session if inputs.facts else None)
    title = f"US markets · {long_day(session)}, USD" if session else "US markets, USD"
    rows = []
    preliminary = []
    for holding in inputs.holdings:
        quote = inputs.quotes.get(holding.symbol)
        if quote is None or quote.price is None:
            rows.append(f"- {holding.symbol}: no quote this morning")
            continue
        if quote.session and session and quote.session < session:
            rows.append(f"- {holding.symbol}: {money(quote.price)} · last traded {short_day(quote.session)}")
            continue
        change = "" if quote.change_pct is None else (f", {fmt_pct(quote.change_pct)}" if quote.final else f", about {fmt_pct(quote.change_pct)}")
        rows.append(f"- {holding.symbol}: {money(quote.price)}{change} · {'closing quote' if quote.final else 'preliminary'}")
        if not quote.final:
            preliminary.append(holding.symbol)
    status = "The regular session has closed."
    if preliminary:
        verb = "is" if len(preliminary) == 1 else "are"
        status += f" {_join(preliminary)} {verb} still settling, so {'that reading is' if len(preliminary) == 1 else 'those readings are'} preliminary:"
    lines = [status, *rows]
    if inputs.facts and inputs.facts.macro:
        market = []
        for label, key in (("S&P 500", "sp500_change_pct"), ("Nasdaq", "nasdaq_change_pct")):
            value = _number(inputs.facts.macro.get(key))
            if value is not None:
                market.append(f"{label} {fmt_pct(value)}")
        vix = _number(inputs.facts.macro.get("vix_price"))
        if vix is not None:
            market.append(f"VIX {vix:.1f}")
        if market:
            lines.append(" · ".join(market))
    return title, lines


def _join(names: list[str]) -> str:
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]


def compose_guide(inputs: GuideInputs) -> str:
    greeting = f"Morning, {inputs.first_name}." if inputs.first_name else "Morning."
    title, market_lines = us_markets(inputs)
    sections = [
        f"☀️ <b>{_h(greeting)}</b> {_h(long_day(inputs.today))}, {_h(str(inputs.reader_zone.key).rsplit('/', 1)[-1].replace('_', ' '))} time.",
        "<b>Your priorities</b>\n" + "\n".join("- " + _h(line) for line in priorities(inputs)),
        "<b>Today in the market</b>\n" + "\n".join("- " + _h(line) for line in market_today(inputs)),
        "<b>Loose ends</b>\n" + "\n".join("- " + _h(line) for line in loose_ends(inputs)),
        f"<i>{_h(coverage_line(inputs))}</i>",
        f"<b>{_h(title)}</b>\n" + "\n".join(_h(line) for line in market_lines),
        "Lyra's engine, no AI · Research, not advice.",
    ]
    return "\n\n".join(sections)


# --------------------------------------------------------------------------------------------
# I/O.


def load_first_name(client: Any, user_id: str) -> str:
    rows = client.table("profiles").select("display_name").eq("id", user_id).limit(1).execute().data or []
    name = str((rows[0] if rows else {}).get("display_name") or "").strip()
    return name.split()[0] if name else ""


def load_holdings(client: Any, user_id: str) -> list[Holding]:
    rows = (
        client.table("portfolio_positions").select("symbol,stop_loss_price,take_profit_price").eq("user_id", user_id).eq("is_active", True).limit(200).execute().data
        or []
    )
    merged: dict[str, Holding] = {}
    for row in rows:
        symbol = str(row.get("symbol") or "").upper().strip()
        if not symbol:
            continue
        current = merged.get(symbol, Holding(symbol))
        stop, target = _number(row.get("stop_loss_price")), _number(row.get("take_profit_price"))
        merged[symbol] = replace(
            current,
            stop=max(filter(None, (current.stop, stop)), default=None),
            target=min(filter(None, (current.target, target)), default=None),
        )
    return sorted(merged.values(), key=lambda h: h.symbol)


def load_watchlist(client: Any, user_id: str) -> list[WatchItem]:
    rows = client.table("watchlist_items").select("symbol,target_price,reference_price").eq("user_id", user_id).eq("is_active", True).limit(200).execute().data or []
    items = {}
    for row in rows:
        symbol = str(row.get("symbol") or "").upper().strip()
        if symbol:
            items[symbol] = WatchItem(symbol, _number(row.get("target_price")), _number(row.get("reference_price")))
    return sorted(items.values(), key=lambda w: w.symbol)


def load_events(client: Any, start: date, days: int = 7) -> list[CalendarEvent]:
    end = start + timedelta(days=days)
    rows = (
        client.table("market_calendar_events").select("event_date,title").gte("event_date", start.isoformat()).lte("event_date", end.isoformat()).order("event_date").limit(50).execute().data
        or []
    )
    events = []
    for row in rows:
        try:
            events.append(CalendarEvent(date.fromisoformat(str(row.get("event_date"))[:10]), " ".join(str(row.get("title") or "").split())))
        except ValueError:
            continue
    return [event for event in events if event.title]


def load_guide_runs(client: Any, since: datetime) -> list[dict[str, Any]]:
    return list(
        client.table("stock_scanner_runs").select("job_name,status,started_at,payload").in_("job_name", [JOB_NAME, "daily_read", "ai_briefing", "content_judge"]).gte("started_at", since.isoformat()).order("started_at", desc=True).limit(60).execute().data
        or []
    )


def ai_last_night(runs: list[dict[str, Any]], since: datetime) -> dict[str, str]:
    """The evening jobs whose latest run since `since` ran without the model, and why."""
    latest: dict[str, dict[str, Any]] = {}
    for row in runs:
        job = row.get("job_name")
        when = _parse_time(row.get("started_at"))
        payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
        # A rehearsal is not what readers got: it never stands in for the evening's real run.
        if job not in ("daily_read", "ai_briefing", "content_judge") or when is None or when < since or payload.get("rehearsal"):
            continue
        if job not in latest or when > (_parse_time(latest[job].get("started_at")) or when):
            latest[job] = row
    out = {}
    for job, row in latest.items():
        payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
        if not payload.get("ai") and payload.get("reason") not in (None, "ok", "resend"):
            out[job] = str(payload.get("reason"))
    return out


def run(now: datetime | None = None, *, quote_fn: Callable[[str, datetime], Quote | None] = fetch_quote, earnings_fn: Callable[[str, date], date | None] = fetch_earnings) -> int:
    now = now or datetime.now(timezone.utc)
    settings: Settings = load_settings()
    rehearsal = _truthy("LYRA_REHEARSAL")
    if not _truthy("ENABLE_MORNING_GUIDE") and not rehearsal:
        LOGGER.info("The morning guide is off (ENABLE_MORNING_GUIDE is not true) - nothing sent.")
        return 0
    bot_token = os.getenv("SUMMARY_TELEGRAM_BOT_TOKEN", "")
    chat_id = os.getenv("SUMMARY_TELEGRAM_CHAT_ID", "")
    if (not bot_token or not chat_id) and not rehearsal:
        LOGGER.info("No SUMMARY_TELEGRAM_BOT_TOKEN / SUMMARY_TELEGRAM_CHAT_ID - nowhere to send the guide.")
        return 0
    if not settings.default_user_id:
        LOGGER.info("No DEFAULT_USER_ID - the guide is built from the operator's book, and there is no operator.")
        return 0
    repository = SupabaseRepository(settings)
    if not repository.client:
        LOGGER.info("Supabase is not configured - demo mode, no guide.")
        return 0
    client = repository.client
    force = rehearsal or _truthy("MORNING_FORCE")
    reader_zone = ZoneInfo(os.getenv("SUMMARY_TIMEZONE", "").strip() or DEFAULT_TIMEZONE)
    local_now = now.astimezone(reader_zone)
    today = local_now.date()
    send_at = parse_clock(os.getenv("MORNING_SEND_AT", ""), parse_clock(DEFAULT_SEND_AT, clock_time(8, 30)))
    if not force and not due(local_now, send_at):
        LOGGER.info("Not yet the reader's morning send time (%s local) - nothing sent.", local_now.strftime("%H:%M"))
        return 0

    runs = load_guide_runs(client, now - timedelta(days=8))
    guides = [row.get("payload") for row in runs if row.get("job_name") == JOB_NAME and isinstance(row.get("payload"), dict)]
    if not force and any(payload.get("date") == today.isoformat() for payload in guides):
        LOGGER.info("This morning's guide has already gone out - nothing sent.")
        return 0
    # The session the guide will describe is the one the scanner's rows say, not a separate probe:
    # the dedupe and the ledger then name the same session the message does.
    universe_rows = load_universe(client, settings.default_timeframe)
    facts = build_facts(universe_rows, settings)
    session = facts.session if facts is not None else newest_session(client, settings.default_timeframe)
    if not force and session is not None and any(payload.get("session") == session.isoformat() and payload.get("date") for payload in guides):
        LOGGER.info("No US session since the last guide - nothing sent.")
        return 0
    # The closing bar is scored about 50 minutes after the close; November to March that is after
    # 08:30 Sydney. A firing that finds it missing waits for the next one, and the last firing of
    # the morning sends anyway (the loose ends say the readings are not final).
    late = local_now >= datetime.combine(today, send_at, tzinfo=reader_zone) + LATE_AFTER
    if not force and facts is not None and not session_complete(facts) and not late:
        LOGGER.info("The session's closing bar is not scored yet - waiting for the next firing.")
        return 0

    user = settings.default_user_id
    holdings = load_holdings(client, user)
    watchlist = load_watchlist(client, user)
    if facts is not None:
        facts.macro = macro_for_session(load_market_snapshot(client), facts.session)
        try:
            since = facts.close_bar - timedelta(days=5)
            facts.holdings = holdings_facts([{"symbol": h.symbol} for h in holdings], load_overlays(client, "portfolio_signal_overlay", "symbol,candle_time,unrealised_pl,unrealised_pl_pct,market_value", user, since), facts)
            facts.watchlist = watchlist_facts([{"symbol": w.symbol} for w in watchlist], load_overlays(client, "watchlist_signal_overlay", "symbol,candle_time,watchlist_trigger_state", user, since), facts)
        except Exception as exc:  # noqa: BLE001 - the book lines sharpen the guide; it still goes out without them
            LOGGER.warning("could not read the operator's overlays: %s", type(exc).__name__)

    total_holdings = len(holdings)
    holdings = holdings[:MAX_HOLDINGS]
    symbols = sorted({h.symbol for h in holdings} | {w.symbol for w in watchlist if w.target})
    quotes = {symbol: quote for symbol in symbols if (quote := quote_fn(symbol, now)) is not None}
    earnings = {h.symbol: when for h in holdings if (when := earnings_fn(h.symbol, today)) is not None}
    try:
        events = load_events(client, today)
    except Exception as exc:  # noqa: BLE001 - the calendar is one section; the rest still stands
        LOGGER.warning("could not read the calendar: %s", type(exc).__name__)
        events = []
    evening = datetime.combine(today - timedelta(days=1), clock_time(12, 0), tzinfo=reader_zone)
    inputs = GuideInputs(
        today=today,
        first_name=load_first_name(client, user),
        facts=facts,
        holdings=holdings,
        watchlist=watchlist,
        quotes=quotes,
        earnings=earnings,
        events=events,
        ai_last_night=ai_last_night(runs, evening),
        reader_zone=reader_zone,
        now=now,
        total_holdings=total_holdings,
        universe=frozenset(str(row.get("symbol") or "").upper() for row in universe_rows if row.get("symbol")),
    )
    message = compose_guide(inputs)

    run_id = repository.create_run(JOB_NAME, settings.default_timeframe)
    ledger: dict[str, Any] = {
        "date": None,  # set once delivered: an undelivered guide is retried by the later firing
        "date_attempted": today.isoformat(),
        "session": session.isoformat() if session else None,
        "holdings": total_holdings,
        "quotes": len(quotes),
        "closing_quotes": sum(1 for q in quotes.values() if q.final),
        "earnings_dates": len(earnings),
        "ai": False,
        "reason": "ok",
        "cost_usd": 0.0,
        "rehearsal": rehearsal,
    }
    generation = Generation(
        agent_name=JOB_NAME,
        prompt_version=PROMPT_VERSION,
        input_text="\n".join(
            [f"{q.symbol} {q.price} {q.change_pct} {q.session} final={q.final}" for q in quotes.values()]
            + [f"earnings {s} {d}" for s, d in sorted(earnings.items())]
            + [f"event {e.day} {e.title}" for e in events]
        ),
        text_parts=[message],
        mode=REHEARSAL if rehearsal else PRODUCTION,
        user_id=user,
        input_payload={"session": ledger["session"], "today": today.isoformat(), "holdings": len(holdings)},
        extra={"session": ledger["session"], "closing_quotes": ledger["closing_quotes"], "quotes": len(quotes)},
    )
    recorded = record_generation(client, generation)
    ledger["generation_id"] = generation.id if recorded else None
    _record(client, run_id, "running", ledger, delivered=False)

    silent = quiet_now(os.getenv("SUMMARY_QUIET_HOURS", DEFAULT_QUIET_HOURS), local_now)
    if rehearsal:
        _write_rehearsal(message)
        _record(client, run_id, "success", {**ledger, "silent": silent}, delivered=False)
        LOGGER.info("morning guide REHEARSAL (not sent): recorded=%s holdings=%d quotes=%d", recorded, len(holdings), len(quotes))
        return 0
    delivery = send_telegram_message(
        message,
        replace(settings, telegram_bot_token=bot_token, telegram_chat_id=chat_id),
        chat_id=chat_id,
        silent=silent,
        parse_mode="HTML",
        reply_markup=vote_keyboard(generation.id) if recorded and buttons_live(bot_token, settings.telegram_bot_token) else None,
    )
    delivered = delivery.sent_status == "sent"
    _record(
        client,
        run_id,
        "success" if delivered else "failed",
        {**ledger, "date": today.isoformat() if delivered else None, "silent": silent, "telegram_message_id": delivery.message_id},
        delivered=delivered,
        error=None if delivered else delivery.error_message,
    )
    LOGGER.info(
        "morning guide for %s: delivered=%s silent=%s holdings=%d quotes=%d closing=%d earnings=%d events=%d recorded=%s",
        today.isoformat(), delivered, silent, len(holdings), len(quotes), ledger["closing_quotes"], len(earnings), len(events), recorded,
    )
    if not delivered:
        LOGGER.error("The morning guide was NOT delivered: %s", delivery.error_message)
        return 1
    return 0


def main() -> None:
    sys.exit(run())


if __name__ == "__main__":
    main()
