from __future__ import annotations

from workers.stock_scanner.models import IndicatorSnapshot, PortfolioOverlay, PortfolioPosition, SignalResult


def risk_state_for(position: PortfolioPosition, indicator: IndicatorSnapshot, signal: SignalResult) -> str:
    cost_base = (position.quantity * position.average_buy_price) + position.brokerage_fee
    market_value = position.quantity * (indicator.close or 0)
    unrealised_pct = ((market_value - cost_base) / cost_base) * 100 if cost_base else 0

    if signal.signal_status == "invalidated":
        return "invalidated"
    if unrealised_pct > 20 and indicator.rsi_14 is not None and indicator.rsi_14 > 70:
        return "overextended"
    if signal.signal_status == "weakening":
        return "elevated_risk"
    if signal.signal_status == "strong_setup":
        return "opportunity"
    if signal.signal_status == "watchlist_setup":
        return "watch"
    return "neutral"


def calculate_portfolio_overlays(
    positions: list[PortfolioPosition],
    latest_by_symbol: dict[str, IndicatorSnapshot],
    signal_by_symbol: dict[str, SignalResult],
) -> list[PortfolioOverlay]:
    values = {
        position.symbol: position.quantity * (latest_by_symbol[position.symbol].close or 0)
        for position in positions
        if position.symbol in latest_by_symbol
    }
    total_value = sum(values.values())
    overlays: list[PortfolioOverlay] = []

    for position in positions:
        indicator = latest_by_symbol.get(position.symbol)
        signal = signal_by_symbol.get(position.symbol)
        if not indicator or not signal:
            continue

        current_price = indicator.close
        market_value = position.quantity * (current_price or 0)
        cost_base = (position.quantity * position.average_buy_price) + position.brokerage_fee
        unrealised_pl = market_value - cost_base
        unrealised_pl_pct = (unrealised_pl / cost_base) * 100 if cost_base else 0
        portfolio_weight_pct = (market_value / total_value) * 100 if total_value else 0
        risk_state = risk_state_for(position, indicator, signal)

        overlays.append(
            PortfolioOverlay(
                position_id=position.id,
                symbol=position.symbol,
                candle_time=indicator.candle_time,
                current_price=current_price,
                market_value=market_value,
                unrealised_pl=unrealised_pl,
                unrealised_pl_pct=unrealised_pl_pct,
                portfolio_weight_pct=portfolio_weight_pct,
                signal_score=signal.signal_score,
                signal_status=signal.signal_status,
                action_state=signal.action_state,
                risk_state=risk_state,
                explanation={
                    "position": {
                        "quantity": position.quantity,
                        "average_buy_price": position.average_buy_price,
                        "cost_base": cost_base,
                    },
                    "signal": {
                        "score": signal.signal_score,
                        "status": signal.signal_status,
                        "action_state": signal.action_state,
                    },
                    "risk_state": risk_state,
                },
            )
        )

    return overlays
