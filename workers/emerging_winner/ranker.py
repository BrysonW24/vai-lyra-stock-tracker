"""
Model 4 - Archetype classifier + Learning-to-Rank research-queue ranker (deck 5/7; spec 102-114, 450-475).

Two parts:
  1. Archetype classification - assign the best-fit opportunity type (AI Infrastructure Enabler,
     Government-Backed Strategic Tech, Robotics Platform, Quantum Infrastructure, Space/Defence Supplier,
     Turnaround, Speculative narrative). v1 is rule-based over the domain pattern + theme membership +
     the nearest historical-winner archetype as a prior. The trained multinomial / mixture-of-experts
     model (spec) drops in behind this interface.
  2. Learning-to-Rank priority - combine the ranking signals (winner score, model confidence, risk
     penalty, catalyst freshness, portfolio relevance) into a single priority score so the worker can
     order the research queue. The real model is LambdaMART (spec 197, 222, 2059); v1 is a transparent
     weighted priority. "Which five deserve research first" - never "which to buy".
"""
from __future__ import annotations

from dataclasses import dataclass

from .analogue import AnalogueResult
from .classifier import ClassifierResult
from .domains import DomainResult

_THEME_ARCHETYPE = {
    "quantum": "Quantum Infrastructure",
    "robotics": "Robotics Platform",
    "space": "Space / Defence Supplier",
    "defence": "Space / Defence Supplier",
    "defense": "Space / Defence Supplier",
    "ai": "AI Infrastructure Enabler",
    "agi": "AI Infrastructure Enabler",
    "semiconductors": "AI Infrastructure Enabler",
    "chips": "AI Infrastructure Enabler",
    "compute": "AI Infrastructure Enabler",
}

_CONFIDENCE_NUM = {"low": 0.4, "medium": 0.7, "high": 0.95}

# Research actions - research vocabulary only, never "buy".
ACTION_DEEP_RESEARCH = "deep_research"
ACTION_PAPER_BOT = "paper_bot_candidate"
ACTION_WATCHLIST = "watchlist_candidate"
ACTION_REVIEW = "needs_review"


@dataclass
class RankResult:
    archetype: str
    archetype_confidence: str
    priority_score: float          # 0-100, used to order the research queue
    action: str
    signals: dict                  # the ranking signals, for transparency

    def to_dict(self) -> dict:
        return {
            "archetype": self.archetype,
            "archetype_confidence": self.archetype_confidence,
            "priority_score": round(self.priority_score, 1),
            "action": self.action,
            "signals": {k: round(v, 1) if isinstance(v, float) else v for k, v in self.signals.items()},
        }


def _strong(domains: dict[str, DomainResult], key: str, thresh: float = 60.0) -> bool:
    d = domains.get(key)
    return d is not None and d.score is not None and d.score >= thresh


def classify_archetype(
    domains: list[DomainResult],
    theme_context: dict | None,
    analogue: AnalogueResult,
) -> tuple[str, str]:
    by_key = {d.key: d for d in domains}

    # 1) Theme membership is the strongest archetype signal when present.
    if theme_context and theme_context.get("themes"):
        for t in theme_context["themes"]:
            hit = _THEME_ARCHETYPE.get(str(t).lower())
            if hit:
                # Government strength promotes an AI/quantum theme to the strategic-tech archetype.
                if _strong(by_key, "government", 65) and hit in ("AI Infrastructure Enabler", "Quantum Infrastructure"):
                    return ("Government-Backed Strategic Tech", "medium")
                return (hit, "medium")

    # 2) Government-led with no clear theme.
    if _strong(by_key, "government", 65):
        return ("Government-Backed Strategic Tech", "medium")

    # 3) Technical/accumulation recovery off a weak base -> turnaround.
    if _strong(by_key, "technical") and _strong(by_key, "accumulation") and not _strong(by_key, "theme"):
        return ("Turnaround", "low")

    # 4) High narrative + weak fundamentals -> speculative (the failure-adjacent archetype).
    narr = by_key.get("narrative")
    bq = by_key.get("business_quality")
    if narr is not None and narr.score and narr.score >= 65 and (bq is None or (bq.score or 0) < 40):
        return ("Speculative narrative", "low")

    # 5) Fall back to the nearest historical winner's archetype, if the match is meaningful.
    if analogue.nearest_winners and analogue.nearest_winners[0].similarity >= 60:
        return (analogue.nearest_winners[0].archetype, "low")

    return ("Unclassified (learned archetype model not yet trained)", "low")


def rank(
    classifier: ClassifierResult,
    risk_penalty: float,
    blocked: bool,
    *,
    catalyst_freshness: float = 50.0,
    portfolio_relevance: float = 50.0,
) -> tuple[float, str, dict]:
    """Compute the priority score + research action from the ranking signals. Blocked -> priority 0."""
    conf_num = _CONFIDENCE_NUM.get(classifier.confidence, 0.5)
    signals = {
        "winner_score": classifier.winner_similarity,
        "model_confidence_pct": conf_num * 100.0,
        "risk_penalty": risk_penalty,
        "catalyst_freshness": catalyst_freshness,
        "portfolio_relevance": portfolio_relevance,
    }
    if blocked:
        return (0.0, ACTION_REVIEW, signals)

    priority = (
        classifier.winner_similarity * 0.50
        + catalyst_freshness * 0.15
        + portfolio_relevance * 0.10
        + conf_num * 100.0 * 0.15
        - risk_penalty * 0.40
    )
    priority = max(0.0, min(100.0, priority))

    # Action from stage + risk. Research vocabulary only.
    if risk_penalty >= 45:
        action = ACTION_REVIEW
    elif classifier.ordinal_stage >= 3:
        action = ACTION_DEEP_RESEARCH
    elif classifier.ordinal_stage == 2:
        action = ACTION_PAPER_BOT
    else:
        action = ACTION_WATCHLIST

    return (priority, action, signals)
