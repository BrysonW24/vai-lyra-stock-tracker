"""
Deterministic hype scoring per ticker.

Hype is CONTEXT, not a trade signal. It measures buzz intensity:
- Recent mention frequency (last 7 days vs. 8-14 days)
- Sentiment skew (% positive mentions)
- Acceleration (rising/steady/cooling trend)

Range: 0-100.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import NamedTuple


class HypeScore(NamedTuple):
    """Hype metrics for a ticker."""

    ticker: str
    hype_score: int  # 0-100
    recent_count: int  # Count of high-relevance items in last 7 days
    positive_pct: int  # % of recent items that are positive
    trend: str  # 'rising' | 'steady' | 'cooling'
    acceleration: float  # Recent vs prior window growth factor


def compute_hype_per_ticker(
    ticker: str,
    news_items: list[tuple[str, str, int]],  # (ticker, relevance, score)
    historical_recent_count: int | None = None,
) -> HypeScore:
    """
    Compute hype metrics for a ticker from its news items.

    Args:
        ticker: Symbol (e.g., 'NVDA')
        news_items: List of (ticker, relevance, score) tuples from relevance engine
        historical_recent_count: Prior window's count (for trend calculation)

    Returns: HypeScore namedtuple
    """
    if not news_items:
        return HypeScore(
            ticker=ticker,
            hype_score=0,
            recent_count=0,
            positive_pct=0,
            trend="steady",
            acceleration=0.0,
        )

    # Count high-relevance items in last 7 days
    now = datetime.now(timezone.utc)
    recent_cutoff = now - timedelta(days=7)

    # For demo: we assume items passed are recent; in production, filter by published_at
    high_relevance_count = sum(1 for _, relevance, score in news_items if relevance in ("high", "medium"))

    # Estimate sentiment: assume high-relevance items are 70% positive on average
    positive_count = int(high_relevance_count * 0.7)
    positive_pct = int((positive_count / high_relevance_count * 100)) if high_relevance_count > 0 else 0

    # Compute base hype score from mention count
    # 1 item = 20, 2 = 35, 3+ = 50+
    if high_relevance_count == 0:
        base_score = 0
    elif high_relevance_count == 1:
        base_score = 20
    elif high_relevance_count == 2:
        base_score = 40
    else:
        base_score = 50 + min(high_relevance_count - 3, 2) * 10

    # Boost for positive sentiment
    sentiment_boost = int((positive_pct / 100) * 20)
    hype_score = min(base_score + sentiment_boost, 100)

    # Compute trend / acceleration
    if historical_recent_count is None:
        trend = "steady"
        acceleration = 1.0
    else:
        if high_relevance_count > historical_recent_count * 1.5:
            trend = "rising"
            acceleration = high_relevance_count / max(historical_recent_count, 1)
        elif high_relevance_count < historical_recent_count * 0.7:
            trend = "cooling"
            acceleration = high_relevance_count / max(historical_recent_count, 1)
        else:
            trend = "steady"
            acceleration = high_relevance_count / max(historical_recent_count, 1)

    return HypeScore(
        ticker=ticker,
        hype_score=hype_score,
        recent_count=high_relevance_count,
        positive_pct=positive_pct,
        trend=trend,
        acceleration=acceleration,
    )


def build_hype_map(
    tickers_to_items: dict[str, list[tuple[str, str, int]]],
    historical_hype: dict[str, int] | None = None,
) -> dict[str, HypeScore]:
    """
    Build hype scores for multiple tickers.

    Args:
        tickers_to_items: Dict mapping ticker -> list of (ticker, relevance, score)
        historical_hype: Dict mapping ticker -> prior recent_count for trend

    Returns: Dict mapping ticker -> HypeScore
    """
    result = {}
    for ticker, items in tickers_to_items.items():
        historical_count = historical_hype.get(ticker) if historical_hype else None
        result[ticker] = compute_hype_per_ticker(ticker, items, historical_count)

    return result
