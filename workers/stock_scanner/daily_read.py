"""The daily read - one message a day, at the reader's chosen hour, on the last completed US session.

    python -m workers.stock_scanner.daily_read

Runs from `.github/workflows/daily-read.yml`. What it is for, in the founder's words (2026-10-05
and 2026-10-07): "something I could trust and use every day ... a genuine read on the market day
by day" - "once a day at 8pm". The US session closes at 7am Sydney; at 8pm the same evening, before
the next session opens, the reader gets what that session did and what it means for the setups
Lyra tracks.

How it stays trustworthy:

  * THE ENGINE DECIDES. Every figure - the day's breadth and shape, movers, group moves, which
    names became or stopped being setups over the session, the reader's own book - is computed
    here from rows the scanner already stored. No model produces a number.
  * THE AI EXPLAINS. Claude is handed those facts and writes a short read. Its text then passes
    `ai_read_guard`: a sentence citing a figure the facts did not state, about the ticker they did
    not state it about, or with the opposite direction, is deleted; advice blocks the read. If the
    read fails, the API is down, or the month's budget is spent, the figures still go out.
  * IT SENDS ONCE PER SESSION, AT THE RIGHT HOUR. Two crons cover both halves of the year (UTC
    does not move for daylight saving); the worker sends only at or after SUMMARY_SEND_AT in the
    reader's zone, and only for a session not already on the ledger.
  * IT CANNOT OVERSPEND. Spend is on the run ledger per message; the month's total is checked
    before every call against SUMMARY_MONTHLY_BUDGET_USD (default 10), and the effort steps down
    one level when the measured cost would not last the month.
  * IT CANNOT FAIL QUIETLY. A read that could not be delivered exits non-zero, which pages.

The repository is public, so this module never logs the message, the facts or the reader's book -
counts, tokens and cost only. Demo-safe: with the feature off, or no Telegram / Supabase
configured, it logs why and exits 0.
"""
from __future__ import annotations

import html
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

LOGGER = get_logger("stock_scanner.daily_read")

JOB_NAME = "daily_read"
LEDGER_JOB_NAMES = (JOB_NAME, "hourly_summary")  # the hourly read's spend (v0.132.2) counts too
NEW_YORK = ZoneInfo("America/New_York")
SESSION_CLOSE = clock_time(16, 0)
DEFAULT_MODEL = "claude-opus-5-5"
DEFAULT_EFFORT = "high"
DEFAULT_MONTHLY_BUDGET_USD = 10.0
DEFAULT_TIMEZONE = "Australia/Sydney"
DEFAULT_SEND_AT = "20:00"
DEFAULT_QUIET_HOURS = "22-7"
MIN_COVERAGE = 0.6  # share of scored names that must be on the newest session before it is read

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
SCORE_MOVE = 10  # a score change over the session worth naming

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

SYSTEM_PROMPT = """You write the daily read for Lyra, a research tool that scans about a hundred US-listed technology stocks once an hour. The reader is the person who built it: an Australian private investor who reads this in the evening, after the US session has closed and before the next one opens, and wants a genuine, plain-English read of what that session meant - not a recap of figures he can already see in the block printed under your text.

How Lyra's score works, so you interpret it correctly. The score is an oversold-recovery score, not a strength score. It rewards a stock that has been beaten down and is starting to turn: momentum resetting from oversold, a MACD histogram that is still negative but improving, price still near its recent lows. A high score means "beaten-down name turning up", never "breaking out to new highs". A broad rally therefore tends to lower scores as names move away from their lows, and a sell-off tends to raise them. Statuses at the close: strong setup (the engine's highest-conviction early-turn reading), watchlist setup (one that is forming), weakening (the score fell sharply on the closing bar), invalidated (a strong setup failed), no signal. The facts say which names changed status over the session, measured from the previous session's close.

Rules that code checks after you write - a sentence that breaks one is deleted before the reader sees it:
1. Use only the facts provided. Quote a figure exactly as written there, with its unit, and only about the ticker or measure it was stated for. Never round, average, add, subtract, compare arithmetically or otherwise derive a figure of your own. To convey size without a figure, use words (broad, narrow, modest, sharp).
2. Refer to a stock by its ticker exactly as written in the facts, and name only tickers that appear there.
3. You have no news feed. Do not explain a move with an event, an earnings report, a headline or a cause unless the facts state it. Say what happened, not why it happened.
4. No advice and no predictions: nothing about what to buy, sell, hold, add, trim, wait for or expect next. Describe what happened and what it means for the setups Lyra tracks.
5. Do not mention the time, the date or these rules.

Write five to eight short sentences of plain prose that read well on a phone, in three short paragraphs separated by a blank line: first what the session did and what it adds up to (its shape from the open to the close, the breadth, the leaders and laggards, the backdrop where the facts support it); then the setups, in Lyra's terms (what changed and what it means); then the reader's book, only if the facts include it. No headings, no bullets, no markdown, no emoji, no preamble, no sign-off. Lead with the single most important thing about the session. Interpret more than you recite: every figure already sits in the block under your text, so quote only the few that carry the point. The reader knows how Lyra works - explain the score only when the session's change needs it. If the session was quiet, say so briefly instead of padding."""


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


