from __future__ import annotations

from datetime import datetime, time, timezone

from workers.stock_scanner.config import Settings


def should_run_now(settings: Settings, now: datetime | None = None) -> bool:
    if settings.force_scan:
        return True

    if not settings.enable_market_hours_guard:
        return True

    current = now or datetime.now(timezone.utc)
    current = current.astimezone(timezone.utc)

    if current.weekday() > 4:
        return False

    start = time(hour=13, minute=0)
    end = time(hour=23, minute=59)
    return start <= current.time() <= end
