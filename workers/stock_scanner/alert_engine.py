from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from workers.stock_scanner.config import Settings
from workers.stock_scanner.models import PortfolioOverlay, SignalResult, WatchlistOverlay


@dataclass(frozen=True)
class AlertDecision:
    should_send: bool
    symbol: str
    alert_type: str
    channel: str
    reason: str
    cooldown_hours: int
    payload: dict[str, Any]
    user_id: str | None = None  # Multi-user: which user to send to


def signal_alert_decision(signal: SignalResult, previous_signal: dict[str, Any] | None, settings: Settings) -> AlertDecision:
    previous_status = previous_signal.get("signal_status") if previous_signal else None
    previous_score_raw = previous_signal.get("signal_score") if previous_signal else None
    previous_score = float(previous_score_raw) if previous_score_raw is not None else None
    score_delta = signal.signal_score_delta

    if signal.signal_status == "invalidated":
        return AlertDecision(True, signal.symbol, "signal_invalidated", "telegram", "Signal invalidated after prior setup.", 6, signal.raw_payload, user_id=None)

    if signal.signal_status == "strong_setup" and previous_status != "strong_setup":
        return AlertDecision(True, signal.symbol, "strong_setup", "telegram", "New strong setup.", 6, signal.raw_payload, user_id=None)

    if previous_score is not None and score_delta is not None and score_delta >= settings.signal_change_threshold:
        return AlertDecision(True, signal.symbol, "score_jump", "telegram", "Score jumped above configured threshold.", 6, signal.raw_payload, user_id=None)

    if settings.enable_watchlist_alerts and signal.signal_status == "watchlist_setup" and previous_status != "watchlist_setup":
        return AlertDecision(True, signal.symbol, "watchlist_upgrade", "telegram", "Ticker entered watchlist setup.", 12, signal.raw_payload, user_id=None)

    return AlertDecision(False, signal.symbol, "none", "telegram", "No meaningful alert state change.", 6, signal.raw_payload, user_id=None)


def portfolio_alert_decisions(overlays: list[PortfolioOverlay]) -> list[AlertDecision]:
    decisions: list[AlertDecision] = []
    for overlay in overlays:
        if overlay.risk_state in {"invalidated", "elevated_risk", "overextended"}:
            decisions.append(
                AlertDecision(
                    should_send=True,
                    symbol=overlay.symbol,
                    alert_type="portfolio_risk",
                    channel="telegram",
                    reason=f"Portfolio holding {overlay.symbol} entered {overlay.risk_state}.",
                    cooldown_hours=6,
                    payload=overlay.explanation,
                    user_id=overlay.user_id,
                )
            )
    return decisions


def watchlist_alert_decisions(overlays: list[WatchlistOverlay], settings: Settings) -> list[AlertDecision]:
    if not settings.enable_watchlist_alerts:
        return []

    decisions: list[AlertDecision] = []
    for overlay in overlays:
        if overlay.watchlist_trigger_state == "triggered":
            decisions.append(
                AlertDecision(
                    should_send=True,
                    symbol=overlay.symbol,
                    alert_type="watchlist_upgrade",
                    channel="telegram",
                    reason=f"Watchlist item {overlay.symbol} triggered.",
                    cooldown_hours=12,
                    payload=overlay.explanation,
                    user_id=overlay.user_id,
                )
            )
    return decisions


def should_send_alert_to_user(
    user_prefs: dict[str, Any],
    ticker_prefs: dict[str, Any],
    alert_type: str,
    current_time: datetime | None = None,
) -> tuple[bool, str]:
    """Determine whether to send an alert to a user based on their preferences.

    Args:
        user_prefs: User-level alert preferences
        ticker_prefs: Ticker-level alert preferences for this symbol
        alert_type: The type of alert being sent
        current_time: For testing; defaults to datetime.now(timezone.utc)

    Returns (should_send: bool, reason: str).
    """
    if current_time is None:
        current_time = datetime.now(timezone.utc)

    # Check user-level alerts_enabled
    if not user_prefs.get("alerts_enabled", True):
        return False, "User alerts disabled globally"

    # Check quiet hours
    quiet_start = user_prefs.get("quiet_hours_start")
    quiet_end = user_prefs.get("quiet_hours_end")
    if quiet_start is not None and quiet_end is not None:
        current_hour = current_time.hour
        # Handle wrap-around midnight (e.g., 22:00 to 08:00)
        if quiet_start < quiet_end:
            # Normal range, e.g., 09:00 to 17:00
            in_quiet = quiet_start <= current_hour < quiet_end
        else:
            # Wrap-around midnight, e.g., 22:00 to 08:00
            in_quiet = current_hour >= quiet_start or current_hour < quiet_end
        if in_quiet:
            return False, f"User in quiet hours ({quiet_start}-{quiet_end})"

    # Check if ticker is muted
    if ticker_prefs.get("is_muted"):
        muted_until = ticker_prefs.get("muted_until")
        if muted_until:
            muted_until_dt = datetime.fromisoformat(muted_until) if isinstance(muted_until, str) else muted_until
            if current_time < muted_until_dt:
                return False, f"Ticker muted until {muted_until_dt.isoformat()}"

    # Check per-type alert toggles
    alert_toggle_key = f"enable_{alert_type}"
    if alert_toggle_key in user_prefs and not user_prefs[alert_toggle_key]:
        return False, f"Alert type {alert_type} disabled for user"

    # Check ticker-level score thresholds
    min_signal_score = ticker_prefs.get("min_signal_score")
    min_score_delta = ticker_prefs.get("min_score_delta")
    # Note: actual score/delta checking is done by the caller with the signal object

    return True, "All alert gates passed"