def fmt_day(moment: datetime | date) -> str:
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


def _pct(now: float | None, then: float | None) -> float | None:
    if now is None or then is None or then <= 0:
        return None
    return (now / then - 1) * 100


# --------------------------------------------------------------------------------------------
# The facts - pure functions over rows the scanner stored.


@dataclass(frozen=True)
class TickerSession:
    symbol: str
    category: str
    session: date  # NY date of the newest scored bar
    close_bar: datetime
    score: float  # at the close
    status: str  # at the close
    prior_score: float | None  # at the previous session's close (newest signal before this session)
    bar_statuses: tuple[str, ...]  # this session's bars, oldest first
    volume_ratio: float | None
    close: float | None
    first_bar_time: datetime | None  # earliest stored candle on the session date
    first_bar_close: float | None
    prior_close_time: datetime | None  # newest stored candle before the session date
    prior_close: float | None
    day_pct: float | None = None  # close vs prior close - set by build_facts once the universe agrees on references
    open_pct: float | None = None  # first bar's close vs prior close
    late_pct: float | None = None  # close vs the first bar's close


def ticker_session(row: dict[str, Any]) -> TickerSession | None:
    """One ticker's newest session from its newest signals and candles. None when it has no signal."""
    signals = []
    for raw in row.get("stock_signals") or []:
        when, score = _parse_time(raw.get("candle_time")), _number(raw.get("signal_score"))
        if when is not None and score is not None:
            signals.append((when, score, str(raw.get("signal_status") or "no_signal"), raw))
    if not signals:
        return None
    signals.sort(key=lambda item: item[0], reverse=True)
    close_bar, score, status, newest = signals[0]
    session = ny_date(close_bar)
    this_session = [item for item in signals if ny_date(item[0]) == session]
    prior = next((item for item in signals if ny_date(item[0]) < session), None)
    payload = newest.get("raw_payload") if isinstance(newest.get("raw_payload"), dict) else {}
    volume_ratio = _number(newest["volume_ratio"]) if "volume_ratio" in newest else _number(payload.get("volume_ratio"))

    candles = sorted(
        (
            (when, close)
            for when, close in ((_parse_time(c.get("candle_time")), _number(c.get("close"))) for c in row.get("stock_candles") or [])
            if when is not None and close is not None and close > 0
        ),
        key=lambda pair: pair[0],
    )
    on_session = [(when, close) for when, close in candles if ny_date(when) == session]
    before = [(when, close) for when, close in candles if ny_date(when) < session]
    at_close = next((close for when, close in on_session if when == close_bar), None)

    return TickerSession(
        symbol=str(row.get("symbol") or "").upper(),
        category=str(row.get("category") or "other"),
        session=session,
        close_bar=close_bar,
        score=score,
        status=status,
        prior_score=prior[1] if prior else None,
        bar_statuses=tuple(item[2] for item in reversed(this_session)),
        volume_ratio=volume_ratio,
        close=at_close,
        first_bar_time=on_session[0][0] if on_session else None,
        first_bar_close=on_session[0][1] if on_session else None,
        prior_close_time=before[-1][0] if before else None,
        prior_close=before[-1][1] if before else None,
    )


@dataclass(frozen=True)
class Transition:
    symbol: str
    score: float
    previous_score: float | None


@dataclass(frozen=True)
class BookLine:
    """One holding or watchlist name against this session. Percentages only - never dollars or units."""

    symbol: str
    scanned: bool
    day_pct: float | None = None
    score: float | None = None
    status: str = ""
    position_pct: float | None = None  # unrealised P/L of the whole position, on cost
    trigger: str = ""  # watchlist trigger state

    def sheet_text(self) -> str:
        """The sentence the model reads (registered to the symbol by the sheet)."""
        if not self.scanned:
            return f"{self.symbol}: not covered by the scan"
        parts = []
        if self.day_pct is not None:
            parts.append(f"{move_words(self.day_pct)} on the session")
        if self.trigger:
            parts.append(f"{self.trigger} on the reader's watchlist")
        if self.score is not None:
            parts.append(f"score {round(self.score)} at the close ({STATUS_WORDS.get(self.status, self.status.replace('_', ' '))})")
        if self.position_pct is not None:
            parts.append(f"position {move_words(self.position_pct)} overall")
        return f"{self.symbol}: " + ", ".join(parts)

    def reader_text(self) -> str:
        """The same figures, compact and signed, for the message."""
        if not self.scanned:
            return f"{self.symbol} · not scanned"
        parts = []
        if self.day_pct is not None:
            parts.append(f"{fmt_pct(self.day_pct)} session")
        if self.trigger:
            parts.append(self.trigger)
        if self.score is not None:
            parts.append(f"score {round(self.score)} {STATUS_WORDS.get(self.status, self.status.replace('_', ' '))}")
        if self.position_pct is not None:
            parts.append(f"position {fmt_pct(self.position_pct)}")
        return f"{self.symbol} " + " · ".join(parts)


