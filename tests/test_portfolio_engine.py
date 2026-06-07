from tests.test_signal_engine import settings, snapshot
from workers.stock_scanner.models import PortfolioPosition, Ticker
from workers.stock_scanner.portfolio_engine import calculate_portfolio_overlays
from workers.stock_scanner.signal_engine import calculate_signal


def test_portfolio_overlay_calculates_value_and_risk_state() -> None:
    current = snapshot(rsi=46.0, histogram=-0.45, volume=1300.0, volume_ratio=1.3, close=164.0)
    previous = snapshot(rsi=42.0, histogram=-0.8, volume=1100.0, volume_ratio=1.1, close=160.0)
    _, signal = calculate_signal(Ticker("AMD", "AMD", "Advanced Micro Devices"), current, previous, previous, settings())

    overlays = calculate_portfolio_overlays(
        [PortfolioPosition(id="position-1", symbol="AMD", quantity=10, average_buy_price=170.0, brokerage_fee=5.0)],
        {"AMD": current},
        {"AMD": signal},
    )

    assert len(overlays) == 1
    assert overlays[0].market_value == 1640.0
    assert overlays[0].action_state == "buy_review"
    assert overlays[0].risk_state == "opportunity"
