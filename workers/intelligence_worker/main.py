"""
Horizon-2 NEWS INTELLIGENCE orchestrator.

Coordinates fetching, scoring, and persistence of company news.
Entry point: run_intelligence_worker(settings, repo).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from workers.intelligence_worker.hype_engine import build_hype_map, compute_hype_per_ticker
from workers.intelligence_worker.news_provider import create_news_provider
from workers.intelligence_worker.relevance_engine import map_news_to_tickers
from workers.intelligence_worker.sentiment_engine import score_sentiment
from workers.stock_scanner.config import Settings
from workers.stock_scanner.supabase_repo import SupabaseRepository

logger = logging.getLogger(__name__)


def run_intelligence_worker(settings: Settings, repo: SupabaseRepository) -> dict[str, Any]:
    """
    Run the intelligence worker: fetch news, score, and persist.

    Returns a summary dict with counts.
    """
    try:
        summary = {
            "status": "running",
            "news_items_fetched": 0,
            "news_items_persisted": 0,
            "hype_scores_computed": 0,
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

        # Create news provider (Finnhub or Demo)
        provider = create_news_provider()

        # Fetch news for each ticker
        all_news = []
        for ticker in tickers:
            try:
                news_items = provider.fetch_company_news(ticker.symbol, days=7)
                all_news.extend(news_items)
                logger.info(f"Fetched {len(news_items)} news items for {ticker.symbol}")
            except Exception as e:
                logger.error(f"Failed to fetch news for {ticker.symbol}: {e}")
                continue

        summary["news_items_fetched"] = len(all_news)
        if not all_news:
            logger.warning("No news items fetched")
            summary["status"] = "no_news"
            return summary

        # Score sentiment and relevance
        scored_items = _score_news_items(all_news)

        # Persist to Supabase
        persisted_count = _persist_news_to_supabase(repo, scored_items)
        summary["news_items_persisted"] = persisted_count

        # Compute and persist hype scores
        hype_count = _compute_and_persist_hype(repo, all_news)
        summary["hype_scores_computed"] = hype_count

        summary["status"] = "success"
        logger.info(f"Intelligence worker completed: {summary}")
        return summary

    except Exception as e:
        logger.error(f"Intelligence worker failed: {e}", exc_info=True)
        return {
            "status": "failed",
            "error": str(e),
            "news_items_fetched": 0,
            "news_items_persisted": 0,
            "hype_scores_computed": 0,
            "tickers_processed": 0,
        }


def _score_news_items(
    news_items: list,
) -> list[dict[str, Any]]:
    """
    Score each news item: sentiment, relevance, mapping to tickers.

    Returns list of dicts with all scoring attached.
    """
    scored = []

    for item in news_items:
        # Score sentiment
        sentiment, sentiment_score = score_sentiment(item.headline + " " + item.summary)

        # Map to tickers and compute relevance
        ticker_matches = map_news_to_tickers(
            headline=item.headline,
            summary=item.summary,
            source_domain=item.source_domain,
            published_at=item.published_at,
        )

        # Create a record for each ticker match
        for ticker, relevance_level, relevance_score in ticker_matches:
            record = {
                "headline": item.headline,
                "summary": item.summary,
                "source": item.source,
                "source_domain": item.source_domain,
                "category": item.category,
                "published_at": item.published_at.isoformat(),
                "ticker": ticker,
                "sentiment": sentiment,
                "sentiment_score": sentiment_score,
                "relevance": relevance_level,
                "relevance_score": relevance_score,
                "url": item.url,
            }
            scored.append(record)

    return scored


def _persist_news_to_supabase(
    repo: SupabaseRepository,
    scored_items: list[dict[str, Any]],
) -> int:
    """
    Persist scored news items to Supabase.

    Returns count of persisted items.
    """
    if not repo.enabled or not scored_items:
        return 0

    try:
        client = repo.client
        if not client:
            return 0

        # Persist news_items table
        records = []
        for item in scored_items:
            record = {
                "headline": item["headline"],
                "summary": item["summary"],
                "source": item["source"],
                "source_domain": item["source_domain"],
                "category": item["category"],
                "published_at": item["published_at"],
                "sentiment": item["sentiment"],
                "relevance": item["relevance"],
                "url": item["url"],
            }
            records.append(record)

        if records:
            result = client.table("news_items").upsert(records, on_conflict="headline,source").execute()
            logger.info(f"Persisted {len(result.data)} news items to Supabase")

            # Build ticker_news_map
            ticker_news = []
            for item in scored_items:
                ticker_news.append(
                    {
                        "ticker": item["ticker"],
                        "headline": item["headline"],
                        "source": item["source"],
                        "relevance": item["relevance"],
                        "relevance_score": item["relevance_score"],
                        "sentiment": item["sentiment"],
                        "sentiment_score": item["sentiment_score"],
                        "published_at": item["published_at"],
                    }
                )

            if ticker_news:
                client.table("ticker_news_map").upsert(
                    ticker_news,
                    on_conflict="ticker,headline,source",
                ).execute()
                logger.info(f"Persisted {len(ticker_news)} ticker_news_map entries")

            return len(records)
        return 0
    except Exception as e:
        logger.error(f"Failed to persist news to Supabase: {e}")
        return 0


def _compute_and_persist_hype(
    repo: SupabaseRepository,
    news_items: list,
) -> int:
    """
    Compute hype scores per ticker and persist to Supabase.

    Returns count of hype scores computed.
    """
    if not repo.enabled or not news_items:
        return 0

    try:
        # Group news by ticker
        ticker_to_items = {}
        for item in news_items:
            # Map to all relevant tickers
            matches = map_news_to_tickers(
                headline=item.headline,
                summary=item.summary,
                source_domain=item.source_domain,
                published_at=item.published_at,
            )
            for ticker, relevance, score in matches:
                if ticker not in ticker_to_items:
                    ticker_to_items[ticker] = []
                ticker_to_items[ticker].append((ticker, relevance, score))

        # Compute hype per ticker
        hype_map = build_hype_map(ticker_to_items)

        # Persist hype_scores table
        records = []
        for ticker, hype_score in hype_map.items():
            record = {
                "ticker": ticker,
                "hype_score": hype_score.hype_score,
                "recent_count": hype_score.recent_count,
                "positive_pct": hype_score.positive_pct,
                "trend": hype_score.trend,
                "computed_at": datetime.now(timezone.utc).isoformat(),
            }
            records.append(record)

        if records:
            client = repo.client
            if client:
                client.table("hype_scores").upsert(records, on_conflict="ticker").execute()
                logger.info(f"Persisted {len(records)} hype_scores to Supabase")

            return len(records)
        return 0

    except Exception as e:
        logger.error(f"Failed to compute/persist hype scores: {e}")
        return 0
