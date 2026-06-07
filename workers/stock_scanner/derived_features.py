from __future__ import annotations


def delta(current: float | None, previous: float | None) -> float | None:
    if current is None or previous is None:
        return None
    return current - previous


def percent_change(current: float | None, previous: float | None) -> float | None:
    if current is None or previous is None or previous == 0:
        return None
    return ((current - previous) / previous) * 100


def distance_from_low(close: float | None, low: float | None) -> float | None:
    if close is None or low is None or low == 0:
        return None
    return ((close - low) / low) * 100


def price_vs_average(close: float | None, average: float | None) -> float | None:
    if close is None or average is None or average == 0:
        return None
    return ((close - average) / average) * 100


def rsi_state(rsi: float | None, rsi_delta_1: float | None) -> str:
    if rsi is None:
        return "neutral"
    if rsi >= 70:
        return "overbought"
    if rsi <= 30:
        return "oversold"
    if rsi_delta_1 is None:
        return "neutral"
    if rsi_delta_1 > 0.1:
        return "rising"
    if rsi_delta_1 < -0.1:
        return "falling"
    return "flat"


def macd_state(
    macd: float | None,
    macd_signal: float | None,
    previous_macd: float | None,
    previous_macd_signal: float | None,
    histogram: float | None,
    histogram_delta_1: float | None,
) -> str:
    if None not in (macd, macd_signal, previous_macd, previous_macd_signal):
        if previous_macd <= previous_macd_signal and macd > macd_signal:
            return "bullish_cross"
        if previous_macd >= previous_macd_signal and macd < macd_signal:
            return "bearish_cross"

    if histogram is not None and histogram < 0 and histogram_delta_1 is not None and histogram_delta_1 > 0:
        return "bearish_but_improving"
    if histogram_delta_1 is not None and histogram_delta_1 < 0:
        return "weakening"
    return "neutral"


def volume_state(volume: float | None, previous_volume: float | None, volume_ratio: float | None) -> str:
    if volume_ratio is not None and volume_ratio >= 1:
        return "above_average"
    if volume_ratio is not None and volume_ratio < 0.8:
        return "below_average"
    if volume is not None and previous_volume is not None and volume > previous_volume:
        return "rising"
    if volume is not None and previous_volume is not None and volume < previous_volume:
        return "falling"
    return "below_average"


def trend_state(close: float | None, sma_20: float | None, sma_50: float | None, sma_200: float | None) -> str:
    if close is None or sma_200 is None:
        return "broken_trend"
    if sma_20 is not None and sma_50 is not None and sma_20 >= sma_50 * 0.95 and close >= sma_20:
        return "short_term_recovery"
    if close >= sma_200:
        return "above_long_trend"
    if close >= sma_200 * 0.95:
        return "near_long_trend"
    if close < sma_200 * 0.9:
        return "broken_trend"
    return "below_long_trend"
