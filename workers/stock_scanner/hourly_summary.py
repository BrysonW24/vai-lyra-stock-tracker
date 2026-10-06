"""Hourly market read - one message per completed hourly bar, to the operator's Telegram.

    python -m workers.stock_scanner.hourly_summary

Runs as its own step right after the hourly scan. What it is for, in the founder's words
(2026-10-05): "something I could trust and use every day, an hourly summary with AI ... a genuine
read on the market day by day". Before this module the product had never delivered that: an
"Hourly digest" switch existed in onboarding and a flag existed in the worker config, and nothing
read either of them.

How it stays trustworthy:

  * THE ENGINE DECIDES. Every figure - breadth, movers, group moves, setup changes, the reader's
    own holdings - is computed here from rows the scanner already stored. No model produces a number.
  * THE AI EXPLAINS. Claude is handed those facts and writes a short read of what the hour meant.
    Its text then passes `ai_read_guard`: a sentence citing a figure the facts did not state, about
    the ticker they did not state it about, or with the opposite direction, is deleted; advice
    blocks the read. If the read fails, the API is down, or the month's budget is spent, the
    figures still go out - labelled as figures only.
  * IT SENDS ONCE PER BAR. The scan fires twice an hour; a read goes out only when a new hourly bar
    has completed since the last one, so a closed market is silent rather than repetitive.
  * IT CANNOT OVERSPEND. Spend is recorded per message in the run ledger and the month's total is
    checked before every call against SUMMARY_MONTHLY_BUDGET_USD (default 10). When the budget
    would not last the month at the configured effort, the next call runs one level lower.
  * IT CANNOT FAIL QUIETLY. A read that could not be delivered exits non-zero, which pages.
  * IT DOES NOT WAKE ANYONE. The US session is the Australian night; between SUMMARY_QUIET_HOURS
    (default 22-7, reader's time) messages arrive silently. The one alert that did wake the founder,
    at 2:39am on 18 July 2026, is why every alert was muted for the eleven weeks that followed.

The repository is public, so this module never logs the message, the facts or the reader's book -
counts, tokens and cost only.

Demo-safe: with the feature off, or no Telegram / Supabase configured, it logs why and exits 0.
"""
from __future__ import annotations

import json
import os
import statistics
import sys
import time
from collections import Counter
from dataclasses import dataclass, field, replace
from datetime import date, datetime, time as clock_time, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from workers.stock_scanner.ai_read_guard import FactSheet, guard_ai_read
from workers.stock_scanner.config import Settings, load_settings
from workers.stock_scanner.logger import get_logger
from workers.stock_scanner.supabase_repo import _NO_ECHO, SupabaseRepository
from workers.stock_scanner.telegram import send_telegram_message

LOGGER = get_logger("stock_scanner.hourly_summary")

JOB_NAME = "hourly_summary"
NEW_YORK = ZoneInfo("America/New_York")
SESSION_CLOSE = clock_time(16, 0)
DEFAULT_MODEL = "claude-opus-5-5"
DEFAULT_EFFORT = "high"
DEFAULT_MONTHLY_BUDGET_USD = 10.0
DEFAULT_TIMEZONE = "Australia/Sydney"
DEFAULT_QUIET_HOURS = "22-7"
BARS_PER_SESSION = 7  # 9:30 to 15:30 New York, hourly opens
MIN_COVERAGE = 0.6  # share of scored names that must be on the newest bar before it is summarised

# Every column this module names, in one file the schema gate reads (`npm run check:app-columns`).
# A named column that does not exist makes PostgREST refuse the whole read.
COLUMNS: dict[str, list[str]] = json.loads(Path(__file__).with_name("summary_columns.json").read_text())

# US$ per million tokens (input, output) - Anthropic list prices read on PRICING_AS_OF. A model that
# is not listed is priced at the dearest row, so an unknown model can never slip under the budget.
PRICING_AS_OF = "2026-10-05"
PRICES_PER_MTOK: dict[str, tuple[float, float]] = {
    "claude-fable-5-1": (10.0, 50.0),
    "claude-fable-5": (10.0, 50.0),
    "claude-opus-5-5": (4.0, 20.0),
    "claude-opus-5": (5.0, 25.0),
    "claude-opus-4-8": (5.0, 25.0),
    "claude-sonnet-5-5": (2.0, 10.0),
    "claude-sonnet-5": (2.0, 10.0),
    "claude-haiku-4-5": (1.0, 5.0),
}
MODEL_NAMES = {
    "claude-fable-5-1": "Claude Fable 5.1",
    "claude-fable-5": "Claude Fable 5",
    "claude-opus-5-5": "Claude Opus 5.5",
    "claude-opus-5": "Claude Opus 5",
    "claude-opus-4-8": "Claude Opus 4.8",
    "claude-sonnet-5-5": "Claude Sonnet 5.5",
    "claude-sonnet-5": "Claude Sonnet 5",
    "claude-haiku-4-5": "Claude Haiku 4.5",
}
EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"]

FLAT_BAND_PCT = 0.05  # a move smaller than this is "flat", not up or down
HEAVY_VOLUME_RATIO = 3.0  # bar volume against its 20-bar average
STALE_AFTER = timedelta(hours=6)  # a bar older than this is "the latest completed bar", not "this hour"

STATUS_WORDS = {
    "strong_setup": "strong setup",
    "watchlist_setup": "watchlist setup",
    "weakening": "weakening",
    "invalidated": "invalidated",
    "no_signal": "no signal",
}
GROUP_NAMES = {
    "semiconductor": "semiconductors",
    "software": "software",
    "consumer_internet": "consumer internet",
    "cybersecurity": "cybersecurity",
    "ai_infrastructure": "AI infrastructure",
    "cloud_data": "cloud and data",
    "enterprise_software": "enterprise software",
    "mega_cap_platform": "mega-cap platforms",
    "fintech_tech": "fintech",
}

