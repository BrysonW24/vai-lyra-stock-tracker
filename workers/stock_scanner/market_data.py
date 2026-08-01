from __future__ import annotations

import csv
import io
import logging
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Callable, Protocol, TypeVar

import pandas as pd

from workers.stock_scanner.models import Candle

logger = logging.getLogger("stock_scanner.market_data")


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


class StooqProvider:
    """Free, keyless DAILY OHLCV from Stooq's public CSV endpoint - the second, independent price source
    so a Yahoo throttle does not blind a scan. Fallback-grade by design and honestly limited:

      * daily bars only - a "1h" request returns [] (the hourly scanner keeps yfinance);
      * covered markets only - symbols map through `SUFFIX_MAP` (bare US -> `.us`, LSE `.L` -> `.uk`,
        Xetra `.DE` -> `.de`, Hong Kong `.HK` -> `.hk`); an unmapped market (e.g. ASX) returns [] and is
        logged rather than guessed at.

    Prices are split-adjusted at source, so `adjusted_close` mirrors `close`.
    """

    source = "stooq"

    STOOQ_URL = "https://stooq.com/q/d/l/?s={symbol}&d1={d1}&d2={d2}&i=d"
    SUFFIX_MAP = {"": ".us", ".L": ".uk", ".DE": ".de", ".HK": ".hk"}

    @classmethod
    def map_symbol(cls, symbol: str) -> str | None:
        """Yahoo-style symbol -> Stooq symbol, or None when Stooq does not cover that market."""
        sym = symbol.upper().strip()
        for suffix, stooq_suffix in cls.SUFFIX_MAP.items():
            if suffix and sym.endswith(suffix):
                return sym[: -len(suffix)].lower() + stooq_suffix
        if "." not in sym:
            return sym.lower() + cls.SUFFIX_MAP[""]
        return None

    def _fetch_csv(self, url: str, timeout: int = 30) -> str:
        req = urllib.request.Request(url, headers={"User-Agent": "Lyra research (stooq fallback)"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 - fixed, trusted stooq host
            return resp.read().decode("utf-8", errors="replace")

    def fetch_ohlcv(self, symbol: str, timeframe: str, lookback_days: int) -> list[Candle]:
        if timeframe not in ("1d", "daily"):
            return []  # daily-only source, stated not guessed
        mapped = self.map_symbol(symbol)
        if mapped is None:
            logger.debug("stooq: no symbol mapping for %s - market not covered", symbol)
            return []
        end = datetime.now(timezone.utc)
        start = end - timedelta(days=lookback_days)
        url = self.STOOQ_URL.format(symbol=mapped, d1=start.strftime("%Y%m%d"), d2=end.strftime("%Y%m%d"))
        try:
            text = download_with_retry(lambda: self._fetch_csv(url))
        except Exception:  # noqa: BLE001 - a fallback source failing is a miss, never a crash
            return []
        candles = self.parse_csv(text, symbol=symbol, timeframe=timeframe)
        return drop_incomplete_last_candle(candles, timeframe)

    def parse_csv(self, text: str, *, symbol: str, timeframe: str) -> list[Candle]:
        """Pure parse of Stooq's `Date,Open,High,Low,Close,Volume` CSV (also tolerates a `No data`
        body). Bad rows are skipped; rows are returned time-ascending."""
        out: list[Candle] = []
        try:
            reader = csv.DictReader(io.StringIO(text))
            if not reader.fieldnames or "Date" not in reader.fieldnames:
                return []
            for row in reader:
                try:
                    when = datetime.strptime((row.get("Date") or "").strip(), "%Y-%m-%d").replace(tzinfo=timezone.utc)
                except ValueError:
                    continue
                close = _parse_float(row.get("Close"))
                out.append(
                    Candle(
                        symbol=symbol,
                        timeframe=timeframe,
                        candle_time=when,
                        open=_parse_float(row.get("Open")),
                        high=_parse_float(row.get("High")),
                        low=_parse_float(row.get("Low")),
                        close=close,
                        adjusted_close=close,  # stooq data is split-adjusted at source
                        volume=_parse_float(row.get("Volume")),
                        source=self.source,
                    )
                )
        except Exception:  # noqa: BLE001 - unparseable body = no data
            return []
        out.sort(key=lambda c: c.candle_time)
        return out


def _parse_float(value: object) -> float | None:
    try:
        if value is None or str(value).strip() in ("", "N/A", "-"):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


class FallbackProvider:
    """Chain of providers tried in order - the first non-empty result wins. A primary throwing or coming
    back empty degrades to the next source (logged), so one throttled provider costs a fallback fetch,
    not the whole symbol. Composed by `create_provider("yfinance+stooq")`."""

    source = "fallback"

    def __init__(self, providers: list[MarketDataProvider]):
        if not providers:
            raise ValueError("FallbackProvider needs at least one provider")
        self.providers = providers
        self.source = "+".join(getattr(p, "source", "?") for p in providers)

    def fetch_ohlcv(self, symbol: str, timeframe: str, lookback_days: int) -> list[Candle]:
        for i, provider in enumerate(self.providers):
            try:
                candles = provider.fetch_ohlcv(symbol, timeframe, lookback_days)
            except Exception:  # noqa: BLE001 - a failing source falls through to the next
                candles = []
            if candles:
                if i > 0:
                    logger.info("%s: served by fallback source %s", symbol, getattr(provider, "source", "?"))
                return candles
        return []


def create_provider(provider_name: str) -> MarketDataProvider:
    """Provider factory. Single names ("yfinance", "stooq") return that provider; a "+"-joined chain
    ("yfinance+stooq") returns a FallbackProvider trying each in order."""
    names = [p.lower().strip() for p in provider_name.split("+") if p.strip()]
    if not names:
        raise ValueError(f"Unsupported market data provider: {provider_name}")
    providers: list[MarketDataProvider] = []
    for name in names:
        if name == "yfinance":
            providers.append(YFinanceProvider())
        elif name == "stooq":
            providers.append(StooqProvider())
        else:
            raise ValueError(f"Unsupported market data provider: {provider_name}")
    return providers[0] if len(providers) == 1 else FallbackProvider(providers)
