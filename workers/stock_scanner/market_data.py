from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from typing import Callable, Protocol, TypeVar

import pandas as pd

from workers.stock_scanner.models import Candle


class MarketDataProvider(Protocol):
    def fetch_ohlcv(self, symbol: str, timeframe: str, lookback_days: int) -> list[Candle]:
        ...


_TIMEFRAME_SECONDS = {
    "1h": 3_600,
    "1d": 86_400,
    "daily": 86_400,
}

_T = TypeVar("_T")


def drop_incomplete_last_candle(
    candles: list[Candle], timeframe: str, now: datetime | None = None
) -> list[Candle]:
    """Discard the in-progress bar so every published score is reproducible.

    yfinance includes the currently-forming candle (its `candle_time` is the bar OPEN);
    scoring it means the stored score gets rewritten when the bar completes - alerts
    would cite numbers the candle history later contradicts. A bar is complete only
    once its open time plus the bar duration has passed.
    """
    if not candles:
        return candles
    seconds = _TIMEFRAME_SECONDS.get(timeframe)
    if seconds is None:
        return candles
    if now is None:
        now = datetime.now(timezone.utc)
    ordered = sorted(candles, key=lambda candle: candle.candle_time)
    if ordered[-1].candle_time + timedelta(seconds=seconds) > now:
        return ordered[:-1]
    return ordered


def download_with_retry(
    download: Callable[[], _T],
    attempts: int = 3,
    base_delay_seconds: float = 2.0,
    sleep: Callable[[float], None] = time.sleep,
) -> _T:
    """Retry a flaky provider download with exponential backoff (2s, 4s)."""
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            return download()
        except Exception as error:  # noqa: BLE001 - provider errors are opaque; retry then surface
            last_error = error
            if attempt < attempts - 1:
                sleep(base_delay_seconds * (2**attempt))
    assert last_error is not None
    raise last_error


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

        frame = download_with_retry(
            lambda: yf.download(
                symbol,
                period=period,
                interval=interval,
                progress=False,
                auto_adjust=False,
                threads=False,
            )
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

        return drop_incomplete_last_candle(candles, timeframe)


def create_provider(provider_name: str) -> MarketDataProvider:
    provider = provider_name.lower().strip()
    if provider == "yfinance":
        return YFinanceProvider()
    raise ValueError(f"Unsupported market data provider: {provider_name}")
