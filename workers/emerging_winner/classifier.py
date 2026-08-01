"""
Model 2 - the Emerging Winner Classifier (ordinal winner-stage + calibrated similarity).

Two-path inference, one output contract:
  - TRAINED path (champion): if the frozen artifact `src/lib/generated/emerging-winner-model.json` exists,
    inference uses its learned logistic over the 10 domain scores + completeness. This is the deployed
    model; it is produced by the lifecycle in `train.py` (dataset -> walk-forward -> freeze) and stamped
    with its dataset provenance (bootstrap-synthetic until real ledger outcomes mature, then point-in-time).
  - REFERENCE path (fallback): if no artifact is present, a transparent hand-designed calibrated logistic
    over the 10 domain scores (DOMAIN_WEIGHTS + _BIAS) - so the surface always renders honestly.

Either way the output is identical (winner-similarity 0-100, ordinal stage 0-3, class probabilities,
per-domain SHAP-like contributions, coverage-aware confidence) and `provenance` states exactly which
path + dataset produced it. The deck's CatBoost/LightGBM ordinal classifier is a drop-in that keeps this
contract - only the frozen artifact's estimator changes.

Research only - it informs a resemblance score, it never decides an action.
"""
from __future__ import annotations

import json
import math
import os
from dataclasses import dataclass
from typing import Optional

from .dataset import FEATURE_ORDER
from .domains import DOMAIN_WEIGHTS, DomainResult

MODEL_VERSION = "emerging-winner-classifier-reference-v1"

# Ordinal stages (deck 3/7 + spec ordinal regression 96-100).
STAGE_LABELS = {
    0: "weak",
    1: "interesting",
    2: "strong candidate",
    3: "breakout archetype",
}

# Reference coefficients (fallback path): the structural traits that most separated winners from also-rans
# carry the most weight. Superseded by the trained artifact when it exists.
_BIAS = -0.35

_ARTIFACT_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "src", "lib", "generated", "emerging-winner-model.json"
)


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


# --- deployment: load the champion artifact -------------------------------------------------------

@dataclass
class TrainedModel:
    feature_order: list[str]
    model_version: str
    dataset_source: str
    provenance: str
    # Estimator dispatch (the deck's swap seam, real since 2026-08-01): "logistic" carries
    # mean/std/weights/bias; "boosted_stumps" carries the frozen tree ensemble in `boost`.
    estimator: str = "logistic"
    mean: Optional[list[float]] = None
    std: Optional[list[float]] = None
    weights: Optional[list[float]] = None
    bias: float = 0.0
    boost: Optional[dict] = None
    # Optional post-hoc probability calibration carried BY THE ARTIFACT (absent = identity, all
    # existing artifacts unchanged). Motivated by the gen-2 weak-calibration finding: recalibration
    # slope 0.755 CI90 [0.57, 0.98] - the spread is mildly overconfident. A slope correction is a
    # gen-3 candidate that must EARN its way in through the standing loop; this seam only makes
    # that evaluation a data decision instead of a code fork. {"slope": s, "intercept": a} applied
    # as sigmoid(a + s * logit(p_raw)).
    calibration: Optional[dict] = None


_CHAMPION: Optional[TrainedModel] = None
_CHAMPION_LOADED = False


