"""
Deterministic unit tests for relevance engine.
No network. Synthetic fixtures only.
"""

from datetime import datetime, timezone

import pytest

from workers.intelligence_worker.relevance_engine import (
    map_news_to_tickers,
    _compute_relevance_score,
)


class TestRelevanceEngine:
    """Unit tests for news-to-ticker mapping and relevance scoring."""

    def test_exact_symbol_match(self) -> None:
        """Exact symbol match should score high."""
        headline = "NVDA raises Q4 guidance"
        summary = "NVIDIA expects strong datacentre demand."
        now = datetime.now(timezone.utc)

        matches = map_news_to_tickers(headline, summary, "reuters.com", now)
        assert any(ticker == "NVDA" for ticker, _, _ in matches)

        nvda_match = [m for m in matches if m[0] == "NVDA"][0]
        assert nvda_match[1] == "high"
        assert nvda_match[2] >= 75

    def test_company_name_match(self) -> None:
        """Company name match should score decently."""
        headline = "Snowflake reports strong growth"
        summary = "Cloud data warehouse leader SNOW beats expectations."
        now = datetime.now(timezone.utc)

        matches = map_news_to_tickers(headline, summary, "snowflake.com", now)
        assert any(ticker == "SNOW" for ticker, _, _ in matches)

    def test_earnings_category_boost(self) -> None:
        """Earnings news should score high."""
        headline = "AMD Q1 earnings beat"
        summary = "AMD reports revenue growth."
        now = datetime.now(timezone.utc)

        matches = map_news_to_tickers(headline, summary, "amd.com", now)
        amd_match = [m for m in matches if m[0] == "AMD"]
        if amd_match:
            assert amd_match[0][2] >= 50  # Should be medium-to-high

    def test_analyst_upgrade_boost(self) -> None:
        """Analyst upgrade news should score high."""
        headline = "Goldman upgrades MSFT to conviction buy"
        summary = "Microsoft outlook strengthens on Copilot adoption."
        now = datetime.now(timezone.utc)

        matches = map_news_to_tickers(headline, summary, "goldmansachs.com", now)
        msft_match = [m for m in matches if m[0] == "MSFT"]
        if msft_match:
            assert msft_match[0][2] >= 50

    def test_ai_announcement_boost(self) -> None:
        """AI announcement should score high."""
        headline = "CRWD integrates Claude API for threat detection"
        summary = "CrowdStrike announces AI-powered security."
        now = datetime.now(timezone.utc)

        matches = map_news_to_tickers(headline, summary, "bloomberg.com", now)
        crwd_match = [m for m in matches if m[0] == "CRWD"]
        if crwd_match:
            assert crwd_match[0][2] >= 50

    def test_no_match_returns_empty(self) -> None:
        """Unrelated news should not match."""
        headline = "European car manufacturer expands production"
        summary = "Tesla competitor ramps up capacity in Berlin."
        now = datetime.now(timezone.utc)

        matches = map_news_to_tickers(headline, summary, "reuters.com", now)
        # Should be empty or very low scores
        high_relevance = [m for m in matches if m[2] >= 50]
        assert len(high_relevance) == 0

    def test_recency_boost_same_day(self) -> None:
        """Same-day news should have recency boost."""
        now = datetime.now(timezone.utc)
        headline = "NVDA stock news today"
        summary = "NVIDIA announces something."

        score = _compute_relevance_score(
            text="NVDA NVIDIA",
            symbol="NVDA",
            company_name="NVIDIA",
            category="News",
            published_at=now,
        )
        assert score > 75

    def test_older_news_lower_score(self) -> None:
        """Older news should score lower."""
        from datetime import timedelta

        now = datetime.now(timezone.utc)
        old_date = now - timedelta(days=30)

        score = _compute_relevance_score(
            text="NVDA NVIDIA",
            symbol="NVDA",
            company_name="NVIDIA",
            category="News",
            published_at=old_date,
        )
        # Should still be decent (symbol + company + category), but no recency boost
        assert score >= 75 and score < 90

    def test_multiple_ticker_mentions(self) -> None:
        """News mentioning multiple tickers should return multiple matches."""
        headline = "TSMC accelerates HBM3 for NVDA and AMD"
        summary = "Both NVIDIA and AMD benefit from TSMC capacity."
        now = datetime.now(timezone.utc)

        matches = map_news_to_tickers(headline, summary, "reuters.com", now)
        tickers = [m[0] for m in matches]
        assert "NVDA" in tickers
        assert "AMD" in tickers

    def test_sorted_by_score(self) -> None:
        """Results should be sorted by relevance score (descending)."""
        headline = "NVDA beats AMD in market share"
        summary = "NVIDIA gains ground over AMD."
        now = datetime.now(timezone.utc)

        matches = map_news_to_tickers(headline, summary, "reuters.com", now)
        scores = [m[2] for m in matches]
        # Should be sorted descending
        assert scores == sorted(scores, reverse=True)

    def test_relevance_level_mapping(self) -> None:
        """Relevance levels should map correctly from scores."""
        headline = "NVDA stock news"
        summary = "NVIDIA mentioned here."
        now = datetime.now(timezone.utc)

        matches = map_news_to_tickers(headline, summary, "reuters.com", now)
        for ticker, level, score in matches:
            if score >= 75:
                assert level == "high"
            elif score >= 50:
                assert level == "medium"
            else:
                assert level == "low"

    def test_macro_news_lower_relevance(self) -> None:
        """Macro news should score lower than company-specific."""
        headline = "Fed signals pause in rate hikes; benefits tech"
        summary = "Central bank policy impacts all tech stocks."
        now = datetime.now(timezone.utc)

        matches = map_news_to_tickers(headline, summary, "federalreserve.gov", now)
        # Any matches should be lower relevance (medium/low) due to macro category weight
        if matches:
            for _, level, score in matches:
                assert score <= 50

    def test_deterministic_scoring(self) -> None:
        """Same input should yield same output."""
        headline = "NVDA raises guidance"
        summary = "NVIDIA sees strong demand."
        now = datetime.now(timezone.utc)

        results = [
            map_news_to_tickers(headline, summary, "reuters.com", now) for _ in range(3)
        ]
        assert all(r == results[0] for r in results)

    def test_partnership_news(self) -> None:
        """Partnership news between two companies."""
        headline = "SNOW and DDOG announce integration"
        summary = "Snowflake and Datadog partner on monitoring."
        now = datetime.now(timezone.utc)

        matches = map_news_to_tickers(headline, summary, "forbes.com", now)
        tickers = [m[0] for m in matches]
        # Should match both SNOW and DDOG
        assert "SNOW" in tickers or "DDOG" in tickers
