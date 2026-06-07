from __future__ import annotations

from datetime import datetime, timezone
from typing import Protocol

import pandas as pd

from workers.stock_scanner.models import Candle


class MarketDataProvider(Protocol):
    def fetch_ohlcv(self, symbol: str, timeframe: str, lookback_days: int) -> list[Candle]:
        ...


def _clean_float(value: object) -> float | None:
    if value is None or pd.isna(value):
        return None
    return float(value)


def _clean_datetime(value: object) -> datetime:
    timestamp = pd.Timestamp(value)
    if timestamp.tzinfo is None:
        timestamp = timestamp.tz_localize(timezone.utc)
    return timestamp.tz_convert(timezone.utc).to_pydatetime()


class YFinanceProvider:
    source = "yfinance"

    def fetch_ohlcv(self, symbol: str, timeframe: str, lookback_days: int) -> list[Candle]:
        import yfinance as yf

        interval_map = {
            "1h": "1h",
            "1d": "1d",
            "daily": "1d",
        }
        interval = interval_map.get(timeframe, timeframe)
        period = f"{lookback_days}d"

        frame = yf.download(
            symbol,
            period=period,
            interval=interval,
            progress=False,
            auto_adjust=False,
            threads=False,
        )

        if frame.empty:
            return []

        if isinstance(frame.columns, pd.MultiIndex):
            frame.columns = [str(column[0]) for column in frame.columns]

        frame = frame.reset_index()
        time_column = "Datetime" if "Datetime" in frame.columns else "Date"
        candles: list[Candle] = []

        for row in frame.to_dict(orient="records"):
            candles.append(
                Candle(
                    symbol=symbol,
                    timeframe=timeframe,
                    candle_time=_clean_datetime(row[time_column]),
                    open=_clean_float(row.get("Open")),
                    high=_clean_float(row.get("High")),
                    low=_clean_float(row.get("Low")),
                    close=_clean_float(row.get("Close")),
                    adjusted_close=_clean_float(row.get("Adj Close")),
                    volume=_clean_float(row.get("Volume")),
                    source=self.source,
                )
            )

        return candles


def create_provider(provider_name: str) -> MarketDataProvider:
    provider = provider_name.lower().strip()
    if provider == "yfinance":
        return YFinanceProvider()
    raise ValueError(f"Unsupported market data provider: {provider_name}")
