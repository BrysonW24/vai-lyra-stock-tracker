"""Event radar - earnings T-1 for names you hold or watch, and imminent IPO listings.

Both event classes already land nightly (company_events and ipos, populated by
workers/events_worker since the v0.41 upsert fix); this module is the alerting leg that
was always missing: it never fetches anything, it reads the tables the worker filled and
tells the user what is about to happen to a name they actually care about.

Scoping doctrine:
- Earnings alerts fire ONLY for symbols in the user's portfolio or watchlist - a
  whole-market earnings feed is noise, an earnings date on a name you hold is risk.
- IPO alerts fire for upcoming listings within the notice window regardless of holdings
  (you cannot hold what has not listed) but only from the curated ipos table.
- Both ride the existing `capital_event` type (an earnings print and a listing are
  capital events), so the macroAlerts preference is the single opt-out and no new
  notification type is needed.
- Dates are compared on the Sydney calendar; dedupe keys are event-scoped so each
  event alerts exactly once per user.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from workers.stock_scanner.config import Settings
from workers.stock_scanner.logger import get_logger
from workers.stock_scanner.notification_dispatch import dispatch_notification
from workers.stock_scanner.supabase_repo import SupabaseRepository

LOGGER = get_logger("stock_scanner.event_radar")

SYDNEY = ZoneInfo("Australia/Sydney")

EARNINGS_NOTICE_DAYS = 2  # alert when a held/watched name reports within this many days
IPO_NOTICE_DAYS = 2


@dataclass(frozen=True)
class EventNotice:
    """One imminent event worth a ping."""

    kind: str  # 'earnings_t1' | 'ipo_listing'
    symbol: str
    title: str
    body: str
    event_date: date
    dedupe_suffix: str


def earnings_notices(
    events: list[dict[str, Any]],
    tracked_symbols: set[str],
    sydney_today: date,
) -> list[EventNotice]:
    """Pure: earnings events within the notice window for tracked symbols only."""
    notices: list[EventNotice] = []
    for event in events:
        if str(event.get("event_type")) != "earnings":
            continue
        ticker = (event.get("ticker") or "").upper()
        if ticker not in tracked_symbols:
            continue
        try:
            event_day = date.fromisoformat(str(event.get("event_date"))[:10])
        except ValueError:
            continue
        days_out = (event_day - sydney_today).days
        if not 0 <= days_out <= EARNINGS_NOTICE_DAYS:
            continue
        when = "today" if days_out == 0 else "tomorrow" if days_out == 1 else f"in {days_out} days"
        notices.append(
            EventNotice(
                kind="earnings_t1",
                symbol=ticker,
                title=f"{ticker} reports earnings {when}",
                body=(
                    f"{event.get('title') or f'{ticker} earnings'} lands on "
                    f"{event_day.strftime('%d %b')} (US reporting time). You track this "
                    "name, and earnings prints are where oversold-recovery setups get "
                    "confirmed or broken. Nothing to do - just know it is coming."
                ),
                event_date=event_day,
                dedupe_suffix=f"earnings:{ticker}:{event_day.isoformat()}",
            )
        )
    return notices


def ipo_notices(
    ipos: list[dict[str, Any]],
    sydney_today: date,
) -> list[EventNotice]:
    """Pure: upcoming listings within the notice window."""
    notices: list[EventNotice] = []
    for ipo in ipos:
        if str(ipo.get("status")) not in {"upcoming", "priced"}:
            continue
        symbol = (ipo.get("symbol") or "").upper()
        if not symbol:
            continue
        try:
            ipo_day = date.fromisoformat(str(ipo.get("ipo_date"))[:10])
        except ValueError:
            continue
        days_out = (ipo_day - sydney_today).days
        if not 0 <= days_out <= IPO_NOTICE_DAYS:
            continue
        when = "today" if days_out == 0 else "tomorrow" if days_out == 1 else f"in {days_out} days"
        valuation = ipo.get("valuation_usd_m")
        valuation_text = (
            f" Valuation at offer: ~${float(valuation) / 1000:.1f}B USD."
            if valuation is not None and float(valuation) > 0
            else ""
        )
        notices.append(
            EventNotice(
                kind="ipo_listing",
                symbol=symbol,
                title=f"IPO {when}: {ipo.get('company_name') or symbol} ({symbol})",
                body=(
                    f"{ipo.get('company_name') or symbol} lists on "
                    f"{ipo.get('exchange') or 'a US exchange'} on {ipo_day.strftime('%d %b')}."
                    f"{valuation_text} First prints are volatile by nature - the scanner "
                    "needs candle history before it can score a new name."
                ),
                event_date=ipo_day,
                dedupe_suffix=f"ipo:{symbol}:{ipo_day.isoformat()}",
            )
        )
    return notices


def send_event_notices(
    repo: SupabaseRepository,
    settings: Settings,
    now: datetime | None = None,
) -> int:
    """Dispatch earnings + IPO notices per user. Returns fresh sends."""
    if now is None:
        now = datetime.now(timezone.utc)
    if not settings.notification_dispatch_enabled:
        return 0
    sydney_today = now.astimezone(SYDNEY).date()
    horizon = sydney_today + timedelta(days=max(EARNINGS_NOTICE_DAYS, IPO_NOTICE_DAYS))

    events = repo.load_company_events_window(sydney_today, horizon)
    upcoming_ipos = repo.load_upcoming_ipos(sydney_today, horizon)

    user_ids = repo.load_active_user_ids()
    if not user_ids and settings.default_user_id:
        user_ids = [settings.default_user_id]

    sent = 0
    for user_id in user_ids:
        tracked = {p.symbol.upper() for p in repo.load_portfolio_positions(user_id)}
        tracked |= {w.symbol.upper() for w in repo.load_watchlist_items(user_id)}
        notices = earnings_notices(events, tracked, sydney_today) + ipo_notices(
            upcoming_ipos, sydney_today
        )
        for notice in notices:
            result = dispatch_notification(
                settings,
                user_id=user_id,
                symbol=notice.symbol,
                alert_type="capital_event",
                title=notice.title,
                body=notice.body,
                reason=f"{notice.kind} on {notice.event_date.isoformat()} (events worker data)",
                payload={
                    "kind": notice.kind,
                    "event_date": notice.event_date.isoformat(),
                    "dedupe_key": f"capital_event:{notice.dedupe_suffix}:{user_id}",
                },
                relevance_score=100,
                notification_type="capital_event",
                url="/calendar",
            )
            if result.ok and not result.deduped:
                sent += 1
    return sent
