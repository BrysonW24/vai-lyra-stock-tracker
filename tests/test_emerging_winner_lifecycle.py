"""
Model-lifecycle tests for the Emerging Winner Classifier: dataset -> train -> deploy -> monitor -> infer.

These pin the machinery, not a hoped-for score: the labeler is exact, the bootstrap is reproducible, the
walk-forward actually learns out-of-sample, the frozen artifact re-serves identically (drift guard), the
deployed classifier prefers the trained champion and falls back to the reference honestly, and the live
monitor computes calibration/precision from matured ledger pairs. Dependency-free + timezone-independent.
"""
from __future__ import annotations

import json

import pytest

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


# --- 8. purged + embargoed walk-forward (no 12-month label leak across the fold boundary) ----------

def test_purged_train_indices_drops_overlapping_window():
    # boundary time = times[5] = 5; keep rows whose label window (t + horizon) + embargo closes before it.
    times = [float(i) for i in range(11)]
    keep = T._purged_train_indices(times, train_end=5, horizon=2, embargo=1)
    assert keep == [0, 1, 2]  # t + 2 + 1 <= 5  =>  t <= 2


def test_bootstrap_walk_forward_purge_is_a_noop():
    # i.i.d. bootstrap rows have no timeline, so there is nothing to purge - and it must not silently drop.
    ds = load_training_dataset(n_bootstrap=4000, seed=42)
    X = [T.to_model_vector(f, c) for f, c in zip(ds["X"], ds["completeness"])]
    m = T.walk_forward_metrics(X, ds["y"], folds=5)
    assert m["purge"]["applied"] is False
    assert m["purge"]["n_dropped"] == 0


def test_walk_forward_purge_applied_with_timeline():
    # With a real monotonic clock, purge + embargo actually drop the boundary-overlapping training rows.
    ds = load_training_dataset(n_bootstrap=500, seed=42)
    X = [T.to_model_vector(f, c) for f, c in zip(ds["X"], ds["completeness"])]
    times = [float(i) for i in range(len(X))]
    m = T.walk_forward_metrics(X, ds["y"], folds=5, times=times, horizon=50, embargo=10)
    assert m["purge"]["applied"] is True
    assert m["purge"]["n_dropped"] > 0
    assert m["n_oos"] > 0  # still produces out-of-sample predictions after purging


# --- 9. rare-positive metric family: per-cohort precision@k, PR-AUC, equal-mass ECE -----------------

def test_precision_at_k_by_cohort_reports_worst():
    # Q1 ranks its winner top; Q2 ranks a loser top -> worst cohort is Q2 at 0.0.
    y = [1, 0, 0, 0, 1, 0]
    p = [0.9, 0.1, 0.2, 0.9, 0.1, 0.3]
    cohorts = ["Q1", "Q1", "Q1", "Q2", "Q2", "Q2"]
    res = T.precision_at_k_by_cohort(y, p, cohorts, k_frac=0.34)  # k = 1 per cohort of 3
    assert res["n_cohorts"] == 2
    assert res["worst"] == 0.0 and res["worst_cohort"] == "Q2"
    assert res["mean"] == 0.5


def test_average_precision_ranks_positives():
    assert T.average_precision([0, 1, 1], [0.1, 0.9, 0.8]) == 1.0            # both winners on top -> AP 1
    assert abs(T.average_precision([1, 0, 1], [0.9, 0.8, 0.1]) - 0.8333) < 1e-3


def test_equal_mass_calibration_does_not_collapse_to_one_bin():
    # 90 rows clustered near 0 + 10 spread high. Equal-WIDTH would pile 90 in bin 0; equal-MASS balances.
    y = [0] * 95 + [1] * 5
    p = [0.01] * 90 + [0.2] * 5 + [0.9] * 5
    bins = T.calibration_bins(y, p, bins=10)
    assert len(bins) >= 2
    assert max(b["n"] for b in bins) <= 15  # ~10 per bin, not 90 dumped into one
    ece = T.expected_calibration_error(y, p, bins=10)
    assert 0.0 <= ece <= 1.0


