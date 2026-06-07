"""
Deterministic event-risk scoring engine.

Rule: event_risk_for_ticker(symbol, signal_status, events, today) -> 'elevated'|'moderate'|'low'

Elevated: ticker has strong_setup/watchlist_setup signal AND high-importance event within 7 days
Moderate: medium-importance event within 7 days (regardless of signal)
Low: else

Pure functions; no side effects; documented deterministic logic.
"""

from __future__ import annotations

from datetime import datetime


def days_until(iso_date: str, today: str) -> int:
    """
    Calculate days until a given ISO date (YYYY-MM-DD) from a reference date.

    Examples:
        days_until("2026-06-05", "2026-06-03") == 2
        days_until("2026-06-03", "2026-06-03") == 0
        days_until("2026-06-02", "2026-06-03") == -1
    """
    target = datetime.fromisoformat(iso_date)
    ref = datetime.fromisoformat(today)
    diff_days = (target - ref).days
    return diff_days


def event_risk_for_ticker(
    symbol: str,
    signal_status: str,
    events: list,
    today: str = "2026-06-03",
) -> str:
    """
    Compute event risk for a ticker based on signal status and upcoming events.

    Rule (deterministic):
    - 'elevated' if signal is 'strong_setup' or 'watchlist_setup' AND
      there is a 'high' importance event within 7 days for this ticker.
    - 'moderate' if there is a 'medium' importance event within 7 days for this ticker.
    - 'low' otherwise.

    Note: Only ticker-specific events count. Macro events (ticker=None) are ignored.

    Args:
        symbol: ticker symbol (e.g., 'NVDA')
        signal_status: signal status from scanner (e.g., 'strong_setup', 'watchlist_setup', 'inactive')
        events: list of CalendarEvent dicts with keys: id, date, type, ticker, title, importance
        today: reference date (ISO format YYYY-MM-DD), defaults to '2026-06-03'

    Returns:
        'elevated', 'moderate', or 'low'
    """
    # Only consider tickers with strong or watchlist setups for elevated risk
    is_setup_signal = signal_status in ("strong_setup", "watchlist_setup")

    # Find upcoming events for this ticker within 7 days
    upcoming_high = []
    upcoming_medium = []

    for event in events:
        # Only match events with an explicit ticker assigned
        event_ticker = event.get("ticker")
        if not event_ticker:
            # Skip macro events (ticker=None)
            continue

        if event_ticker.upper() != symbol.upper():
            # Skip events for other tickers
            continue

        days_out = days_until(event["date"], today)

        # Only consider events within 7 days (including today)
        if 0 <= days_out <= 7:
            importance = event.get("importance", "low")
            if importance == "high":
                upcoming_high.append(event)
            elif importance == "medium":
                upcoming_medium.append(event)

    # Rule: elevated only when signal is strong/watchlist AND high-importance event within 7 days
    if is_setup_signal and upcoming_high:
        return "elevated"

    # Rule: moderate if any medium-importance event within 7 days
    if upcoming_medium:
        return "moderate"

    # Default to low
    return "low"
