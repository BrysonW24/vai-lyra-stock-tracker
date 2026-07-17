"""Macro calendar - seeded central-bank dates + the morning companion briefs.

The first writer of `market_calendar_events` (the schema shipped it in migration 040 and
the frontend calendar reads it, but no worker ever filled it - src/lib/calendar-live.ts
even notes "a future macro provider lands here for free"). This module is that provider.

Every date below is SEEDED from the issuing institution's published schedule, verified
live on 2026-07-17:
- RBA: rba.gov.au/schedules-events/board-meeting-schedules.html (2026 AND 2027 published).
  Decisions announce 2:30pm Sydney on meeting day 2; minutes follow 14 days later at
  11:30am; the Chart Pack is released 11:30am the day after the meeting.
- Fed: federalreserve.gov/monetarypolicy/fomccalendars.htm (2026 published). Decisions
  announce 2:00pm ET on meeting day 2.
US CPI dates are deliberately ABSENT: the BLS schedule page blocked automated
verification, and this codebase does not seed dates it could not verify.

Companion briefs ride the nightly job (22:05 UTC = 8:05am next-morning Sydney):
- RBA decision morning: "announcement 2:30pm AEST today" pre-brief.
- RBA minutes morning: where to read them and what was decided.
- Chart Pack morning: the release note (full chart delivery is a later wave).
- FOMC morning-after: the 22:05 UTC run lands ~4h after the 2pm ET announcement, which
  is already the next morning in Sydney.

Timezone doctrine: all "is it due today" checks run on the Australia/Sydney calendar
date (never a fixed UTC offset - Nov-Mar is AEDT). Dedupe keys are date-scoped so a
re-run can never double-send.
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

LOGGER = get_logger("stock_scanner.macro_calendar")

SYDNEY = ZoneInfo("Australia/Sydney")

# Decision-announcement dates = meeting day 2. Verified 2026-07-17 (see module docstring).
RBA_DECISION_DATES: tuple[str, ...] = (
    "2026-02-03", "2026-03-17", "2026-05-05", "2026-06-16",
    "2026-08-11", "2026-09-29", "2026-11-03", "2026-12-08",
    "2027-02-09", "2027-03-23", "2027-05-04", "2027-06-22",
    "2027-08-10", "2027-09-28", "2027-11-02", "2027-12-14",
)

FOMC_DECISION_DATES: tuple[str, ...] = (
    "2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17",
    "2026-07-29", "2026-09-16", "2026-10-28", "2026-12-09",
)

RBA_MINUTES_DELAY_DAYS = 14
RBA_CHART_PACK_DELAY_DAYS = 1


def _iso(day: date) -> str:
    return day.isoformat()


def rba_minutes_date(decision: date) -> date:
    return decision + timedelta(days=RBA_MINUTES_DELAY_DAYS)


def rba_chart_pack_date(decision: date) -> date:
    return decision + timedelta(days=RBA_CHART_PACK_DELAY_DAYS)


def macro_calendar_rows() -> list[dict[str, Any]]:
    """Every seeded macro event as a market_calendar_events row. event_id is stable and
    semantic so re-seeding upserts in place; event_type 'economic_release' renders as
    'macro' in the frontend (mapEventType tolerates the alias by design)."""
    rows: list[dict[str, Any]] = []
    for iso_day in RBA_DECISION_DATES:
        decision = date.fromisoformat(iso_day)
        rows.append(
            {
                "event_id": f"rba-decision-{iso_day}",
                "event_date": iso_day,
                "event_type": "economic_release",
                "title": "RBA Monetary Policy Decision (2:30pm Sydney)",
                "description": (
                    "The Monetary Policy Board announces the cash rate decision at 2:30pm "
                    "Sydney time, with the Governor's media conference at 3:30pm. "
                    "Statement: rba.gov.au/media-releases. Source: RBA published schedule."
                ),
                "importance": "high",
            }
        )
        minutes = rba_minutes_date(decision)
        rows.append(
            {
                "event_id": f"rba-minutes-{_iso(minutes)}",
                "event_date": _iso(minutes),
                "event_type": "economic_release",
                "title": "RBA Board Minutes (11:30am Sydney)",
                "description": (
                    f"Minutes of the {decision.strftime('%d %b %Y')} Monetary Policy Board "
                    "meeting publish at 11:30am Sydney time. "
                    "rba.gov.au/monetary-policy/rba-board-minutes. Source: RBA published schedule."
                ),
                "importance": "medium",
            }
        )
        chart_pack = rba_chart_pack_date(decision)
        rows.append(
            {
                "event_id": f"rba-chart-pack-{_iso(chart_pack)}",
                "event_date": _iso(chart_pack),
                "event_type": "economic_release",
                "title": "RBA Chart Pack release (11:30am Sydney)",
                "description": (
                    "The RBA's summary of macroeconomic and financial market trends, "
                    "updated after each Board meeting: rba.gov.au/chart-pack. "
                    "Source: RBA published schedule."
                ),
                "importance": "medium",
            }
        )
    for iso_day in FOMC_DECISION_DATES:
        rows.append(
            {
                "event_id": f"fomc-decision-{iso_day}",
                "event_date": iso_day,
                "event_type": "economic_release",
                "title": "FOMC rate decision (2:00pm ET)",
                "description": (
                    "The Federal Open Market Committee announces its rate decision at "
                    "2:00pm Eastern with the Chair's press conference at 2:30pm. "
                    "federalreserve.gov. Source: Federal Reserve published schedule."
                ),
                "importance": "high",
            }
        )
    return rows


def seed_macro_calendar(repo: SupabaseRepository) -> int:
    """Idempotent upsert of the seeded macro events. Safe to run every night."""
    rows = macro_calendar_rows()
    return repo.upsert_market_calendar_events(rows)


@dataclass(frozen=True)
class MacroCompanion:
    """One morning brief due today (Sydney calendar)."""

    kind: str  # rba_prebrief | rba_minutes | rba_chart_pack | fomc_after
    title: str
    body: str
    url: str


def _fmt_aud(audusd: float | None) -> str:
    return f" AUD/USD this morning: {audusd:.4f}." if audusd else ""


def macro_companions_for(sydney_today: date, audusd: float | None = None) -> list[MacroCompanion]:
    """Pure: which macro briefs are due on this Sydney calendar date. `audusd` is the
    latest stored snapshot value - None simply omits the line (honest degradation)."""
    companions: list[MacroCompanion] = []
    today_iso = _iso(sydney_today)

    if today_iso in RBA_DECISION_DATES:
        companions.append(
            MacroCompanion(
                kind="rba_prebrief",
                title="RBA decision day: announcement 2:30pm AEST",
                body=(
                    "The Monetary Policy Board announces the cash rate decision at 2:30pm "
                    "Sydney time today, with the Governor's press conference at 3:30pm. "
                    "Your US holdings feel this through the currency: a cut tends to soften "
                    "the AUD, which lifts the AUD value of USD positions; a hike tends to do "
                    f"the opposite.{_fmt_aud(audusd)} "
                    "Statement lands at rba.gov.au/media-releases."
                ),
                url="/calendar",
            )
        )

    for iso_day in RBA_DECISION_DATES:
        decision = date.fromisoformat(iso_day)
        if rba_minutes_date(decision) == sydney_today:
            companions.append(
                MacroCompanion(
                    kind="rba_minutes",
                    title="RBA minutes drop 11:30am AEST",
                    body=(
                        f"Minutes of the {decision.strftime('%d %B')} Monetary Policy Board "
                        "meeting publish at 11:30am Sydney time - the fullest read on how "
                        "the Board weighed the decision. "
                        "rba.gov.au/monetary-policy/rba-board-minutes."
                    ),
                    url="/calendar",
                )
            )
        if rba_chart_pack_date(decision) == sydney_today:
            companions.append(
                MacroCompanion(
                    kind="rba_chart_pack",
                    title="RBA Chart Pack out 11:30am AEST",
                    body=(
                        "The RBA's Chart Pack - the institution's own distilled read on the "
                        "world and Australian economy across 17 sections - updates at "
                        "11:30am Sydney time. Worth the coffee: rba.gov.au/chart-pack. "
                        "Source: RBA."
                    ),
                    url="/calendar",
                )
            )

    for iso_day in FOMC_DECISION_DATES:
        if date.fromisoformat(iso_day) + timedelta(days=1) == sydney_today:
            companions.append(
                MacroCompanion(
                    kind="fomc_after",
                    title="FOMC decided overnight",
                    body=(
                        "The Federal Reserve announced its rate decision at 2:00pm ET while "
                        "Sydney slept. US rates set the discount rate on every growth stock "
                        f"you hold - the statement is at federalreserve.gov.{_fmt_aud(audusd)}"
                    ),
                    url="/calendar",
                )
            )

    return companions


def send_macro_companions(
    repo: SupabaseRepository,
    settings: Settings,
    now: datetime | None = None,
) -> int:
    """Dispatch every due morning brief to every opted-in user. Returns fresh sends."""
    if now is None:
        now = datetime.now(timezone.utc)
    sydney_today = now.astimezone(SYDNEY).date()
    audusd = repo.load_latest_audusd()
    companions = macro_companions_for(sydney_today, audusd)
    if not companions:
        return 0
    if not settings.notification_dispatch_enabled:
        LOGGER.info("Notification dispatch unconfigured - macro companions are a no-op")
        return 0

    user_ids = repo.load_active_user_ids()
    if not user_ids and settings.default_user_id:
        user_ids = [settings.default_user_id]

    sent = 0
    for user_id in user_ids:
        for companion in companions:
            result = dispatch_notification(
                settings,
                user_id=user_id,
                symbol="MACRO",
                alert_type="macro_event",
                title=companion.title,
                body=companion.body,
                reason=f"Seeded macro calendar: {companion.kind} on {sydney_today.isoformat()}",
                payload={
                    "kind": companion.kind,
                    "dedupe_key": f"macro_event:{companion.kind}:{user_id}:{sydney_today.isoformat()}",
                },
                relevance_score=100,
                notification_type="macro_event",
                url=companion.url,
            )
            if result.ok and not result.deduped:
                sent += 1
    return sent
