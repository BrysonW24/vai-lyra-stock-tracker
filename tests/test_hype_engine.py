"""
Deterministic unit tests for hype engine.
No network. Synthetic fixtures only.
"""

import pytest

from workers.intelligence_worker.hype_engine import (
    compute_hype_per_ticker,
    build_hype_map,
)


class TestHypeEngine:
    """Unit tests for hype scoring."""

    def test_zero_items_zero_hype(self) -> None:
        """No news items should yield zero hype."""
        hype = compute_hype_per_ticker("NVDA", [])
        assert hype.hype_score == 0
        assert hype.recent_count == 0
        assert hype.trend == "steady"

    def test_one_high_relevance_item(self) -> None:
        """One high-relevance item should yield ~20 hype."""
        items = [("NVDA", "high", 80)]
        hype = compute_hype_per_ticker("NVDA", items)
        assert hype.hype_score >= 20
        assert hype.hype_score <= 50
        assert hype.recent_count == 1

    def test_two_high_relevance_items(self) -> None:
        """Two high-relevance items should yield ~40 hype."""
        items = [("NVDA", "high", 80), ("NVDA", "high", 75)]
        hype = compute_hype_per_ticker("NVDA", items)
        assert hype.hype_score >= 35
        assert hype.hype_score <= 60
        assert hype.recent_count == 2

    def test_three_high_relevance_items(self) -> None:
        """Three+ items should yield 50+ hype."""
        items = [
            ("NVDA", "high", 85),
            ("NVDA", "high", 80),
            ("NVDA", "high", 75),
        ]
        hype = compute_hype_per_ticker("NVDA", items)
        assert hype.hype_score >= 50
        assert hype.recent_count == 3

    def test_low_relevance_items_not_counted(self) -> None:
        """Low-relevance items should not contribute to hype."""
        items = [("NVDA", "low", 30), ("NVDA", "low", 25)]
        hype = compute_hype_per_ticker("NVDA", items)
        assert hype.recent_count == 0
        assert hype.hype_score == 0

    def test_medium_relevance_counted(self) -> None:
        """Medium-relevance items should count."""
        items = [("NVDA", "medium", 60), ("NVDA", "medium", 55)]
        hype = compute_hype_per_ticker("NVDA", items)
        assert hype.recent_count == 2

    def test_trend_rising(self) -> None:
        """Trend should be 'rising' when count > 1.5x prior."""
        items = [
            ("NVDA", "high", 80),
            ("NVDA", "high", 75),
            ("NVDA", "high", 70),
        ]
        hype = compute_hype_per_ticker("NVDA", items, historical_recent_count=1)
        assert hype.trend == "rising"

    def test_trend_cooling(self) -> None:
        """Trend should be 'cooling' when count < 0.7x prior."""
        items = [("NVDA", "high", 80)]
        hype = compute_hype_per_ticker("NVDA", items, historical_recent_count=5)
        assert hype.trend == "cooling"

    def test_trend_steady(self) -> None:
        """Trend should be 'steady' when count is stable."""
        items = [
            ("NVDA", "high", 80),
            ("NVDA", "high", 75),
            ("NVDA", "high", 70),
        ]
        hype = compute_hype_per_ticker("NVDA", items, historical_recent_count=3)
        assert hype.trend == "steady"

    def test_positive_sentiment_boost(self) -> None:
        """Positive sentiment should boost hype score."""
        # In real scenario, sentiment would be computed per item
        # For unit test, we assume high-relevance items are ~70% positive
        items = [
            ("NVDA", "high", 85),
            ("NVDA", "high", 80),
            ("NVDA", "high", 75),
        ]
        hype = compute_hype_per_ticker("NVDA", items)
        assert hype.positive_pct > 0

    def test_hype_score_bounded(self) -> None:
        """Hype score should always be 0-100."""
        test_cases = [
            [],
            [("NVDA", "high", 100)],
            [
                ("NVDA", "high", 95),
                ("NVDA", "high", 90),
                ("NVDA", "high", 85),
                ("NVDA", "high", 80),
                ("NVDA", "high", 75),
            ],
        ]
        for items in test_cases:
            hype = compute_hype_per_ticker("NVDA", items)
            assert 0 <= hype.hype_score <= 100

    def test_build_hype_map_multiple_tickers(self) -> None:
        """Build hype for multiple tickers."""
        tickers_to_items = {
            "NVDA": [("NVDA", "high", 85), ("NVDA", "high", 80), ("NVDA", "high", 75)],
            "AMD": [("AMD", "high", 75), ("AMD", "high", 70)],
            "MSFT": [("MSFT", "medium", 60)],
        }
        hype_map = build_hype_map(tickers_to_items)
        assert len(hype_map) == 3
        assert "NVDA" in hype_map
        assert "AMD" in hype_map
        assert "MSFT" in hype_map
        assert hype_map["NVDA"].hype_score > hype_map["AMD"].hype_score
        assert hype_map["AMD"].hype_score > hype_map["MSFT"].hype_score

    def test_deterministic_hype(self) -> None:
        """Same input should yield same hype."""
        items = [
            ("NVDA", "high", 85),
            ("NVDA", "high", 80),
        ]
        results = [compute_hype_per_ticker("NVDA", items) for _ in range(3)]
        assert all(r == results[0] for r in results)

    def test_empty_tickers_to_items(self) -> None:
        """Empty tickers dict should yield empty hype map."""
        hype_map = build_hype_map({})
        assert len(hype_map) == 0

    def test_acceleration_factor(self) -> None:
        """Acceleration factor should reflect growth."""
        items = [
            ("NVDA", "high", 85),
            ("NVDA", "high", 80),
            ("NVDA", "high", 75),
        ]
        hype = compute_hype_per_ticker("NVDA", items, historical_recent_count=1)
        assert hype.acceleration > 1.0  # Growing

        hype2 = compute_hype_per_ticker("NVDA", items, historical_recent_count=5)
        assert hype2.acceleration < 1.0  # Declining

    def test_no_items_results_in_zero(self) -> None:
        """Empty items should result in all-zero metrics."""
        hype = compute_hype_per_ticker("NVDA", [])
        assert hype.hype_score == 0
        assert hype.recent_count == 0
        assert hype.positive_pct == 0
        assert hype.trend == "steady"
        assert hype.acceleration == 0.0
