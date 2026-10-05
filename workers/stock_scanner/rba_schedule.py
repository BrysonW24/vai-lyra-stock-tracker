"""The RBA decision schedule and the one question the alert cron asks of it: is a decision due NOW?

Standard library only, on purpose. The alert workflow asks this before it installs anything, so the
~250 weekdays a year that are not decision days cost a few seconds instead of a dependency install -
and so the answer cannot depend on a package being importable.

Why the time of day is part of the gate, not just the date: the job that follows still alerts when it
cannot read the statement ("decision is out, read it at rba.gov.au"). That fallback is only honest
AFTER 2:30pm Sydney. A run that started early - Sydney's UTC offset changes on the first Sunday of
April and of October, so any fixed UTC cron is an hour out for part of those months - would announce
a decision that had not happened yet. Gating on Sydney wall-clock time makes the job correct under
any cron, and lets the workflow fire at both UTC candidates in the two boundary months.
"""
from __future__ import annotations

from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

SYDNEY = ZoneInfo("Australia/Sydney")

# The Monetary Policy Board announces at 2:30pm Sydney time.
DECISION_TIME = time(hour=14, minute=30)

# Decision-announcement dates = meeting day 2. Verified 2026-07-17 from the RBA's published schedule.
RBA_DECISION_DATES: tuple[str, ...] = (
    "2026-02-03", "2026-03-17", "2026-05-05", "2026-06-16",
    "2026-08-11", "2026-09-29", "2026-11-03", "2026-12-08",
    "2027-02-09", "2027-03-23", "2027-05-04", "2027-06-22",
    "2027-08-10", "2027-09-28", "2027-11-02", "2027-12-14",
)


def rba_decision_due(now: datetime | None = None) -> bool:
    """True only on a seeded decision day, at or after the 2:30pm Sydney announcement."""
    current = (now or datetime.now(timezone.utc)).astimezone(SYDNEY)
    return current.date().isoformat() in RBA_DECISION_DATES and current.time() >= DECISION_TIME


if __name__ == "__main__":
    # The workflow gate: prints a GitHub Actions step output line.
    print(f"due={'true' if rba_decision_due() else 'false'}")
