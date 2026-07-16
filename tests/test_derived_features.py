"""Unit tests for the derived-feature helpers that feed the signal engine.

These compute the deltas, ratios, and categorical states (RSI / MACD / volume / trend) the scorer
reads, so a regression here silently mis-scores every symbol. The scorer had tests; this closes the
gap on the layer beneath it.
"""

from workers.stock_scanner.derived_features import (
    delta,
    percent_change,
    distance_from_low,
    price_vs_average,
    rsi_state,
    macd_state,
    volume_state,
    trend_state,
)


def test_delta_and_percent_change_handle_none_and_zero() -> None:
    assert delta(10.0, 4.0) == 6.0
    assert delta(None, 4.0) is None
    assert delta(10.0, None) is None
    assert percent_change(110.0, 100.0) == 10.0
    assert percent_change(100.0, 0.0) is None  # no divide-by-zero
    assert percent_change(None, 100.0) is None


def test_distance_from_low_and_price_vs_average() -> None:
    # 6% above the 60-period low.
    assert round(distance_from_low(106.0, 100.0), 4) == 6.0
    assert distance_from_low(100.0, 0.0) is None
    assert round(price_vs_average(102.0, 100.0), 4) == 2.0
    assert price_vs_average(100.0, None) is None


def test_rsi_state_bands() -> None:
    assert rsi_state(75.0, 1.0) == "overbought"
    assert rsi_state(25.0, -1.0) == "oversold"
    assert rsi_state(45.0, 0.5) == "rising"
    assert rsi_state(45.0, -0.5) == "falling"
    assert rsi_state(45.0, 0.0) == "flat"
    assert rsi_state(None, 1.0) == "neutral"


def test_macd_state_crosses_and_recovery() -> None:
    # Bullish cross: macd rises above signal across the two periods.
    assert macd_state(1.0, 0.5, -0.2, 0.1, 0.5, 0.3) == "bullish_cross"
    # Bearish cross.
    assert macd_state(-0.5, 0.2, 0.3, 0.1, -0.7, -0.2) == "bearish_cross"
    # No cross, negative-but-improving histogram (the setup the strategy hunts).
    assert macd_state(0.1, 0.2, 0.1, 0.2, -0.3, 0.4) == "bearish_but_improving"
    # No cross, fading histogram.
    assert macd_state(0.1, 0.2, 0.1, 0.2, 0.3, -0.4) == "weakening"


def test_volume_state_thresholds() -> None:
    assert volume_state(1000, 900, 1.2) == "above_average"
    assert volume_state(1000, 900, 0.5) == "below_average"
    assert volume_state(1000, 900, 0.9) == "rising"
    assert volume_state(900, 1000, 0.9) == "falling"


def test_trend_state_ladder() -> None:
    assert trend_state(None, 10, 10, 10) == "broken_trend"  # missing close
    # Short-term recovery: 20>=50*0.95 and close>=sma20.
    assert trend_state(105.0, 104.0, 105.0, 90.0) == "short_term_recovery"
    # Above the long trend (short-term-recovery branch not met: close is below sma_20).
    assert trend_state(120.0, 130.0, 130.0, 100.0) == "above_long_trend"
    # Just under the 200 SMA (within 5%), with close below sma_20 so short-term-recovery is not met.
    assert trend_state(96.0, 100.0, 100.0, 100.0) == "near_long_trend"
    # Well below the 200 SMA.
    assert trend_state(80.0, 85.0, 85.0, 100.0) == "broken_trend"
