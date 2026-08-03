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

from typing import Optional

from ..stock_scanner.indicators import calculate_indicators
from ..stock_scanner.market_data import MarketDataProvider, create_provider
from . import fx
from .edgar_source import fetch_edgar_features
from .universe_source import currency_for_symbol

MIN_CANDLES = 30  # below this, indicators (esp. the longer SMAs) are too sparse to be honest

# USD-semantics fields: thresholds downstream (risk gates, cap tiers) read these AS US dollars, so for a
# non-USD listing they are converted via fx.py - or DROPPED when no rate exists (absent beats wrong).
_USD_SEMANTICS_KEYS = ("market_cap", "avg_dollar_volume")


def normalise_currency_code(raw: str) -> str:
    """Provider currency string -> the FX code the pipeline uses. The one trap: 'GBp' (LSE pence)
    must map to GBX, not be uppercased into GBP - pence read as pounds overstates USD fields ~100x."""
    code = raw.strip()
    return "GBX" if code in ("GBp", "GBX", "gbp_pence") else code.upper()


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
    # The listing currency the provider itself states for this name (per-name truth; beats any
    # suffix-implied guess). Consumed by the FX normalisation step, never emitted as a feature.
    # "GBp" (LSE pence) must NOT collapse to "GBP" via uppercasing - pence read as pounds overstates
    # every USD-semantics field ~100x; fx.py's GBX rate handles pence correctly.
    ccy = info.get("currency")
    if isinstance(ccy, str) and ccy.strip():
        out["_currency"] = normalise_currency_code(ccy)
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


def _normalise_to_usd(feats: dict, currency: Optional[str]) -> None:
    """Convert the USD-semantics fields (market cap, average dollar volume) from the listing currency to
    USD in place, so the USD-thresholded gates read comparable numbers across markets. No rate available
    -> the fields are DROPPED and the domains read partial/unavailable (absent beats wrong)."""
    ccy = (feats.pop("_currency", None) or currency or "USD").upper()
    if ccy == "USD" or not any(k in feats for k in _USD_SEMANTICS_KEYS):
        return
    rate = fx.usd_rate(ccy)
    if rate is None:
        for key in _USD_SEMANTICS_KEYS:
            feats.pop(key, None)
        # Tell the downstream liquidity readers the drop was DELIBERATE, so their close x volume
        # fallback does not reinstate a mislabeled listing-currency number against USD thresholds.
        feats["usd_semantics_dropped"] = True
        return
    for key in _USD_SEMANTICS_KEYS:
        if isinstance(feats.get(key), (int, float)):
            feats[key] = float(feats[key]) * rate[0]


def assemble_features(
    symbol: str,
    *,
    provider: Optional[MarketDataProvider] = None,
    timeframe: str = "1d",
    lookback_days: int = 400,
    theme: Optional[dict] = None,
    with_fundamentals: bool = True,
    cik: Optional[int] = None,
    currency: Optional[str] = None,
    market_context: Optional[dict] = None,
    sponsorship: Optional[dict] = None,
    government: Optional[dict] = None,
) -> Optional[dict]:
    """Real feature dict for `symbol` from live market data, or None if the series is unusable.

    Works for any market the universe emits (bare US symbols or Yahoo-suffixed ones like `XRO.AX`) - the
    provider handles the suffix, and the USD-semantics fields are normalised from the listing currency
    (`currency` param, provider-stated currency winning when present, suffix-implied as the fallback).

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
    # Pair open with the SAME session as the latest snapshot: the indicator pass drops NaN-close rows,
    # so candles[-1] can be a newer (still-forming/holiday) bar than snapshots[-1] - an up-day test
    # across two different sessions is not an up-day test.
    last_candle = next(
        (c for c in reversed(candles) if c.candle_time == latest.candle_time), candles[-1]
    )

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
    # Honest ADV denominator: the FULL 20-bar window, no-trade days counted as $0. Dropping them
    # overstated executable liquidity on exactly the thin names the $250K/$2M gates exist to catch.
    window = candles[-20:]
    if any(c.close and c.volume for c in window):
        feats["avg_dollar_volume"] = (
            sum((c.close or 0.0) * (c.volume or 0.0) for c in window) / len(window)
        )

    # Price context.
    put("close", latest.close)
    put("open", last_candle.open)

    # Theme domain: only when we actually know the theme for this name (else left unavailable).
    if theme and theme.get("themes"):
        feats["theme_context"] = theme

    # Narrative domain: the market regime, computed ONCE per run by the caller from the benchmark
    # series (regime_source) and passed in - never fabricated per name.
    if market_context and market_context.get("regime"):
        feats["market_context"] = market_context

    # Sponsorship domain: real Form 4 insider flow (form4_source), supplied by the caller when the
    # per-CIK filing index was readable. A dict with a real 0.0 means "insiders reportably did
    # nothing" - genuinely different from absent.
    if sponsorship is not None:
        feats["sponsorship"] = sponsorship

    # Government: same shape as the corpus assembler (history_source) - award presence +
    # magnitude from USAspending, v1 totals are a documented floor (subsidiary booking).
    if government is not None and government.get("available"):
        feats["government"] = {
            "award_count": government.get("award_count_2y"),
            "contract_value_usd": government.get("obligations_2y_usd"),
        }

    # Real fundamentals (market cap, float, revenue growth, debt) light up the liquidity, business-quality
    # and capital domains - the quality-discriminating layer. Best-effort: absent for names yfinance has no
    # fundamentals for, so those domains stay honestly partial/unavailable.
    if with_fundamentals:
        fundamentals = _fetch_fundamentals(symbol)
        # Merge WITHOUT clobbering: a curated theme_context must survive the yfinance industry/sector
        # labels (dict.update replaced the whole sub-dict, wiping e.g. RGTI's "quantum computing").
        # Curated themes lead, Yahoo labels append - the theme domain sees both.
        yf_theme = fundamentals.pop("theme_context", None)
        if yf_theme:
            existing = feats.get("theme_context")
            if existing and existing.get("themes"):
                merged = list(existing["themes"]) + [
                    t for t in yf_theme.get("themes", []) if t not in existing["themes"]
                ]
                feats["theme_context"] = {**yf_theme, **existing, "themes": merged}
            else:
                feats["theme_context"] = yf_theme
        feats.update(fundamentals)

        # Real SEC EDGAR fundamentals fill the TREND fields a single yfinance snapshot cannot: gross-margin
        # trend and real share-count dilution. Merged into the existing sub-dicts (never clobbering the
        # yfinance level fields), keyed by the AUTHORITATIVE ticker->CIK map, so filings attach to the right
        # company. Best-effort: absent CIK or facts -> nothing merged, the domain stays honestly partial.
        if cik:
            for section, vals in fetch_edgar_features(cik).items():
                feats.setdefault(section, {}).update(vals)

    # Cross-market comparability: cap + dollar-volume to USD (or dropped when no rate exists).
    _normalise_to_usd(feats, currency or currency_for_symbol(symbol))

    # Still deliberately absent (the deep data gate): government contracts, insider/institutional CHANGE,
    # adoption/traction, and the point-in-time delisted-inclusive history. Those domains read `unavailable`
    # rather than being defaulted.
    return feats