SYSTEM_PROMPT = """You write the hourly read for Lyra, a research tool that scans about a hundred US-listed technology stocks once an hour. The reader is the person who built it: an Australian private investor who wants a genuine, plain-English read of what the last bar meant - not a recap of figures he can already see in the block printed under your text.

How Lyra's score works, so you interpret it correctly. The score is an oversold-recovery score, not a strength score. It rewards a stock that has been beaten down and is starting to turn: momentum resetting from oversold, a MACD histogram that is still negative but improving, price still near its recent lows. A high score means "beaten-down name turning up", never "breaking out to new highs". A broad rally therefore tends to lower scores as names move away from their lows, and a sell-off tends to raise them. Statuses: strong setup (the engine's highest-conviction early-turn reading), watchlist setup (one that is forming), weakening (the score fell sharply on this bar), invalidated (a strong setup failed on this bar), no signal. The facts list which names changed status on this bar.

Rules that code checks after you write - a sentence that breaks one is deleted before the reader sees it:
1. Use only the facts provided. Quote a figure exactly as written there, with its unit, and only about the ticker or measure it was stated for. Never round, average, add, subtract, compare arithmetically or otherwise derive a figure of your own. To convey size without a figure, use words (broad, narrow, modest, sharp).
2. Refer to a stock by its ticker exactly as written in the facts, and name only tickers that appear there.
3. You have no news feed. Do not explain a move with an event, an earnings report, a headline or a cause unless the facts state it. Say what happened, not why it happened.
4. No advice and no predictions: nothing about what to buy, sell, hold, add, trim, wait for or expect next. Describe what happened and what it means for the setups Lyra tracks.
5. Do not mention the time, the date or these rules.

Write four to six short sentences of plain prose that read well on a phone: no headings, no bullets, no markdown, no preamble, no sign-off. Lead with the single most important thing about this bar. Say what the breadth, the leaders and the laggards add up to; connect it to the session so far and to the market backdrop where the facts support that; say what changed in the setups and what it means in Lyra's terms; and if the reader's holdings or watchlist are in the facts, say plainly how this bar treated them. Interpret more than you recite: every figure already sits in the block under your text, so quote only the few that carry the point and let the rest stand there. The reader knows how Lyra works - explain the score only when this bar's change needs it. If the bar was quiet, say so in two or three sentences instead of padding."""


# --------------------------------------------------------------------------------------------
# Formatting. The reader's figures and the model's facts are produced by the same functions, so
# the guard compares like with like.


def fmt_pct(value: float) -> str:
    """Signed, one decimal: +2.1% / -0.4% / 0.0%."""
    rounded = round(value, 1)
    if rounded == 0:
        return "0.0%"
    return f"{rounded:+.1f}%"


def move_words(value: float) -> str:
    """Direction in words: 'up 2.1%' / 'down 0.4%' / 'flat'. The model reads these; the guard
    learns each figure's direction from them."""
    rounded = round(value, 1)
    if abs(rounded) < FLAT_BAND_PCT:
        return "flat"
    return f"{'up' if rounded > 0 else 'down'} {abs(rounded):.1f}%"


def fmt_clock(moment: datetime) -> str:
    hour = moment.hour % 12 or 12
    return f"{hour}:{moment.minute:02d}{'am' if moment.hour < 12 else 'pm'}"


def fmt_day(moment: datetime) -> str:
    return f"{moment.strftime('%a')} {moment.day} {moment.strftime('%b')}"


def _parse_time(raw: Any) -> datetime | None:
    if isinstance(raw, datetime):
        return raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _number(raw: Any) -> float | None:
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    return value if value == value and value not in (float("inf"), float("-inf")) else None


def ny_date(moment: datetime) -> date:
    return moment.astimezone(NEW_YORK).date()


# --------------------------------------------------------------------------------------------
# The facts - pure functions over rows the scanner stored.


@dataclass(frozen=True)
class TickerHour:
    symbol: str
    category: str
    bar: datetime
    score: float
    previous_score: float | None
    status: str
    volume_ratio: float | None
    close: float | None
    previous_time: datetime | None  # the stored bar immediately before this one
    previous_close: float | None
    prior_session_time: datetime | None  # newest stored bar from an earlier NY date
    prior_session_close: float | None
    before_previous_close: float | None  # the bar before the previous one, for the previous hour's move
    hour_pct: float | None = None  # set by build_facts once the universe agrees on the reference bars
    day_pct: float | None = None
    previous_hour_pct: float | None = None


def ticker_hour(row: dict[str, Any]) -> TickerHour | None:
    """One ticker's newest signal joined to its own recent candles. None when it has no signal."""
    signals = row.get("stock_signals") or []
    if not signals:
        return None
    signal = signals[0]
    bar = _parse_time(signal.get("candle_time"))
    score = _number(signal.get("signal_score"))
    if bar is None or score is None:
        return None
    payload = signal.get("raw_payload") if isinstance(signal.get("raw_payload"), dict) else {}
    volume_ratio = _number(signal["volume_ratio"]) if "volume_ratio" in signal else _number(payload.get("volume_ratio"))

    candles = sorted(
        (
            (when, close)
            for when, close in ((_parse_time(c.get("candle_time")), _number(c.get("close"))) for c in row.get("stock_candles") or [])
            if when is not None and close is not None and close > 0
        ),
        key=lambda pair: pair[0],
        reverse=True,
    )
    at_bar = next((close for when, close in candles if when == bar), None)
    older = [(when, close) for when, close in candles if when < bar]
    bar_day = ny_date(bar)
    prior = next(((when, close) for when, close in older if ny_date(when) != bar_day), (None, None))

    return TickerHour(
        symbol=str(row.get("symbol") or "").upper(),
        category=str(row.get("category") or "other"),
        bar=bar,
        score=score,
        previous_score=_number(signal.get("previous_signal_score")),
        status=str(signal.get("signal_status") or "no_signal"),
        volume_ratio=volume_ratio,
        close=at_bar,
        previous_time=older[0][0] if older else None,
        previous_close=older[0][1] if older else None,
        prior_session_time=prior[0],
        prior_session_close=prior[1],
        before_previous_close=older[1][1] if len(older) > 1 else None,
    )


@dataclass(frozen=True)
class Transition:
    symbol: str
    score: float
    previous_score: float | None


