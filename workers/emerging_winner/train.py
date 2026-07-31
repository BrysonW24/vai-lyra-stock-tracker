"""
Trainer for the Emerging Winner Classifier (Model 2 / Gate 2) - Phase 2 of the model lifecycle.

Mirrors `workers/stock_scanner/ml/recovery_model.py` EXACTLY in shape (train -> walk-forward -> freeze to
JSON + drift fixtures), and REUSES its stdlib learning machinery (`fit_logistic`, `_standardization`,
`auc`, `brier`) per the spec's reuse map - do not rebuild the model machinery, swap the estimator + data.

What it trains: a calibrated logistic over the 10 domain scores + completeness (11 features). The champion
in the deck is a CatBoost/LightGBM ordinal classifier; the lifecycle (dataset -> train -> walk-forward ->
freeze -> deploy -> monitor -> infer) is IDENTICAL for that estimator - when it is added, only `fit`/`predict`
change; the export format, the drift fixtures, the deploy loader and the inference contract do not.

Validation is rare-positive aware (spec §8): not a single AUC, but out-of-sample precision@k, lift over the
base rate, calibration reliability, plus AUC/Brier for reference. Runs dependency-free, in CI.

    python -m workers.emerging_winner.train        # bootstrap-train + export the frozen artifact

Research only - it informs a resemblance probability, it never decides an action.
"""
from __future__ import annotations

import json
import os
from typing import Optional

from ..stock_scanner.ml.recovery_model import _standardization, auc, brier, fit_logistic
from .dataset import FEATURE_ORDER, load_training_dataset

MODEL_VERSION = "emerging-winner-classifier-trained-v1"
TRAINED_AT = "2026-07-31"   # fixed for reproducibility; coefficients never depend on it
ARTIFACT_VERSION = 1

# The model's full feature order: the 10 domains + the completeness scalar (centred at 0.5 at export).
FEATURE_ORDER_MODEL: list[str] = FEATURE_ORDER + ["completeness"]

DEFAULT_OUT = os.path.join(
    os.path.dirname(__file__), "..", "..", "src", "lib", "generated", "emerging-winner-model.json"
)


def _sigmoid(z: float) -> float:
    import math
    if z >= 0:
        return 1.0 / (1.0 + math.exp(-z))
    e = math.exp(z)
    return e / (1.0 + e)


def to_model_vector(domain_feats: list[float], completeness: float) -> list[float]:
    """10 centred domain features + the centred completeness scalar -> the 11-feature model input."""
    return list(domain_feats) + [completeness - 0.5]


def _predict(mean: list[float], std: list[float], w: list[float], b: float, x: list[float]) -> float:
    xs = [(x[i] - mean[i]) / (std[i] or 1.0) for i in range(len(x))]
    return _sigmoid(b + sum(wi * xi for wi, xi in zip(w, xs)))


# --- rare-positive validation metrics (spec §8) ---------------------------------------------------

def precision_at_k(y: list[int], p: list[float], k_frac: float = 0.05) -> tuple[float, int]:
    """Precision among the top k_frac highest-probability names - 'of my top picks, how many ran'."""
    if not y:
        return 0.0, 0
    k = max(1, int(len(y) * k_frac))
    top = sorted(range(len(y)), key=lambda i: p[i], reverse=True)[:k]
    hits = sum(y[i] for i in top)
    return hits / k, k


def calibration_bins(y: list[int], p: list[float], bins: int = 10) -> list[dict]:
    """Reliability curve: predicted probability vs realised winner rate, per probability bin."""
    buckets: list[list[int]] = [[] for _ in range(bins)]
    preds: list[list[float]] = [[] for _ in range(bins)]
    for yi, pi in zip(y, p):
        b = min(bins - 1, int(pi * bins))
        buckets[b].append(yi)
        preds[b].append(pi)
    out = []
    for b in range(bins):
        n = len(buckets[b])
        if n == 0:
            continue
        out.append({
            "bin": round((b + 0.5) / bins, 3),
            "predicted": round(sum(preds[b]) / n, 4),
            "actual": round(sum(buckets[b]) / n, 4),
            "n": n,
        })
    return out


