"""
Lyra Emerging Winner Engine - Layer 1: the deterministic domain signal engine.

WHAT IT IS: a coverage-honest 10-domain scorecard that assesses whether a small cap structurally
resembles the companies that became outsized winners. It is the FIRST SLICE of the Emerging Winner
Engine (planning: lyra-modelling/research/2026-07-29-emerging-winner-engine.md) - the deterministic
foundation the learned classifier (Layers 2-4) will sit on top of. It ships zero machine learning.

THE LAW (unbroken, same as the rest of the modelling space):
- The deterministic engine computes every number; nothing here invents one.
- It INFORMS (a resemblance score + which domains are present/missing); it never DECIDES an action.
- Research only - never "buy", never a price target, never a certainty claim.

COVERAGE HONESTY (the reason this slice is honest and not a fabrication):
- A domain we cannot source yet is `unavailable`, which is NOT the same as a domain assessed and found
  weak. `completeness` counts only *available* domains, and the composite score is normalised over the
  available domains so unbuilt pipelines never masquerade as weak traits.
- As the real data pipelines land (SEC EDGAR, USAspending, Form 4/13F, the theme graph), the SAME engine
  lights up more domains with no refactor: each domain function returns `unavailable` only because its
  inputs are absent, and computes as soon as they arrive.

DEPENDENCY-FREE: pure Python stdlib (no numpy/pandas), so it runs anywhere - including CI - matching the
portability ethos of workers/stock_scanner/ml/recovery_model.py.
"""
from __future__ import annotations

from .analogue import AnalogueResult, find_analogues
from .classifier import ClassifierResult, classify
from .distribution import OutcomeDistribution, estimate_distribution
from .domains import DOMAIN_REGISTRY, DomainResult, SubSignal, score_domains
from .engine import ENGINE_VERSION, EmergingWinnerResult, rank_universe, run_engine
from .ranker import classify_archetype, rank
from .risk_gates import RiskAssessment, assess_risk
from .scorecard import Scorecard, build_scorecard
from .timing import TimingNetworkResult
from .timing import assess as assess_timing_network

__all__ = [
    # Model 1 - domain scorecard
    "DOMAIN_REGISTRY",
    "DomainResult",
    "SubSignal",
    "score_domains",
    "Scorecard",
    "build_scorecard",
    # Model 2 - classifier
    "ClassifierResult",
    "classify",
    # Model 3 - historical analogues
    "AnalogueResult",
    "find_analogues",
    # Model 4 - archetype + rank
    "classify_archetype",
    "rank",
    # Model 5 - risk gates
    "RiskAssessment",
    "assess_risk",
    # Model 6 - timing & network intelligence (shadow challenger)
    "TimingNetworkResult",
    "assess_timing_network",
    # distribution + pipeline
    "OutcomeDistribution",
    "estimate_distribution",
    "EmergingWinnerResult",
    "ENGINE_VERSION",
    "run_engine",
    "rank_universe",
]