@dataclass
class HourFacts:
    bar: datetime
    bar_end: datetime
    tickers: list[TickerHour]
    scored: int  # names with any signal at all, including those not on this bar
    first_bar_of_session: bool
    closing_bar: bool
    up: int
    down: int
    flat: int
    median_hour_pct: float | None
    previous_breadth: tuple[int, int] | None  # (up, down) over the previous bar, same session
    day_up: int
    day_down: int
    median_day_pct: float | None
    leaders: list[TickerHour]
    laggards: list[TickerHour]
    day_leaders: list[TickerHour]
    day_laggards: list[TickerHour]
    groups: list[tuple[str, float, int]]  # (category, mean hour move, names)
    heavy_volume: list[TickerHour]
    status_counts: dict[str, int]
    previous_strong: int
    previous_watch: int
    newly_strong: list[Transition]
    lost_strong: list[Transition]
    newly_watch: list[Transition]
    weakening: list[Transition]
    invalidated: list[Transition]
    macro: dict[str, Any] = field(default_factory=dict)
    holdings: list[tuple[str, str]] = field(default_factory=list)  # (symbol, text written about it)
    watchlist: list[tuple[str, str]] = field(default_factory=list)

    @property
    def symbols(self) -> set[str]:
        return {ticker.symbol for ticker in self.tickers}


def _mode(values: list[datetime]) -> datetime | None:
    return Counter(values).most_common(1)[0][0] if values else None


def _pct(now: float | None, then: float | None) -> float | None:
    if now is None or then is None or then <= 0:
        return None
    return (now / then - 1) * 100


def build_facts(rows: list[dict[str, Any]], settings: Settings) -> HourFacts | None:
    """Everything the summary states about the bar. None when nothing has been scanned yet.

    Reference bars are agreed across the universe: a ticker's hour move counts only if its previous
    stored bar is the one most tickers have (so a name with a gap in its history is not reported as
    a one-hour move that really spans two), and its day move only against the prior session's bar
    that most tickers share."""
    every = [ticker for ticker in (ticker_hour(row) for row in rows) if ticker is not None]
    if not every:
        return None
    bar = max(ticker.bar for ticker in every)
    on_bar = [ticker for ticker in every if ticker.bar == bar]

    previous_time = _mode([t.previous_time for t in on_bar if t.previous_time is not None])
    prior_session_time = _mode([t.prior_session_time for t in on_bar if t.prior_session_time is not None])
    first_bar = previous_time is not None and ny_date(previous_time) != ny_date(bar)

    tickers: list[TickerHour] = []
    for ticker in on_bar:
        hour_pct = _pct(ticker.close, ticker.previous_close) if ticker.previous_time == previous_time else None
        day_pct = _pct(ticker.close, ticker.prior_session_close) if ticker.prior_session_time == prior_session_time else None
        previous_hour_pct = None
        if not first_bar and ticker.previous_time == previous_time and ticker.before_previous_close is not None:
            previous_hour_pct = _pct(ticker.previous_close, ticker.before_previous_close)
        tickers.append(replace(ticker, hour_pct=hour_pct, day_pct=day_pct, previous_hour_pct=previous_hour_pct))

    moves = [t for t in tickers if t.hour_pct is not None]
    day_moves = [t for t in tickers if t.day_pct is not None]
    previous_moves = [t.previous_hour_pct for t in tickers if t.previous_hour_pct is not None]
    by_hour = sorted(moves, key=lambda t: t.hour_pct, reverse=True)
    by_day = sorted(day_moves, key=lambda t: t.day_pct, reverse=True)

    grouped: dict[str, list[float]] = {}
    for ticker in moves:
        grouped.setdefault(ticker.category, []).append(ticker.hour_pct)
    groups = sorted(
        ((category, statistics.fmean(values), len(values)) for category, values in grouped.items() if len(values) >= 3),
        key=lambda group: group[1],
        reverse=True,
    )

    strong, watch = settings.alert_score_threshold, settings.watchlist_score_threshold

    def transition(ticker: TickerHour) -> Transition:
        return Transition(ticker.symbol, ticker.score, ticker.previous_score)

    def was_strong(t: TickerHour) -> bool:
        return t.previous_score is not None and t.previous_score >= strong

    def was_watch_or_better(t: TickerHour) -> bool:
        return t.previous_score is not None and t.previous_score >= watch

    by_score = sorted(tickers, key=lambda t: t.score, reverse=True)
    status_counts = Counter(t.status for t in tickers)
    bar_end = min(bar + timedelta(hours=1), datetime.combine(ny_date(bar), SESSION_CLOSE, tzinfo=NEW_YORK).astimezone(timezone.utc))

    return HourFacts(
        bar=bar,
        bar_end=bar_end,
        tickers=tickers,
        scored=len(every),
        first_bar_of_session=first_bar,
        closing_bar=bar_end < bar + timedelta(hours=1),
        up=sum(1 for t in moves if t.hour_pct >= FLAT_BAND_PCT),
        down=sum(1 for t in moves if t.hour_pct <= -FLAT_BAND_PCT),
        flat=sum(1 for t in moves if abs(t.hour_pct) < FLAT_BAND_PCT),
        median_hour_pct=statistics.median(t.hour_pct for t in moves) if moves else None,
        previous_breadth=(
            (sum(1 for p in previous_moves if p >= FLAT_BAND_PCT), sum(1 for p in previous_moves if p <= -FLAT_BAND_PCT))
            if previous_moves
            else None
        ),
        day_up=sum(1 for t in day_moves if t.day_pct >= FLAT_BAND_PCT),
        day_down=sum(1 for t in day_moves if t.day_pct <= -FLAT_BAND_PCT),
        median_day_pct=statistics.median(t.day_pct for t in day_moves) if day_moves else None,
        leaders=[t for t in by_hour[:3] if t.hour_pct >= FLAT_BAND_PCT],
        laggards=[t for t in reversed(by_hour[-3:]) if t.hour_pct <= -FLAT_BAND_PCT],
        day_leaders=[t for t in by_day[:3] if t.day_pct >= FLAT_BAND_PCT],
        day_laggards=[t for t in reversed(by_day[-3:]) if t.day_pct <= -FLAT_BAND_PCT],
        groups=groups,
        heavy_volume=sorted(
            (t for t in moves if t.volume_ratio is not None and t.volume_ratio >= HEAVY_VOLUME_RATIO and not first_bar),
            key=lambda t: t.volume_ratio,
            reverse=True,
        )[:3],
        status_counts=dict(status_counts),
        previous_strong=sum(1 for t in tickers if was_strong(t)),
        previous_watch=sum(1 for t in tickers if was_watch_or_better(t) and not was_strong(t)),
        newly_strong=[transition(t) for t in by_score if t.status == "strong_setup" and not was_strong(t)],
        lost_strong=[transition(t) for t in by_score if was_strong(t) and t.status != "strong_setup"],
        newly_watch=[transition(t) for t in by_score if t.status == "watchlist_setup" and not was_watch_or_better(t)],
        weakening=[transition(t) for t in by_score if t.status == "weakening"],
        invalidated=[transition(t) for t in by_score if t.status == "invalidated"],
    )


