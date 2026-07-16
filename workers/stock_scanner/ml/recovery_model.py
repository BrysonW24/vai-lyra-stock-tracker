"""
Recovery-probability model - the learned+calibrated layer over Lyra's deterministic score.

WHAT IT IS: a logistic-regression model that maps the engine's own signal components (RSI reset,
improving RSI/MACD deltas, distance to the 60-period low, trend, volume, composite score) to a
calibrated probability that a beaten-down name actually recovers. It is trained offline, backtested
walk-forward (out-of-sample), and frozen to JSON; TS inference (src/lib/ml/recovery-probability.ts)
loads those coefficients and computes the same probability deterministically, with a drift guard so
the two implementations can never diverge.

DOCTRINE (unbroken): this INFORMS, it never DECIDES. The deterministic engine still owns the action
label ("Buy Review / Watch / Do Not Add"); this only attaches a calibrated probability estimate for
research context. Research only, never advice.

DEPENDENCY-FREE: pure Python stdlib (no numpy/sklearn), so it trains and backtests in any environment
- including CI - exactly the portability ethos of the rest of the agent harness.

DATA PROVENANCE (honest): the shipped coefficients are fit on a REPRODUCIBLE REFERENCE dataset whose
data-generating process encodes the engine's recovery hypothesis (recovery is likelier in the reset
band, with improving momentum, near the low). This proves the *learning + calibration machinery* is
real and generalises out-of-sample. Refit on real historical bars with `python -m
workers.stock_scanner.ml.recovery_model --train` once a labelled OHLCV history is wired in; the
feature transforms and the export format do not change.
"""
from __future__ import annotations

import json
import math
import os
import random
from dataclasses import dataclass

# --- feature transforms (MIRRORED byte-for-byte in src/lib/ml/recovery-probability.ts) -----------

FEATURE_ORDER = [
    "reset_band",       # 1.0 at the centre of the 35-50 RSI reset band, decaying outside
    "rsi_improving",    # recent RSI delta, clamped
    "macd_recovering",  # improving MACD histogram (weighted up when still negative = early turn)
    "near_low",         # proximity to the 60-period low (1 at the low, negative when far)
    "trend",            # above/below the 200-period SMA
    "volume",           # volume vs its average
    "score",            # the deterministic composite score, centred
]


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def transform(raw: dict) -> list[float]:
    """Raw signal fields -> the 7 model features. IDENTICAL to the TS mirror."""
    rsi = raw.get("rsi", 50.0)
    rsi_delta = raw.get("rsiDelta", 0.0)
    macd_hist = raw.get("macdHist", 0.0)
    macd_hist_delta = raw.get("macdHistDelta", 0.0)
    dist_from_low = raw.get("distFromLowPct", 20.0)
    above_sma200 = 1.0 if raw.get("aboveSma200", False) else 0.0
    volume_ratio = raw.get("volumeRatio", 1.0)
    score = raw.get("score", 50.0)

    reset_band = max(0.0, 1.0 - abs(rsi - 42.5) / 12.5)
    rsi_improving = _clamp(rsi_delta / 3.0, -1.0, 1.0)
    macd_recovering = _clamp(macd_hist_delta / 1.0, -1.0, 1.0) * (1.0 if macd_hist < 0 else 0.5)
    near_low = _clamp((10.0 - dist_from_low) / 10.0, -1.0, 1.0)
    trend = above_sma200 - 0.5
    volume = _clamp((volume_ratio - 1.0) / 1.0, -1.0, 1.0)
    score_c = (score - 50.0) / 25.0
    return [reset_band, rsi_improving, macd_recovering, near_low, trend, volume, score_c]


# --- logistic regression (stdlib gradient descent) ------------------------------------------------

def _sigmoid(z: float) -> float:
    if z >= 0:
        return 1.0 / (1.0 + math.exp(-z))
    e = math.exp(z)
    return e / (1.0 + e)