@dataclass
class SessionFacts:
    session: date
    close_bar: datetime  # newest scored bar (opens 15:30 NY on a full session)
    bars: int  # hourly bars the session holds (7 when complete)
    tickers: list[TickerSession]
    scored: int  # names with any signal at all, including those not on this session
    up: int
    down: int
    flat: int
    median_day_pct: float | None
    open_up: int
    open_down: int
    median_open_pct: float | None
    late_up: int
    late_down: int
    median_late_pct: float | None
    leaders: list[TickerSession]
    laggards: list[TickerSession]
    groups: list[tuple[str, float, int]]  # (category, mean session move, names)
    status_counts: dict[str, int]
    prior_strong: int
    prior_watch: int
    newly_strong: list[Transition]
    lost_strong: list[Transition]
    newly_watch: list[Transition]
    invalidated: list[Transition]  # a strong setup failed during the session and had not recovered by the close
    score_risers: list[Transition]
    score_fallers: list[Transition]
    macro: dict[str, Any] = field(default_factory=dict)
    holdings: list[BookLine] = field(default_factory=list)
    watchlist: list[BookLine] = field(default_factory=list)

    @property
    def symbols(self) -> set[str]:
        return {ticker.symbol for ticker in self.tickers}

    @property
    def complete(self) -> bool:
        return self.close_bar.astimezone(NEW_YORK).time() >= clock_time(15, 30)


def _mode(values: list[Any]) -> Any:
    return Counter(values).most_common(1)[0][0] if values else None


def build_facts(rows: list[dict[str, Any]], settings: Settings) -> SessionFacts | None:
    """Everything the read states about the session. None when nothing has been scanned yet.

    Reference bars are agreed across the universe: a ticker's moves count only against the prior
    close and first bar that most tickers share, so a name with a gap in its history is never
    reported as a move it did not make."""
    every = [ticker for ticker in (ticker_session(row) for row in rows) if ticker is not None]
    if not every:
        return None
    session = max(ticker.session for ticker in every)
    on_session = [ticker for ticker in every if ticker.session == session]
    close_bar = max(ticker.close_bar for ticker in on_session)
    prior_time = _mode([t.prior_close_time for t in on_session if t.prior_close_time is not None])
    first_time = _mode([t.first_bar_time for t in on_session if t.first_bar_time is not None])

    tickers: list[TickerSession] = []
    for ticker in on_session:
        if ticker.close_bar != close_bar:
            continue  # on the session but not scored through to its last bar: it has no close state
        day_pct = _pct(ticker.close, ticker.prior_close) if ticker.prior_close_time == prior_time else None
        open_pct = _pct(ticker.first_bar_close, ticker.prior_close) if ticker.prior_close_time == prior_time and ticker.first_bar_time == first_time else None
        late_pct = _pct(ticker.close, ticker.first_bar_close) if ticker.first_bar_time == first_time and ticker.first_bar_time != close_bar else None
        tickers.append(replace(ticker, day_pct=day_pct, open_pct=open_pct, late_pct=late_pct))

    moves = [t for t in tickers if t.day_pct is not None]
    opens = [t.open_pct for t in tickers if t.open_pct is not None]
    lates = [t.late_pct for t in tickers if t.late_pct is not None]
    by_day = sorted(moves, key=lambda t: t.day_pct, reverse=True)

    grouped: dict[str, list[float]] = {}
    for ticker in moves:
        grouped.setdefault(ticker.category, []).append(ticker.day_pct)
    groups = sorted(
        ((category, statistics.fmean(values), len(values)) for category, values in grouped.items() if len(values) >= 3),
        key=lambda group: group[1],
        reverse=True,
    )

    strong, watch = settings.alert_score_threshold, settings.watchlist_score_threshold

    def transition(t: TickerSession) -> Transition:
        return Transition(t.symbol, t.score, t.prior_score)

    def was_strong(t: TickerSession) -> bool:
        return t.prior_score is not None and t.prior_score >= strong

    def was_watch_or_better(t: TickerSession) -> bool:
        return t.prior_score is not None and t.prior_score >= watch

    by_score = sorted(tickers, key=lambda t: t.score, reverse=True)
    with_prior = [t for t in tickers if t.prior_score is not None]
    risers = sorted(with_prior, key=lambda t: t.score - t.prior_score, reverse=True)
    fallers = sorted(with_prior, key=lambda t: t.score - t.prior_score)

    def count(values: list[float], sign: int) -> int:
        return sum(1 for v in values if (v >= FLAT_BAND_PCT if sign > 0 else v <= -FLAT_BAND_PCT))

    return SessionFacts(
        session=session,
        close_bar=close_bar,
        bars=max((len(t.bar_statuses) for t in tickers), default=0),
        tickers=tickers,
        scored=len(every),
        up=count([t.day_pct for t in moves], 1),
        down=count([t.day_pct for t in moves], -1),
        flat=sum(1 for t in moves if abs(t.day_pct) < FLAT_BAND_PCT),
        median_day_pct=statistics.median(t.day_pct for t in moves) if moves else None,
        open_up=count(opens, 1),
        open_down=count(opens, -1),
        median_open_pct=statistics.median(opens) if opens else None,
        late_up=count(lates, 1),
        late_down=count(lates, -1),
        median_late_pct=statistics.median(lates) if lates else None,
        leaders=[t for t in by_day[:3] if t.day_pct >= FLAT_BAND_PCT],
        laggards=[t for t in reversed(by_day[-3:]) if t.day_pct <= -FLAT_BAND_PCT],
        groups=groups,
        status_counts=dict(Counter(t.status for t in tickers)),
        prior_strong=sum(1 for t in tickers if was_strong(t)),
        prior_watch=sum(1 for t in tickers if was_watch_or_better(t) and not was_strong(t)),
        newly_strong=[transition(t) for t in by_score if t.status == "strong_setup" and not was_strong(t)],
        lost_strong=[transition(t) for t in by_score if was_strong(t) and t.status != "strong_setup"],
        newly_watch=[transition(t) for t in by_score if t.status == "watchlist_setup" and not was_watch_or_better(t)],
        invalidated=[
            transition(t) for t in by_score if "invalidated" in t.bar_statuses and t.status not in ("strong_setup", "watchlist_setup")
        ],
        score_risers=[transition(t) for t in risers[:3] if t.score - t.prior_score >= SCORE_MOVE],
        score_fallers=[transition(t) for t in fallers[:3] if t.score - t.prior_score <= -SCORE_MOVE],
    )


