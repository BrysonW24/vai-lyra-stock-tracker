"""Pins for the boosted-stumps estimator + the estimator-swap seam (the deck's promise, made real).

What must stay true forever:
  * The estimator is genuinely nonlinear - it learns a threshold interaction a logistic cannot.
  * Fitting is deterministic - identical data in, byte-identical model out, no RNG anywhere.
  * The WHOLE lifecycle rides the seam unchanged: train_and_export freezes a boosted artifact with
    working drift fixtures, and the deployed classifier serves it through the same classify() path
    with per-domain contributions - so a nonlinear champion is a data decision, never a code fork.
  * The logistic path is byte-identical to before the seam existed (backwards compatibility).
"""
import json
import math
import random

from workers.emerging_winner.stump_boost import (
    feature_contributions,
    fit_boosted_stumps,
    predict_boosted,
)


def _xor_dataset(n: int = 1200, seed: int = 3):
    """A threshold-interaction target: y depends on (x0 > 0) XOR (x1 > 0) - linearly inseparable."""
    rng = random.Random(seed)
    X, y = [], []
    for _ in range(n):
        x0, x1 = rng.uniform(-1, 1), rng.uniform(-1, 1)
        noise = rng.random() < 0.08
        label = int((x0 > 0) != (x1 > 0))
        y.append(1 - label if noise else label)
        X.append([x0, x1, rng.uniform(-1, 1)])
    return X, y


def _auc(y, p):
    from workers.stock_scanner.ml.recovery_model import auc

    return auc(y, p)


def test_boosted_stumps_learn_nonlinearity_a_logistic_cannot():
    from workers.stock_scanner.ml.recovery_model import _standardization, fit_logistic
    from workers.emerging_winner.train import _predict

    X, y = _xor_dataset()
    model = fit_boosted_stumps(X, y, rounds=200)
    p_boost = [predict_boosted(model, x) for x in X]
    mean, std = _standardization(X)
    w, b = fit_logistic(X, y, mean, std)
    p_logit = [_predict(mean, std, w, b, x) for x in X]
    assert _auc(y, p_boost) > 0.85, "stumps must crack the threshold interaction"
    assert _auc(y, p_logit) < 0.62, "the XOR target must genuinely defeat the linear model"


def test_fit_is_deterministic():
    X, y = _xor_dataset(seed=11)
    a = fit_boosted_stumps(X, y, rounds=60)
    b = fit_boosted_stumps(X, y, rounds=60)
    assert json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)


def test_predictions_bounded_and_contributions_reconcile():
    X, y = _xor_dataset(seed=5)
    model = fit_boosted_stumps(X, y, rounds=80)
    for x in X[:50]:
        p = predict_boosted(model, x)
        assert 0.0 < p < 1.0
        margin = model["base_score"] + sum(feature_contributions(model, x))
        assert abs(1.0 / (1.0 + math.exp(-margin)) - p) < 1e-9, (
            "per-feature contributions must reconcile exactly with the served probability"
        )


def test_min_leaf_blocks_single_row_rules():
    # 3 positives cannot mint their own split when min_leaf demands 25 per side.
    X = [[float(i)] for i in range(60)]
    y = [1 if i >= 57 else 0 for i in range(60)]
    model = fit_boosted_stumps(X, y, rounds=40, min_leaf=25)
    for tree in model["trees"]:
        left_n = sum(1 for row in X if row[0] <= tree["threshold"])
        assert 25 <= left_n <= len(X) - 25, "every split must respect the min-leaf floor"


def test_full_lifecycle_rides_the_seam(tmp_path, monkeypatch):
    """train_and_export(estimator='boosted_stumps') -> frozen artifact -> classifier serves it,
    drift fixtures replay exactly, contributions attach to domains."""
    from workers.emerging_winner import classifier as C
    from workers.emerging_winner.dataset import FEATURE_ORDER
    from workers.emerging_winner.domains import DomainResult
    from workers.emerging_winner.train import train_and_export

    out = tmp_path / "boosted-champion.json"
    payload = train_and_export(out_path=str(out), estimator="boosted_stumps",
                               model_version="emerging-winner-classifier-boosted-test",
                               force=True)
    assert payload["estimatorType"] == "boosted_stumps"
    assert payload["boost"]["trees"], "a frozen boosted artifact must actually carry trees"
    assert "boosted stumps" in payload["algorithm"]

    model = C.load_champion_model(str(out))
    assert model is not None and model.estimator == "boosted_stumps"
    # Drift fixtures: the deployed inference path must reproduce every frozen probability exactly.
    for fx in payload["fixtures"]:
        feats = []
        present = 0
        for s in fx["scores"]:
            if s is None:
                feats.append(0.0)
            else:
                feats.append((float(s) - 50.0) / 50.0)
                present += 1
        vec = feats + [present / len(FEATURE_ORDER) - 0.5]
        assert abs(C._predict_trained(model, vec) - fx["probability"]) < 1e-6

    # classify() serves it end to end with domain contributions.
    monkeypatch.setenv("EMERGING_WINNER_MODEL_PATH", str(out))
    C.reset_model_cache()
    try:
        domains = [DomainResult(k, k, 80.0, "full", "") for k in FEATURE_ORDER]
        res = C.classify(domains)
        assert res.model_version == "emerging-winner-classifier-boosted-test"
        assert 0.0 <= res.probability <= 1.0
        assert res.contributions, "a nonlinear champion still owes per-domain contributions"
    finally:
        monkeypatch.delenv("EMERGING_WINNER_MODEL_PATH")
        C.reset_model_cache()


def test_logistic_artifacts_still_load_unchanged():
    from workers.emerging_winner import classifier as C

    model = C.load_champion_model()  # the shipped champion is a logistic artifact with no estimatorType
    assert model is not None and model.estimator == "logistic"
    assert model.weights is not None and model.mean is not None