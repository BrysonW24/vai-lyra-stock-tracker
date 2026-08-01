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
from .dataset import FEATURE_ORDER, HORIZON_TRADING_DAYS, load_training_dataset

MODEL_VERSION = "emerging-winner-classifier-trained-v1"
TRAINED_AT = "2026-07-31"   # fixed for reproducibility; coefficients never depend on it
ARTIFACT_VERSION = 1

# Purge/embargo (López de Prado, AFML Ch. 7). The label horizon is 12 months, so a training row whose
# barrier window reaches into a test fold shares outcome information with it and must be dropped. Embargo
# is a further guard band before the test fold against serial-correlation leakage.
#
# UNITS MATTER (2026-08-01 adversarial-review fix): the row timestamps used for purging are CALENDAR
# ordinals (dataset.predicted_at_ordinal -> date.toordinal()), so the purge horizon must be calendar
# days too. The label window is 252 TRADING days ~= 365 calendar days (longer for thinly-traded names
# whose 252 bars stretch further); comparing 252 against calendar ordinals under-purged by ~100 days
# and let ~one quarterly cohort per fold train with label windows still open inside the test fold.
EMBARGO_TRADING_DAYS = 10                 # retained for callers that pass bar-index timelines
PURGE_HORIZON_CALENDAR_DAYS = 430         # 252 trading days + weekends/holidays + thin-trader margin
PURGE_EMBARGO_CALENDAR_DAYS = 15

# Pre-publish floor gate: a freshly trained model must clear these before it is allowed to overwrite the
# champion artifact, so a bad retrain fails loudly instead of shipping silently.
FLOOR_MIN_AUC = 0.55
FLOOR_MIN_LIFT = 1.5
FLOOR_REGRESSION_TOL = 0.05   # allowed slip vs the incumbent champion's stored metrics before it's a block


class ModelFloorError(RuntimeError):
    """A freshly trained model failed the pre-publish floor and would have overwritten the champion."""

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


def fit_estimator(estimator: str, X: list[list[float]], y: list[int],
                  estimator_params: Optional[dict] = None):
    """The one seam the deck promised: swap the estimator, keep the lifecycle. Returns
    (params_for_artifact, predict_fn). 'logistic' is the incumbent family; 'boosted_stumps' is the
    first nonlinear challenger family (pure stdlib gradient boosting over depth-1 trees).
    `estimator_params` are family hyperparameters (boosted only - the logistic has no knobs, and
    passing params for it is an error rather than a silent ignore); they are recorded in the
    artifact so every frozen model states exactly how it was fit."""
    if estimator == "boosted_stumps":
        from .stump_boost import fit_boosted_stumps, predict_boosted

        model = fit_boosted_stumps(X, y, **(estimator_params or {}))
        out = {"estimatorType": "boosted_stumps", "boost": model}
        if estimator_params:
            out["estimatorParams"] = dict(sorted(estimator_params.items()))
        return out, (lambda x, _m=model: predict_boosted(_m, x))
    if estimator_params:
        raise ValueError("estimator_params are only valid for the boosted family - the logistic has no knobs")
    mean, std = _standardization(X)
    w, b = fit_logistic(X, y, mean, std)
    params = {
        "estimatorType": "logistic",
        "mean": [round(m, 8) for m in mean],
        "std": [round(s, 8) for s in std],
        "weights": [round(wi, 8) for wi in w],
        "bias": round(b, 8),
    }
    return params, (lambda x, _mn=mean, _sd=std, _w=w, _b=b: _predict(_mn, _sd, _w, _b, x))


# --- rare-positive validation metrics (spec §8) ---------------------------------------------------

def precision_at_k(y: list[int], p: list[float], k_frac: float = 0.05) -> tuple[float, int]:
    """Precision among the top k_frac highest-probability names - 'of my top picks, how many ran'."""
    if not y:
        return 0.0, 0
    k = max(1, int(len(y) * k_frac))
    top = sorted(range(len(y)), key=lambda i: p[i], reverse=True)[:k]
    hits = sum(y[i] for i in top)
    return hits / k, k