def coverage(facts: HourFacts) -> float:
    return len(facts.tickers) / facts.scored if facts.scored else 0.0


def group_name(category: str) -> str:
    return GROUP_NAMES.get(category, category.replace("_", " "))


def holdings_facts(overlays: list[dict[str, Any]], facts: HourFacts) -> list[tuple[str, str]]:
    """The reader's own positions against this bar: percentages only, never dollars or quantities.
    Several lots of one symbol are combined on cost so the P/L is the position's, not one lot's."""
    by_symbol = {t.symbol: t for t in facts.tickers}
    newest: dict[str, datetime] = {}
    lots: dict[str, list[dict[str, Any]]] = {}
    for row in overlays:
        symbol = str(row.get("symbol") or "").upper()
        when = _parse_time(row.get("candle_time"))
        if not symbol or when is None:
            continue
        if symbol not in newest or when > newest[symbol]:
            newest[symbol], lots[symbol] = when, [row]
        elif when == newest[symbol]:
            lots[symbol].append(row)

    lines: list[tuple[str, str]] = []
    for symbol in sorted(lots):
        ticker = by_symbol.get(symbol)
        if ticker is None:
            lines.append((symbol, f"{symbol}: not in this bar's scan"))
            continue
        parts = []
        if ticker.hour_pct is not None:
            parts.append(f"{move_words(ticker.hour_pct)} {'since the last close' if facts.first_bar_of_session else 'this bar'}")
        if ticker.day_pct is not None and not facts.first_bar_of_session:
            parts.append(f"{move_words(ticker.day_pct)} on the day")
        parts.append(f"score {round(ticker.score)} ({STATUS_WORDS.get(ticker.status, ticker.status.replace('_', ' '))})")
        rows = lots[symbol]
        if len(rows) == 1:
            pl_pct = _number(rows[0].get("unrealised_pl_pct"))
        else:
            pl = sum(_number(r.get("unrealised_pl")) or 0.0 for r in rows)
            cost = sum((_number(r.get("market_value")) or 0.0) - (_number(r.get("unrealised_pl")) or 0.0) for r in rows)
            pl_pct = (pl / cost) * 100 if cost > 0 else None
        if pl_pct is not None:
            parts.append(f"position {move_words(pl_pct)} overall")
        lines.append((symbol, f"{symbol}: " + ", ".join(parts)))
    return lines


def watchlist_facts(overlays: list[dict[str, Any]], facts: HourFacts) -> list[tuple[str, str]]:
    """Watchlist names at or near their trigger - the rest are not news."""
    by_symbol = {t.symbol: t for t in facts.tickers}
    newest: dict[str, tuple[datetime, str]] = {}
    for row in overlays:
        symbol = str(row.get("symbol") or "").upper()
        when = _parse_time(row.get("candle_time"))
        if not symbol or when is None:
            continue
        if symbol not in newest or when > newest[symbol][0]:
            newest[symbol] = (when, str(row.get("watchlist_trigger_state") or ""))
    lines: list[tuple[str, str]] = []
    for symbol in sorted(newest):
        state = newest[symbol][1]
        if state not in ("triggered", "approaching") or symbol not in by_symbol:
            continue
        ticker = by_symbol[symbol]
        lines.append((symbol, f"{symbol}: {state} (score {round(ticker.score)}, {STATUS_WORDS.get(ticker.status, ticker.status)})"))
    return lines


def macro_for_bar(snapshot: dict[str, Any] | None, bar: datetime) -> dict[str, Any]:
    """The market backdrop, only when the snapshot describes the same US session as the bar.
    Older snapshots lack `us_session_date` and are left out rather than guessed about."""
    if not snapshot or not isinstance(snapshot.get("payload"), dict):
        return {}
    payload = snapshot["payload"]
    if payload.get("us_session_date") != ny_date(bar).isoformat():
        return {}
    return {key: payload.get(key) for key in ("sp500_change_pct", "nasdaq_change_pct", "vix_price", "yield_10y", "audusd_price") if payload.get(key) is not None}


def macro_text(macro: dict[str, Any], sheet: FactSheet | None = None) -> str | None:
    """'S&P 500 up 0.7% on the day, Nasdaq up 1.2% on the day, VIX at 16.1, US 10-year yield 5.28%, AUD/USD 0.6966'.
    With a sheet, the same text is registered as general facts."""
    parts = []
    for label, key in (("S&P 500", "sp500_change_pct"), ("Nasdaq", "nasdaq_change_pct")):
        value = _number(macro.get(key))
        if value is not None:
            parts.append(f"{label} {move_words(value)} on the day")
    vix = _number(macro.get("vix_price"))
    if vix is not None:
        parts.append(f"VIX at {vix:.1f}")
    ten_year = _number(macro.get("yield_10y"))
    if ten_year is not None:
        parts.append(f"US 10-year yield {ten_year:.2f}%")
    aud = _number(macro.get("audusd_price"))
    if aud is not None:
        parts.append(f"AUD/USD {aud:.4f}")
    if not parts:
        return None
    text = ", ".join(parts)
    return sheet.general(text) if sheet else text


def _transition_text(sheet: FactSheet, item: Transition) -> str:
    text = f"{item.symbol} (score {round(item.score)}"
    if item.previous_score is not None:
        text += f", from {round(item.previous_score)}"
    return sheet.about(item.symbol, text + ")")


def _listed(sheet: FactSheet, items: list[Transition], limit: int = 6) -> str:
    shown = ", ".join(_transition_text(sheet, item) for item in items[:limit])
    extra = len(items) - limit
    return f"{shown} and {sheet.general(str(extra))} more" if extra > 0 else shown