@dataclass
class Model:
    mean: list[float]
    std: list[float]
    weights: list[float]
    bias: float

    def _standardize(self, feats: list[float]) -> list[float]:
        return [(feats[i] - self.mean[i]) / (self.std[i] or 1.0) for i in range(len(feats))]

    def proba_raw(self, raw: dict) -> float:
        x = self._standardize(transform(raw))
        z = self.bias + sum(w * xi for w, xi in zip(self.weights, x))
        return _sigmoid(z)

    def proba_features(self, feats: list[float]) -> float:
        x = self._standardize(feats)
        z = self.bias + sum(w * xi for w, xi in zip(self.weights, x))
        return _sigmoid(z)


def _standardization(X: list[list[float]]) -> tuple[list[float], list[float]]:
    n = len(X)
    d = len(X[0])
    mean = [sum(row[j] for row in X) / n for j in range(d)]
    std = []
    for j in range(d):
        var = sum((row[j] - mean[j]) ** 2 for row in X) / n
        std.append(math.sqrt(var) or 1.0)
    return mean, std


def fit_logistic(
    X: list[list[float]],
    y: list[int],
    mean: list[float],
    std: list[float],
    epochs: int = 400,
    lr: float = 0.3,
    l2: float = 1e-3,
) -> tuple[list[float], float]:
    """Batch gradient descent on standardized features. Deterministic (weights init to 0)."""
    n = len(X)
    d = len(X[0])
    Xs = [[(row[j] - mean[j]) / std[j] for j in range(d)] for row in X]
    w = [0.0] * d
    b = 0.0
    for _ in range(epochs):
        gw = [0.0] * d
        gb = 0.0
        for i in range(n):
            p = _sigmoid(b + sum(w[j] * Xs[i][j] for j in range(d)))
            err = p - y[i]
            for j in range(d):
                gw[j] += err * Xs[i][j]
            gb += err
        for j in range(d):
            w[j] -= lr * (gw[j] / n + l2 * w[j])
        b -= lr * (gb / n)
    return w, b


# --- metrics --------------------------------------------------------------------------------------

def auc(y: list[int], p: list[float]) -> float:
    """Rank-based AUC (Mann-Whitney). 0.5 = no discrimination."""
    pos = [p[i] for i in range(len(y)) if y[i] == 1]
    neg = [p[i] for i in range(len(y)) if y[i] == 0]
    if not pos or not neg:
        return 0.5
    ranked = sorted(range(len(p)), key=lambda i: p[i])
    ranks = [0.0] * len(p)
    i = 0
    while i < len(ranked):
        j = i
        while j + 1 < len(ranked) and p[ranked[j + 1]] == p[ranked[i]]:
            j += 1
        avg = (i + j) / 2.0 + 1.0
        for k in range(i, j + 1):
            ranks[ranked[k]] = avg
        i = j + 1
    sum_pos = sum(ranks[i] for i in range(len(y)) if y[i] == 1)
    n_pos, n_neg = len(pos), len(neg)
    return (sum_pos - n_pos * (n_pos + 1) / 2.0) / (n_pos * n_neg)


def brier(y: list[int], p: list[float]) -> float:
    return sum((p[i] - y[i]) ** 2 for i in range(len(y))) / len(y)


# --- reference dataset (reproducible; encodes the engine recovery hypothesis) --------------------

# The "true" propensity the generator uses to LABEL samples. Positive on every component the engine
# rewards - so a well-fit model recovers these signs and the backtest measures whether the engine's
# hypothesis is learnable/generalisable out-of-sample.
_TRUE_W = [1.4, 0.9, 1.0, 0.8, 0.6, 0.4, 0.7]
_TRUE_B = -0.15


def make_reference_dataset(n: int, seed: int) -> tuple[list[list[float]], list[int], list[dict]]:
    rng = random.Random(seed)
    X: list[list[float]] = []
    y: list[int] = []
    raws: list[dict] = []
    for _ in range(n):
        raw = {
            "rsi": rng.uniform(20, 70),
            "rsiDelta": rng.uniform(-4, 4),
            "macdHist": rng.uniform(-2, 1),
            "macdHistDelta": rng.uniform(-1.5, 1.5),
            "distFromLowPct": rng.uniform(0, 40),
            "aboveSma200": rng.random() < 0.5,
            "volumeRatio": rng.uniform(0.5, 3.0),
            "score": rng.uniform(0, 100),
        }
        feats = transform(raw)
        z = _TRUE_B + sum(tw * f for tw, f in zip(_TRUE_W, feats))
        prob = _sigmoid(z)
        label = 1 if rng.random() < prob else 0
        X.append(feats)
        y.append(label)
        raws.append(raw)
    return X, y, raws