def precision_at_k_by_cohort(y: list[int], p: list[float], cohorts: list, k_frac: float = 0.05) -> dict:
    """Per-cohort precision@k - the product question is 'of my top picks THAT QUARTER, how many ran', not
    'across all history pooled'. Pooling flatters: a model that ranks a good year above a bad one globally
    scores well while being useless quarter by quarter. Report the distribution + the WORST cohort, which is
    the number that decides whether to surface. Cohorts are scoring quarters (real ledger) or folds (bootstrap)."""
    groups: dict = {}
    for yi, pi, c in zip(y, p, cohorts):
        gy, gp = groups.setdefault(str(c), ([], []))
        gy.append(yi)
        gp.append(pi)
    per: list[dict] = []
    for c in sorted(groups):
        gy, gp = groups[c]
        prec, k = precision_at_k(gy, gp, k_frac)
        per.append({
            "cohort": c, "precision_at_k": round(prec, 4), "k": k, "n": len(gy),
            "base_rate": round(sum(gy) / len(gy), 4) if gy else 0.0,
        })
    if not per:
        return {"n_cohorts": 0, "per_cohort": []}
    precs = sorted(pc["precision_at_k"] for pc in per)
    m = len(precs)
    median = precs[m // 2] if m % 2 else (precs[m // 2 - 1] + precs[m // 2]) / 2
    worst = min(per, key=lambda pc: pc["precision_at_k"])
    return {
        "n_cohorts": m,
        "mean": round(sum(precs) / m, 4),
        "median": round(median, 4),
        "worst": worst["precision_at_k"],
        "worst_cohort": worst["cohort"],
        "per_cohort": per,
    }


def average_precision(y: list[int], p: list[float]) -> float:
    """Average precision (area under the precision-recall curve) - the right PRIMARY discrimination metric
    under extreme class imbalance. ROC-AUC stays flatteringly high because the huge negative class dominates
    the false-positive-rate denominator (Saito & Rehmsmeier, PLOS ONE 2015). AP = mean precision at the rank
    of each true positive."""
    pos = sum(y)
    if pos == 0:
        return 0.0
    order = sorted(range(len(y)), key=lambda i: p[i], reverse=True)
    hits = 0
    seen = 0
    ap = 0.0
    for i in order:
        seen += 1
        if y[i] == 1:
            hits += 1
            ap += hits / seen
    return ap / pos


def calibration_bins(y: list[int], p: list[float], bins: int = 10) -> list[dict]:
    """Reliability curve with EQUAL-MASS (quantile) bins: predicted probability vs realised winner rate.

    Equal-mass, not equal-width: at a 2-4% base rate almost every predicted probability clusters near zero,
    so equal-width `int(p * bins)` binning piles nearly all mass into bin 0 and leaves the upper bins empty
    and noisy - which makes ECE look better than it is. Quantile bins put ~equal counts per bin, so every
    bin is informative (adaptive ECE)."""
    n = len(y)
    if n == 0:
        return []
    order = sorted(range(n), key=lambda i: p[i])
    nb = min(bins, n)
    out = []
    for b in range(nb):
        lo = (b * n) // nb
        hi = ((b + 1) * n) // nb
        idx = order[lo:hi]
        if not idx:
            continue
        m = len(idx)
        out.append({
            "bin": round((b + 0.5) / nb, 3),
            "predicted": round(sum(p[i] for i in idx) / m, 4),
            "actual": round(sum(y[i] for i in idx) / m, 4),
            "n": m,
        })
    return out


def expected_calibration_error(y: list[int], p: list[float], bins: int = 10) -> float:
    """Adaptive (equal-mass) ECE: sum over quantile bins of (n_b / N) * |mean predicted - realised rate|."""
    calib = calibration_bins(y, p, bins)
    n = sum(b["n"] for b in calib) or 1
    return sum(abs(b["predicted"] - b["actual"]) * b["n"] for b in calib) / n


def _purged_train_indices(times: list[float], train_end: int, horizon: float, embargo: float) -> list[int]:
    """Indices in [0, train_end) whose label window closes before the test fold opens (purge + embargo).

    The test fold begins at boundary time t_b = times[train_end]. A training row at t_i carries a label that
    matures at t_i + horizon; if that reaches the test window it shares outcome information with the test
    fold and leaks (López de Prado, AFML Ch. 7). Embargo widens the drop by a further guard band. Assumes
    `times` is sorted ascending."""
    t_b = times[train_end]
    return [i for i in range(train_end) if times[i] + horizon + embargo <= t_b]


def walk_forward_metrics(
    X: list[list[float]],
    y: list[int],
    folds: int = 5,
    k_frac: float = 0.05,
    times: Optional[list[float]] = None,
    cohorts: Optional[list] = None,
    horizon: float = PURGE_HORIZON_CALENDAR_DAYS,
    embargo: float = PURGE_EMBARGO_CALENDAR_DAYS,
    estimator: str = "logistic",
    estimator_params: Optional[dict] = None,
) -> dict:
    """Walk-forward: train on prior folds, test on the next; out-of-sample only. When real timestamps are
    supplied (`times` - CALENDAR ordinals from predicted_at) the split is PURGED + EMBARGOED so a 12-month
    label window can never leak across the fold boundary; the defaults are CALENDAR-day spans matching the
    timestamp units (the old trading-day defaults under-purged - see PURGE_HORIZON_CALENDAR_DAYS). The
    i.i.d. bootstrap has no timeline, so it runs index-ordered with purge correctly a no-op. Reports the
    rare-positive family - PR-AUC (primary), per-cohort precision@k (worst cohort gates surfacing), lift,
    adaptive ECE - with ROC-AUC/Brier as reference."""
    n = len(X)
    if n == 0:
        return {"n_oos": 0, "note": "empty dataset"}
    # Purge/embargo need a reliable clock; enable only when every row carries a timestamp.
    purge = times is not None and len(times) == n and all(t is not None for t in times)
    idx = sorted(range(n), key=lambda i: times[i]) if purge else list(range(n))
    Xs = [X[i] for i in idx]
    ys = [y[i] for i in idx]
    ts = [times[i] for i in idx] if purge else None
    cs = [cohorts[i] for i in idx] if (cohorts is not None and len(cohorts) == n) else None

    fold_size = max(1, n // folds)
    oos_y: list[int] = []
    oos_p: list[float] = []
    oos_cohort: list = []
    baseline_p: list[float] = []
    n_purged = 0
    for f in range(1, folds):
        train_end = f * fold_size
        test_end = (f + 1) * fold_size if f < folds - 1 else n
        keep = _purged_train_indices(ts, train_end, horizon, embargo) if purge else list(range(train_end))
        n_purged += train_end - len(keep)
        Xtr = [Xs[i] for i in keep]
        ytr = [ys[i] for i in keep]
        Xte, yte = Xs[train_end:test_end], ys[train_end:test_end]
        if not Xte or not Xtr or sum(ytr) == 0:
            continue
        _params, predict_fn = fit_estimator(estimator, Xtr, ytr, estimator_params)
        base_rate = sum(ytr) / len(ytr)
        for j in range(train_end, test_end):
            oos_p.append(predict_fn(Xs[j]))
            oos_y.append(ys[j])
            baseline_p.append(base_rate)
            oos_cohort.append(cs[j] if cs is not None else f"fold{f}")
    if not oos_y:
        return {"n_oos": 0, "note": "insufficient positives for walk-forward"}
    prec_k, k = precision_at_k(oos_y, oos_p, k_frac)
    base = sum(oos_y) / len(oos_y)
    return {
        "oos_pr_auc": round(average_precision(oos_y, oos_p), 4),   # PRIMARY discrimination under imbalance
        "oos_auc": round(auc(oos_y, oos_p), 4),                    # ROC-AUC - reference only (flatters here)
        "oos_brier": round(brier(oos_y, oos_p), 4),
        "baseline_brier": round(brier(oos_y, baseline_p), 4),
        "ece": round(expected_calibration_error(oos_y, oos_p), 4),  # adaptive (equal-mass) ECE
        "base_rate": round(base, 4),
        "precision_at_k": round(prec_k, 4),                        # pooled - reference
        "lift_at_k": round(prec_k / base, 3) if base > 0 else None,
        "precision_at_k_by_cohort": precision_at_k_by_cohort(oos_y, oos_p, oos_cohort, k_frac),  # PRIMARY
        "k_frac": k_frac,
        "k": k,
        "calibration": calibration_bins(oos_y, oos_p),
        "purge": {"applied": purge, "n_dropped": n_purged, "horizon": horizon, "embargo": embargo},
        "n_oos": len(oos_y),
    }


# --- train + export the frozen champion artifact --------------------------------------------------

def _build_model_matrix(ds: dict) -> tuple[list[list[float]], list[int]]:
    X = [to_model_vector(feats, comp) for feats, comp in zip(ds["X"], ds["completeness"])]
    return X, ds["y"]


def _fixture_from_scores(scores: list, predict_fn, kind: str) -> dict:
    """One drift fixture: raw domain scores (None = unavailable) -> the exact probability the deployed
    classifier must reproduce. Built through the same impute/completeness/vector path the classifier
    uses; estimator-agnostic (the fixture pins whatever predict_fn the artifact freezes)."""
    feats: list[float] = []
    present = 0
    for s in scores:
        if s is None:
            feats.append(0.0)
        else:
            feats.append((float(s) - 50.0) / 50.0)
            present += 1
    completeness = present / len(FEATURE_ORDER)
    vec = to_model_vector(feats, completeness)
    return {
        "scores": scores,
        "completeness": round(completeness, 4),
        "probability": round(predict_fn(vec), 8),
        "kind": kind,
    }


def _random_fixtures(predict_fn) -> list[dict]:
    """Ten seeded random fixtures across the input space (~25% domains missing, matching coverage reality)."""
    import random
    out = []
    for fs in [7, 99, 123, 512, 2026, 31, 8, 404, 61, 777]:
        rng = random.Random(fs)
        scores = [None if rng.random() < 0.25 else round(rng.uniform(0, 100), 1) for _ in FEATURE_ORDER]
        out.append(_fixture_from_scores(scores, predict_fn, "random"))
    return out


def _boundary_fixtures(predict_fn) -> list[dict]:
    """Engineered CORNER fixtures - extremes + coverage transitions - not just random rows. Random sampling
    essentially never lands on a boundary, so a guard built only from random rows can pass while a real
    boundary bug ships. This pins the logistic's input corners now; when the estimator becomes a tree
    ensemble these are the seam where near-split-threshold rows are added (MODEL-BUILD-TRAIN-HOST.md §5.4)."""
    d = len(FEATURE_ORDER)
    half = d // 2
    corners: list[list] = [
        [None] * d,                              # nothing known -> completeness 0
        [0.0] * d,                               # every domain at the floor
        [50.0] * d,                              # every domain exactly neutral (all features 0)
        [100.0] * d,                             # every domain at the ceiling
        [100.0] * half + [None] * (d - half),    # half present + maxed, half missing (coverage boundary)
        [100.0] + [None] * (d - 1),              # a single strong domain, rest missing (thin read)
        [0.0] + [None] * (d - 1),                # a single weak domain, rest missing
    ]
    return [_fixture_from_scores(c, predict_fn, "boundary") for c in corners]


def _floor_reasons(
    metrics: dict, incumbent: Optional[dict], min_auc: float, min_lift: float,
    max_ece: Optional[float], regression_tol: float,
) -> list[str]:
    """Why a freshly trained model may NOT overwrite the champion: absolute floor + no material regression
    vs the incumbent's stored metrics. Empty list == cleared to publish."""
    reasons: list[str] = []
    auc_v = metrics.get("oos_auc")
    lift_v = metrics.get("lift_at_k")
    ece_v = metrics.get("ece")
    if auc_v is None or auc_v < min_auc:
        reasons.append(f"oos_auc {auc_v} < floor {min_auc}")
    if lift_v is None or lift_v < min_lift:
        reasons.append(f"lift_at_k {lift_v} < floor {min_lift}")
    if max_ece is not None and (ece_v is None or ece_v > max_ece):
        reasons.append(f"ece {ece_v} > ceiling {max_ece}")
    inc_m = (incumbent or {}).get("metrics") or {}
    if auc_v is not None and inc_m.get("oos_auc") is not None and auc_v < inc_m["oos_auc"] - regression_tol:
        reasons.append(f"oos_auc {auc_v} regressed vs champion {inc_m['oos_auc']} (tol {regression_tol})")
    if lift_v is not None and inc_m.get("lift_at_k") is not None and lift_v < inc_m["lift_at_k"] - regression_tol:
        reasons.append(f"lift_at_k {lift_v} regressed vs champion {inc_m['lift_at_k']} (tol {regression_tol})")
    return reasons


def train_and_export(
    out_path: str = DEFAULT_OUT,
    predictions: Optional[list[dict]] = None,
    outcomes: Optional[list[dict]] = None,
    seed: int = 42,
    n_bootstrap: int = 6000,
    folds: int = 5,
    min_auc: float = FLOOR_MIN_AUC,
    min_lift: float = FLOOR_MIN_LIFT,
    max_ece: Optional[float] = None,
    regression_tol: float = FLOOR_REGRESSION_TOL,
    force: bool = False,
    source_label: Optional[str] = None,
    provenance_note: Optional[str] = None,
    model_version: Optional[str] = None,
    trained_at: Optional[str] = None,
    estimator: str = "logistic",
    estimator_params: Optional[dict] = None,
) -> dict:
    """Train the classifier on the current dataset (real ledger rows if matured, else bootstrap), backtest
    with a PURGED + EMBARGOED walk-forward when timestamps exist, fit the final model on all data, and freeze
    to JSON with random + boundary drift fixtures. A PRE-PUBLISH FLOOR GATE refuses to overwrite the champion
    with a model that fails an absolute floor or materially regresses vs the incumbent - `force=True` to
    override deliberately. A bad retrain raises `ModelFloorError` rather than shipping silently.

    `source_label` / `provenance_note` / `model_version` let a non-ledger point-in-time supplier (the
    historical backtest corpus) stamp its honest provenance through the identical lifecycle."""
    ds = load_training_dataset(predictions, outcomes, n_bootstrap=n_bootstrap, seed=seed,
                               source_label=source_label, provenance_note=provenance_note)
    X, y = _build_model_matrix(ds)
    metrics = walk_forward_metrics(X, y, folds=folds, times=ds.get("times"), cohorts=ds.get("cohorts"),
                                   estimator=estimator, estimator_params=estimator_params)

    est_params, predict_fn = fit_estimator(estimator, X, y, estimator_params)
    fixtures = _random_fixtures(predict_fn) + _boundary_fixtures(predict_fn)

    # Read the incumbent champion (if any) so the gate can block a material regression, not just an absolute
    # floor breach. Any read failure degrades to "no incumbent" - the absolute floor still applies.
    abs_out = os.path.abspath(out_path)
    incumbent: Optional[dict] = None
    if os.path.exists(abs_out):
        try:
            with open(abs_out, encoding="utf-8") as fh:
                incumbent = json.load(fh)
        except (OSError, ValueError):
            incumbent = None
    reasons = _floor_reasons(metrics, incumbent, min_auc, min_lift, max_ece, regression_tol)
    floor = {
        "passed": not reasons,
        "min_auc": min_auc, "min_lift": min_lift, "max_ece": max_ece,
        "regression_tol": regression_tol,
        "checked_against_champion": incumbent is not None,
        "forced": bool(force),
        "reasons": reasons,
    }

    algorithm = (
        "boosted stumps (stdlib Newton gradient boosting, depth-1 trees) over 10 domain scores + completeness"
        if estimator == "boosted_stumps"
        else "logistic-regression (stdlib GD, L2) over 10 domain scores + completeness"
    )
    payload = {
        "version": ARTIFACT_VERSION,
        "modelVersion": model_version or MODEL_VERSION,
        "trainedAt": trained_at or TRAINED_AT,
        "algorithm": algorithm,
        "featureOrder": FEATURE_ORDER_MODEL,
        **est_params,
        "metrics": metrics,
        "floor": floor,
        "dataset": {"source": ds["source"], "n": ds["n"], "provenance": ds["provenance"]},
        "training": {"seed": seed, "n_bootstrap": n_bootstrap, "folds": folds},
        "champion": True,
        "provenance": (
            f"Trained via the emerging-winner lifecycle on the '{ds['source']}' dataset. Mirrors "
            "recovery_model.py (stdlib logistic, purged+embargoed walk-forward, frozen JSON, drift "
            "fixtures). The deck's CatBoost/LightGBM ordinal classifier is a drop-in that keeps this exact "
            "export + inference contract. Research only - informs a resemblance probability, never decides."
        ),
        "fixtures": fixtures,
    }

    if reasons and not force:
        raise ModelFloorError(
            "Refusing to overwrite the champion artifact: " + "; ".join(reasons)
            + ". Fix the model, or pass force=True for a deliberate lower-floor ship."
        )

    os.makedirs(os.path.dirname(abs_out), exist_ok=True)
    with open(abs_out, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2)
        fh.write("\n")
    return payload


if __name__ == "__main__":
    result = train_and_export()
    m = result["metrics"]
    bc = m.get("precision_at_k_by_cohort", {})
    pg = m.get("purge", {})
    n_boundary = sum(1 for fx in result["fixtures"] if fx.get("kind") == "boundary")
    print(
        f"emerging-winner-model: source={result['dataset']['source']} n={result['dataset']['n']} | "
        f"PR-AUC {m.get('oos_pr_auc')} (ROC-AUC {m.get('oos_auc')}) | ECE {m.get('ece')} | "
        f"precision@k pooled {m.get('precision_at_k')} / worst-cohort {bc.get('worst')} "
        f"(lift {m.get('lift_at_k')}x over base {m.get('base_rate')}) | "
        f"purge={pg.get('applied')} dropped={pg.get('n_dropped')} | "
        f"floor={'PASS' if result['floor']['passed'] else 'FAIL'} | n_oos {m.get('n_oos')}"
    )
    print(
        f"emerging-winner-model: exported {len(result['fixtures'])} drift fixtures "
        f"({n_boundary} boundary) -> src/lib/generated/emerging-winner-model.json"
    )