def build_sheet(facts: HourFacts) -> FactSheet:
    """The grounding handed to the model: every statement it is allowed to make, in words."""
    sheet = FactSheet()
    say, general = sheet.say, sheet.general
    scanned = general(str(len(facts.tickers)))
    span = "since the last close" if facts.first_bar_of_session else "this bar"

    if facts.first_bar_of_session:
        say("This is the first bar of the US session, so each move below is measured from the previous session's close - it includes the overnight gap.")
    elif facts.closing_bar:
        say("This is the final bar of the US session: it covers the last half hour of trading, into the close.")
    say(f"Names scanned on this bar: {scanned}.")
    say(general(f"Breadth {span}: {facts.up} up, {facts.down} down, {facts.flat} flat."))
    if facts.median_hour_pct is not None:
        say(general(f"Median move {span}: {move_words(facts.median_hour_pct)}."))
    if facts.previous_breadth:
        say(general(f"Breadth over the previous bar: {facts.previous_breadth[0]} up, {facts.previous_breadth[1]} down."))
    if facts.leaders:
        say(f"Biggest gains {span}: " + ", ".join(sheet.about(t.symbol, f"{t.symbol} {move_words(t.hour_pct)}") for t in facts.leaders) + ".")
    if facts.laggards:
        say(f"Biggest falls {span}: " + ", ".join(sheet.about(t.symbol, f"{t.symbol} {move_words(t.hour_pct)}") for t in facts.laggards) + ".")
    if not facts.first_bar_of_session and (facts.day_up or facts.day_down):
        say(general(f"On the day so far (against the previous close): {facts.day_up} up, {facts.day_down} down."))
        if facts.median_day_pct is not None:
            say(general(f"Median move on the day: {move_words(facts.median_day_pct)}."))
        if facts.day_leaders:
            say("Best on the day: " + ", ".join(sheet.about(t.symbol, f"{t.symbol} {move_words(t.day_pct)}") for t in facts.day_leaders) + ".")
        if facts.day_laggards:
            say("Worst on the day: " + ", ".join(sheet.about(t.symbol, f"{t.symbol} {move_words(t.day_pct)}") for t in facts.day_laggards) + ".")
    if facts.groups:
        say(
            f"Average move {span} by group: "
            + ", ".join(general(f"{group_name(category)} {move_words(mean)} ({count} names)") for category, mean, count in facts.groups)
            + "."
        )
    if facts.heavy_volume:
        say(
            "Volume well above normal (bar volume against its own 20-bar average): "
            + ", ".join(sheet.about(t.symbol, f"{t.symbol} at {t.volume_ratio:.1f}x") for t in facts.heavy_volume)
            + "."
        )

    counts = facts.status_counts
    say(
        "Setups now: "
        + general(
            f"{counts.get('strong_setup', 0)} strong setups, {counts.get('watchlist_setup', 0)} watchlist setups, "
            f"{counts.get('weakening', 0)} weakening, {counts.get('invalidated', 0)} invalidated, {counts.get('no_signal', 0)} with no signal."
        )
    )
    say(general(f"Setups on the previous bar: {facts.previous_strong} strong, {facts.previous_watch} watchlist."))
    for label, items in (
        ("Became strong setups on this bar", facts.newly_strong),
        ("Dropped out of strong setup on this bar", facts.lost_strong),
        ("Became watchlist setups on this bar", facts.newly_watch),
        ("Weakening on this bar - the score fell sharply", facts.weakening),
        ("Invalidated on this bar - a strong setup failed", facts.invalidated),
    ):
        if items:
            say(f"{label} ({general(str(len(items)))}): " + _listed(sheet, items) + ".")
    if not (facts.newly_strong or facts.lost_strong or facts.newly_watch or facts.weakening or facts.invalidated):
        say("No setup changed status on this bar.")

    backdrop = macro_text(facts.macro, sheet)
    if backdrop:
        say(f"Market backdrop at the time of the scan: {backdrop}.")
    if facts.holdings:
        say("The reader's holdings: " + "; ".join(sheet.about(symbol, text) for symbol, text in facts.holdings) + ".")
    if facts.watchlist:
        say("On the reader's watchlist, at or near a trigger: " + "; ".join(sheet.about(symbol, text) for symbol, text in facts.watchlist) + ".")
    return sheet


def figure_lines(facts: HourFacts) -> list[str]:
    """The compact figures the reader sees under the read - the same numbers, signed."""
    lines: list[str] = []
    backdrop = macro_text(facts.macro)
    if backdrop:
        lines.append(f"Market at scan time: {backdrop}")
    span = "Since the last close" if facts.first_bar_of_session else ("Closing half hour" if facts.closing_bar else "This hour")
    breadth = f"{facts.up} up, {facts.down} down" + (f", {facts.flat} flat" if facts.flat else "")
    median = f", median {fmt_pct(facts.median_hour_pct)}" if facts.median_hour_pct is not None else ""
    lines.append(f"{span} ({len(facts.tickers)} names): {breadth}{median}")
    if not facts.first_bar_of_session and (facts.day_up or facts.day_down):
        day_median = f", median {fmt_pct(facts.median_day_pct)}" if facts.median_day_pct is not None else ""
        lines.append(f"On the day: {facts.day_up} up, {facts.day_down} down{day_median}")
    if facts.leaders:
        lines.append("Leaders: " + ", ".join(f"{t.symbol} {fmt_pct(t.hour_pct)}" for t in facts.leaders))
    if facts.laggards:
        lines.append("Laggards: " + ", ".join(f"{t.symbol} {fmt_pct(t.hour_pct)}" for t in facts.laggards))
    if len(facts.groups) >= 2:
        best, worst = facts.groups[0], facts.groups[-1]
        lines.append(f"Groups: {group_name(best[0])} {fmt_pct(best[1])} best, {group_name(worst[0])} {fmt_pct(worst[1])} worst")
    counts = facts.status_counts
    setups = f"Setups: {counts.get('strong_setup', 0)} strong, {counts.get('watchlist_setup', 0)} on watch"
    changes = []
    for label, items in (
        ("new strong", facts.newly_strong),
        ("left strong", facts.lost_strong),
        ("new watch", facts.newly_watch),
        ("weakening", facts.weakening),
        ("invalidated", facts.invalidated),
    ):
        if items:
            shown = ", ".join(item.symbol for item in items[:4]) + (f" +{len(items) - 4}" if len(items) > 4 else "")
            changes.append(f"{label}: {shown}")
    lines.append(setups + (" - " + "; ".join(changes) if changes else ""))
    if facts.holdings:
        lines.append("Your holdings: " + "; ".join(text for _, text in facts.holdings))
    if facts.watchlist:
        lines.append("Your watchlist: " + "; ".join(text for _, text in facts.watchlist))
    return lines


# --------------------------------------------------------------------------------------------
# The read - Claude narrates the facts; nothing it writes is trusted until the guard has passed it.


