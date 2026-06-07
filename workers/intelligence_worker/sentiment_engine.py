"""
Deterministic lexicon-based sentiment scoring.

No LLM. Pure keyword matching against documented lists.
Returns ('positive'|'neutral'|'negative', score in -1..1).
"""

from __future__ import annotations


# Positive sentiment keywords
POSITIVE_KEYWORDS = {
    "beat", "exceed", "outperform", "upgrade", "upbeat", "strength", "strong",
    "growth", "accelerating", "acceleration", "positive", "opportunity", "bullish",
    "raised", "raises", "raise", "confidence", "conviction", "momentum",
    "earnings", "revenue", "guidance", "expansion", "demand", "record", "leadership",
    "launch", "announce", "unveil", "partnership", "collaborate", "integrate",
    "deal", "acquisition", "adopt", "adoption", "adoption", "growth", "margin",
    "efficient", "optimize", "improve", "leading", "first", "best", "premium",
    "advantage", "edge", "moat", "breakthrough", "innovation",
}

# Negative sentiment keywords
NEGATIVE_KEYWORDS = {
    "miss", "missed", "downgrade", "downgraded", "underperform", "weakness", "weak",
    "decline", "declining", "declined", "loss", "deficit", "challenge", "challenged",
    "bearish", "concern", "concerns", "risk", "risk", "warning", "caution",
    "lawsuit", "settlement", "litigation", "probe", "investigation",
    "headwind", "headwinds", "pressure", "pressured", "struggle", "struggles",
    "cut", "cutting", "reduced", "reduction", "lower", "lowering", "loss",
    "slowdown", "slowdown", "slowdown", "disappointing", "negative", "bad",
    "deficit", "deficit", "inefficient", "inefficiency", "breach", "breach",
    "competing", "competitor", "competition", "competition", "threat",
    "regulatory", "compliance", "fda", "doe", "ftc", "antitrust",
}

# Neutral keywords (context-dependent, used to offset strong signals)
NEUTRAL_KEYWORDS = {
    "mixed", "unchanged", "stable", "maintain", "maintain", "steady",
    "holding", "stable", "range-bound", "consolidate",
}


def score_sentiment(text: str) -> tuple[str, float]:
    """
    Score sentiment deterministically from text.

    Returns: (sentiment label, score in -1..1)
    - 'positive': score > 0.2
    - 'negative': score < -0.2
    - 'neutral': -0.2 <= score <= 0.2
    """
    text_lower = text.lower()

    positive_count = sum(1 for keyword in POSITIVE_KEYWORDS if keyword in text_lower)
    negative_count = sum(1 for keyword in NEGATIVE_KEYWORDS if keyword in text_lower)
    neutral_count = sum(1 for keyword in NEUTRAL_KEYWORDS if keyword in text_lower)

    # Compute weighted score
    total = max(positive_count + negative_count + neutral_count, 1)
    score = (positive_count - negative_count) / total

    # Boost neutral slightly if many neutral keywords
    if neutral_count > 0 and abs(score) < 0.3:
        score = score * 0.5

    # Classify
    if score > 0.2:
        return "positive", min(score, 1.0)
    elif score < -0.2:
        return "negative", max(score, -1.0)
    else:
        return "neutral", score
