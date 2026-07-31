"""
Assemble the 10 domain results into an Emerging Winner scorecard.

Produces (all deterministic, all engine-owned):
  - winner_similarity  0-100  : weighted mean of AVAILABLE domain scores (unbuilt pipelines never drag it)
  - completeness       0-1    : fraction of the 10 domains we can actually assess right now
  - present_traits            : available domains scoring >= PRESENT_THRESHOLD
  - opportunity_class         : 0 low / 1 emerging / 2 strong / 3 breakout-archetype (v0 rule-based)
  - archetype                 : heuristic winner archetype (v0 - the learned classifier replaces this)
  - confidence                : low/medium/high, driven by how much coverage we have
  - risks / missing_domains   : mandatory, never empty - the honest "what's missing" half

This is v0: the opportunity class and archetype are RULE-BASED, not learned. They exist so the product
shell is real and testable today; Layers 2-4 (the trained classifier + archetype model) replace them.
Nothing here is advice: it is a resemblance measure with its risks stated.
"""
from __future__ import annotations

from dataclasses import dataclass

from .domains import DOMAIN_WEIGHTS, DomainResult, score_domains

CLASS_LABELS = {
    0: "low potential",
    1: "emerging",
    2: "strong candidate",
    3: "breakout archetype",
}

DEFAULT_SMALL_CAP_RISKS = [
    "Small caps carry elevated dilution, going-concern and liquidity risk; any signal can be wrong.",
    "This is a resemblance-to-past-winners measure, not a prediction and not advice.",
]


@dataclass
class Scorecard:
    symbol: str
    winner_similarity: float          # 0-100
    completeness: float               # 0-1
    opportunity_class: int            # 0-3
    opportunity_label: str
    archetype: str
    archetype_confidence: str         # low/medium/high
    confidence: str                   # low/medium/high (overall, coverage-driven)
    domains: list[DomainResult]
    present_traits: list[str]
    strongest_domains: list[str]
    weakest_domains: list[str]
    missing_domains: list[str]        # domains we cannot assess yet (unavailable), with reasons
    risks: list[str]
    model_stage: str = "v0-deterministic-scorecard"

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "model_stage": self.model_stage,
            "winner_similarity": round(self.winner_similarity, 1),
            "completeness": round(self.completeness, 2),
            "opportunity_class": self.opportunity_class,
            "opportunity_label": self.opportunity_label,
            "archetype": self.archetype,
            "archetype_confidence": self.archetype_confidence,
            "confidence": self.confidence,
            "present_traits": self.present_traits,
            "strongest_domains": self.strongest_domains,
            "weakest_domains": self.weakest_domains,
            "missing_domains": self.missing_domains,
            "risks": self.risks,
            "domains": [d.to_dict() for d in self.domains],
        }


def _composite(domains: list[DomainResult]) -> float:
    """Weighted mean over AVAILABLE domains only. 0 when nothing is available."""
    num = 0.0
    den = 0.0
    for d in domains:
        if d.score is None:
            continue
        w = DOMAIN_WEIGHTS.get(d.key, 1.0)
        num += w * d.score
        den += w
    return num / den if den else 0.0


def _confidence(completeness: float) -> str:
    if completeness >= 0.7:
        return "high"
    if completeness >= 0.5:
        return "medium"
    return "low"


def _classify(similarity: float, present_count: int, completeness: float) -> int:
    """v0 rule-based ladder. Breakout-archetype requires both strength AND enough coverage to claim it.

    Coverage gates the ceiling: you cannot be called a strong candidate or better on a preliminary read.
    Under 50% of domains assessed, the class is capped at 1 (emerging) no matter how high the few
    available domains score - a 3-domain technical read must never masquerade as a strong candidate."""
    if similarity >= 75 and present_count >= 5 and completeness >= 0.6:
        cls = 3
    elif similarity >= 60:
        cls = 2
    elif similarity >= 40:
        cls = 1
    else:
        cls = 0
    if completeness < 0.5:
        cls = min(cls, 1)
    return cls


def _archetype(by_key: dict[str, DomainResult]) -> tuple[str, str]:
    """Heuristic archetype (v0). Returns (label, confidence). Confidence is low when key domains are
    unavailable - we never assert an archetype the data cannot support."""

    def strong(key: str) -> bool:
        d = by_key.get(key)
        return d is not None and d.score is not None and d.score >= 60.0

    def avail(key: str) -> bool:
        d = by_key.get(key)
        return d is not None and d.score is not None

    theme = by_key.get("theme")
    theme_strong = strong("theme")
    supply_central = (
        theme is not None and theme.score is not None
        and any(s.name == "supply_chain_centrality" and (s.score or 0) >= 60 for s in theme.subsignals)
    )

    if theme_strong and strong("government"):
        label = "Government-backed strategic tech"
    elif theme_strong and supply_central:
        label = "Second-order supply-chain winner"
    elif theme_strong and strong("adoption"):
        label = "Platform adoption breakout"
    elif theme_strong and strong("technical"):
        label = "Speculative narrative with real traction"
    elif strong("technical") and strong("accumulation"):
        label = "Turnaround with improving structure"
    else:
        return ("Unclassified (learned archetype model not yet trained)", "low")

    # Confidence rests on the domains that define archetypes being sourced at all.
    key_domains = ["theme", "government", "sponsorship", "business_quality"]
    covered = sum(1 for k in key_domains if avail(k))
    confidence = "high" if covered >= 3 else "medium" if covered == 2 else "low"
    return (label, confidence)


def build_scorecard(symbol: str, features: dict) -> Scorecard:
    domains = score_domains(features)
    by_key = {d.key: d for d in domains}

    available = [d for d in domains if d.available]
    completeness = len(available) / len(domains)
    similarity = _composite(domains)

    present = [d.label for d in available if d.is_present_trait]
    ranked = sorted(available, key=lambda d: d.score, reverse=True)
    strongest = [d.label for d in ranked[:4]]
    weakest = [d.label for d in ranked[-3:]][::-1] if len(ranked) >= 3 else [d.label for d in ranked[::-1]]

    missing = [f"{d.label} - {d.reason}" for d in domains if not d.available]

    opportunity_class = _classify(similarity, len(present), completeness)
    archetype, archetype_conf = _archetype(by_key)
    confidence = _confidence(completeness)

    risks = list(DEFAULT_SMALL_CAP_RISKS)
    if completeness < 0.5:
        risks.insert(
            0,
            f"Under-assessed: only {len(available)} of {len(domains)} domains have data - "
            "several signal pipelines are not built yet, so this score is preliminary.",
        )
    unavailable_labels = [d.label for d in domains if not d.available]
    if unavailable_labels:
        risks.append("Not yet assessed: " + ", ".join(unavailable_labels) + ".")

    return Scorecard(
        symbol=symbol,
        winner_similarity=similarity,
        completeness=completeness,
        opportunity_class=opportunity_class,
        opportunity_label=CLASS_LABELS[opportunity_class],
        archetype=archetype,
        archetype_confidence=archetype_conf,
        confidence=confidence,
        domains=domains,
        present_traits=present,
        strongest_domains=strongest,
        weakest_domains=weakest,
        missing_domains=missing,
        risks=risks,
    )
