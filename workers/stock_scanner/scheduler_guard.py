from __future__ import annotations

from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

from workers.stock_scanner.config import Settings

# The scanner tracks US-listed stocks, so "market hours" is New York time. Evaluating the window in
# America/New_York (not a fixed UTC band) means DST is handled correctly - the real 9:30-16:00 ET
# session maps to 13:30-20:00 UTC in summer but 14:30-21:00 UTC in winter, and a fixed UTC window
# would drift by an hour twice a year.
#
# The band is 9:00-17:30 ET, wider than the 9:30-16:00 session on purpose. The END is the part that
# matters: the scanner only scores COMPLETE bars, and an hourly bar counts as complete one hour after
# it opens (market_data.drop_incomplete_last_candle), so the closing bar (opens 15:30 ET) is not
# scoreable until 16:30 ET. The cron fires at :17 and :47 (see hourly-stock-scanner.yml) and GitHub
# starts scheduled runs late, so a band that ended AT 16:30 let the last firing in (16:17) see an
# incomplete closing bar and skipped the next one (16:47) - the close of every session went unscored
# until the following morning. Ending at 17:30 gives the closing bar two firings (16:47, 17:17).
_MARKET_TZ = ZoneInfo("America/New_York")
_SESSION_START = time(hour=9, minute=0)
_SESSION_END = time(hour=17, minute=30)


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
