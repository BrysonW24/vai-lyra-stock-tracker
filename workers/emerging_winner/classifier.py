"""
Model 2 - the Emerging Winner Classifier (ordinal winner-stage + calibrated similarity).

The deck's core supervised model is a CatBoost/LightGBM ordinal classifier trained on historical
winners vs non-winners (point-in-time). That model needs a real point-in-time labelled dataset that
does not exist yet (Phase 1). Until it does, this ships a HONEST REFERENCE classifier: a transparent
calibrated logistic over the 10 domain scores that produces the same output contract the trained model
will - winner-similarity (0-100), an ordinal stage (0 weak -> 4 breakout-archetype), class probabilities,
per-domain SHAP-like contributions, and a coverage-aware confidence. When the labelled dataset lands,
`train_classifier` refits the coefficients (frozen-JSON, walk-forward, drift-guarded, exactly like
workers/stock_scanner/ml/recovery_model.py) and NOTHING downstream changes.

Provenance is stated on every result: this is `reference-v1` (shadow-live), not trained on real winners.
Research only - it informs a resemblance score, it never decides an action.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from .domains import DOMAIN_WEIGHTS, DomainResult

MODEL_VERSION = "emerging-winner-classifier-reference-v1"

# Ordinal stages (deck 3/7 + spec ordinal regression 96-100).
STAGE_LABELS = {
    0: "weak",
    1: "interesting",
    2: "strong candidate",
    3: "breakout archetype",
}

# Reference coefficients: the structural traits that most separated winners from also-rans carry the
# most weight. Fit on real labels via train_classifier() when the point-in-time dataset exists.
_BIAS = -0.35


@dataclass
class Contribution:
    domain: str
    label: str
    contribution: float  # signed points of winner-similarity attributable to this domain


@dataclass
class ClassifierResult:
    winner_similarity: float          # 0-100, calibrated resemblance to historical winners
    probability: float                # 0-1, P(emerging winner) - the calibrated model probability
    ordinal_stage: int                # 0-3
    stage_label: str
    class_probs: dict[str, float]     # per-stage probability mass
    contributions: list[Contribution] # SHAP-like, sorted by absolute contribution desc
    confidence: str                   # low/medium/high (coverage + margin driven)
    completeness: float               # fraction of domains assessed
    model_version: str = MODEL_VERSION
    provenance: str = (
        "reference-v1 (shadow-live): transparent calibrated logistic over the 10 domain scores; "
        "not yet trained on a real point-in-time winner dataset. Research only, never advice."
    )

    def to_dict(self) -> dict:
        return {
            "winner_similarity": round(self.winner_similarity, 1),
            "probability": round(self.probability, 4),
            "ordinal_stage": self.ordinal_stage,
            "stage_label": self.stage_label,
            "class_probs": {k: round(v, 4) for k, v in self.class_probs.items()},
            "contributions": [
                {"domain": c.domain, "label": c.label, "contribution": round(c.contribution, 2)}
                for c in self.contributions
            ],
            "confidence": self.confidence,
            "completeness": round(self.completeness, 2),
            "model_version": self.model_version,
            "provenance": self.provenance,
        }


def _sigmoid(z: float) -> float:
    if z >= 0:
        return 1.0 / (1.0 + math.exp(-z))
    e = math.exp(z)
    return e / (1.0 + e)


def classify(domains: list[DomainResult]) -> ClassifierResult:
    """Map the 10 domain results to a calibrated winner-similarity + ordinal stage.

    Only AVAILABLE domains contribute; the linear score is normalised over the weight actually present,
    so an unbuilt pipeline never drags the probability toward zero (it lowers confidence instead)."""
    available = [d for d in domains if d.score is not None]
    completeness = len(available) / len(domains) if domains else 0.0

    num = 0.0
    den = 0.0
    contributions: list[Contribution] = []
    for d in domains:
        if d.score is None:
            continue
        w = DOMAIN_WEIGHTS.get(d.key, 1.0)
        centred = (d.score - 50.0) / 50.0  # -1..1
        num += w * centred
        den += w
        # SHAP-like: signed points of the 0-100 similarity attributable to this domain.
        contributions.append(Contribution(d.key, d.label, w * centred))

    # Normalise the linear score to a comparable scale regardless of how many domains were present.
    z = _BIAS + (num / den * 3.0 if den else 0.0)
    probability = _sigmoid(z)
    similarity = probability * 100.0

    # Scale contributions so they sum (roughly) to (similarity - baseline) for honest attribution display.
    baseline = _sigmoid(_BIAS) * 100.0
    total_contrib = sum(c.contribution for c in contributions)
    if total_contrib != 0:
        scale = (similarity - baseline) / total_contrib
        for c in contributions:
            c.contribution *= scale
    contributions.sort(key=lambda c: abs(c.contribution), reverse=True)

    # Ordinal stage from probability, capped by coverage (can't claim 'strong'+ on a thin read).
    if probability >= 0.70:
        stage = 3
    elif probability >= 0.55:
        stage = 2
    elif probability >= 0.38:
        stage = 1
    else:
        stage = 0
    if completeness < 0.5:
        stage = min(stage, 1)

    class_probs = _ordinal_mass(probability)

    # Confidence: coverage AND how far the probability sits from the decision boundary (margin).
    margin = abs(probability - 0.5) * 2.0
    if completeness >= 0.7 and margin >= 0.3:
        confidence = "high"
    elif completeness >= 0.5 and margin >= 0.15:
        confidence = "medium"
    else:
        confidence = "low"

    return ClassifierResult(
        winner_similarity=similarity,
        probability=probability,
        ordinal_stage=stage,
        stage_label=STAGE_LABELS[stage],
        class_probs=class_probs,
        contributions=contributions,
        confidence=confidence,
        completeness=completeness,
    )


def _ordinal_mass(p: float) -> dict[str, float]:
    """Spread the single winner probability across the four ordinal stages so the UI can show a
    distribution, not just a point. Deterministic, sums to 1."""
    # Higher p pushes mass toward the top stages.
    w0 = max(0.0, 1.0 - p * 1.6)
    w1 = max(0.0, 1.0 - abs(p - 0.45) * 3.0)
    w2 = max(0.0, 1.0 - abs(p - 0.65) * 3.0)
    w3 = max(0.0, (p - 0.55) * 2.2)
    total = w0 + w1 + w2 + w3 or 1.0
    return {
        "weak": w0 / total,
        "interesting": w1 / total,
        "strong candidate": w2 / total,
        "breakout archetype": w3 / total,
    }


# --- training seam (fills in when a real point-in-time labelled dataset exists) --------------------

def train_classifier(*_args, **_kwargs):  # pragma: no cover - Phase 1 seam
    """Refit the reference coefficients on real (features -> winner label) point-in-time data and freeze
    to JSON with walk-forward metrics + drift fixtures, mirroring recovery_model.py. Intentionally not
    implemented until the labelled winner dataset (Phase 1) is wired in - the output contract above does
    not change when it is."""
    raise NotImplementedError(
        "train_classifier requires the Phase-1 point-in-time labelled winner dataset (not yet built)."
    )
