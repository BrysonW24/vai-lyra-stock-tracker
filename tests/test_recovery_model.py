"""Tests for the recovery-probability model: it learns, generalises out-of-sample, and is reproducible."""
import json
import os

from workers.stock_scanner.ml import recovery_model as rm


def test_transform_arity_and_bounds():
    raw = {"rsi": 42, "rsiDelta": 1, "macdHist": -0.5, "macdHistDelta": 0.5,
           "distFromLowPct": 5, "aboveSma200": True, "volumeRatio": 1.5, "score": 70}
    feats = rm.transform(raw)
    assert len(feats) == len(rm.FEATURE_ORDER)
    # reset_band and near_low are bounded transforms
    assert 0.0 <= feats[0] <= 1.0
    assert -1.0 <= feats[3] <= 1.0


def test_reference_dataset_is_deterministic():
    a = rm.make_reference_dataset(500, seed=42)
    b = rm.make_reference_dataset(500, seed=42)
    assert a[0] == b[0]
    assert a[1] == b[1]


def test_walk_forward_beats_chance_and_baseline():
    X, y, _ = rm.make_reference_dataset(3000, seed=42)
    metrics = rm.walk_forward_backtest(X, y, folds=5)
    # Out-of-sample discrimination well above chance.
    assert metrics["oos_auc"] > 0.65, metrics
    # Out-of-sample calibration beats the base-rate baseline (lower Brier is better).
    assert metrics["oos_brier"] < metrics["baseline_brier"], metrics
    assert metrics["n_oos"] > 0


def test_fit_recovers_positive_signal_direction():
    # The generator makes recovery likelier with a higher composite score; the fitted weight on the
    # score feature (index 6) should be positive after standardization.
    X, y, _ = rm.make_reference_dataset(3000, seed=42)
    mean, std = rm._standardization(X)
    w, b = rm.fit_logistic(X, y, mean, std)
    assert w[rm.FEATURE_ORDER.index("score")] > 0
    assert w[rm.FEATURE_ORDER.index("reset_band")] > 0


def test_train_and_export_writes_valid_payload(tmp_path):
    out = tmp_path / "recovery-model.json"
    payload = rm.train_and_export(str(out), seed=42, n=1500)
    assert out.exists()
    data = json.loads(out.read_text())
    assert data["featureOrder"] == rm.FEATURE_ORDER
    assert len(data["weights"]) == len(rm.FEATURE_ORDER)
    assert len(data["mean"]) == len(rm.FEATURE_ORDER)
    assert len(data["fixtures"]) >= 10
    # Every fixture carries raw inputs and a probability in [0,1].
    for fx in data["fixtures"]:
        assert 0.0 <= fx["prob"] <= 1.0
        assert set(["rsi", "score", "macdHist"]).issubset(fx["raw"].keys())


def test_committed_model_matches_a_fresh_train():
    """The frozen src/lib/generated/recovery-model.json must match a fresh deterministic train, so a
    committed model can never silently drift from the trainer that produced it."""
    committed_path = os.path.join(os.path.dirname(rm.__file__), "..", "..", "..",
                                  "src", "lib", "generated", "recovery-model.json")
    if not os.path.exists(committed_path):
        return  # generated on build; nothing to compare in a clean checkout
    committed = json.loads(open(committed_path).read())
    # Recompute with the committed model's own training params.
    seed = committed["training"]["seed"]
    n = committed["training"]["n"]
    X, y, _ = rm.make_reference_dataset(n, seed=seed)
    mean, std = rm._standardization(X)
    w, b = rm.fit_logistic(X, y, mean, std)
    for a, c in zip(w, committed["weights"]):
        assert abs(a - c) < 1e-6, "committed weights drifted from a fresh train"
    assert abs(b - committed["bias"]) < 1e-6
