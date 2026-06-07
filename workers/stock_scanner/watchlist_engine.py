from __future__ import annotations

from workers.stock_scanner.models import IndicatorSnapshot, SignalResult, WatchlistItem, WatchlistOverlay


def distance_to_target(current_price: float | None, target_price: float | None) -> float | None:
    if current_price is None or target_price is None or target_price == 0:
        return None
    return ((current_price - target_price) / target_price) * 100


def watchlist_trigger_state(item: WatchlistItem, indicator: IndicatorSnapshot, signal: SignalResult) -> str:
    current_price = indicator.close
    price_condition_met = item.target_price is None or (current_price is not None and current_price <= item.target_price)
    rsi_condition_met = indicator.rsi_14 is not None and item.rsi_min <= indicator.rsi_14 <= item.rsi_max
    macd_condition_met = (
        not item.require_macd_histogram_rising
        or (indicator.macd_histogram_delta_1 is not None and indicator.macd_histogram_delta_1 > 0)
    )
    volume_condition_met = indicator.volume_ratio is not None and indicator.volume_ratio >= item.require_volume_ratio

    if signal.signal_status == "invalidated":
        return "invalidated"
    if signal.signal_score >= item.target_signal_score and price_condition_met and rsi_condition_met and macd_condition_met and volume_condition_met:
        return "triggered"
    if signal.signal_score >= item.target_signal_score - 10:
        return "approaching"
    if item.target_price is not None and current_price is not None and current_price > item.target_price * 1.15:
        return "missed"
    return "not_ready"


def calculate_watchlist_overlays(
    items: list[WatchlistItem],
    latest_by_symbol: dict[str, IndicatorSnapshot],
    signal_by_symbol: dict[str, SignalResult],
) -> list[WatchlistOverlay]:
    overlays: list[WatchlistOverlay] = []

    for item in items:
        indicator = latest_by_symbol.get(item.symbol)
        signal = signal_by_symbol.get(item.symbol)
        if not indicator or not signal:
            continue

        trigger_state = watchlist_trigger_state(item, indicator, signal)
        overlays.append(
            WatchlistOverlay(
                watchlist_item_id=item.id,
                symbol=item.symbol,
                candle_time=indicator.candle_time,
                current_price=indicator.close,
                distance_to_target_price_pct=distance_to_target(indicator.close, item.target_price),
                signal_score=signal.signal_score,
                signal_status=signal.signal_status,
                watchlist_trigger_state=trigger_state,
                explanation={
                    "target_price": item.target_price,
                    "target_signal_score": item.target_signal_score,
                    "rsi_range": [item.rsi_min, item.rsi_max],
                    "requires_macd_histogram_rising": item.require_macd_histogram_rising,
                    "required_volume_ratio": item.require_volume_ratio,
                    "trigger_state": trigger_state,
                    "notes": item.notes,
                },
            )
        )

    return overlays
