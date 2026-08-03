"""
Emerging Winner Engine worker - runs the full pipeline over the candidate universe and appends the
results to the immutable shadow-live ledger (migration 056).

    npm run worker:emerging-winner        # once, now
    python -m workers.emerging_winner.main

SHADOW-LIVE + HONEST: the small-cap point-in-time FEATURE pipeline (SEC EDGAR, USAspending, Form 4/13F,
the small-cap universe with delisted names) is Phase 1 and not built yet, so there is no real small-cap
feature source to score. Until it lands, this worker proves the pipeline end to end over an ILLUSTRATIVE
candidate set and logs it to the ledger clearly labelled - so the loop (score -> persist -> read back)
is demonstrably live in production, without pretending the universe is real. When the feature pipeline
lands, swap `load_candidates` to read real point-in-time features and the rest is unchanged.

Demo mode (no Supabase env): prints the ranked queue, persists nothing.
"""
from __future__ import annotations

import logging
import os
import sys

from .engine import ENGINE_VERSION, rank_universe
from .repo import EmergingWinnerRepo

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("emerging_winner.main")

RUN_NOTE = (
    "shadow-live pipeline verification over an illustrative candidate universe; "
    "small-cap point-in-time feature pipeline (Phase 1) pending"
)

# Illustrative candidates (same shape the real feature-assembler will produce). Not live market data.
ILLUSTRATIVE_CANDIDATES: list[tuple[str, dict]] = [
    ("QBIT", {
        "rsi": 44.0, "rsi_delta": 2.1, "macd_hist": -0.3, "macd_hist_delta": 0.4, "score_delta": 5.0,
        "price_vs_sma200": 1.04, "dist_from_60_low_pct": 9.0,
        "volume_ratio": 1.9, "close": 12.4, "open": 11.8, "volume": 2_400_000, "volume_state": "accumulation",
        "market_cap": 680_000_000, "avg_dollar_volume": 29_760_000,
        "theme_context": {"themes": ["quantum", "ai", "defence"], "supply_chain_centrality": 0.72, "mention_velocity": 0.55},
        "market_context": {"regime": "risk_on"}, "news_attention": 0.55, "portfolio_relevance": 0.6,
        "government": {"award_count": 3, "contract_value_usd": 42_000_000, "policy_alignment": 0.8},
        "fundamentals": {"revenue_growth_yoy": 45.0, "gross_margin_trend": 0.4, "cash_burn_quality": 0.7},
        "capital": {"cash_runway_quarters": 6.0, "share_count_growth_yoy": 4.0, "debt_to_equity": 0.4},
        "sponsorship": {"insider_net_buy_usd": 1_200_000, "institutional_ownership_change_pct": 6.0},
    }),
    ("HYPE", {
        "rsi": 63.0, "rsi_delta": 3.0, "macd_hist": 0.4, "macd_hist_delta": 0.2, "score_delta": 1.0,
        "price_vs_sma200": 1.2, "dist_from_60_low_pct": 40.0,
        "volume_ratio": 3.4, "close": 2.1, "open": 1.7, "volume": 90_000, "volume_state": "high",
        "market_cap": 90_000_000, "avg_dollar_volume": 189_000, "float_shares": 3_000_000,
        "theme_context": {"themes": ["quantum"], "supply_chain_centrality": 0.2, "mention_velocity": 0.95},
        "market_context": {"regime": "risk_on"}, "news_attention": 0.95,
        "capital": {"cash_runway_quarters": 1.0, "share_count_growth_yoy": 35.0, "debt_to_equity": 1.2},
    }),
    ("TCNO", {
        "rsi": 41.0, "rsi_delta": 1.8, "macd_hist": -0.5, "macd_hist_delta": 0.5, "score_delta": 3.0,
        "price_vs_sma200": 1.01, "dist_from_60_low_pct": 11.0,
        "volume_ratio": 1.6, "close": 8.2, "open": 7.9, "volume": 900_000, "volume_state": "high",
        "market_cap": 540_000_000, "avg_dollar_volume": 7_380_000,
    }),
]


