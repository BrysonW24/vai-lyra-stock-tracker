from __future__ import annotations

import pandas as pd
from ta.momentum import RSIIndicator
from ta.trend import EMAIndicator, MACD, SMAIndicator

from workers.stock_scanner.derived_features import macd_state, rsi_state, trend_state, volume_state
from workers.stock_scanner.models import Candle, IndicatorSnapshot


def _clean_float(value: object) -> float | None:
    if value is None or pd.isna(value):
        return None
    return float(value)


def _ratio(close: pd.Series, average: pd.Series) -> pd.Series:
    return ((close - average) / average) * 100


def calculate_indicators(candles: list[Candle]) -> list[IndicatorSnapshot]:
    if len(candles) < 35:
        return []

    sorted_candles = sorted(candles, key=lambda candle: candle.candle_time)
    frame = pd.DataFrame(
        [
            {
                "symbol": candle.symbol,
                "timeframe": candle.timeframe,
                "candle_time": candle.candle_time,
                "open": candle.open,
                "high": candle.high,
                "low": candle.low,
                "close": candle.close,
                "volume": candle.volume,
            }
            for candle in sorted_candles
        ]
    )

    frame = frame.dropna(subset=["close"])
    if len(frame) < 35:
        return []

    close = frame["close"].astype(float)
    high = frame["high"].astype(float)
    low = frame["low"].astype(float)
    volume = frame["volume"].fillna(0).astype(float)

    macd_indicator = MACD(close=close, window_slow=26, window_fast=12, window_sign=9)

    frame["rsi_14"] = RSIIndicator(close=close, window=14).rsi()
    frame["rsi_delta_1"] = frame["rsi_14"].diff()
    frame["rsi_delta_2"] = frame["rsi_14"] - frame["rsi_14"].shift(2)
    frame["macd"] = macd_indicator.macd()
    frame["macd_signal"] = macd_indicator.macd_signal()
    frame["macd_histogram"] = macd_indicator.macd_diff()
    frame["macd_histogram_delta_1"] = frame["macd_histogram"].diff()
    frame["macd_histogram_delta_2"] = frame["macd_histogram"] - frame["macd_histogram"].shift(2)
    frame["sma_20"] = SMAIndicator(close=close, window=20).sma_indicator()
    frame["sma_50"] = SMAIndicator(close=close, window=50).sma_indicator()
    frame["sma_200"] = SMAIndicator(close=close, window=200).sma_indicator()
    frame["ema_12"] = EMAIndicator(close=close, window=12).ema_indicator()
    frame["ema_26"] = EMAIndicator(close=close, window=26).ema_indicator()
    frame["volume_sma_20"] = volume.rolling(20).mean()
    frame["volume_ratio"] = volume / frame["volume_sma_20"]
    frame["price_vs_sma_20"] = _ratio(close, frame["sma_20"])
    frame["price_vs_sma_50"] = _ratio(close, frame["sma_50"])
    frame["price_vs_sma_200"] = _ratio(close, frame["sma_200"])
    frame["period_low_20"] = low.rolling(20).min()
    frame["period_low_60"] = low.rolling(60).min()
    frame["period_low_120"] = low.rolling(120).min()
    frame["distance_from_20_period_low"] = ((close - frame["period_low_20"]) / frame["period_low_20"]) * 100
    frame["distance_from_60_period_low"] = ((close - frame["period_low_60"]) / frame["period_low_60"]) * 100
    frame["distance_from_120_period_low"] = ((close - frame["period_low_120"]) / frame["period_low_120"]) * 100
    frame["previous_macd"] = frame["macd"].shift(1)
    frame["previous_macd_signal"] = frame["macd_signal"].shift(1)
    frame["previous_volume"] = volume.shift(1)

    snapshots: list[IndicatorSnapshot] = []
    for row in frame.to_dict(orient="records"):
        snapshots.append(
            IndicatorSnapshot(
                symbol=str(row["symbol"]),
                timeframe=str(row["timeframe"]),
                candle_time=row["candle_time"],
                close=_clean_float(row.get("close")),
                volume=_clean_float(row.get("volume")),
                rsi_14=_clean_float(row.get("rsi_14")),
                rsi_delta_1=_clean_float(row.get("rsi_delta_1")),
                rsi_delta_2=_clean_float(row.get("rsi_delta_2")),
                rsi_state=rsi_state(_clean_float(row.get("rsi_14")), _clean_float(row.get("rsi_delta_1"))),
                macd=_clean_float(row.get("macd")),
                macd_signal=_clean_float(row.get("macd_signal")),
                macd_histogram=_clean_float(row.get("macd_histogram")),
                macd_histogram_delta_1=_clean_float(row.get("macd_histogram_delta_1")),
                macd_histogram_delta_2=_clean_float(row.get("macd_histogram_delta_2")),
                macd_state=macd_state(
                    _clean_float(row.get("macd")),
                    _clean_float(row.get("macd_signal")),
                    _clean_float(row.get("previous_macd")),
                    _clean_float(row.get("previous_macd_signal")),
                    _clean_float(row.get("macd_histogram")),
                    _clean_float(row.get("macd_histogram_delta_1")),
                ),
                sma_20=_clean_float(row.get("sma_20")),
                sma_50=_clean_float(row.get("sma_50")),
                sma_200=_clean_float(row.get("sma_200")),
                ema_12=_clean_float(row.get("ema_12")),
                ema_26=_clean_float(row.get("ema_26")),
                volume_sma_20=_clean_float(row.get("volume_sma_20")),
                volume_ratio=_clean_float(row.get("volume_ratio")),
                volume_state=volume_state(
                    _clean_float(row.get("volume")),
                    _clean_float(row.get("previous_volume")),
                    _clean_float(row.get("volume_ratio")),
                ),
                price_vs_sma_20=_clean_float(row.get("price_vs_sma_20")),
                price_vs_sma_50=_clean_float(row.get("price_vs_sma_50")),
                price_vs_sma_200=_clean_float(row.get("price_vs_sma_200")),
                distance_from_20_period_low=_clean_float(row.get("distance_from_20_period_low")),
                distance_from_60_period_low=_clean_float(row.get("distance_from_60_period_low")),
                distance_from_120_period_low=_clean_float(row.get("distance_from_120_period_low")),
                trend_state=trend_state(
                    _clean_float(row.get("close")),
                    _clean_float(row.get("sma_20")),
                    _clean_float(row.get("sma_50")),
                    _clean_float(row.get("sma_200")),
                ),
            )
        )

    return snapshots
