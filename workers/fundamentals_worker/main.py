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

                # Persist snapshot to Supabase
                snap_count = _persist_snapshot(repo, fundamentals, snapshot_date)
                snapshots_persisted += snap_count

                # Compute and persist valuation metrics
                metrics = compute_valuation(fundamentals)
                metrics_count = _persist_valuation_metrics(repo, metrics, snapshot_date)
                metrics_persisted += metrics_count

                logger.info(f"Processed {ticker.symbol}: snapshot + metrics persisted")

            except Exception as e:
                logger.error(f"Failed to process {ticker.symbol}: {e}")
                continue

        summary["fundamentals_fetched"] = fundamentals_fetched
        summary["snapshots_persisted"] = snapshots_persisted
        summary["metrics_persisted"] = metrics_persisted
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
    if summary.get("status") == "failed":
        raise SystemExit("fundamentals worker failed: " + str(summary.get("error")))


if __name__ == "__main__":
    main()
