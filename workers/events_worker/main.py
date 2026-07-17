"""
Horizon-2 EVENTS + IPO worker orchestrator.

Coordinates fetching calendar events + IPO data, computing event risk, and persistence.
Entry point: run_events_worker(settings, repo).

SINGLE-OPERATOR, research software (NOT advice).
Demo-safe: works with ZERO API keys. Flips live when FINNHUB_API_KEY env is set.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from workers.events_worker.event_risk_engine import event_risk_for_ticker
from workers.events_worker.events_provider import create_events_provider
from workers.stock_scanner.config import Settings
from workers.stock_scanner.supabase_repo import SupabaseRepository

logger = logging.getLogger(__name__)


def run_events_worker(settings: Settings, repo: SupabaseRepository) -> dict[str, Any]:
    """
    Run the events worker: fetch calendar events + IPO data, compute event risk, persist.

    Returns a summary dict with counts.
    """
    try:
        summary = {
            "status": "running",
            "events_fetched": 0,
            "ipos_fetched": 0,
            "event_risks_computed": 0,
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
        logger.info(f"Processing {len(tickers)} active tickers")

        # Create provider (Finnhub or Demo)
        provider = create_events_provider()

        # Fetch calendar events (30-day window)
        try:
            events = provider.fetch_events(days=30)
            summary["events_fetched"] = len(events)
            logger.info(f"Fetched {len(events)} calendar events")
        except Exception as e:
            logger.error(f"Failed to fetch calendar events: {e}")
            events = []

        # Fetch IPO calendar
        try:
            ipos = provider.fetch_ipos()
            summary["ipos_fetched"] = len(ipos)
            logger.info(f"Fetched {len(ipos)} IPO records")
        except Exception as e:
            logger.error(f"Failed to fetch IPO calendar: {e}")
            ipos = []

        # Persist events and IPOs to Supabase (guarded)
        if repo.enabled:
            try:
                _persist_events_to_supabase(repo, events)
                _persist_ipos_to_supabase(repo, ipos)
            except Exception as e:
                logger.error(f"Failed to persist events/IPOs: {e}")

        # Compute event risk for active tickers (load latest signals)
        try:
            risk_count = _compute_and_persist_event_risks(repo, tickers, events)
            summary["event_risks_computed"] = risk_count
        except Exception as e:
            logger.error(f"Failed to compute event risks: {e}")

        summary["status"] = "success"
        logger.info(f"Events worker completed: {summary}")
        return summary

    except Exception as e:
        logger.error(f"Events worker failed: {e}", exc_info=True)
        return {
            "status": "failed",
            "error": str(e),
            "events_fetched": 0,
            "ipos_fetched": 0,
            "event_risks_computed": 0,
            "tickers_processed": 0,
        }


def _persist_events_to_supabase(repo: SupabaseRepository, events: list) -> None:
    """
    Persist calendar events to Supabase table `company_events`.
    Guarded: if client is None, return silently.
    """
    if not repo.client:
        logger.debug("Supabase not enabled; skipping event persistence")
        return

    try:
        records = []
        for event in events:
            record = {
                "event_id": event.id,
                "event_date": event.date,
                "event_type": event.type,
                "ticker": event.ticker,
                "title": event.title,
                "importance": event.importance,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            records.append(record)

        if records:
            repo.client.table("company_events").upsert(records, on_conflict="event_id").execute()
            logger.info(f"Persisted {len(records)} calendar events to Supabase")
    except Exception as e:
        logger.error(f"Failed to persist events to Supabase: {e}")


def _persist_ipos_to_supabase(repo: SupabaseRepository, ipos: list) -> None:
    """
    Persist IPO records to Supabase table `ipos`.
    Guarded: if client is None, return silently.
    """
    if not repo.client:
        logger.debug("Supabase not enabled; skipping IPO persistence")
        return

    try:
        records = []
        for ipo in ipos:
            record = {
                "symbol": ipo.symbol,
                "company_name": ipo.company_name,
                "ipo_date": ipo.ipo_date,
                "exchange": ipo.exchange,
                "category": ipo.category,
                "status": ipo.status,
                "offer_price": ipo.offer_price,
                "shares_offered_m": ipo.shares_offered_m,
                "proceeds_usd_m": ipo.proceeds_usd_m,
                "valuation_usd_m": ipo.valuation_usd_m,
                "revenue_ttm_usd_m": ipo.revenue_ttm_usd_m,
                "revenue_growth_pct": ipo.revenue_growth_pct,
                "gross_margin_pct": ipo.gross_margin_pct,
                "net_income_usd_m": ipo.net_income_usd_m,
                "profitable": ipo.profitable,
                "employees": ipo.employees,
                "products": ipo.products or [],
                "notable_projects": ipo.notable_projects or [],
                "key_people": ipo.key_people or [],
                "description": ipo.description,
                "domain": ipo.domain,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            records.append(record)

        if records:
            repo.client.table("ipos").upsert(records, on_conflict="symbol").execute()
            logger.info(f"Persisted {len(records)} IPO records to Supabase")
    except Exception as e:
        logger.error(f"Failed to persist IPOs to Supabase: {e}")


def _compute_and_persist_event_risks(
    repo: SupabaseRepository, tickers: list, events: list
) -> int:
    """
    Compute event risk for each active ticker and persist to Supabase.
    Returns the count of tickers with computed risk.
    Guarded: if client is None, skip persistence but still return count.
    """
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    count = 0

    try:
        # Load latest signals for all tickers to check for strong_setup / watchlist_setup
        signals = _load_latest_signals(repo)
        signal_map = {s["symbol"]: s.get("status", "inactive") for s in signals}

        # Compute risk for each ticker
        risk_records = []
        for ticker in tickers:
            signal_status = signal_map.get(ticker.symbol, "inactive")

            # Convert event dataclasses to dicts for the engine
            event_dicts = []
            for event in events:
                event_dicts.append(
                    {
                        "id": event.id,
                        "date": event.date,
                        "type": event.type,
                        "ticker": event.ticker,
                        "title": event.title,
                        "importance": event.importance,
                    }
                )

            risk = event_risk_for_ticker(ticker.symbol, signal_status, event_dicts, today)
            count += 1

            risk_records.append(
                {
                    "symbol": ticker.symbol,
                    "event_risk": risk,
                    "risk_date": today,
                    "computed_at": datetime.now(timezone.utc).isoformat(),
                }
            )

        # Persist to Supabase if enabled
        if repo.client and risk_records:
            repo.client.table("event_risks").upsert(risk_records, on_conflict="symbol,risk_date").execute()
            logger.info(f"Persisted event risk for {len(risk_records)} tickers")

    except Exception as e:
        logger.error(f"Failed to compute/persist event risks: {e}")

    return count


def _load_latest_signals(repo: SupabaseRepository) -> list[dict]:
    """
    Load the LATEST signal per symbol from Supabase.

    Returns records with 'symbol' and 'status' keys ('strong_setup' | 'watchlist_setup' |
    'inactive'), matching what event_risk_for_ticker expects.

    Three bugs lived here and all three failed silently, leaving every ticker "inactive" and the
    whole event-risk layer inert:
      1. it queried table "signals", which has never existed (the table is stock_signals) - Postgres
         answered PGRST205 every night and the except-branch swallowed it;
      2. it selected column "status", but the column is "signal_status";
      3. it built the map with a dict comprehension over a newest-first list, so the OLDEST row won
         for each symbol. Newest must win.
    Guarded: if client is None, return empty list.
    """
    if not repo.client:
        return []

    try:
        result = (
            repo.client.table("stock_signals")
            .select("symbol, signal_status, created_at")
            .order("created_at", desc=True)
            .limit(1000)
            .execute()
        )
        rows = result.data or []
    except Exception as e:
        logger.warning(f"Failed to load latest signals: {e}")
        return []

    # Rows arrive newest-first, so the first time a symbol appears is its latest signal.
    latest: dict[str, dict] = {}
    for row in rows:
        symbol = row.get("symbol")
        if not symbol or symbol in latest:
            continue
        latest[symbol] = {"symbol": symbol, "status": row.get("signal_status") or "inactive"}
    return list(latest.values())


def main() -> None:
    """CLI entrypoint so the scheduler can actually run this worker.

    (The run_* orchestrator existed with no caller - `python -m
    workers.events_worker.main`, scheduled by nightly-maintenance.yml, is the fix.)
    """
    from workers.stock_scanner.config import load_settings

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    settings = load_settings()
    repo = SupabaseRepository(settings)
    summary = run_events_worker(settings, repo)
    if summary.get("status") == "failed":
        raise SystemExit("events worker failed: " + str(summary.get("error")))


if __name__ == "__main__":
    main()
