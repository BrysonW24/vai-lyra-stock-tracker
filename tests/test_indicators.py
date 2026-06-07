from datetime import datetime, timedelta, timezone

from workers.stock_scanner.indicators import calculate_indicators
from workers.stock_scanner.models import Candle


def fixture_candles(count: int = 160) -> list[Candle]:
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    candles: list[Candle] = []
    for index in range(count):
        base = 100 + (index * 0.15)
        if 90 <= index <= 120:
            base -= (120 - index) * 0.35
        candles.append(
            Candle(
                symbol="AMD",
                timeframe="1h",
                candle_time=start + timedelta(hours=index),
                open=base - 0.3,
                high=base + 0.8,
                low=base - 1.0,
                close=base,
                adjusted_close=base,
                volume=1000 + (index * 4),
                source="fixture",
            )
        )
    return candles


def test_indicator_engine_calculates_macd_deltas_and_low_distances() -> None:
    snapshots = calculate_indicators(fixture_candles())
    latest = snapshots[-1]

    assert latest.rsi_14 is not None
    assert latest.macd is not None
    assert latest.macd_signal is not None
    assert latest.macd_histogram is not None
    assert latest.macd_histogram_delta_1 is not None
    assert latest.distance_from_20_period_low is not None
    assert latest.distance_from_60_period_low is not None
    assert latest.distance_from_120_period_low is not None
    assert latest.rsi_state in {"rising", "falling", "flat", "overbought", "oversold", "neutral"}
    assert latest.macd_state in {"bearish_but_improving", "bullish_cross", "bearish_cross", "weakening", "neutral"}