def coverage(facts: SessionFacts) -> float:
    return len(facts.tickers) / facts.scored if facts.scored else 0.0


def group_name(category: str) -> str:
    return GROUP_NAMES.get(category, category.replace("_", " "))


def holdings_facts(positions: list[dict[str, Any]], overlays: list[dict[str, Any]], facts: SessionFacts) -> list[BookLine]:
    """The reader's own positions against the session. Every active position is listed - one the
    scanner does not cover says so, rather than vanishing. Several lots of one symbol are combined
    on cost so the P/L is the position's, not one lot's."""
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

    symbols = sorted({str(row.get("symbol") or "").upper() for row in positions if row.get("symbol")} | set(lots))
    lines: list[BookLine] = []
    for symbol in symbols:
        ticker = by_symbol.get(symbol)
        if ticker is None:
            lines.append(BookLine(symbol, scanned=False))
            continue
        rows = lots.get(symbol, [])
        position_pct: float | None = None
        if len(rows) == 1:
            position_pct = _number(rows[0].get("unrealised_pl_pct"))
        elif rows:
            pl = sum(_number(r.get("unrealised_pl")) or 0.0 for r in rows)
            cost = sum((_number(r.get("market_value")) or 0.0) - (_number(r.get("unrealised_pl")) or 0.0) for r in rows)
            position_pct = (pl / cost) * 100 if cost > 0 else None
        lines.append(BookLine(symbol, True, ticker.day_pct, ticker.score, ticker.status, position_pct))
    return lines


def watchlist_facts(items: list[dict[str, Any]], overlays: list[dict[str, Any]], facts: SessionFacts) -> list[BookLine]:
    """Watchlist names at or near their trigger - the rest are not news."""
    by_symbol = {t.symbol: t for t in facts.tickers}
    wanted = {str(row.get("symbol") or "").upper() for row in items if row.get("symbol")}
    newest: dict[str, tuple[datetime, str]] = {}
    for row in overlays:
        symbol = str(row.get("symbol") or "").upper()
        when = _parse_time(row.get("candle_time"))
        if not symbol or when is None or symbol not in wanted:
            continue
        if symbol not in newest or when > newest[symbol][0]:
            newest[symbol] = (when, str(row.get("watchlist_trigger_state") or ""))
    lines: list[BookLine] = []
    for symbol in sorted(newest):
        state = newest[symbol][1]
        if state not in ("triggered", "approaching") or symbol not in by_symbol:
            continue
        ticker = by_symbol[symbol]
        lines.append(BookLine(symbol, True, score=ticker.score, status=ticker.status, trigger=state))
    return lines


def macro_for_session(snapshot: dict[str, Any] | None, session: date) -> dict[str, Any]:
    """The market backdrop, only when the snapshot describes this session. Older snapshots lack
    `us_session_date` and are left out rather than guessed about."""
    if not snapshot or not isinstance(snapshot.get("payload"), dict):
        return {}
    payload = snapshot["payload"]
    if payload.get("us_session_date") != session.isoformat():
        return {}
    return {key: payload.get(key) for key in ("sp500_change_pct", "nasdaq_change_pct", "vix_price", "yield_10y", "audusd_price") if payload.get(key) is not None}