@dataclass(frozen=True)
class Narration:
    text: str | None
    model: str  # the model that actually served the request
    effort: str
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    note: str | None = None  # why there is no text, for the reader
    reason: str = "ok"  # a coarse, public-safe label for the ledger and the log
    guard_removed: int = 0


def cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    dearest = max(PRICES_PER_MTOK.values())
    input_rate, output_rate = PRICES_PER_MTOK.get(model, dearest)
    return (input_tokens * input_rate + output_tokens * output_rate) / 1_000_000


def billable_tokens(usage: Any) -> tuple[int, int]:
    """Input and output tokens to pay for. Cache writes are counted at 1.25x and cache reads at full
    price (both overstate, never understate), and when the response carries per-attempt
    `usage.iterations` (a server-side fallback ran) the attempts are summed, because the top-level
    usage covers only the attempt that produced the returned message."""

    def side(block: Any) -> tuple[int, int]:
        creation = int(getattr(block, "cache_creation_input_tokens", 0) or 0)
        read = int(getattr(block, "cache_read_input_tokens", 0) or 0)
        input_tokens = int(getattr(block, "input_tokens", 0) or 0) + read + -(-creation * 5 // 4)
        return input_tokens, int(getattr(block, "output_tokens", 0) or 0)

    top_in, top_out = side(usage)
    iterations = getattr(usage, "iterations", None) or []
    if not iterations:
        return top_in, top_out
    total_in = sum(side(entry)[0] for entry in iterations)
    total_out = sum(side(entry)[1] for entry in iterations)
    return max(top_in, total_in), max(top_out, total_out)


def narrate(sheet: FactSheet, *, model: str, effort: str) -> Narration:
    """One Claude call. Any failure returns a Narration with no text and the reason - never raises."""
    try:
        import anthropic
    except ImportError:
        return Narration(None, model, effort, note="the AI library is not installed on this runner", reason="no_library")

    request: dict[str, Any] = {
        "model": model,
        # Thinking is always on for this model and is billed as output, so the ceiling has to leave
        # room for it; the prompt, not the ceiling, is what keeps the read short.
        "max_tokens": 16000,
        "output_config": {"effort": effort},
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": f"Facts for this bar:\n<facts>\n{sheet.text}\n</facts>\n\nWrite the read."}],
    }
    try:
        client = anthropic.Anthropic(timeout=150.0, max_retries=1)
        try:
            # A safety classifier can decline a request; the server-side fallback re-runs a declined
            # one on Anthropic's recommended substitute inside the same call.
            response = client.beta.messages.create(betas=["server-side-fallback-2026-07-01"], fallbacks="default", **request)
        except anthropic.BadRequestError:
            LOGGER.warning("fallback-enabled request was rejected - retrying without the fallback option")
            response = client.messages.create(**request)
    except anthropic.AuthenticationError:
        return Narration(None, model, effort, note="the Anthropic API key was rejected", reason="auth")
    except anthropic.RateLimitError:
        return Narration(None, model, effort, note="the Anthropic API was rate limited", reason="rate_limit")
    except anthropic.APIStatusError as exc:
        return Narration(None, model, effort, note=f"the Anthropic API returned an error ({exc.status_code})", reason=f"api_{exc.status_code}")
    except anthropic.APIConnectionError:
        return Narration(None, model, effort, note="the Anthropic API could not be reached", reason="connection")

    served = str(getattr(response, "model", None) or model)
    input_tokens, output_tokens = billable_tokens(response.usage)
    # Price at whichever of the requested and serving model is dearer: the budget must never be
    # understated because a fallback model answered.
    spent = max(cost_usd(model, input_tokens, output_tokens), cost_usd(served, input_tokens, output_tokens))
    base = Narration(None, served, effort, input_tokens, output_tokens, spent)

    if response.stop_reason == "refusal":
        return replace(base, note="the model declined to write this bar's read", reason="refusal")
    if response.stop_reason == "max_tokens":
        return replace(base, note="the model's read was cut off before it finished", reason="max_tokens")
    text = " ".join(block.text for block in response.content if block.type == "text").strip()
    verdict = guard_ai_read(text, sheet)
    if verdict.removed:
        LOGGER.warning("guard removed %d sentence(s): %s", len(verdict.removed), ", ".join(sorted(set(verdict.categories))))
    if not verdict.ok:
        return replace(
            base,
            note="the model's read failed Lyra's checks (" + "; ".join(verdict.reasons[:2]) + ")",
            reason="guard_blocked",
            guard_removed=len(verdict.removed),
        )
    return replace(base, text=verdict.text, guard_removed=len(verdict.removed))


# --------------------------------------------------------------------------------------------
# Budget pacing.


def weekdays_remaining(today: date) -> int:
    """Weekdays from today to the end of the month, today included."""
    count = 0
    day = today
    while day.month == today.month:
        if day.weekday() < 5:
            count += 1
        day += timedelta(days=1)
    return count


def month_spend(runs: list[dict[str, Any]]) -> float:
    total = 0.0
    for run in runs:
        payload = run.get("payload") if isinstance(run.get("payload"), dict) else {}
        total += _number(payload.get("cost_usd")) or 0.0
    return total


def choose_effort(configured: str, runs: list[dict[str, Any]], budget: float, now: datetime) -> str:
    """The configured effort, unless this month's measured cost at that effort would not last the
    month - then one level lower. With nothing measured yet, the configured level runs and is
    measured. Uses weekdays x bars per session as the expected remaining count (holidays ignored,
    which errs towards saving)."""
    if configured not in EFFORT_LEVELS:
        return DEFAULT_EFFORT
    if budget <= 0 or EFFORT_LEVELS.index(configured) == 0:
        return configured
    costs = [
        _number(payload.get("cost_usd")) or 0.0
        for payload in (run.get("payload") for run in runs)
        if isinstance(payload, dict) and payload.get("effort") == configured and payload.get("ai") and (_number(payload.get("cost_usd")) or 0.0) > 0
    ]
    if not costs:
        return configured
    remaining_budget = budget - month_spend(runs)
    expected_remaining = weekdays_remaining(now.date()) * BARS_PER_SESSION
    if remaining_budget < expected_remaining * statistics.fmean(costs):
        return EFFORT_LEVELS[EFFORT_LEVELS.index(configured) - 1]
    return configured


# --------------------------------------------------------------------------------------------
# The message.


def quiet_now(spec: str, local_now: datetime) -> bool:
    """SUMMARY_QUIET_HOURS 'start-end' in the reader's clock, wrapping midnight. Blank or 'off' = never."""
    spec = (spec or "").strip().lower()
    if not spec or spec in ("off", "none", "never"):
        return False
    try:
        start_text, end_text = spec.split("-")
        start, end = int(start_text) % 24, int(end_text) % 24
    except ValueError:
        return False
    hour = local_now.hour
    if start == end:
        return False
    return start <= hour < end if start < end else hour >= start or hour < end


def compose_message(
    facts: HourFacts,
    narration: Narration | None,
    *,
    now: datetime,
    month_to_date: float,
    budget: float,
    reader_zone: ZoneInfo,
) -> str:
    bar_ny, end_ny = facts.bar.astimezone(NEW_YORK), facts.bar_end.astimezone(NEW_YORK)
    bar_local, end_local = facts.bar.astimezone(reader_zone), facts.bar_end.astimezone(reader_zone)
    place = str(reader_zone.key).rsplit("/", 1)[-1].replace("_", " ")
    stale = now - facts.bar_end > STALE_AFTER

    heading = "Lyra - US tech, " + ("closing half hour" if facts.closing_bar else "the hour") + f" {fmt_clock(bar_ny)}-{fmt_clock(end_ny)} New York, {fmt_day(bar_ny)}"
    local = f"({fmt_clock(bar_local)}-{fmt_clock(end_local)} {place}"
    if bar_local.date() != bar_ny.date():
        local += f", {fmt_day(end_local)}"
    local += ". The latest completed bar - the market has been closed since.)" if stale else ")"

    parts = [heading, local, ""]
    if narration and narration.text:
        parts += [narration.text, ""]
    parts += figure_lines(facts)
    parts.append("")
    if narration and narration.text:
        model_name = MODEL_NAMES.get(narration.model, narration.model)
        parts.append(
            f"Read by {model_name} at {narration.effort} effort from the figures above - "
            f"${narration.cost_usd:.3f} this read, ${month_to_date:.2f} of ${budget:.0f} this month."
        )
    elif narration and narration.note:
        parts.append(f"Figures only this hour - {narration.note}.")
    else:
        parts.append("Figures only this hour.")
    parts.append("Research, not advice.")
    return "\n".join(parts)


# --------------------------------------------------------------------------------------------
# I/O - reads and the run ledger. Kept thin so everything above is testable without a database.

_SIGNAL_SELECT_LEAN = "candle_time,signal_score,previous_signal_score,signal_status,volume_ratio:raw_payload->volume_ratio"
_SIGNAL_SELECT_FULL = "candle_time,signal_score,previous_signal_score,signal_status,raw_payload"
_CANDLE_SELECT = "candle_time,close"
CANDLES_PER_TICKER = 9  # one session (seven hourly bars) plus the previous session's last two bars


def _universe_query(client: Any, timeframe: str, signal_select: str, candles: int):
    select = f"symbol,company_name,category,stock_signals({signal_select})" + (f",stock_candles({_CANDLE_SELECT})" if candles else "")
    query = (
        client.table("stock_tickers")
        .select(select)
        .eq("is_active", True)
        .eq("scan_enabled", True)
        .eq("stock_signals.timeframe", timeframe)
        .order("symbol")
        .order("candle_time", desc=True, foreign_table="stock_signals")
        .limit(1, foreign_table="stock_signals")
    )
    if candles:
        query = (
            query.eq("stock_candles.timeframe", timeframe)
            .order("candle_time", desc=True, foreign_table="stock_candles")
            .limit(candles, foreign_table="stock_candles")
        )
    return query


def newest_bar(client: Any, timeframe: str) -> datetime | None:
    """The cheap question asked on every firing: what is the newest bar the scanner has scored?"""
    rows = _universe_query(client, timeframe, "candle_time", 0).execute().data or []
    bars = [bar for bar in (_parse_time((row.get("stock_signals") or [{}])[0].get("candle_time")) for row in rows if row.get("stock_signals")) if bar]
    return max(bars) if bars else None


def load_universe(client: Any, timeframe: str) -> list[dict[str, Any]]:
    """Every ticker with its newest signal and recent candles - one index-backed request."""
    try:
        return _universe_query(client, timeframe, _SIGNAL_SELECT_LEAN, CANDLES_PER_TICKER).execute().data or []
    except Exception as exc:  # noqa: BLE001 - the lean projection is an optimisation, not a requirement
        LOGGER.warning("lean signal read was refused (%s) - falling back to the full payload", type(exc).__name__)
        return _universe_query(client, timeframe, _SIGNAL_SELECT_FULL, CANDLES_PER_TICKER).execute().data or []


def load_summary_runs(client: Any, since: datetime) -> list[dict[str, Any]]:
    result = (
        client.table("stock_scanner_runs")
        .select("started_at,status,payload")
        .eq("job_name", JOB_NAME)
        .gte("started_at", since.isoformat())
        .order("started_at", desc=True)
        .limit(1000)
        .execute()
    )
    return list(result.data or [])


def last_summarised_bar(runs: list[dict[str, Any]]) -> datetime | None:
    bars = [
        bar
        for bar in (_parse_time(run["payload"].get("bar")) for run in runs if run.get("status") == "success" and isinstance(run.get("payload"), dict))
        if bar is not None
    ]
    return max(bars) if bars else None


def load_market_snapshot(client: Any) -> dict[str, Any] | None:
    rows = client.table("market_context_snapshots").select("captured_at,payload").order("captured_at", desc=True).limit(1).execute().data or []
    return rows[0] if rows else None


def load_overlays(client: Any, table: str, select: str, user_id: str, since: datetime) -> list[dict[str, Any]]:
    return list(
        client.table(table)
        .select(select)
        .eq("user_id", user_id)
        .gte("candle_time", since.isoformat())
        .order("candle_time", desc=True)
        .limit(200)
        .execute()
        .data
        or []
    )


def _record(client: Any, run_id: str | None, status: str, payload: dict[str, Any], *, delivered: bool, error: str | None = None) -> None:
    """Write the run row; retried because this is the write that stops the next firing re-sending."""
    if not client or not run_id:
        return
    row = {
        "status": status,
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "alerts_sent": 1 if delivered else 0,
        "error_message": error,
        "payload": payload,
    }
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            client.table("stock_scanner_runs").update(row, returning=_NO_ECHO).eq("id", run_id).execute()
            return
        except Exception as exc:  # noqa: BLE001 - a transient write failure must not drop the ledger
            last_error = exc
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"could not record the summary run: {type(last_error).__name__}")


