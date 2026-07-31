"""
Model-lifecycle tests for the Emerging Winner Classifier: dataset -> train -> deploy -> monitor -> infer.

These pin the machinery, not a hoped-for score: the labeler is exact, the bootstrap is reproducible, the
walk-forward actually learns out-of-sample, the frozen artifact re-serves identically (drift guard), the
deployed classifier prefers the trained champion and falls back to the reference honestly, and the live
monitor computes calibration/precision from matured ledger pairs. Dependency-free + timezone-independent.
"""
from __future__ import annotations

import json

from workers.emerging_winner import classifier as C
from workers.emerging_winner import monitor as M
from workers.emerging_winner import train as T
from workers.emerging_winner.dataset import (
    FEATURE_ORDER,
    assemble_training_rows,
    first_touch_barrier,
    label_from_barrier,
    load_training_dataset,
    make_bootstrap_dataset,
)
from workers.emerging_winner.domains import DomainResult


# --- 1. the labeler -------------------------------------------------------------------------------

def test_first_touch_barrier_up_first():
    # rises to +100% (10 -> 20) before falling: winner.
    assert first_touch_barrier([10, 12, 15, 21, 5], entry_price=10) == "up_100"


def test_first_touch_barrier_down_first():
    # falls to -80% (10 -> 2) before any doubling: ruin.
    assert first_touch_barrier([10, 8, 3, 1.9, 25], entry_price=10) == "down_80"


def test_first_touch_barrier_neither():
    assert first_touch_barrier([10, 11, 9, 12, 10], entry_price=10) == "neither"


def test_first_touch_same_bar_down_takes_priority():
    # a bar that is simultaneously past both barriers resolves to the conservative (down) outcome.
    assert first_touch_barrier([1.5], entry_price=10) == "down_80"


def test_first_touch_empty_is_neither():
    assert first_touch_barrier([], entry_price=10) == "neither"


def test_first_touch_horizon_truncates():
    # the doubling happens only after the horizon -> not counted.
    prices = [10] * 300 + [21]
    assert first_touch_barrier(prices, entry_price=10, horizon=252) == "neither"


def test_label_from_barrier():
    assert label_from_barrier("up_100") == 1
    assert label_from_barrier("down_80") == 0
    assert label_from_barrier("neither") == 0


# --- 2. the bootstrap dataset ---------------------------------------------------------------------

def test_bootstrap_is_reproducible():
    a = make_bootstrap_dataset(500, seed=7)
    b = make_bootstrap_dataset(500, seed=7)
    assert a == b


def test_bootstrap_base_rate_is_rare_but_present():
    _X, y, _c = make_bootstrap_dataset(6000, seed=42)
    rate = sum(y) / len(y)
    assert 0.02 <= rate <= 0.20, f"winner base rate {rate} outside a realistic rare-positive band"
    assert sum(y) > 0


def test_feature_order_matches_ten_domains():
    assert len(FEATURE_ORDER) == 10
    assert "technical" in FEATURE_ORDER and "government" in FEATURE_ORDER


# --- 3. training actually learns out-of-sample ----------------------------------------------------

def test_walk_forward_learns():
    ds = load_training_dataset(n_bootstrap=6000, seed=42)
    X = [T.to_model_vector(f, c) for f, c in zip(ds["X"], ds["completeness"])]
    metrics = T.walk_forward_metrics(X, ds["y"], folds=5)
    assert metrics["oos_auc"] > 0.6, f"model does not discriminate OOS: {metrics}"
    assert metrics["lift_at_k"] and metrics["lift_at_k"] > 1.5, f"no lift over base rate: {metrics}"


def test_precision_at_k_beats_random():
    y = [1, 0, 0, 1, 0, 0, 0, 1, 0, 0]
    p = [0.9, 0.1, 0.2, 0.8, 0.3, 0.05, 0.15, 0.7, 0.25, 0.1]
    prec, k = T.precision_at_k(y, p, k_frac=0.3)
    assert k == 3 and prec == 1.0  # top 3 by prob are exactly the three winners


# --- 4. train -> freeze -> drift guard ------------------------------------------------------------

def test_train_and_export_artifact(tmp_path):
    out = tmp_path / "model.json"
    payload = T.train_and_export(out_path=str(out), n_bootstrap=4000, seed=1)
    assert out.exists()
    data = json.loads(out.read_text())
    for key in ("modelVersion", "featureOrder", "mean", "std", "weights", "bias", "metrics",
                "dataset", "fixtures", "champion"):
        assert key in data, f"artifact missing {key}"
    assert len(data["weights"]) == len(FEATURE_ORDER) + 1  # 10 domains + completeness
    assert data["dataset"]["source"] == "bootstrap-synthetic"

    # Drift guard: the deployed classifier must re-serve every fixture identically.
    guard = M.verify_drift_guard(str(out))
    assert guard["ok"], f"drift guard failed: {guard}"
    assert guard["max_error"] < 1e-6


