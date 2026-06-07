from tests.test_signal_engine import settings, snapshot
from workers.stock_scanner.models import Ticker, WatchlistItem
from workers.stock_scanner.signal_engine import calculate_signal
from workers.stock_scanner.watchlist_engine import calculate_watchlist_overlays


def test_watchlist_overlay_marks_triggered_when_rules_match() -> None:
    current = snapshot(rsi=46.0, histogram=-0.45, volume=1300.0, volume_ratio=1.3, close=164.0)
    previous = snapshot(rsi=42.0, histogram=-0.8, volume=1100.0, volume_ratio=1.1, close=166.0)
    _, signal = calculate_signal(Ticker("AMD", "AMD", "Advanced Micro Devices"), current, previous, previous, settings())

    overlays = calculate_watchlist_overlays(
        [WatchlistItem(id="watch-1", symbol="AMD", target_price=170.0, target_signal_score=75)],
        {"AMD": current},
        {"AMD": signal},
    )

    assert len(overlays) == 1
    assert overlays[0].watchlist_trigger_state == "triggered"
    assert overlays[0].distance_to_target_price_pct is not None
