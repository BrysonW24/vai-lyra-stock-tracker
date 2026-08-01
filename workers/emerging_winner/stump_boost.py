"""
Boosted depth-2 trees - the first NONLINEAR estimator for the Emerging Winner lifecycle, stdlib-only.

Why this exists: the deck promises the classifier's estimator is swappable behind an unchanged
lifecycle (dataset -> walk-forward -> floor gate -> frozen artifact -> drift fixtures -> serve).
That promise is only real once a second estimator actually rides the seam. This is Newton gradient
boosting on binary log-loss over DEPTH-2 trees: one root split + one split per side. Depth matters
and is not an implementation detail - depth-1 stumps are purely ADDITIVE (a sum of univariate step
functions, mathematically unable to represent any interaction; an XOR-style target defeats them
completely), while depth-2 captures exactly the pairwise interactions the winner hypothesis cares
about (fundamentals x liquidity, dilution x momentum). Still small, deterministic, fast on
20k x 11, and explainable - every tree is a two-level if/else a human can read.

Honesty properties, by construction:
  * Deterministic: candidate thresholds are feature quantiles; ties break on (gain, feature index,
    threshold) - identical data in, identical model out, no RNG anywhere.
  * Regularised for rare positives: Newton leaf weights with L2, capped step size, and a
    min-samples-per-leaf floor so a lone winner cannot mint its own rule.
  * The earn-gate is NOT here: whether this estimator ever becomes champion is decided by the
    standing loop (dev walk-forward + one-shot holdout + floors + CI separation vs the incumbent),
    never by how clever the maths looks.
"""
from __future__ import annotations

import math
from typing import Optional

# Conservative defaults tuned for ~10-50k rows x ~11 features at a 5-15% base rate.
DEFAULT_ROUNDS = 120
DEFAULT_LEARNING_RATE = 0.08
DEFAULT_N_THRESHOLDS = 16
DEFAULT_MIN_LEAF = 25
DEFAULT_L2 = 1.0
MAX_LEAF_STEP = 2.0  # cap any single leaf's log-odds step - rare-positive blow-up guard


def _sigmoid(z: float) -> float:
    if z >= 0:
        return 1.0 / (1.0 + math.exp(-z))
    e = math.exp(z)
    return e / (1.0 + e)


def _quantile_thresholds(values: list[float], n: int) -> list[float]:
    """Deterministic candidate split points: n quantile midpoints over the sorted unique values."""
    uniq = sorted(set(values))
    if len(uniq) <= 1:
        return []
    if len(uniq) <= n:
        return [(a + b) / 2.0 for a, b in zip(uniq, uniq[1:])]
    out = []
    for k in range(1, n + 1):
        idx = round(k * (len(uniq) - 1) / (n + 1))
        a, b = uniq[max(0, idx - 1)], uniq[idx]
        if a != b:
            out.append((a + b) / 2.0)
    return sorted(set(out))


def _leaf_weight(g_sum: float, h_sum: float, l2: float) -> float:
    w = -g_sum / (h_sum + l2)
    return max(-MAX_LEAF_STEP, min(MAX_LEAF_STEP, w))


def _best_split(idx: list[int], X: list[list[float]], g: list[float], h: list[float],
                thresholds: list[list[float]], min_leaf: int, l2: float
                ) -> Optional[tuple[tuple, int, float, list[int], list[int], float, float, float, float]]:
    """Best (feature, threshold) split of the row subset `idx` by Newton gain. Returns
    (key, j, t, idx_left, idx_right, gL, hL, gR, hR) or None when no legal split exists."""
    g_tot = sum(g[i] for i in idx)
    h_tot = sum(h[i] for i in idx)
    parent_score = (g_tot * g_tot) / (h_tot + l2)
    best = None
    for j in range(len(thresholds)):
        cand = thresholds[j]
        if not cand:
            continue
        vals = sorted(idx, key=lambda i: X[i][j])
        ci = 0
        g_left = h_left = 0.0
        count_left = 0
        n_sub = len(vals)
        for pos_i, i in enumerate(vals):
            xij = X[i][j]
            while ci < len(cand) and xij > cand[ci]:
                if count_left >= min_leaf and (n_sub - count_left) >= min_leaf:
                    g_right = g_tot - g_left
                    h_right = h_tot - h_left
                    gain = (g_left * g_left) / (h_left + l2) + (g_right * g_right) / (h_right + l2) \
                           - parent_score
                    key = (round(gain, 12), -j, -cand[ci])
                    if best is None or key > best[0]:
                        t = cand[ci]
                        best = (key, j, t, None, None, g_left, h_left, g_right, h_right)
                ci += 1
            g_left += g[i]
            h_left += h[i]
            count_left = pos_i + 1
    if best is None:
        return None
    key, j, t, _, _, gL, hL, gR, hR = best
    idx_left = [i for i in idx if X[i][j] <= t]
    idx_right = [i for i in idx if X[i][j] > t]
    return key, j, t, idx_left, idx_right, gL, hL, gR, hR