def macro_text(macro: dict[str, Any], sheet: FactSheet | None = None) -> str | None:
    """'S&P 500 up 0.7% on the session, Nasdaq up 1.2% on the session, VIX at 15.3, US 10-year yield 5.28%, AUD/USD 0.6929'.
    With a sheet, the same text is registered as general facts."""
    parts = []
    for label, key in (("S&P 500", "sp500_change_pct"), ("Nasdaq", "nasdaq_change_pct")):
        value = _number(macro.get(key))
        if value is not None:
            parts.append(f"{label} {move_words(value)} on the session")
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


def build_sheet(facts: SessionFacts) -> FactSheet:
    """The grounding handed to the model: every statement it is allowed to make, in words."""
    sheet = FactSheet()
    say, general = sheet.say, sheet.general

    if facts.complete:
        say(f"This is a full US session of {general(str(facts.bars))} hourly bars, from the open to the close.")
    else:
        say(f"The scan covers only the first {general(str(facts.bars))} hourly bars of this session - the figures below are not a full-session read.")
    say(f"Names scanned: {general(str(len(facts.tickers)))}.")
    say(general(f"Breadth on the session (close against the previous close): {facts.up} up, {facts.down} down, {facts.flat} flat."))
    if facts.median_day_pct is not None:
        say(general(f"Median move on the session: {move_words(facts.median_day_pct)}."))
    if facts.open_up or facts.open_down:
        line = f"At the end of the first hour, measured from the previous close: {facts.open_up} up, {facts.open_down} down"
        line += f", median {move_words(facts.median_open_pct)}." if facts.median_open_pct is not None else "."
        say(general(line))
    if facts.late_up or facts.late_down:
        line = f"From the end of the first hour to the close: {facts.late_up} up, {facts.late_down} down"
        line += f", median {move_words(facts.median_late_pct)}." if facts.median_late_pct is not None else "."
        say(general(line))
    if facts.leaders:
        say("Biggest gains on the session: " + ", ".join(sheet.about(t.symbol, f"{t.symbol} {move_words(t.day_pct)}") for t in facts.leaders) + ".")
    if facts.laggards:
        say("Biggest falls on the session: " + ", ".join(sheet.about(t.symbol, f"{t.symbol} {move_words(t.day_pct)}") for t in facts.laggards) + ".")
    if facts.groups:
        say(
            "Average move on the session by group: "
            + ", ".join(general(f"{group_name(category)} {move_words(mean)} ({count} names)") for category, mean, count in facts.groups)
            + "."
        )

    counts = facts.status_counts
    say(
        "Setups at the close: "
        + general(
            f"{counts.get('strong_setup', 0)} strong setups, {counts.get('watchlist_setup', 0)} watchlist setups, "
            f"{counts.get('weakening', 0)} weakening, {counts.get('invalidated', 0)} invalidated, {counts.get('no_signal', 0)} with no signal."
        )
    )
    say(general(f"Setups at the previous session's close: {facts.prior_strong} strong, {facts.prior_watch} watchlist."))
    for label, items in (
        ("Became strong setups over the session", facts.newly_strong),
        ("Dropped out of strong setup over the session", facts.lost_strong),
        ("Became watchlist setups over the session", facts.newly_watch),
        ("Invalidated during the session and still out at the close - a strong setup failed", facts.invalidated),
    ):
        if items:
            say(f"{label} ({general(str(len(items)))}): " + _listed(sheet, items) + ".")
    if not (facts.newly_strong or facts.lost_strong or facts.newly_watch or facts.invalidated):
        say("No setup changed status over the session.")
    if facts.score_risers:
        say("Biggest score rises over the session: " + ", ".join(_transition_text(sheet, item) for item in facts.score_risers) + ".")
    if facts.score_fallers:
        say("Biggest score falls over the session: " + ", ".join(_transition_text(sheet, item) for item in facts.score_fallers) + ".")

    backdrop = macro_text(facts.macro, sheet)
    if backdrop:
        say(f"Market backdrop: {backdrop}.")
    if facts.holdings:
        say("The reader's holdings: " + "; ".join(sheet.about(line.symbol, line.sheet_text()) for line in facts.holdings) + ".")
    if facts.watchlist:
        say("On the reader's watchlist, at or near a trigger: " + "; ".join(sheet.about(line.symbol, line.sheet_text()) for line in facts.watchlist) + ".")
    return sheet


# --------------------------------------------------------------------------------------------
# The message - Telegram HTML: short sections, bold headings, one emoji per section.


def _h(text: str) -> str:
    """Escape for Telegram's HTML parse mode (only <, > and & matter)."""
    return html.escape(text, quote=False)


def _b(text: str) -> str:
    return f"<b>{_h(text)}</b>"