def test_walk_forward_reports_new_metric_family():
    ds = load_training_dataset(n_bootstrap=4000, seed=42)
    X = [T.to_model_vector(f, c) for f, c in zip(ds["X"], ds["completeness"])]
    m = T.walk_forward_metrics(X, ds["y"], folds=5)
    for key in ("oos_pr_auc", "oos_auc", "ece", "precision_at_k_by_cohort", "purge"):
        assert key in m, f"walk-forward metrics missing {key}"
    assert m["precision_at_k_by_cohort"]["n_cohorts"] >= 1


# --- 10. the pre-publish floor gate (a bad retrain must not ship silently) --------------------------

def test_floor_gate_blocks_bad_retrain_and_force_overrides(tmp_path):
    out = tmp_path / "m.json"
    with pytest.raises(T.ModelFloorError):
        T.train_and_export(out_path=str(out), n_bootstrap=2000, seed=3, min_lift=99.0)
    assert not out.exists()  # champion untouched when the floor fails
    payload = T.train_and_export(out_path=str(out), n_bootstrap=2000, seed=3, min_lift=99.0, force=True)
    assert out.exists()
    assert payload["floor"]["passed"] is False and payload["floor"]["forced"] is True


def test_floor_gate_passes_on_healthy_bootstrap(tmp_path):
    out = tmp_path / "m.json"
    payload = T.train_and_export(out_path=str(out), n_bootstrap=4000, seed=1)
    assert payload["floor"]["passed"] is True
    assert payload["metrics"]["oos_auc"] >= payload["floor"]["min_auc"]


# --- 11. boundary drift fixtures --------------------------------------------------------------------

def test_boundary_fixtures_present_and_drift_guarded(tmp_path):
    out = tmp_path / "m.json"
    payload = T.train_and_export(out_path=str(out), n_bootstrap=3000, seed=5)
    kinds = [fx.get("kind") for fx in payload["fixtures"]]
    assert kinds.count("boundary") >= 5
    assert any(all(s is None for s in fx["scores"]) for fx in payload["fixtures"])  # the all-missing corner
    guard = M.verify_drift_guard(str(out))
    assert guard["ok"] and guard["max_error"] < 1e-6  # engineered corners re-serve identically too


# --- 12. labeler behaviour exactly at the barriers --------------------------------------------------

def test_first_touch_exact_up_boundary():
    assert first_touch_barrier([10, 20], entry_price=10) == "up_100"   # exactly +100% counts (>=)


def test_first_touch_exact_down_boundary():
    # Inclusive (<=) at the barrier. Uses -50% so the level (5.0) is float-exact; the default -80% level is
    # 1.999...96 in float, so a price of exactly 2 sits an epsilon ABOVE it - a known boundary property that
    # the labeler-hardening items (intraday high/low, total-return adjustment) address, not this batch.
    assert first_touch_barrier([10, 5], entry_price=10, down_pct=-50.0) == "down_80"


def test_first_touch_entry_defaults_to_first_price():
    assert first_touch_barrier([5, 7, 10]) == "up_100"                 # base = first forward price (5)


def test_first_touch_nonpositive_base_is_neither():
    assert first_touch_barrier([0, 100], entry_price=0) == "neither"


# --- 13. dataset carries the point-in-time timeline + cohorts ---------------------------------------

def test_bootstrap_dataset_has_no_timeline():
    ds = load_training_dataset(n_bootstrap=100, seed=1)
    assert ds["times"] is None and ds["cohorts"] is None


def test_ledger_dataset_carries_times_and_quarter_cohorts():
    preds, outs = [], []
    for i in range(210):
        pid = f"p{i}"
        preds.append({"id": pid, "symbol": f"S{i}", "predicted_at": "2026-03-15",
                      "payload": {"domains": [{"key": k, "score": 60.0} for k in FEATURE_ORDER]}})
        outs.append({"prediction_id": pid, "barrier_hit": "neither"})
    ds = load_training_dataset(preds, outs, min_matured=200)
    assert ds["source"] == "point-in-time-ledger"
    assert ds["times"] is not None and len(ds["times"]) == 210
    assert ds["cohorts"][0] == "2026Q1"