def _env_float(name: str, default: float) -> float:
    value = _number(os.getenv(name))
    return value if value is not None and value >= 0 else default


def run(now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    settings = load_settings()

    if not settings.enable_hourly_digest:
        LOGGER.info("Hourly summary is off (ENABLE_HOURLY_DIGEST is not true) - nothing sent.")
        return 0
    bot_token = os.getenv("SUMMARY_TELEGRAM_BOT_TOKEN", "")
    chat_id = os.getenv("SUMMARY_TELEGRAM_CHAT_ID", "")
    if not bot_token or not chat_id:
        LOGGER.info("No SUMMARY_TELEGRAM_BOT_TOKEN / SUMMARY_TELEGRAM_CHAT_ID - nowhere to send the summary.")
        return 0
    repository = SupabaseRepository(settings)
    if not repository.client:
        LOGGER.info("Supabase is not configured - demo mode, no summary.")
        return 0
    client = repository.client
    timeframe = settings.default_timeframe
    force = os.getenv("SUMMARY_FORCE", "").strip().lower() in ("1", "true", "yes")

    bar = newest_bar(client, timeframe)
    if bar is None:
        LOGGER.info("Nothing has been scanned yet - no summary.")
        return 0
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    runs = load_summary_runs(client, min(month_start, now - timedelta(days=7)))
    last_bar = last_summarised_bar(runs)
    if last_bar is not None and last_bar >= bar and not force:
        LOGGER.info("No new bar since the last summary (%s) - nothing sent.", bar.isoformat())
        return 0

    facts = build_facts(load_universe(client, timeframe), settings)
    if facts is None:
        LOGGER.info("No scored tickers at the newest bar - no summary.")
        return 0
    if coverage(facts) < MIN_COVERAGE:
        LOGGER.warning(
            "Only %d of %d scored names are on the newest bar (%s) - waiting for the scan to catch up.",
            len(facts.tickers), facts.scored, facts.bar.isoformat(),
        )
        return 0

    facts.macro = macro_for_bar(load_market_snapshot(client), facts.bar)
    if settings.default_user_id:
        try:
            since = facts.bar - timedelta(days=5)
            facts.holdings = holdings_facts(
                load_overlays(client, "portfolio_signal_overlay", "symbol,candle_time,unrealised_pl,unrealised_pl_pct,market_value", settings.default_user_id, since),
                facts,
            )
            facts.watchlist = watchlist_facts(
                load_overlays(client, "watchlist_signal_overlay", "symbol,candle_time,watchlist_trigger_state", settings.default_user_id, since),
                facts,
            )
        except Exception as exc:  # noqa: BLE001 - the book is an extra; the market read must still go out
            LOGGER.warning("could not read the operator's book for the summary: %s", type(exc).__name__)

    month_runs = [run_row for run_row in runs if (_parse_time(run_row.get("started_at")) or now) >= month_start]
    spent_before = month_spend(month_runs)
    budget = _env_float("SUMMARY_MONTHLY_BUDGET_USD", DEFAULT_MONTHLY_BUDGET_USD)
    model = os.getenv("SUMMARY_MODEL", "").strip() or DEFAULT_MODEL
    configured_effort = os.getenv("SUMMARY_EFFORT", "").strip().lower() or DEFAULT_EFFORT

    run_id = repository.create_run(JOB_NAME, timeframe)
    sheet = build_sheet(facts)
    if not os.getenv("ANTHROPIC_API_KEY"):
        narration = Narration(None, model, configured_effort, note="no Anthropic API key is configured", reason="no_key")
    elif spent_before >= budget:
        narration = Narration(None, model, configured_effort, note=f"this month's ${budget:.0f} AI budget is used up", reason="budget")
    else:
        narration = narrate(sheet, model=model, effort=choose_effort(configured_effort, month_runs, budget, now))
    spent_after = spent_before + narration.cost_usd

    ledger = {
        "bar": None,  # set only once the message is delivered - an undelivered bar must be retried
        "bar_attempted": facts.bar.isoformat(),
        "names": len(facts.tickers),
        "ai": bool(narration.text),
        "reason": narration.reason,
        "guard_removed": narration.guard_removed,
        "model": narration.model,
        "effort": narration.effort,
        "input_tokens": narration.input_tokens,
        "output_tokens": narration.output_tokens,
        "cost_usd": round(narration.cost_usd, 6),
        "pricing_as_of": PRICING_AS_OF,
    }
    # The spend is on the ledger before the send, so a crash between the two cannot lose it.
    _record(client, run_id, "running", ledger, delivered=False)

    reader_zone = ZoneInfo(os.getenv("SUMMARY_TIMEZONE", "").strip() or DEFAULT_TIMEZONE)
    message = compose_message(facts, narration, now=now, month_to_date=spent_after, budget=budget, reader_zone=reader_zone)
    silent = quiet_now(os.getenv("SUMMARY_QUIET_HOURS", DEFAULT_QUIET_HOURS), now.astimezone(reader_zone))
    delivery = send_telegram_message(
        message, replace(settings, telegram_bot_token=bot_token, telegram_chat_id=chat_id), chat_id=chat_id, silent=silent
    )
    delivered = delivery.sent_status == "sent"
    _record(
        client,
        run_id,
        "success" if delivered else "failed",
        {**ledger, "bar": facts.bar.isoformat() if delivered else None, "silent": silent},
        delivered=delivered,
        error=None if delivered else delivery.error_message,
    )
    LOGGER.info(
        "hourly summary for bar %s: delivered=%s silent=%s ai=%s reason=%s guard_removed=%d model=%s effort=%s tokens=%d in / %d out cost=$%.4f month=$%.2f of $%.0f",
        facts.bar.isoformat(), delivered, silent, bool(narration.text), narration.reason, narration.guard_removed,
        narration.model, narration.effort, narration.input_tokens, narration.output_tokens, narration.cost_usd, spent_after, budget,
    )
    if not delivered:
        LOGGER.error("The summary was NOT delivered: %s", delivery.error_message)
        return 1
    return 0


def main() -> None:
    sys.exit(run())


if __name__ == "__main__":
    main()