def figure_sections(facts: SessionFacts) -> list[str]:
    """The figures the reader sees under the read - the same numbers, signed."""
    sections: list[str] = []
    backdrop = macro_text(facts.macro)
    if backdrop:
        sections.append("🌐 " + _b("Market") + "\n" + _h(backdrop.replace(" on the session", "").replace(", ", " · ")))

    lines = ["📊 " + _b(f"Session · {len(facts.tickers)} names")]
    breadth = f"🟢 {facts.up} up · 🔴 {facts.down} down" + (f" · ⚪ {facts.flat} flat" if facts.flat else "")
    if facts.median_day_pct is not None:
        breadth += f" · median {fmt_pct(facts.median_day_pct)}"
    lines.append(_h(breadth))
    if facts.open_up or facts.open_down:
        shape = f"First hour: {facts.open_up} up · {facts.open_down} down"
        if facts.late_up or facts.late_down:
            shape += f" → then {facts.late_up} up · {facts.late_down} down into the close"
        lines.append(_h(shape))
    if facts.leaders:
        lines.append(_h("🚀 " + " · ".join(f"{t.symbol} {fmt_pct(t.day_pct)}" for t in facts.leaders)))
    if facts.laggards:
        lines.append(_h("🐌 " + " · ".join(f"{t.symbol} {fmt_pct(t.day_pct)}" for t in facts.laggards)))
    if len(facts.groups) >= 2:
        best, worst = facts.groups[0], facts.groups[-1]
        lines.append(_h(f"🧩 {group_name(best[0])} {fmt_pct(best[1])} best · {group_name(worst[0])} {fmt_pct(worst[1])} worst"))
    sections.append("\n".join(lines))

    counts = facts.status_counts
    lines = ["🎯 " + _b(f"Setups at the close · {counts.get('strong_setup', 0)} strong · {counts.get('watchlist_setup', 0)} on watch")]
    lines.append(_h(f"Previous close: {facts.prior_strong} strong · {facts.prior_watch} on watch"))
    for mark, label, items in (
        ("⬆️", "New strong", facts.newly_strong),
        ("⬇️", "Left strong", facts.lost_strong),
        ("👀", "New watch", facts.newly_watch),
        ("❌", "Invalidated", facts.invalidated),
    ):
        if items:
            shown = ", ".join(item.symbol for item in items[:4]) + (f" +{len(items) - 4}" if len(items) > 4 else "")
            lines.append(_h(f"{mark} {label}: {shown}"))
    for mark, label, items in (("📈", "Score up", facts.score_risers), ("📉", "Score down", facts.score_fallers)):
        if items:
            lines.append(_h(f"{mark} {label}: " + " · ".join(f"{i.symbol} {round(i.previous_score)}→{round(i.score)}" for i in items)))
    if len(lines) == 2:
        lines.append("No status changes over the session")
    sections.append("\n".join(lines))

    if facts.holdings or facts.watchlist:
        lines = ["💼 " + _b("Your book")]
        lines += [_h(line.reader_text()) for line in facts.holdings]
        lines += [_h("🔔 " + line.reader_text()) for line in facts.watchlist]
        sections.append("\n".join(lines))
    return sections


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
        "messages": [{"role": "user", "content": f"Facts for the session:\n<facts>\n{sheet.text}\n</facts>\n\nWrite the read."}],
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
        return replace(base, note="the model declined to write this read", reason="refusal")
    if response.stop_reason == "max_tokens":
        return replace(base, note="the model's read was cut off before it finished", reason="max_tokens")
    text = "\n\n".join(block.text for block in response.content if block.type == "text").strip()
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
# Budget pacing and timing.


def weekdays_remaining(today: date) -> int:
    """Weekdays from today to the end of the month, today included - one read per weekday."""
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
    measured."""
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
    if remaining_budget < weekdays_remaining(now.date()) * statistics.fmean(costs):
        return EFFORT_LEVELS[EFFORT_LEVELS.index(configured) - 1]
    return configured


def parse_clock(spec: str, default: clock_time) -> clock_time:
    try:
        hour, minute = (spec or "").strip().split(":")
        return clock_time(int(hour) % 24, int(minute) % 60)
    except ValueError:
        return default


def due(local_now: datetime, send_at: clock_time) -> bool:
    """True from the send time to the end of the reader's day. The ledger stops a second send."""
    return local_now.time() >= send_at


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
    facts: SessionFacts,
    narration: Narration | None,
    *,
    month_to_date: float,
    budget: float,
    reader_zone: ZoneInfo,
) -> str:
    """The Telegram message, in Telegram's HTML parse mode. Every piece of content passes through _h()."""
    close_ny = facts.close_bar.astimezone(NEW_YORK)
    session_end = datetime.combine(facts.session, SESSION_CLOSE, tzinfo=NEW_YORK) if facts.complete else close_ny + timedelta(hours=1)
    place = str(reader_zone.key).rsplit("/", 1)[-1].replace("_", " ")

    head = ["📈 " + _b("Lyra daily read")]
    head.append(_h(f"US session of {fmt_day(facts.session)}" + ("" if facts.complete else f" (first {facts.bars} bars only)")))
    head.append(_h(f"Closed {fmt_clock(session_end.astimezone(reader_zone))} {place}, {fmt_day(session_end.astimezone(reader_zone))}"))

    sections = ["\n".join(head)]
    if narration and narration.text:
        sections.append("🧠 " + _b("The read") + "\n" + _h(narration.text))
    sections += figure_sections(facts)

    if narration and narration.text:
        model_name = MODEL_NAMES.get(narration.model, narration.model)
        footer = f"🤖 {model_name} at {narration.effort} effort · ${narration.cost_usd:.3f} this read · ${month_to_date:.2f} of ${budget:.0f} this month"
    elif narration and narration.note:
        footer = f"🤖 Figures only today - {narration.note}."
    else:
        footer = "🤖 Figures only today."
    sections.append(_h(footer) + "\n" + _h("Research, not advice."))
    return "\n\n".join(sections)


