"""
Stooq fallback provider + provider chaining - CI-safe (no network).

The scanner convention says the worker is provider-abstracted so yfinance can be replaced; this proves
the second implementation of that protocol behaves, and that the "yfinance+stooq" chain degrades to the
fallback instead of going blind when the primary throttles. All fetches are stubbed - the CSV parse and
the chain logic are what is under test.
"""
from __future__ import annotations

from workers.stock_scanner.market_data import FallbackProvider, StooqProvider, create_provider
from workers.stock_scanner.models import Candle

STOOQ_CSV = (
    "Date,Open,High,Low,Close,Volume\n"
    "2020-01-02,10.0,10.5,9.8,10.2,120000\n"
    "2020-01-06,10.3,10.6,10.1,10.4,\n"      # missing volume tolerated (None, row kept)
    "not-a-date,1,2,3,4,5\n"                  # bad row skipped
    "2020-01-03,10.1,10.4,10.0,10.3,90000\n"  # out of order in the file - sorted on parse
)


def test_stooq_csv_parses_ordered_and_tolerant():
    candles = StooqProvider().parse_csv(STOOQ_CSV, symbol="AAPL", timeframe="1d")
    assert [c.candle_time.day for c in candles] == [2, 3, 6]  # time-ascending
    assert candles[0].close == 10.2 and candles[0].adjusted_close == 10.2  # split-adjusted at source
    assert candles[-1].volume is None  # absent volume stays None, never invented
    assert all(c.source == "stooq" and c.candle_time.tzinfo is not None for c in candles)


def test_stooq_handles_no_data_and_garbage():
    provider = StooqProvider()
    assert provider.parse_csv("No data", symbol="X", timeframe="1d") == []
    assert provider.parse_csv("", symbol="X", timeframe="1d") == []


def test_stooq_symbol_mapping_is_honest_about_coverage():
    assert StooqProvider.map_symbol("AAPL") == "aapl.us"
    assert StooqProvider.map_symbol("RR.L") == "rr.uk"
    assert StooqProvider.map_symbol("SAP.DE") == "sap.de"
    assert StooqProvider.map_symbol("XRO.AX") is None  # market not covered -> None, never a guess


def test_stooq_is_daily_only_and_skips_unmapped(monkeypatch):
    provider = StooqProvider()
    monkeypatch.setattr(provider, "_fetch_csv", lambda url, timeout=30: STOOQ_CSV)
    assert provider.fetch_ohlcv("AAPL", "1h", 30) == []       # hourly is not pretended
    assert provider.fetch_ohlcv("XRO.AX", "1d", 30) == []     # unmapped market is a stated miss
    assert len(provider.fetch_ohlcv("AAPL", "1d", 30)) == 3   # mapped daily works


class _Boom:
    source = "boom"

    def fetch_ohlcv(self, symbol, timeframe, lookback_days):
        raise RuntimeError("throttled")


class _Empty:
    source = "empty"

    def fetch_ohlcv(self, symbol, timeframe, lookback_days):
        return []


class _Fixed:
    source = "fixed"

    def __init__(self, candles):
        self.candles = candles
        self.calls = 0

    def fetch_ohlcv(self, symbol, timeframe, lookback_days):
        self.calls += 1
        return self.candles


def _one_candle():
    import datetime

    return [
        Candle(
            symbol="T", timeframe="1d",
            candle_time=datetime.datetime(2020, 1, 2, tzinfo=datetime.timezone.utc),
            open=1.0, high=1.0, low=1.0, close=1.0, adjusted_close=1.0, volume=1.0, source="fixed",
        )
    ]


def test_fallback_chain_degrades_and_short_circuits():
    good = _Fixed(_one_candle())
    chain = FallbackProvider([_Boom(), _Empty(), good])
    assert len(chain.fetch_ohlcv("T", "1d", 30)) == 1  # error -> empty -> served by the fallback
    assert chain.fetch_ohlcv("T", "1d", 30)[0].source == "fixed"

    late = _Fixed(_one_candle())
    first = _Fixed(_one_candle())
    chain2 = FallbackProvider([first, late])
    chain2.fetch_ohlcv("T", "1d", 30)
    assert first.calls == 1 and late.calls == 0  # a healthy primary never costs a fallback fetch


def test_fallback_all_dark_is_an_empty_miss_not_a_crash():
    assert FallbackProvider([_Boom(), _Empty()]).fetch_ohlcv("T", "1d", 30) == []


def test_create_provider_builds_singles_and_chains():
    assert create_provider("stooq").source == "stooq"
    chain = create_provider("yfinance+stooq")
    assert isinstance(chain, FallbackProvider)
    assert chain.source == "yfinance+stooq"
    try:
        create_provider("nope")
        raise AssertionError("unknown provider must raise")
    except ValueError:
        pass
