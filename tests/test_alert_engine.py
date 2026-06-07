from tests.test_signal_engine import settings, snapshot
from workers.stock_scanner.alert_engine import signal_alert_decision
from workers.stock_scanner.models import Ticker
from workers.stock_scanner.signal_engine import calculate_signal


def test_alert_engine_sends_new_strong_setup() -> None:
    current = snapshot(rsi=46.0, histogram=-0.45, volume=1300.0, volume_ratio=1.3)
    previous = snapshot(rsi=42.0, histogram=-0.8, volume=1100.0, volume_ratio=1.1)
    _, signal = calculate_signal(Ticker("AMD", "AMD", "Advanced Micro Devices"), current, previous, previous, settings())

    decision = signal_alert_decision(signal, {"signal_status": "watchlist_setup", "signal_score": 66}, settings())

    assert decision.should_send is True
    assert decision.alert_type == "strong_setup"
    assert decision.symbol == "AMD"
