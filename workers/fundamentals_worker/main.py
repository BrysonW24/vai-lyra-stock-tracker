"""
Horizon-2 FUNDAMENTALS orchestrator.

Coordinates fetching fundamentals, computing valuation metrics, and persistence.
Entry point: run_fundamentals_worker(settings, repo).

Guarded: never fatally crashes; logs issues and continues.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from workers.fundamentals_worker.fundamentals_provider import create_fundamentals_provider
from workers.fundamentals_worker.valuation_engine import compute_valuation
from workers.stock_scanner.config import Settings
from workers.stock_scanner.supabase_repo import SupabaseRepository

logger = logging.getLogger(__name__)


def run_fundamentals_worker(settings: Settings, repo: SupabaseRepository) -> dict[str, Any]:
    """
    Run the fundamentals worker: fetch, compute valuation, and persist.

    Returns a summary dict with counts and status.
    """
    try:
        summary = {
            "status": "running",
            "fundamentals_fetched": 0,
            "snapshots_persisted": 0,
            "metrics_persisted": 0,
            "tickers_processed": 0,
            "error": None,
        }

        # Load active tickers
        tickers = repo.load_active_tickers()
        if not tickers:
            logger.warning("No active tickers to process")
            summary["status"] = "no_tickers"
            return summary

        summary["tickers_processed"] = len(tickers)
        logger.info(f"Processing {len(tickers)} active tickers for fundamentals")

        # Create fundamentals provider (Finnhub or Demo)
        provider = create_fundamentals_provider()

        # Persist to Supabase ONLY when the source is live (mirror events_worker). The demo
        # provider (used when FINNHUB_API_KEY is unset) returns FABRICATED snapshots;
        # persisting those to the live fundamental_snapshots / valuation_metrics tables would
        # surface invented company financials on /fundamentals as if real. The demo run still
        # fetches + computes for shape, but writes nothing.
        persist_live = provider.is_live
        if not persist_live and repo.enabled:
            logger.info("demo fundamentals provider (no FINNHUB_API_KEY) - fetched for shape, NOT persisted to live tables")

        # Fetch and persist for each ticker
        snapshot_date = datetime.now(timezone.utc)
        fundamentals_fetched = 0
        snapshots_persisted = 0
        metrics_persisted = 0

        for ticker in tickers:
            try:
                fundamentals = provider.fetch_fundamentals(ticker.symbol)
                if fundamentals is None:
                    logger.debug(f"No fundamentals available for {ticker.symbol}")
                    continue

                fundamentals_fetched += 1

                if not persist_live:
                    continue

                # Persist snapshot to Supabase
                snap_count = _persist_snapshot(repo, fundamentals, snapshot_date)
                snapshots_persisted += snap_count

                # Compute and persist valuation metrics
                metrics = compute_valuation(fundamentals)
                metrics_count = _persist_valuation_metrics(repo, metrics, snapshot_date)
                metrics_persisted += metrics_count

                # Report what actually landed. This line used to claim "snapshot + metrics persisted"
                # unconditionally - it printed for AAPL while the upsert was being rejected.
                logger.info(
                    f"Processed {ticker.symbol}: {snap_count} snapshot, {metrics_count} metrics persisted"
                )

            except Exception as e:
                logger.error(f"Failed to process {ticker.symbol}: {e}")
                continue

        summary["fundamentals_fetched"] = fundamentals_fetched
        summary["snapshots_persisted"] = snapshots_persisted
        summary["metrics_persisted"] = metrics_persisted

        # A run that fetched fundamentals and stored NONE of them has failed, however cleanly each
        # individual write "handled" its own error. This is the exact shape of the bug that hid for
        # months: every upsert was rejected (42P10 - the ON CONFLICT target was a partial index),
        # _persist_snapshot logged a warning and returned 0, and this function still reported
        # "success" to a green workflow step while the table sat at zero rows. Only holds for a
        # LIVE provider: a demo run deliberately persists nothing (see persist_live above).
        if persist_live and fundamentals_fetched > 0 and snapshots_persisted == 0:
            summary["status"] = "failed"
            summary["error"] = (
                f"fetched {fundamentals_fetched} fundamentals but persisted 0 snapshots - "
                "every write was rejected (see the warnings above for the database error)"
            )
            logger.error(summary["error"])
            return summary

        summary["status"] = "success"

        logger.info(
            f"Fundamentals worker complete: "
            f"{fundamentals_fetched} fetched, {snapshots_persisted} snapshots, {metrics_persisted} metrics"
        )

        return summary

    except Exception as e:
        logger.error(f"Fatal error in fundamentals worker: {e}", exc_info=True)
        return {
            "status": "error",
            "fundamentals_fetched": 0,
            "snapshots_persisted": 0,
            "metrics_persisted": 0,
            "tickers_processed": 0,
            "error": str(e),
        }


def _persist_snapshot(
    repo: SupabaseRepository,
    fundamentals,
    snapshot_date: datetime,
) -> int:
    """
    Persist fundamental snapshot to Supabase.

    Returns count of rows persisted (0 or 1).
    """
    if not repo.client:
        return 0

    try:
        record = {
            "symbol": fundamentals.symbol,
            "company_name": fundamentals.company_name,
            "sector": fundamentals.sector,
            "industry": fundamentals.industry,
            "market_cap": fundamentals.market_cap,
            "enterprise_value": fundamentals.enterprise_value,
            "revenue": fundamentals.revenue,
            "revenue_growth_yoy": fundamentals.revenue_growth_yoy,
            "gross_margin": fundamentals.gross_margin,
            "operating_margin": fundamentals.operating_margin,
            "net_income": fundamentals.net_income,
            "free_cash_flow": fundamentals.free_cash_flow,
            "ebitda": fundamentals.ebitda,
            "cash": fundamentals.cash,
            "debt": fundamentals.debt,
            "pe": fundamentals.pe,
            "forward_pe": fundamentals.forward_pe,
            "price_to_sales": fundamentals.price_to_sales,
            "ev_to_ebitda": fundamentals.ev_to_ebitda,
            "ev_to_revenue": fundamentals.ev_to_revenue,
            "eps_growth": fundamentals.eps_growth,
            "snapshot_date": snapshot_date.isoformat(),
        }

        repo.client.table("fundamental_snapshots").upsert(
            record,
            on_conflict="symbol,snapshot_date",
        ).execute()

        return 1

    except Exception as e:
        logger.warning(f"Failed to persist snapshot for {fundamentals.symbol}: {e}")
        return 0


def _persist_valuation_metrics(
    repo: SupabaseRepository,
    metrics,
    snapshot_date: datetime,
) -> int:
    """
    Persist valuation metrics to Supabase.

    Returns count of rows persisted (0 or 1).
    """
    if not repo.client:
        return 0

    try:
        record = {
            "symbol": metrics.symbol,
            "snapshot_date": snapshot_date.isoformat(),
            "ev_to_ebitda": metrics.ev_to_ebitda,
            "price_to_sales": metrics.price_to_sales,
            "pe_ratio": metrics.pe_ratio,
            "ev_to_revenue": metrics.ev_to_revenue,
            "fcf_margin": metrics.fcf_margin,
            "rule_of_40": metrics.rule_of_40,
            "valuation_flag": metrics.valuation_flag,
            "growth_durability_flag": metrics.growth_durability_flag,
            "quality_score": metrics.quality_score,
            "computed_at": snapshot_date.isoformat(),
        }

        repo.client.table("valuation_metrics").upsert(
            record,
            on_conflict="symbol,snapshot_date",
        ).execute()

        return 1

    except Exception as e:
        logger.warning(f"Failed to persist metrics for {metrics.symbol}: {e}")
        return 0


def main() -> None:
    """CLI entrypoint so the scheduler can actually run this worker.

    (The run_* orchestrator existed with no caller - `python -m
    workers.fundamentals_worker.main`, scheduled by nightly-maintenance.yml, is the fix.)
    """
    from workers.stock_scanner.config import load_settings

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    settings = load_settings()
    repo = SupabaseRepository(settings)
    summary = run_fundamentals_worker(settings, repo)
    # The fatal handler in run_fundamentals_worker returns status "error", but this
    # check used to test == "failed" only - so a total crash (e.g. the ticker load
    # throwing on a DB outage) exited 0 and the nightly stayed green. Fail on anything
    # that is not an explicit good outcome.
    if summary.get("status") not in ("success", "no_tickers"):
        raise SystemExit("fundamentals worker failed: " + str(summary.get("error") or summary.get("status")))


if __name__ == "__main__":
    main()
