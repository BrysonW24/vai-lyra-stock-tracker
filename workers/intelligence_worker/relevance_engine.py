"""
Deterministic relevance scoring and ticker mapping.

Maps a news item to one or more tickers + relevance level ('high'|'medium'|'low').
Scores based on symbol/company-name match, category weight, and recency.
"""

from __future__ import annotations

from datetime import datetime, timezone


def map_news_to_tickers(
    headline: str,
    summary: str,
    source_domain: str,
    published_at: datetime,
    universe: dict[str, dict] | None = None,
) -> list[tuple[str, str, int]]:
    """
    Map a news item to relevant ticker symbols.

    Returns: list of (ticker, relevance_level, relevance_score)
    where relevance_level is 'high' | 'medium' | 'low'
    and relevance_score is 0-100.
    """
    if universe is None:
        universe = _default_universe()

    text = (headline + " " + summary).upper()
    matched = []

    # Try to match each ticker in universe
    for symbol, info in universe.items():
        score = _compute_relevance_score(
            text=text,
            symbol=symbol,
            company_name=info.get("company_name", ""),
            category=_infer_category(headline),
            published_at=published_at,
        )

        if score > 0:
            relevance_level = "high" if score >= 75 else ("medium" if score >= 50 else "low")
            matched.append((symbol, relevance_level, score))

    # Sort by score descending
    matched.sort(key=lambda x: x[2], reverse=True)

    return matched


def _compute_relevance_score(
    text: str,
    symbol: str,
    company_name: str,
    category: str,
    published_at: datetime,
) -> int:
    """
    Compute relevance score 0-100.

    Based on:
    - Symbol match (exact): +50
    - Company name match: +30
    - Category weight: +15-25
    - Recency: +0-5 (more recent = higher)
    """
    score = 0

    # Symbol match (highest confidence)
    if symbol in text:
        score += 50

    # Company name match
    if company_name and company_name.upper() in text:
        score += 30

    # Category weight
    category_weights = {
        "Earnings": 25,
        "Product launch": 20,
        "AI announcement": 20,
        "Analyst upgrade": 15,
        "Analyst downgrade": 15,
        "Partnership": 15,
        "Regulatory": 10,
        "Litigation": 10,
        "M&A": 15,
        "Guidance": 20,
        "Macro": 5,
    }
    score += category_weights.get(category, 5)

    # Recency boost (last 24 hours = +5, last 7 days = +3, older = +0)
    now = datetime.now(timezone.utc)
    days_old = (now - published_at).days
    if days_old == 0:
        score += 5
    elif days_old <= 7:
        score += 3

    return min(score, 100)


def _infer_category(headline: str) -> str:
    """Infer news category from headline keywords."""
    headline_lower = headline.lower()

    if any(word in headline_lower for word in ["earnings", "q1", "q2", "q3", "q4", "revenue", "guidance", "eps"]):
        return "Earnings"
    elif any(word in headline_lower for word in ["upgrade", "outperform", "conviction buy"]):
        return "Analyst upgrade"
    elif any(word in headline_lower for word in ["downgrade", "underperform", "equal weight", "sell"]):
        return "Analyst downgrade"
    elif any(word in headline_lower for word in ["partnership", "collaboration", "integr"]):
        return "Partnership"
    elif any(word in headline_lower for word in ["launch", "announce", "release", "unveil"]):
        return "Product launch"
    elif any(word in headline_lower for word in ["ai", "artificial", "machine learning", "llm", "copilot"]):
        return "AI announcement"
    elif any(word in headline_lower for word in ["regulate", "compliance", "fda", "doe", "ftc", "antitrust"]):
        return "Regulatory"
    elif any(word in headline_lower for word in ["lawsuit", "settlement", "litigation", "probe"]):
        return "Litigation"
    elif any(word in headline_lower for word in ["merger", "acquisition", "acquire", "m&a"]):
        return "M&A"
    elif any(word in headline_lower for word in ["guidance"]):
        return "Guidance"
    elif any(word in headline_lower for word in ["macro", "fed", "interest rate", "inflation"]):
        return "Macro"
    else:
        return "News"


def _default_universe() -> dict[str, dict]:
    """Default ticker universe for scoring."""
    return {
        "NVDA": {"company_name": "NVIDIA"},
        "AMD": {"company_name": "AMD"},
        "MSFT": {"company_name": "MICROSOFT"},
        "GOOGL": {"company_name": "GOOGLE"},
        "SNOW": {"company_name": "SNOWFLAKE"},
        "CRWD": {"company_name": "CROWDSTRIKE"},
        "PANW": {"company_name": "PALO ALTO"},
        "AVGO": {"company_name": "BROADCOM"},
        "CRM": {"company_name": "SALESFORCE"},
        "NOW": {"company_name": "SERVICENOW"},
        "DDOG": {"company_name": "DATADOG"},
        "ADBE": {"company_name": "ADOBE"},
        "AAPL": {"company_name": "APPLE"},
        "AMZN": {"company_name": "AMAZON"},
        "META": {"company_name": "META"},
    }