def load_real_candidates(*, limit: int) -> list[tuple[str, dict]]:
    """Scan the real, dynamic multi-market universe (emergence-first, rotating window - see
    universe_source) and assemble live market features per name. Small caps through mega caps across
    every enabled market (EW_MARKETS, default "us,au"); names with unusable/sparse data are skipped
    rather than faked. Returns [] if nothing could be assembled (offline / rate-limited), so the caller
    falls back honestly.

    Three domains light up from identity-safe sources (2026-08-01): THEME from the issuer's SEC SIC
    code (deterministic map, curated labels only as fallback), NARRATIVE from the benchmark market
    regime (computed once per run), and SPONSORSHIP from real Form 4 insider flow (per-CIK filing
    index, bounded document reads, EW_FORM4=0 to disable)."""
    import datetime as _dt
    import tempfile

    from ..stock_scanner.market_data import create_provider
    from . import regime_source
    from .feature_source import assemble_features
    from .form4_source import sponsorship_features
    from .submissions_source import load_submissions_bundle, theme_context_from_sic
    from .universe_source import (
        cik_by_symbol,
        coverage_note,
        currency_for_symbol,
        load_candidate_symbols,
        load_market_pools,
        theme_by_symbol,
    )

    # yfinance handles every market's Yahoo-suffixed symbols; "yfinance+stooq" adds the free daily
    # fallback source for the markets stooq covers (one throttled provider != a blind scan).
    provider = create_provider(os.environ.get("EW_MARKET_DATA_PROVIDER", "yfinance"))
    themes = theme_by_symbol()
    ciks = cik_by_symbol()  # authoritative ticker -> CIK for real EDGAR fundamentals (US names; empty if offline)
    pools = load_market_pools()
    symbols = load_candidate_symbols(limit=limit, pools=pools)
    logger.info("universe: %s", coverage_note(pools, limit=limit))

    source_cache = os.path.join(tempfile.gettempdir(), "lyra_ew_sources")
    market_context = None
    try:
        market_context = regime_source.current_regime(provider)
    except Exception:  # noqa: BLE001 - no benchmark read -> narrative stays honestly unavailable
        market_context = None
    if market_context:
        logger.info("market regime: %s (benchmark %s)", market_context["regime"], market_context["benchmark"])
    form4_on = os.environ.get("EW_FORM4", "1") != "0"
    usaspending_on = os.environ.get("EW_USASPENDING", "1") != "0"
    today = _dt.datetime.now(_dt.timezone.utc).date().isoformat()
    # Symbol -> {cik, title} for the USAspending name bridge (one static-file read, cached).
    company_names: dict = {}
    if usaspending_on:
        try:
            from .usaspending_source import government_features
            from .universe_source import company_names_by_symbol

            company_names = company_names_by_symbol(source_cache)
        except Exception:  # noqa: BLE001 - no names -> government stays honestly unavailable
            company_names = {}

    out: list[tuple[str, dict]] = []
    themed = with_sponsorship = with_government = 0
    for sym in symbols:
        try:
            cik = ciks.get(sym.upper())
            bundle = load_submissions_bundle(cik, source_cache) if cik else None
            # Authoritative SIC theme first; curated label only as the fallback for non-US names.
            theme = None
            if bundle:
                theme = theme_context_from_sic(bundle.get("sic"), bundle.get("sic_description"))
            if theme is None:
                theme = themes.get(sym)
            sponsorship = None
            if form4_on and cik and bundle:
                try:
                    sponsorship = sponsorship_features(cik, bundle, source_cache, as_of=today)
                except Exception:  # noqa: BLE001 - insider read failure never fails the name
                    sponsorship = None
            government = None
            name_ent = company_names.get(sym.upper()) if usaspending_on else None
            if name_ent:
                try:
                    government = government_features(
                        name_ent["cik"], name_ent["title"], source_cache, as_of=today,
                    )
                except Exception:  # noqa: BLE001 - award read failure never fails the name
                    government = None
            feats = assemble_features(
                sym,
                provider=provider,
                theme=theme,
                cik=cik,
                currency=currency_for_symbol(sym),
                market_context=market_context,
                sponsorship=sponsorship,
                government=government,
            )
            if feats:
                themed += 1 if "theme_context" in feats else 0
                with_sponsorship += 1 if "sponsorship" in feats else 0
                with_government += 1 if "government" in feats else 0
        except Exception:  # noqa: BLE001 - a single bad symbol never fails the run
            feats = None
        if feats:
            out.append((sym, feats))
    logger.info(
        "real universe: assembled features for %d of %d scanned symbols (%d with a CIK for EDGAR; "
        "%d themed via SIC/curated, %d with insider flow, %d with federal awards, regime=%s)",
        len(out), len(symbols), len(ciks), themed, with_sponsorship, with_government,
        market_context["regime"] if market_context else "unavailable",
    )
    return out


def load_candidates(repo: EmergingWinnerRepo) -> list[tuple[str, dict]]:
    """Candidates for this run. With EW_REAL_UNIVERSE=1 the engine scans the real listed universe with
    live market data - every enabled market (EW_MARKETS, default "us,au": the SEC listing + the ASX),
    small caps through mega caps, dynamically refreshed, swept in full by the rotating window. If that is
    off, or the real scan yields nothing (offline/rate-limited), it falls back to the illustrative set -
    clearly labelled - so the pipeline never silently pretends an illustrative universe is real."""
    if os.environ.get("EW_REAL_UNIVERSE") == "1":
        real = load_real_candidates(limit=int(os.environ.get("EW_UNIVERSE_LIMIT", "300")))
        if real:
            return real
    return ILLUSTRATIVE_CANDIDATES


def main() -> int:
    repo = EmergingWinnerRepo()
    candidates = load_candidates(repo)
    results = rank_universe(candidates)

    surfaced = [r for r in results if r.surfaced]
    logger.info(
        "scored %d candidates: %d surfaced, %d blocked (engine %s)",
        len(results), len(surfaced), len(results) - len(surfaced), ENGINE_VERSION,
    )
    for r in results[:10]:
        logger.info("  %-6s %-18s sim=%4.0f prio=%4.0f risk=%-6s action=%s",
                    r.symbol, r.stage_label, r.winner_similarity, r.priority_score,
                    r.risk["verdict"], r.action)

    if not repo.enabled:
        logger.info("Supabase not configured - demo mode, nothing persisted.")
        return 0

    run_id = repo.create_run(ENGINE_VERSION)
    written = repo.save_predictions(run_id, results)
    repo.finish_run(run_id, results)
    logger.info("persisted %d predictions to the shadow-live ledger (run %s) - %s", written, run_id, RUN_NOTE)

    # Green-must-go-red: an enabled worker that stored nothing while it had candidates is a failure.
    if candidates and written == 0:
        logger.error("worker enabled but persisted 0 predictions - failing loudly")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