# --- 5. deployment: champion vs reference fallback ------------------------------------------------

def _domains(scores: dict) -> list[DomainResult]:
    return [
        DomainResult(k, k, scores.get(k), "full" if scores.get(k) is not None else "unavailable", "")
        for k in FEATURE_ORDER
    ]


def test_classify_uses_trained_champion_when_present():
    C.reset_model_cache()
    res = C.classify(_domains({k: 80.0 for k in FEATURE_ORDER}))
    assert "trained" in res.model_version, "expected the trained champion to serve when the artifact exists"


def test_classify_reference_fallback_when_no_artifact(monkeypatch, tmp_path):
    monkeypatch.setattr(C, "_ARTIFACT_PATH", str(tmp_path / "does-not-exist.json"))
    C.reset_model_cache()
    try:
        res = C.classify(_domains({k: 80.0 for k in FEATURE_ORDER}))
        assert res.model_version == C.MODEL_VERSION  # reference-v1
        assert "reference-v1" in res.provenance
    finally:
        C.reset_model_cache()  # restore the real champion for other tests


def test_classify_is_monotonic_strong_over_weak():
    C.reset_model_cache()
    strong = C.classify(_domains({k: 85.0 for k in FEATURE_ORDER}))
    weak = C.classify(_domains({k: 15.0 for k in FEATURE_ORDER}))
    assert strong.winner_similarity > weak.winner_similarity
    assert strong.probability > weak.probability


def test_classify_coverage_caps_stage():
    C.reset_model_cache()
    # Only two domains present -> completeness < 0.5 -> stage capped at 1 even if strong.
    thin = C.classify(_domains({"technical": 95.0, "government": 95.0}))
    assert thin.ordinal_stage <= 1
    assert thin.completeness < 0.5


# --- 6. monitoring: live health from matured pairs ------------------------------------------------

def test_verify_drift_guard_on_shipped_artifact():
    guard = M.verify_drift_guard()
    assert guard["ok"], f"shipped artifact drift guard failed: {guard}"


def test_model_health_reports_calibration_once_matured():
    # Build synthetic ledger rows where higher probability really did win more -> calibration should show it.
    preds = []
    outcomes = []
    for i in range(60):
        prob = (i % 10) / 10.0
        pid = f"p{i}"
        preds.append({"id": pid, "probability": prob, "winner_similarity": prob * 100,
                      "stage_label": "strong candidate", "completeness": 0.8, "payload": {"confidence": "high"}})
        barrier = "up_100" if (i % 10) >= 7 else "neither"  # top-prob rows win
        outcomes.append({"prediction_id": pid, "barrier_hit": barrier})
    report = M.model_health(preds, outcomes, k_frac=0.3)
    assert report["summary"]["n"] == 60
    assert "live" in report
    assert report["live"]["lift_at_k"] and report["live"]["lift_at_k"] > 1.0
    assert report["live"]["calibration"]


def test_model_health_stays_shadow_below_minimum():
    report = M.model_health([], [])
    assert "live" not in report
    assert "shadow-live" in report["verdict"]


# --- 7. real point-in-time assembly ---------------------------------------------------------------

def test_assemble_training_rows_joins_predictions_to_outcomes():
    preds = [
        {"id": "a", "symbol": "AAA", "predicted_at": "2026-01-01",
         "payload": {"domains": [{"key": k, "score": 70.0} for k in FEATURE_ORDER]}},
        {"id": "b", "symbol": "BBB", "predicted_at": "2026-01-01",
         "payload": {"domains": [{"key": k, "score": 30.0} for k in FEATURE_ORDER]}},
        {"id": "c", "symbol": "CCC", "predicted_at": "2026-01-01", "payload": {"domains": []}},  # no outcome
    ]
    outcomes = [
        {"prediction_id": "a", "barrier_hit": "up_100"},
        {"prediction_id": "b", "barrier_hit": "down_80"},
    ]
    rows = assemble_training_rows(preds, outcomes)
    assert len(rows) == 2  # 'c' has no matured outcome, so it is excluded (no look-ahead)
    by_symbol = {r.symbol: r for r in rows}
    assert by_symbol["AAA"].label == 1
    assert by_symbol["BBB"].label == 0
    assert len(by_symbol["AAA"].features) == len(FEATURE_ORDER)