# --------------------------------------------------------------------------------------------
# I/O - reads and the run ledger. Kept thin so everything above is testable without a database.

_SIGNAL_SELECT_LEAN = "candle_time,signal_score,signal_status,volume_ratio:raw_payload->volume_ratio"
_SIGNAL_SELECT_FULL = "candle_time,signal_score,signal_status,raw_payload"
_CANDLE_SELECT = "candle_time,close"
SIGNALS_PER_TICKER = 8  # a full session (seven bars) plus the previous session's close
CANDLES_PER_TICKER = 9  # a full session plus the previous session's last two bars


def _universe_query(client: Any, timeframe: str, signal_select: str, signals: int, candles: int):
    select = f"symbol,company_name,category,stock_signals({signal_select})" + (f",stock_candles({_CANDLE_SELECT})" if candles else "")
    query = (
        client.table("stock_tickers")
        .select(select)
        .eq("is_active", True)
        .eq("scan_enabled", True)
        .eq("stock_signals.timeframe", timeframe)
        .order("symbol")
        .order("candle_time", desc=True, foreign_table="stock_signals")
        .limit(signals, foreign_table="stock_signals")
    )
    if candles:
        query = (
            query.eq("stock_candles.timeframe", timeframe)
            .order("candle_time", desc=True, foreign_table="stock_candles")
            .limit(candles, foreign_table="stock_candles")
        )
    return query


def newest_session(client: Any, timeframe: str) -> date | None:
    """The cheap question asked on every firing: which session has the scanner scored last?"""
    rows = _universe_query(client, timeframe, "candle_time", 1, 0).execute().data or []
    bars = [bar for bar in (_parse_time((row.get("stock_signals") or [{}])[0].get("candle_time")) for row in rows if row.get("stock_signals")) if bar]
    return ny_date(max(bars)) if bars else None


def load_universe(client: Any, timeframe: str) -> list[dict[str, Any]]:
    """Every ticker with its newest session of signals and candles - one index-backed request."""
    try:
        return _universe_query(client, timeframe, _SIGNAL_SELECT_LEAN, SIGNALS_PER_TICKER, CANDLES_PER_TICKER).execute().data or []
    except Exception as exc:  # noqa: BLE001 - the lean projection is an optimisation, not a requirement
        LOGGER.warning("lean signal read was refused (%s) - falling back to the full payload", type(exc).__name__)
        return _universe_query(client, timeframe, _SIGNAL_SELECT_FULL, SIGNALS_PER_TICKER, CANDLES_PER_TICKER).execute().data or []


def load_read_runs(client: Any, since: datetime) -> list[dict[str, Any]]:
    result = (
        client.table("stock_scanner_runs")
        .select("job_name,started_at,status,payload")
        .in_("job_name", list(LEDGER_JOB_NAMES))
        .gte("started_at", since.isoformat())
        .order("started_at", desc=True)
        .limit(1000)
        .execute()
    )
    return list(result.data or [])


def last_session_sent(runs: list[dict[str, Any]]) -> date | None:
    sessions = []
    for run in runs:
        payload = run.get("payload") if isinstance(run.get("payload"), dict) else {}
        if run.get("status") == "success" and run.get("job_name") == JOB_NAME and payload.get("session"):
            try:
                sessions.append(date.fromisoformat(str(payload["session"])))
            except ValueError:
                continue
    return max(sessions) if sessions else None


def load_market_snapshot(client: Any) -> dict[str, Any] | None:
    rows = client.table("market_context_snapshots").select("captured_at,payload").order("captured_at", desc=True).limit(1).execute().data or []
    return rows[0] if rows else None


def load_active(client: Any, table: str, user_id: str) -> list[dict[str, Any]]:
    """The symbols on the reader's own list (positions or watchlist items), active only."""
    return list(client.table(table).select("symbol").eq("user_id", user_id).eq("is_active", True).limit(200).execute().data or [])


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
    raise RuntimeError(f"could not record the read: {type(last_error).__name__}")


