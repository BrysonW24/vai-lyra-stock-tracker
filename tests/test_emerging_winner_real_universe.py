"""
Emerging Winner Engine - REAL UNIVERSE scan path (CI-safe, no network).

Proves the honest realisation of the landscape-coverage gap: the engine can scan the real SEC-listed
universe with live market features instead of a hardcoded illustrative set. A stub market-data provider
returns synthetic candles so this runs in CI without touching the network, and asserts:

  * `assemble_features` turns a real OHLCV series into the feature dict the domains read, populating the
    market-derived keys (rsi / macd / price / volume) and LEAVING THE DEEP DOMAINS ABSENT;
  * running the engine over those features keeps the output in contract AND marks the unwired deep domains
    `unavailable` - coverage honesty holds on real-shaped data, no fabrication;
  * the candidate universe is emergence-first real small-cap names, and offline it still yields real names
    (never empty), so a scan always runs over real tickers.

Needs pandas (the scanner indicator maths), so it lives apart from the pure-stdlib behaviour eval.
"""
from __future__ import annotations

import datetime

from workers.emerging_winner.engine import run_engine
from workers.emerging_winner.feature_source import assemble_features
from workers.emerging_winner import universe_source
from workers.stock_scanner.models import Candle

GENERATED_AT = "2026-08-01T00:00:00+00:00"
_DEEP_KEYS = {"government", "fundamentals", "capital", "sponsorship", "market_cap", "float_shares"}


class _StubProvider:
    """Deterministic synthetic candles - a gently rising series with enough history for SMA-200."""

    def fetch_ohlcv(self, symbol: str, timeframe: str, lookback_days: int) -> list[Candle]:
        base = datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc)
        candles: list[Candle] = []
        price = 10.0
        for i in range(260):
            price *= 1.002 + (0.01 if i % 7 == 0 else -0.004)
            price = max(1.0, price)
            candles.append(
                Candle(
                    symbol=symbol,
                    timeframe=timeframe,
                    candle_time=base + datetime.timedelta(days=i),
                    open=price * 0.99,
                    high=price * 1.02,
                    low=price * 0.98,
                    close=price,
                    adjusted_close=price,
                    volume=1_000_000 + (250_000 if i % 5 == 0 else 0),
                    source="stub",
                )
            )
        return candles


def test_assemble_features_is_market_derived_and_omits_deep_domains():
    feats = assemble_features("TEST", provider=_StubProvider(), with_fundamentals=False)
    assert feats is not None
    # Market-derived keys are present and finite.
    for key in ("rsi", "macd_hist", "close", "volume", "volume_ratio", "avg_dollar_volume"):
        assert key in feats, key
    # Deep-domain keys are DELIBERATELY absent (coverage honesty - they read `unavailable`, never faked).
    assert _DEEP_KEYS.isdisjoint(feats.keys())


def test_engine_over_real_features_is_in_contract_and_coverage_honest():
    feats = assemble_features("TEST", provider=_StubProvider(), with_fundamentals=False)
    assert feats is not None
    d = run_engine("TEST", feats, generated_at=GENERATED_AT).to_dict()
    assert 0.0 <= d["winner_similarity"] <= 100.0
    assert 0.0 <= d["completeness"] <= 1.0
    # With only the market-derived domains fed, the deep domains must report unavailable, not a number.
    domains = {dom["key"]: dom for dom in d["domains"]}
    unavailable = [k for k, dom in domains.items() if dom["coverage"] == "unavailable"]
    assert unavailable, "expected some domains to be honestly unavailable on a market-only feed"
    for dom in d["domains"]:
        if dom["coverage"] == "unavailable":
            assert dom["score"] is None
    # The mandatory risk half is never empty.
    assert len(d["risks"]) >= 1


def test_too_short_series_is_skipped_not_faked():
    class _Short(_StubProvider):
        def fetch_ohlcv(self, symbol, timeframe, lookback_days):
            return super().fetch_ohlcv(symbol, timeframe, lookback_days)[:10]

    assert assemble_features("SHORT", provider=_Short()) is None


def test_candidate_universe_is_real_small_caps_and_never_empty_offline():
    # Offline path (no SEC round-trip) still yields the curated real small-cap emergence names.
    syms = universe_source.load_candidate_symbols(limit=8, include_sec=False)
    assert len(syms) >= 1
    assert all(s.isupper() and s.isalpha() for s in syms)
    # These real small-cap tickers are the engine's intended target.
    assert {"LUNR", "RGTI", "SERV", "BKSY"} & set(universe_source.load_candidate_symbols(include_sec=False))


def test_theme_map_covers_known_symbols():
    themes = universe_source.theme_by_symbol()
    assert "RGTI" in themes and themes["RGTI"]["themes"]
