from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

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
        for threshold in crossed_thresholds_from_current(overlay.unrealised_pl_pct):
            direction = "up" if threshold > 0 else "down"
            decisions.append(
                AlertDecision(
                    should_send=True,
                    symbol=overlay.symbol,
                    alert_type=f"portfolio_price_move_{direction}_{abs(threshold)}",
                    channel="multi_channel",
                    reason=f"Portfolio holding {overlay.symbol} moved {overlay.unrealised_pl_pct:.1f}% from cost basis, crossing {threshold:+d}%.",
                    cooldown_hours=24 * 30,
                    payload={
                        **overlay.explanation,
                        "threshold_pct": threshold,
                        "current_move_pct": overlay.unrealised_pl_pct,
                        "current_price": overlay.current_price,
                        "dedupe_key": f"portfolio_price_move:{overlay.symbol}:{direction}:{abs(threshold)}",
                    },
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
        reference_price = overlay.explanation.get("reference_price")
        current_price = overlay.current_price
        move_pct = pct_move_from_reference(current_price, reference_price)
        for threshold in crossed_thresholds_from_current(move_pct, overlay.explanation.get("movement_alert_pcts")):
            direction = "up" if threshold > 0 else "down"
            decisions.append(
                AlertDecision(
                    should_send=True,
                    symbol=overlay.symbol,
                    alert_type=f"watchlist_price_move_{direction}_{abs(threshold)}",
                    channel="multi_channel",
                    reason=f"Watchlist item {overlay.symbol} moved {move_pct:.1f}% from its add-time price, crossing {threshold:+d}%.",
                    cooldown_hours=24 * 30,
                    payload={
                        **overlay.explanation,
                        "threshold_pct": threshold,
                        "current_move_pct": move_pct,
                        "current_price": current_price,
                        "dedupe_key": f"watchlist_price_move:{overlay.symbol}:{direction}:{abs(threshold)}",
                    },
                    user_id=overlay.user_id,
                )
            )
    return decisions


def pct_move_from_reference(current_price: float | None, reference_price: Any) -> float | None:
    try:
        reference = float(reference_price)
    except (TypeError, ValueError):
        return None
    if current_price is None or reference <= 0:
        return None
    return ((float(current_price) - reference) / reference) * 100


def normalise_thresholds(thresholds: Any = None) -> list[int]:
    if not thresholds:
        thresholds = [-15, -10, -5, 5, 10, 15]
    out: set[int] = set()
    for raw in thresholds:
        try:
            value = int(raw)
        except (TypeError, ValueError):
            continue
        if value != 0:
            out.add(value)
    return sorted(out)


def crossed_thresholds_from_current(current_pct: float | None, thresholds: Any = None) -> list[int]:
    if current_pct is None:
        return []
    return [
        threshold
        for threshold in normalise_thresholds(thresholds)
        if (threshold > 0 and current_pct >= threshold) or (threshold < 0 and current_pct <= threshold)
    ]


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

    # Quiet hours are stored as wall-clock hours in the USER'S timezone (default Australia/Sydney),
    # so the comparison must happen in that zone - not server UTC, or the window inverts.
    tz_name = user_prefs.get("timezone") or "Australia/Sydney"
    try:
        local_now = current_time.astimezone(ZoneInfo(tz_name))
    except Exception:  # noqa: BLE001 - unknown tz string falls back to the raw time, never fatal
        local_now = current_time

    # Check quiet hours
    quiet_start = user_prefs.get("quiet_hours_start") or user_prefs.get("quiet_start")
    quiet_end = user_prefs.get("quiet_hours_end") or user_prefs.get("quiet_end")
    if quiet_start is not None and quiet_end is not None:
        current_hour = local_now.hour
        if isinstance(quiet_start, str):
            quiet_start = int(quiet_start.split(":")[0])
        if isinstance(quiet_end, str):
            quiet_end = int(quiet_end.split(":")[0])
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
    if alert_type.startswith("watchlist_price_move") and not user_prefs.get("watchlist_movement_alerts", True):
        return False, "Watchlist movement alerts disabled for user"
    if alert_type.startswith("portfolio_price_move") and not user_prefs.get("portfolio_movement_alerts", True):
        return False, "Portfolio movement alerts disabled for user"
    if alert_type == "portfolio_risk" and not user_prefs.get("portfolio_risk_enabled", True):
        return False, "Portfolio risk alerts disabled for user"
    if alert_type == "watchlist_upgrade" and not user_prefs.get("watchlist_trigger_enabled", True):
        return False, "Watchlist trigger alerts disabled for user"
    # Signal-alert toggles map to the user_alert_preferences columns (not an enable_* key).
    if alert_type == "strong_setup" and not user_prefs.get("strong_setup_enabled", True):
        return False, "Strong-setup alerts disabled for user"
    if alert_type == "score_jump" and not user_prefs.get("score_jump_enabled", True):
        return False, "Score-jump alerts disabled for user"
    if alert_type == "signal_invalidated" and not user_prefs.get("invalidation_enabled", True):
        return False, "Invalidation alerts disabled for user"

    alert_toggle_key = f"enable_{alert_type}"
    if alert_toggle_key in user_prefs and not user_prefs[alert_toggle_key]:
        return False, f"Alert type {alert_type} disabled for user"

    # Check ticker-level score thresholds
    min_signal_score = ticker_prefs.get("min_signal_score")
    min_score_delta = ticker_prefs.get("min_score_delta")
    # Note: actual score/delta checking is done by the caller with the signal object

    return True, "All alert gates passed"