def _env_float(name: str, default: float) -> float:
    value = _number(os.getenv(name))
    return value if value is not None and value >= 0 else default


def run(now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    settings = load_settings()

    if not settings.enable_daily_read:
        LOGGER.info("The daily read is off (ENABLE_DAILY_READ is not true) - nothing sent.")
        return 0
    bot_token = os.getenv("SUMMARY_TELEGRAM_BOT_TOKEN", "")
    chat_id = os.getenv("SUMMARY_TELEGRAM_CHAT_ID", "")
    if not bot_token or not chat_id:
        LOGGER.info("No SUMMARY_TELEGRAM_BOT_TOKEN / SUMMARY_TELEGRAM_CHAT_ID - nowhere to send the read.")
        return 0
    repository = SupabaseRepository(settings)
    if not repository.client:
        LOGGER.info("Supabase is not configured - demo mode, no read.")
        return 0
    client = repository.client
    timeframe = settings.default_timeframe
    force = os.getenv("SUMMARY_FORCE", "").strip().lower() in ("1", "true", "yes")
    reader_zone = ZoneInfo(os.getenv("SUMMARY_TIMEZONE", "").strip() or DEFAULT_TIMEZONE)
    local_now = now.astimezone(reader_zone)

    if not force and not due(local_now, parse_clock(os.getenv("SUMMARY_SEND_AT", ""), parse_clock(DEFAULT_SEND_AT, clock_time(20, 0)))):
        LOGGER.info("Not yet the reader's send time (%s local) - nothing sent.", local_now.strftime("%H:%M"))
        return 0
    session = newest_session(client, timeframe)
    if session is None:
        LOGGER.info("Nothing has been scanned yet - no read.")
        return 0
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    runs = load_read_runs(client, min(month_start, now - timedelta(days=7)))
    sent = last_session_sent(runs)
    if sent is not None and sent >= session and not force:
        LOGGER.info("The %s session has already been read - nothing sent.", session.isoformat())
        return 0

    facts = build_facts(load_universe(client, timeframe), settings)
    if facts is None:
        LOGGER.info("No scored tickers - no read.")
        return 0
    if coverage(facts) < MIN_COVERAGE:
        LOGGER.warning("Only %d of %d scored names are on the %s session - not reading it.", len(facts.tickers), facts.scored, facts.session.isoformat())
        return 0

    facts.macro = macro_for_session(load_market_snapshot(client), facts.session)
    if settings.default_user_id:
        try:
            since = facts.close_bar - timedelta(days=5)
            user = settings.default_user_id
            facts.holdings = holdings_facts(
                load_active(client, "portfolio_positions", user),
                load_overlays(client, "portfolio_signal_overlay", "symbol,candle_time,unrealised_pl,unrealised_pl_pct,market_value", user, since),
                facts,
            )
            facts.watchlist = watchlist_facts(
                load_active(client, "watchlist_items", user),
                load_overlays(client, "watchlist_signal_overlay", "symbol,candle_time,watchlist_trigger_state", user, since),
                facts,
            )
        except Exception as exc:  # noqa: BLE001 - the book is an extra; the market read must still go out
            LOGGER.warning("could not read the operator's book: %s", type(exc).__name__)

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
        "session": None,  # set only once the message is delivered - an undelivered read must be retried
        "session_attempted": facts.session.isoformat(),
        "bars": facts.bars,
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

    message = compose_message(facts, narration, month_to_date=spent_after, budget=budget, reader_zone=reader_zone)
    silent = quiet_now(os.getenv("SUMMARY_QUIET_HOURS", DEFAULT_QUIET_HOURS), local_now)
    delivery = send_telegram_message(
        message, replace(settings, telegram_bot_token=bot_token, telegram_chat_id=chat_id), chat_id=chat_id, silent=silent, parse_mode="HTML"
    )
    delivered = delivery.sent_status == "sent"
    _record(
        client,
        run_id,
        "success" if delivered else "failed",
        {**ledger, "session": facts.session.isoformat() if delivered else None, "silent": silent},
        delivered=delivered,
        error=None if delivered else delivery.error_message,
    )
    LOGGER.info(
        "daily read for the %s session: delivered=%s silent=%s ai=%s reason=%s guard_removed=%d model=%s effort=%s tokens=%d in / %d out cost=$%.4f month=$%.2f of $%.0f",
        facts.session.isoformat(), delivered, silent, bool(narration.text), narration.reason, narration.guard_removed,
        narration.model, narration.effort, narration.input_tokens, narration.output_tokens, narration.cost_usd, spent_after, budget,
    )
    if not delivered:
        LOGGER.error("The read was NOT delivered: %s", delivery.error_message)
        return 1
    return 0


def main() -> None:
    sys.exit(run())


if __name__ == "__main__":
    main()
