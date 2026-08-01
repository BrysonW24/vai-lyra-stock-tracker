"""
Real feature assembler for the Emerging Winner Engine.

This is the honest realisation of `main.load_candidates`'s single swap point: it turns a real ticker +
real market data into the feature dict the domain scorecard reads, so the engine scans the ACTUAL
market instead of a hardcoded illustrative set. It reuses the scanner's proven market-data provider and
indicator maths (`workers/stock_scanner`), so the numbers are the same deterministic indicators the Live
radar computes.

Coverage-honest by construction: it populates the domains a real OHLCV series can support (technical,
accumulation/liquidity, and - where known - theme). The deeper domains that need sources not yet wired
(SEC filings, Form 4/13F insider flow, USAspending contracts, point-in-time fundamentals) are simply
LEFT ABSENT, so the scorecard reads them `unavailable` and never fabricates a value. As those ingestion
sources land, attach their keys here and the domains light up - nothing downstream changes.

Network-touching (yfinance), so it runs in the worker, never in the pure engine or in CI. A missing or
too-short series returns None and that symbol is skipped - the universe scan tolerates sparse names.
"""
from __future__ import annotations

import statistics
from typing import Optional

from ..stock_scanner.indicators import calculate_indicators
from ..stock_scanner.market_data import MarketDataProvider, create_provider
from .edgar_source import fetch_edgar_features

MIN_CANDLES = 30  # below this, indicators (esp. the longer SMAs) are too sparse to be honest


def _fetch_fundamentals(symbol: str) -> dict:
    """Best-effort REAL fundamentals from yfinance `.info`. Only fields that map CLEANLY to a domain
    feature are used - a single snapshot cannot honestly provide the trend/delta fields (margin trend,
    cash-runway, share-count growth, insider/institutional CHANGE), so those are left absent and their
    domains read partial/unavailable rather than being filled from a level masquerading as a trend."""
    try:
        import yfinance as yf

        info = yf.Ticker(symbol).info or {}
    except Exception:  # noqa: BLE001 - offline / rate-limited / delisted: no fundamentals, stays unavailable
        return {}

    out: dict = {}
    mc = info.get("marketCap")
    if isinstance(mc, (int, float)) and mc > 0:
        out["market_cap"] = float(mc)
    fs = info.get("floatShares")
    if isinstance(fs, (int, float)) and fs > 0:
        out["float_shares"] = float(fs)

    revenue_growth = info.get("revenueGrowth")
    if isinstance(revenue_growth, (int, float)):
        out["fundamentals"] = {"revenue_growth_yoy": float(revenue_growth) * 100.0}  # yfinance = fraction

    dte = info.get("debtToEquity")
    if isinstance(dte, (int, float)) and dte >= 0:
        out["capital"] = {"debt_to_equity": float(dte) / 100.0}  # yfinance reports a percentage

    # The company's REAL, finite industry/sector label (Yahoo taxonomy) - an authoritative classification
    # from the data source, not a keyword guess. Attaching it lights up the theme domain honestly and gives
    # the archetype layer a known label to map from (the deterministic industry -> vertical map) rather than
    # inferring one. This is what makes vertical coverage complete without mislabelling.
    industry = info.get("industry")
    sector = info.get("sector")
    themes = [t.lower() for t in (industry, sector) if isinstance(t, str) and t.strip()]
    if themes:
        out["theme_context"] = {"themes": themes, "industry": industry, "sector": sector}

    return out


def assemble_features(
    symbol: str,
    *,
    provider: Optional[MarketDataProvider] = None,
    timeframe: str = "1d",
    lookback_days: int = 400,
    theme: Optional[dict] = None,
    with_fundamentals: bool = True,
    cik: Optional[int] = None,
) -> Optional[dict]:
    """Real feature dict for `symbol` from live market data, or None if the series is unusable.

    Only the market-derived domains are populated; unwired deep domains are left absent on purpose so the
    scorecard marks them `unavailable` (coverage honesty), never a fabricated or defaulted value."""
    provider = provider or create_provider("yfinance")
    candles = provider.fetch_ohlcv(symbol, timeframe, lookback_days)
    if not candles or len(candles) < MIN_CANDLES:
        return None
    snapshots = calculate_indicators(candles)
    if not snapshots:
        return None
    latest = snapshots[-1]
    last_candle = candles[-1]

    feats: dict = {}

    def put(key: str, value) -> None:
        if value is not None:
            feats[key] = value

    # Technical domain (real indicators, identical maths to the Live scanner).
    put("rsi", latest.rsi_14)
    put("rsi_delta", latest.rsi_delta_1)
    put("macd_hist", latest.macd_histogram)
    put("macd_hist_delta", latest.macd_histogram_delta_1)
    if latest.close is not None and latest.sma_200:
        feats["price_vs_sma200"] = latest.close / latest.sma_200  # ratio, e.g. 1.04
    put("dist_from_60_low_pct", latest.distance_from_60_period_low)

    # Accumulation / liquidity domain.
    put("volume_ratio", latest.volume_ratio)
    put("volume", latest.volume)
    if latest.volume_state:
        feats["volume_state"] = latest.volume_state
    recent = [c for c in candles[-20:] if c.close and c.volume]
    if recent:
        feats["avg_dollar_volume"] = statistics.mean(c.close * c.volume for c in recent)

    # Price context.
    put("close", latest.close)
    put("open", last_candle.open)

    # Theme domain: only when we actually know the theme for this name (else left unavailable).
    if theme and theme.get("themes"):
        feats["theme_context"] = theme

    # Real fundamentals (market cap, float, revenue growth, debt) light up the liquidity, business-quality
    # and capital domains - the quality-discriminating layer. Best-effort: absent for names yfinance has no
    # fundamentals for, so those domains stay honestly partial/unavailable.
    if with_fundamentals:
        feats.update(_fetch_fundamentals(symbol))

        # Real SEC EDGAR fundamentals fill the TREND fields a single yfinance snapshot cannot: gross-margin
        # trend and real share-count dilution. Merged into the existing sub-dicts (never clobbering the
        # yfinance level fields), keyed by the AUTHORITATIVE ticker->CIK map, so filings attach to the right
        # company. Best-effort: absent CIK or facts -> nothing merged, the domain stays honestly partial.
        if cik:
            for section, vals in fetch_edgar_features(cik).items():
                feats.setdefault(section, {}).update(vals)

    # Still deliberately absent (the deep data gate): government contracts, insider/institutional CHANGE,
    # adoption/traction, and the point-in-time delisted-inclusive history. Those domains read `unavailable`
    # rather than being defaulted.
    return feats