def walk_forward_backtest(X: list[list[float]], y: list[int], folds: int = 5) -> dict:
    """Time-ordered walk-forward: train on all prior folds, test on the next. Out-of-sample only."""
    n = len(X)
    fold_size = n // folds
    oos_y: list[int] = []
    oos_p: list[float] = []
    baseline_p: list[float] = []
    for f in range(1, folds):
        train_end = f * fold_size
        test_end = (f + 1) * fold_size if f < folds - 1 else n
        Xtr, ytr = X[:train_end], y[:train_end]
        Xte, yte = X[train_end:test_end], y[train_end:test_end]
        if not Xte:
            continue
        mean, std = _standardization(Xtr)
        w, b = fit_logistic(Xtr, ytr, mean, std)
        model = Model(mean, std, w, b)
        base_rate = sum(ytr) / len(ytr)
        for feats, label in zip(Xte, yte):
            oos_p.append(model.proba_features(feats))
            oos_y.append(label)
            baseline_p.append(base_rate)
    return {
        "oos_auc": round(auc(oos_y, oos_p), 4),
        "oos_brier": round(brier(oos_y, oos_p), 4),
        "baseline_brier": round(brier(oos_y, baseline_p), 4),
        "n_oos": len(oos_y),
        "base_rate": round(sum(oos_y) / len(oos_y), 4),
    }


DEFAULT_OUT = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "src", "lib", "generated", "recovery-model.json"
)

# Fixed metadata date so training is fully reproducible (coefficients never depend on it).
TRAINED_AT = "2026-07-16"
MODEL_VERSION = 1


def train_and_export(out_path: str = DEFAULT_OUT, seed: int = 42, n: int = 4000) -> dict:
    X, y, raws = make_reference_dataset(n, seed)
    metrics = walk_forward_backtest(X, y)

    # Final model fit on ALL data for shipping.
    mean, std = _standardization(X)
    w, b = fit_logistic(X, y, mean, std)
    model = Model(mean, std, w, b)

    # Drift-guard fixtures: raw inputs spanning the space -> probability, checked by the TS mirror.
    fixture_seeds = [7, 99, 123, 512, 2026, 31, 8, 404, 61, 777, 1, 250]
    fixtures = []
    for fs in fixture_seeds:
        rng = random.Random(fs)
        raw = {
            "rsi": round(rng.uniform(25, 65), 2),
            "rsiDelta": round(rng.uniform(-3, 3), 2),
            "macdHist": round(rng.uniform(-2, 1), 2),
            "macdHistDelta": round(rng.uniform(-1.2, 1.2), 2),
            "distFromLowPct": round(rng.uniform(0, 35), 2),
            "aboveSma200": rng.random() < 0.5,
            "volumeRatio": round(rng.uniform(0.6, 2.5), 2),
            "score": round(rng.uniform(10, 95), 1),
        }
        fixtures.append({"raw": raw, "prob": round(model.proba_raw(raw), 8)})

    payload = {
        "version": MODEL_VERSION,
        "trainedAt": TRAINED_AT,
        "algorithm": "logistic-regression (stdlib GD, L2)",
        "featureOrder": FEATURE_ORDER,
        "mean": [round(m, 8) for m in mean],
        "std": [round(s, 8) for s in std],
        "weights": [round(wi, 8) for wi in w],
        "bias": round(b, 8),
        "metrics": metrics,
        "training": {"seed": seed, "n": n, "folds": 5},
        "provenance": (
            "Fit on a reproducible reference dataset whose data-generating process encodes the "
            "engine recovery hypothesis. Proves the learning+calibration machinery and its "
            "out-of-sample lift. Refit on real historical bars before production reliance. "
            "Research only - informs a probability, never decides an action."
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
    print(f"recovery-model: OOS AUC {m['oos_auc']} | Brier {m['oos_brier']} vs baseline {m['baseline_brier']} | n_oos {m['n_oos']}")
    print(f"recovery-model: exported {len(result['fixtures'])} drift fixtures -> src/lib/generated/recovery-model.json")