def walk_forward_metrics(X: list[list[float]], y: list[int], folds: int = 5, k_frac: float = 0.05) -> dict:
    """Time-ordered walk-forward: train on prior folds, test on the next. Out-of-sample only. Reports the
    rare-positive metrics (precision@k, lift) alongside AUC/Brier."""
    n = len(X)
    fold_size = max(1, n // folds)
    oos_y: list[int] = []
    oos_p: list[float] = []
    baseline_p: list[float] = []
    for f in range(1, folds):
        train_end = f * fold_size
        test_end = (f + 1) * fold_size if f < folds - 1 else n
        Xtr, ytr = X[:train_end], y[:train_end]
        Xte, yte = X[train_end:test_end], y[train_end:test_end]
        if not Xte or sum(ytr) == 0:
            continue
        mean, std = _standardization(Xtr)
        w, b = fit_logistic(Xtr, ytr, mean, std)
        base_rate = sum(ytr) / len(ytr)
        for feats, label in zip(Xte, yte):
            oos_p.append(_predict(mean, std, w, b, feats))
            oos_y.append(label)
            baseline_p.append(base_rate)
    if not oos_y:
        return {"n_oos": 0, "note": "insufficient positives for walk-forward"}
    prec_k, k = precision_at_k(oos_y, oos_p, k_frac)
    base = sum(oos_y) / len(oos_y)
    return {
        "oos_auc": round(auc(oos_y, oos_p), 4),
        "oos_brier": round(brier(oos_y, oos_p), 4),
        "baseline_brier": round(brier(oos_y, baseline_p), 4),
        "base_rate": round(base, 4),
        "precision_at_k": round(prec_k, 4),
        "lift_at_k": round(prec_k / base, 3) if base > 0 else None,
        "k_frac": k_frac,
        "k": k,
        "calibration": calibration_bins(oos_y, oos_p),
        "n_oos": len(oos_y),
    }


# --- train + export the frozen champion artifact --------------------------------------------------

def _build_model_matrix(ds: dict) -> tuple[list[list[float]], list[int]]:
    X = [to_model_vector(feats, comp) for feats, comp in zip(ds["X"], ds["completeness"])]
    return X, ds["y"]


def train_and_export(
    out_path: str = DEFAULT_OUT,
    predictions: Optional[list[dict]] = None,
    outcomes: Optional[list[dict]] = None,
    seed: int = 42,
    n_bootstrap: int = 6000,
    folds: int = 5,
) -> dict:
    """Train the classifier on the current dataset (real ledger rows if matured, else bootstrap), backtest
    walk-forward, fit the final model on all data, and freeze to JSON with drift fixtures."""
    ds = load_training_dataset(predictions, outcomes, n_bootstrap=n_bootstrap, seed=seed)
    X, y = _build_model_matrix(ds)
    metrics = walk_forward_metrics(X, y, folds=folds)

    mean, std = _standardization(X)
    w, b = fit_logistic(X, y, mean, std)

    # Drift-guard fixtures: domain-score inputs -> probability, re-checked by the classifier's trained path.
    import random
    fixtures = []
    for fs in [7, 99, 123, 512, 2026, 31, 8, 404, 61, 777]:
        rng = random.Random(fs)
        scores: list[Optional[float]] = []
        feats10: list[float] = []
        present = 0
        for _ in FEATURE_ORDER:
            if rng.random() < 0.25:
                scores.append(None)
                feats10.append(0.0)
            else:
                s = round(rng.uniform(0, 100), 1)
                scores.append(s)
                feats10.append((s - 50.0) / 50.0)
                present += 1
        completeness = present / len(FEATURE_ORDER)
        vec = to_model_vector(feats10, completeness)
        fixtures.append({
            "scores": scores,
            "completeness": round(completeness, 4),
            "probability": round(_predict(mean, std, w, b, vec), 8),
        })

    payload = {
        "version": ARTIFACT_VERSION,
        "modelVersion": MODEL_VERSION,
        "trainedAt": TRAINED_AT,
        "algorithm": "logistic-regression (stdlib GD, L2) over 10 domain scores + completeness",
        "featureOrder": FEATURE_ORDER_MODEL,
        "mean": [round(m, 8) for m in mean],
        "std": [round(s, 8) for s in std],
        "weights": [round(wi, 8) for wi in w],
        "bias": round(b, 8),
        "metrics": metrics,
        "dataset": {"source": ds["source"], "n": ds["n"], "provenance": ds["provenance"]},
        "training": {"seed": seed, "n_bootstrap": n_bootstrap, "folds": folds},
        "champion": True,
        "provenance": (
            f"Trained via the emerging-winner lifecycle on the '{ds['source']}' dataset. Mirrors "
            "recovery_model.py (stdlib logistic, walk-forward, frozen JSON, drift fixtures). The deck's "
            "CatBoost/LightGBM ordinal classifier is a drop-in that keeps this exact export + inference "
            "contract. Research only - informs a resemblance probability, never decides an action."
        ),
        "fixtures": fixtures,
    }

    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(os.path.abspath(out_path), "w") as fh:
        json.dump(payload, fh, indent=2)
        fh.write("\n")
    return payload


if __name__ == "__main__":
    result = train_and_export()
    m = result["metrics"]
    print(
        f"emerging-winner-model: source={result['dataset']['source']} n={result['dataset']['n']} | "
        f"OOS AUC {m.get('oos_auc')} | precision@k {m.get('precision_at_k')} "
        f"(lift {m.get('lift_at_k')}x over base {m.get('base_rate')}) | n_oos {m.get('n_oos')}"
    )
    print(f"emerging-winner-model: exported {len(result['fixtures'])} drift fixtures -> src/lib/generated/emerging-winner-model.json")
