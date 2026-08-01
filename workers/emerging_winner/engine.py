"""
The Emerging Winner Engine pipeline orchestrator (deck 1/7 core model stack; spec "Production v1").

Runs a candidate through the full stack and assembles one finding matching the spec's target output
(lines 2016-2050):

  Domain Score Engine (M1)  ->  Emerging Winner Classifier (M2)  ->  Historical Analogue (M3)
      ->  Archetype & Ranker (M4)  ->  Risk Gate Stack (M5)  ->  ranked, risk-gated user output
      +  Timing & Network Intelligence (M6, shadow challenger annotating every finding)

Doctrine, unbroken: every number is engine-computed; the AI only phrases; research only, never advice,
never a price target. Everything ships SHADOW-LIVE (`reference-v1`) - it runs end to end and logs to an
immutable ledger, but is not trained on a real point-in-time winner dataset yet, and the surface says so.
The learned models (M2 GBDT, M3 vector index, M4 LambdaMART, M6 temporal/graph) drop in behind these
interfaces without changing the output contract.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

from . import analogue as m3
from . import classifier as m2
from . import ranker as m4
from . import risk_gates as m5
from . import timing as m6
from .distribution import estimate_distribution
from .domains import score_domains
from .scorecard import build_scorecard

ENGINE_VERSION = "emerging-winner-engine-v1-shadow-live"


@dataclass
class EmergingWinnerResult:
    symbol: str
    engine_version: str
    generated_at: str
    # headline classification
    winner_similarity: float
    probability: float
    ordinal_stage: int
    stage_label: str
    confidence: str
    completeness: float
    archetype: str
    archetype_confidence: str
    # size (real market cap when the feature source supplied one; None = not sourced, never a guess)
    market_cap: float | None
    # domain layer
    domain_composite: float
    present_traits: list[str]
    strongest_domains: list[str]
    weakest_domains: list[str]
    missing_domains: list[str]
    contributions: list[dict]
    domains: list[dict]
    # analogue, distribution, risk, ranking
    analogues: dict
    outcome_distribution: dict
    risk: dict
    priority_score: float
    action: str
    ranking_signals: dict
    surfaced: bool          # False when a risk BLOCK excludes it from the research queue
    timing_state: str
    timing: dict            # Model 6 shadow annotation (temporal + network); never steers ranking
    risks: list[str]

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "engine_version": self.engine_version,
            "generated_at": self.generated_at,
            "winner_similarity": round(self.winner_similarity, 1),
            "probability": round(self.probability, 4),
            "ordinal_stage": self.ordinal_stage,
            "stage_label": self.stage_label,
            "confidence": self.confidence,
            "completeness": round(self.completeness, 2),
            "archetype": self.archetype,
            "archetype_confidence": self.archetype_confidence,
            "market_cap": self.market_cap,
            "domain_composite": round(self.domain_composite, 1),
            "present_traits": self.present_traits,
            "strongest_domains": self.strongest_domains,
            "weakest_domains": self.weakest_domains,
            "missing_domains": self.missing_domains,
            "contributions": self.contributions,
            "domains": self.domains,
            "analogues": self.analogues,
            "outcome_distribution": self.outcome_distribution,
            "risk": self.risk,
            "priority_score": round(self.priority_score, 1),
            "action": self.action,
            "ranking_signals": self.ranking_signals,
            "surfaced": self.surfaced,
            "timing_state": self.timing_state,
            "timing": self.timing,
            "risks": self.risks,
        }


def run_engine(symbol: str, features: dict, *, generated_at: str | None = None) -> EmergingWinnerResult:
    if generated_at is None:
        generated_at = datetime.now(timezone.utc).isoformat()

    # M1 - domain scorecard
    domains = score_domains(features)
    scorecard = build_scorecard(symbol, features)

    # M2 - classifier
    clf = m2.classify(domains)

    # M3 - historical analogues
    analogues = m3.find_analogues(domains)

    # M4a - archetype
    archetype, arche_conf = m4.classify_archetype(domains, features.get("theme_context"), analogues)

    # M5 - risk gates
    risk = m5.assess_risk(features)

    # M6 - timing & network intelligence (shadow challenger: annotates, never steers ranking)
    tn = m6.assess(features)

    # Distribution (Gate 7) from calibrated probability + risk
    dist = estimate_distribution(clf.probability, risk.penalty, clf.completeness)

    # M4b - rank / action (blocked risk => excluded from queue)
    catalyst_freshness = float(features.get("news_attention", 0.5)) * 100.0
    portfolio_relevance = float(features.get("portfolio_relevance", 0.5)) * 100.0
    priority, action, signals = m4.rank(
        clf, risk.penalty, risk.blocked,
        catalyst_freshness=catalyst_freshness, portfolio_relevance=portfolio_relevance,
    )

    # Assemble the risk half (mandatory, never empty) from every layer.
    risks = list(scorecard.risks)
    for g in risk.gates:
        if g.verdict in (m5.REVIEW, m5.BLOCK):
            risks.extend(g.reasons)
    if analogues.failure_similarity >= analogues.winner_similarity and analogues.failure_similarity > 0:
        risks.append(
            f"Resembles historical FAILURES at least as much as winners "
            f"(failure similarity {analogues.failure_similarity:.0f} vs winner {analogues.winner_similarity:.0f})."
        )
    if dist.p_ruin >= 0.3:
        risks.append(f"Modelled P(-80% / delisting) ~{dist.p_ruin*100:.0f}% - material ruin risk.")
    if tn.timing_state == m6.CROWDED:
        risks.append("Timing read: attention is ahead of evidence - the crowd likely arrived first.")
    if risk.blocked:
        risks.insert(0, "BLOCKED by a risk gate - excluded from the research queue until the flag clears.")

    return EmergingWinnerResult(
        symbol=symbol,
        engine_version=ENGINE_VERSION,
        generated_at=generated_at,
        winner_similarity=clf.winner_similarity,
        probability=clf.probability,
        ordinal_stage=clf.ordinal_stage,
        stage_label=clf.stage_label,
        confidence=clf.confidence,
        completeness=clf.completeness,
        archetype=archetype,
        archetype_confidence=arche_conf,
        market_cap=(float(features["market_cap"]) if isinstance(features.get("market_cap"), (int, float)) else None),
        domain_composite=scorecard.winner_similarity,
        present_traits=scorecard.present_traits,
        strongest_domains=scorecard.strongest_domains,
        weakest_domains=scorecard.weakest_domains,
        missing_domains=scorecard.missing_domains,
        contributions=[c.__dict__ for c in clf.contributions],
        domains=[d.to_dict() for d in domains],
        analogues=analogues.to_dict(),
        outcome_distribution=dist.to_dict(),
        risk=risk.to_dict(),
        priority_score=priority,
        action=action,
        ranking_signals=signals,
        surfaced=not risk.blocked,
        timing_state=tn.timing_state,
        timing=tn.to_dict(),
        risks=risks,
    )


def rank_universe(candidates: list[tuple[str, dict]], *, generated_at: str | None = None) -> list[EmergingWinnerResult]:
    """Run the engine over many candidates and return them ordered as the research queue (surfaced,
    highest priority first). Blocked names are still returned (surfaced=False) but sink to the bottom."""
    results = [run_engine(sym, feats, generated_at=generated_at) for sym, feats in candidates]
    results.sort(key=lambda r: (r.surfaced, r.priority_score), reverse=True)
    return results