def fit_boosted_stumps(
    X: list[list[float]],
    y: list[int],
    *,
    rounds: int = DEFAULT_ROUNDS,
    learning_rate: float = DEFAULT_LEARNING_RATE,
    n_thresholds: int = DEFAULT_N_THRESHOLDS,
    min_leaf: int = DEFAULT_MIN_LEAF,
    l2: float = DEFAULT_L2,
) -> dict:
    """Fit the boosted depth-2-tree model. Returns the frozen-artifact-ready dict:

        {"base_score": log_odds, "depth": 2, "trees": [
            {"feature": j, "threshold": t,
             "left":  {"feature": j2, "threshold": t2, "left": w, "right": w} | {"leaf": w},
             "right": {...}}, ...]}

    where a side is either a nested split or a terminal {"leaf": w}. Pure, deterministic, stdlib.
    (Function name kept from the depth-1 era - the artifact records depth explicitly.)"""
    n = len(X)
    if n == 0:
        return {"base_score": 0.0, "depth": 2, "trees": []}
    n_features = len(X[0])
    pos = sum(y)
    base_rate = min(max(pos / n, 1e-6), 1 - 1e-6)
    base_score = math.log(base_rate / (1 - base_rate))

    thresholds: list[list[float]] = [
        _quantile_thresholds([row[j] for row in X], n_thresholds) for j in range(n_features)
    ]

    margin = [base_score] * n
    all_idx = list(range(n))
    trees: list[dict] = []
    for _ in range(rounds):
        p = [_sigmoid(m) for m in margin]
        g = [pi - yi for pi, yi in zip(p, y)]
        h = [pi * (1 - pi) for pi in p]

        root = _best_split(all_idx, X, g, h, thresholds, min_leaf, l2)
        if root is None:
            break
        _key, j, t, idx_l, idx_r, gL, hL, gR, hR = root

        def side(idx_side: list[int], g_sum: float, h_sum: float) -> dict:
            child = _best_split(idx_side, X, g, h, thresholds, min_leaf, l2)
            if child is None:
                return {"leaf": round(learning_rate * _leaf_weight(g_sum, h_sum, l2), 10)}
            _ck, cj, ct, c_l, c_r, cgL, chL, cgR, chR = child
            return {
                "feature": cj, "threshold": round(ct, 10),
                "left": round(learning_rate * _leaf_weight(cgL, chL, l2), 10),
                "right": round(learning_rate * _leaf_weight(cgR, chR, l2), 10),
            }

        tree = {"feature": j, "threshold": round(t, 10),
                "left": side(idx_l, gL, hL), "right": side(idx_r, gR, hR)}
        trees.append(tree)

        moved = 0.0
        for i in range(n):
            step = _tree_step(tree, X[i])
            margin[i] += step
            moved += abs(step)
        if moved / n < 1e-9:
            trees.pop()
            break

    return {"base_score": round(base_score, 10), "depth": 2, "trees": trees}


def _side_step(node, xj_child_value_getter, x: list[float]) -> float:
    if "leaf" in node:
        return float(node["leaf"])
    cj = int(node["feature"])
    xcj = x[cj] if cj < len(x) else 0.0
    return float(node["left"]) if xcj <= float(node["threshold"]) else float(node["right"])


def _tree_step(tree: dict, x: list[float]) -> float:
    j = int(tree["feature"])
    xj = x[j] if j < len(x) else 0.0
    node = tree["left"] if xj <= float(tree["threshold"]) else tree["right"]
    return _side_step(node, None, x)


def _tree_path_features(tree: dict, x: list[float]) -> list[int]:
    """The distinct feature indices on the decision path for x (1 or 2 features)."""
    j = int(tree["feature"])
    xj = x[j] if j < len(x) else 0.0
    node = tree["left"] if xj <= float(tree["threshold"]) else tree["right"]
    if "leaf" in node:
        return [j]
    cj = int(node["feature"])
    return [j] if cj == j else [j, cj]


def predict_boosted(model: dict, x: list[float]) -> float:
    """Probability from a frozen boosted-trees model - the exact serving maths, no shortcuts."""
    z = float(model.get("base_score", 0.0))
    for tree in model.get("trees", []):
        z += _tree_step(tree, x)
    return _sigmoid(z)


def feature_contributions(model: dict, x: list[float]) -> list[float]:
    """Per-feature signed log-odds contribution. A depth-2 path can involve two features; its step is
    split equally between the path's distinct features - a simple, stated attribution rule (full
    tree-SHAP is deliberately out of scope for a two-level tree a human can just read)."""
    max_f = 0
    for t in model.get("trees", []):
        max_f = max(max_f, int(t["feature"]))
        for s in ("left", "right"):
            if isinstance(t[s], dict) and "leaf" not in t[s]:
                max_f = max(max_f, int(t[s]["feature"]))
    out = [0.0] * max(max_f + 1, len(x))
    for tree in model.get("trees", []):
        step = _tree_step(tree, x)
        path = _tree_path_features(tree, x)
        share = step / len(path)
        for j in path:
            out[j] += share
    return out