def _read_model(path: str) -> Optional[TrainedModel]:
    """Read a frozen artifact from disk into a TrainedModel, or None if absent/malformed. Dispatches
    on estimatorType (absent = the original logistic schema, fully backwards-compatible)."""
    try:
        with open(os.path.abspath(path)) as fh:
            data = json.load(fh)
        estimator = data.get("estimatorType", "logistic")
        common = {
            "feature_order": data["featureOrder"],
            "model_version": data.get("modelVersion", "trained"),
            "dataset_source": data.get("dataset", {}).get("source", "unknown"),
            "provenance": data.get("provenance", ""),
            "estimator": estimator,
        }
        cal = data.get("probabilityCalibration")
        if cal is not None:
            if (not isinstance(cal, dict) or cal.get("type") != "logit_linear"
                    or not isinstance(cal.get("slope"), (int, float))
                    or not isinstance(cal.get("intercept"), (int, float))
                    or cal["slope"] <= 0):
                return None  # a malformed calibration block must never silently serve raw probabilities
            common["calibration"] = {"slope": float(cal["slope"]), "intercept": float(cal["intercept"])}
        if estimator == "boosted_stumps":
            boost = data["boost"]
            if not isinstance(boost, dict) or "trees" not in boost:
                return None
            return TrainedModel(boost=boost, **common)
        return TrainedModel(
            mean=data["mean"], std=data["std"], weights=data["weights"], bias=data["bias"],
            **common,
        )
    except (OSError, KeyError, ValueError, json.JSONDecodeError):
        return None


def load_champion_model(path: Optional[str] = None) -> Optional[TrainedModel]:
    """The deployed champion artifact, or None (reference fallback) if absent/malformed. An EXPLICIT path
    loads fresh + uncached (for monitoring a specific artifact or tests); the default champion (module
    constant or the EMERGING_WINNER_MODEL_PATH env override) is cached for the inference hot path."""
    global _CHAMPION, _CHAMPION_LOADED
    if path is not None:
        return _read_model(path)
    if _CHAMPION_LOADED:
        return _CHAMPION
    _CHAMPION_LOADED = True
    _CHAMPION = _read_model(os.getenv("EMERGING_WINNER_MODEL_PATH") or _ARTIFACT_PATH)
    return _CHAMPION


def reset_model_cache() -> None:
    """Test seam: force the next classify() to re-read the artifact from disk."""
    global _CHAMPION, _CHAMPION_LOADED
    _CHAMPION, _CHAMPION_LOADED = None, False


def _predict_trained(model: TrainedModel, x: list[float]) -> float:
    if model.estimator == "boosted_stumps" and model.boost is not None:
        from .stump_boost import predict_boosted

        p = predict_boosted(model.boost, x)
    else:
        xs = [(x[i] - model.mean[i]) / (model.std[i] or 1.0) for i in range(len(x))]
        p = _sigmoid(model.bias + sum(w * xi for w, xi in zip(model.weights, xs)))
    return _apply_calibration(model, p)


def _apply_calibration(model: TrainedModel, p: float) -> float:
    """Artifact-carried logit-linear recalibration; identity when the artifact carries none.
    Monotone by construction (slope > 0 is enforced at load), so rankings are untouched - only the
    probability SPREAD changes, which is exactly what the slope-0.755 finding calls for."""
    if model.calibration is None:
        return p
    import math

    eps = 1e-9
    p = max(eps, min(1 - eps, p))
    z = math.log(p / (1 - p))
    return _sigmoid(model.calibration["intercept"] + model.calibration["slope"] * z)


# --- inference dispatcher -------------------------------------------------------------------------

def classify(domains: list[DomainResult]) -> ClassifierResult:
    """Map the 10 domain results to a calibrated winner-similarity + ordinal stage, using the trained
    champion artifact when present, else the transparent reference model. Same contract either way."""
    model = load_champion_model()
    if model is not None:
        return _classify_trained(domains, model)
    return _classify_reference(domains)


