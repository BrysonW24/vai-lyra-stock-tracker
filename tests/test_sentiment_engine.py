"""
Deterministic unit tests for sentiment engine.
No network. Synthetic fixtures only.
"""

import pytest

from workers.intelligence_worker.sentiment_engine import score_sentiment


class TestSentimentEngine:
    """Unit tests for lexicon-based sentiment scoring."""

    def test_positive_sentiment_strong(self) -> None:
        """Strong positive keywords should yield positive sentiment."""
        text = "NVDA raised to conviction buy. Strong earnings beat and accelerating growth."
        sentiment, score = score_sentiment(text)
        assert sentiment == "positive"
        assert score > 0.5

    def test_positive_sentiment_upgrade(self) -> None:
        """Analyst upgrade text."""
        text = "Goldman Sachs upgrades AMD with outperform rating. Strong demand and positive momentum."
        sentiment, score = score_sentiment(text)
        assert sentiment == "positive"
        assert score > 0.2

    def test_negative_sentiment_downgrade(self) -> None:
        """Analyst downgrade text."""
        text = "Morgan Stanley downgraded CRM to underperform. Valuation concerns and weak guidance."
        sentiment, score = score_sentiment(text)
        assert sentiment == "negative"
        assert score < -0.2

    def test_negative_sentiment_lawsuit(self) -> None:
        """Negative event (litigation)."""
        text = "PANW faces lawsuit settlement. Breach and compliance issues under investigation."
        sentiment, score = score_sentiment(text)
        assert sentiment == "negative"
        assert score < -0.2

    def test_neutral_sentiment_mixed(self) -> None:
        """Mixed or neutral language."""
        text = "MSFT maintains position in cloud market. Some challenges but steady growth."
        sentiment, score = score_sentiment(text)
        assert sentiment == "neutral"
        assert -0.2 <= score <= 0.2

    def test_neutral_sentiment_unchanged(self) -> None:
        """Neutral/stable keywords."""
        text = "Stock price unchanged. Maintain current levels."
        sentiment, score = score_sentiment(text)
        assert sentiment == "neutral"
        assert -0.2 <= score <= 0.2

    def test_empty_text(self) -> None:
        """Empty text should be neutral."""
        sentiment, score = score_sentiment("")
        assert sentiment == "neutral"
        assert score == 0.0

    def test_score_range(self) -> None:
        """Score should always be in [-1, 1]."""
        texts = [
            "Beat beat beat beat beat positive positive positive positive",
            "Miss miss miss miss miss negative negative negative negative",
            "Neutral neutral neutral neutral",
            "Random words xyz abc 123",
        ]
        for text in texts:
            _, score = score_sentiment(text)
            assert -1.0 <= score <= 1.0

    def test_positive_with_one_negative_keyword(self) -> None:
        """Mostly positive with one negative should still be positive."""
        text = "Strong growth beat expectations. One minor concern noted."
        sentiment, score = score_sentiment(text)
        assert sentiment == "positive"

    def test_negative_with_one_positive_keyword(self) -> None:
        """Negative and positive keywords balanced; results in neutral."""
        text = "Downgrade and miss. Some minor positive on innovation."
        sentiment, score = score_sentiment(text)
        # 2 negative + 1 positive = balanced, results in neutral
        assert sentiment in ("neutral", "negative")

    def test_case_insensitive(self) -> None:
        """Sentiment matching should be case-insensitive."""
        text_lower = "beat and upgrade and positive momentum"
        text_upper = "BEAT AND UPGRADE AND POSITIVE MOMENTUM"
        sentiment_lower, score_lower = score_sentiment(text_lower)
        sentiment_upper, score_upper = score_sentiment(text_upper)
        assert sentiment_lower == sentiment_upper
        assert score_lower == score_upper

    def test_deterministic(self) -> None:
        """Same input should always yield same output."""
        text = "Earnings beat on AI acceleration with strong guidance."
        results = [score_sentiment(text) for _ in range(3)]
        assert all(r == results[0] for r in results)

    def test_earnings_beat_positive(self) -> None:
        """Earnings beat is positive."""
        text = "Q2 earnings beat estimates. Revenue growth strong."
        sentiment, score = score_sentiment(text)
        assert sentiment == "positive"

    def test_earnings_miss_negative(self) -> None:
        """Earnings miss with multiple negatives is negative."""
        text = "Q2 earnings miss. Revenue declining down down. Guidance lowered cut reduced."
        sentiment, score = score_sentiment(text)
        assert sentiment == "negative"

    def test_partnership_positive(self) -> None:
        """Partnership news is positive."""
        text = "SNOW announced partnership with datadog. Integration benefits enterprise."
        sentiment, score = score_sentiment(text)
        assert sentiment == "positive"

    def test_multiple_strong_signals(self) -> None:
        """Multiple strong signals should amplify sentiment."""
        text = "Strong growth beat guidance positive momentum leading position"
        sentiment, score = score_sentiment(text)
        assert sentiment == "positive"
        assert score > 0.6
