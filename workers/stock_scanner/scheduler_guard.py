from __future__ import annotations

from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

from workers.stock_scanner.config import Settings

# The scanner tracks US-listed stocks, so "market hours" is New York time. Evaluating the window in
# America/New_York (not a fixed UTC band) means DST is handled correctly - the real 9:30-16:00 ET
# session maps to 13:30-20:00 UTC in summer but 14:30-21:00 UTC in winter, and a fixed UTC window
# would drift by an hour twice a year. We use a slightly widened 9:00-16:30 ET band so the hourly
# cron (fires at :05) reliably catches both the open and the close.
_MARKET_TZ = ZoneInfo("America/New_York")
_SESSION_START = time(hour=9, minute=0)
_SESSION_END = time(hour=16, minute=30)


def should_run_now(settings: Settings, now: datetime | None = None) -> bool:
    if settings.force_scan:
        return True

    if not settings.enable_market_hours_guard:
        return True

    current = now or datetime.now(timezone.utc)
    # Evaluate the weekday AND the clock in New York, so a UTC timestamp that is still "Friday
    # evening" in the US is not mistaken for the weekend, and vice versa.
    ny_now = current.astimezone(_MARKET_TZ)

    if ny_now.weekday() > 4:  # Sat/Sun in NY
        return False

    return _SESSION_START <= ny_now.time() <= _SESSION_END