def _classify_trained(domains: list[DomainResult], model: TrainedModel) -> ClassifierResult:
    by_key = {d.key: d for d in domains}
    feats: list[float] = []
    present = 0
    labels: list[str] = []
    for key in FEATURE_ORDER:
        d = by_key.get(key)
        labels.append(d.label if d else key)
        if d is not None and d.score is not None:
            feats.append((d.score - 50.0) / 50.0)
            present += 1
        else:
            feats.append(0.0)
    completeness = present / len(FEATURE_ORDER) if FEATURE_ORDER else 0.0
    x = feats + [completeness - 0.5]

    probability = _predict_trained(model, x)
    similarity = probability * 100.0
    baseline = _sigmoid(model.bias) * 100.0

    # SHAP-like per-domain contributions (10 domains only): standardized feature x learned weight for
    # the logistic; summed per-feature tree steps for boosted stumps - every estimator that takes a
    # seat owes the surface a per-name explanation.
    contributions: list[Contribution] = []
    if model.estimator == "boosted_stumps" and model.boost is not None:
        from .stump_boost import feature_contributions

        contribs = feature_contributions(model.boost, x)
        for i, key in enumerate(FEATURE_ORDER):
            d = by_key.get(key)
            if d is None or d.score is None:
                continue
            contributions.append(Contribution(key, labels[i], contribs[i] if i < len(contribs) else 0.0))
    else:
        for i, key in enumerate(FEATURE_ORDER):
            d = by_key.get(key)
            if d is None or d.score is None:
                continue
            xs = (x[i] - model.mean[i]) / (model.std[i] or 1.0)
            contributions.append(Contribution(key, labels[i], model.weights[i] * xs))

    provenance = (
        f"{model.model_version} (shadow-live, dataset={model.dataset_source}): learned logistic over the "
        "10 domain scores + completeness. Research only, never advice."
    )
    return _assemble_result(probability, completeness, similarity, baseline, contributions,
                            model.model_version, provenance)


def _classify_reference(domains: list[DomainResult]) -> ClassifierResult:
    """Transparent hand-designed fallback (no artifact). Only AVAILABLE domains contribute; the linear score
    is normalised over the weight actually present, so an unbuilt pipeline lowers confidence, not probability."""
    num = 0.0
    den = 0.0
    contributions: list[Contribution] = []
    present = 0
    for d in domains:
        if d.score is None:
            continue
        present += 1
        w = DOMAIN_WEIGHTS.get(d.key, 1.0)
        centred = (d.score - 50.0) / 50.0  # -1..1
        num += w * centred
        den += w
        contributions.append(Contribution(d.key, d.label, w * centred))
    completeness = present / len(domains) if domains else 0.0

    z = _BIAS + (num / den * 3.0 if den else 0.0)
    probability = _sigmoid(z)
    similarity = probability * 100.0
    baseline = _sigmoid(_BIAS) * 100.0
    return _assemble_result(probability, completeness, similarity, baseline, contributions,
                            MODEL_VERSION, ClassifierResult.provenance)


def _assemble_result(
    probability: float,
    completeness: float,
    similarity: float,
    baseline: float,
    contributions: list[Contribution],
    model_version: str,
    provenance: str,
) -> ClassifierResult:
    """Shared tail: scale contributions for honest attribution, derive stage/confidence/class-probs."""
    total_contrib = sum(c.contribution for c in contributions)
    if total_contrib != 0:
        scale = (similarity - baseline) / total_contrib
        for c in contributions:
            c.contribution *= scale
    contributions.sort(key=lambda c: abs(c.contribution), reverse=True)

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
        class_probs=_ordinal_mass(probability),
        contributions=contributions,
        confidence=confidence,
        completeness=completeness,
        model_version=model_version,
        provenance=provenance,
    )


def _ordinal_mass(p: float) -> dict[str, float]:
    """Spread the single winner probability across the four ordinal stages so the UI can show a
    distribution, not just a point. Deterministic, sums to 1."""
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


# --- training seam (Phase 2 lifecycle) ------------------------------------------------------------

def train_classifier(**kwargs) -> dict:
    """Train + freeze the champion artifact via the lifecycle in train.py (real ledger rows if enough
    outcomes have matured, else the reproducible bootstrap). Returns the export payload. After training,
    call reset_model_cache() so the next classify() picks up the new champion."""
    from .train import train_and_export
    payload = train_and_export(**kwargs)
    reset_model_cache()
    return payload
