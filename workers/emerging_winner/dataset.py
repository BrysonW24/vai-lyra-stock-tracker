"""
Training-dataset layer for the Emerging Winner Classifier (Model 2 / Gate 2).

This is the "get the dataset ready to train" slice. It has three honest halves:

1. THE REAL POINT-IN-TIME PATH (`assemble_training_rows`). The 056 shadow-live ledger is, by design, a
   point-in-time feature store + label store: `emerging_winner_predictions.payload` records the exact
   feature/domain state as-of the prediction (immutable, append-only), and `emerging_winner_outcomes`
   records the matured first-touch barrier 12 months later. A training row is simply a matured prediction
   joined to its outcome. No look-ahead is possible - the features were frozen before the outcome existed.

2. THE LABELER (`first_touch_barrier`). Turns a forward price path into the honest label the outcomes
   table stores: which barrier (+100% up / -80% down) is touched FIRST within the horizon, or neither.
   This is what the maturation job writes into `emerging_winner_outcomes.barrier_hit`.

3. THE BOOTSTRAP (`make_bootstrap_dataset`). Real ledger labels take 12 months to mature, so - exactly like
   `workers/stock_scanner/ml/recovery_model.py` - training bootstraps on a REPRODUCIBLE reference dataset
   whose data-generating process encodes the winner hypothesis (theme / government / sponsorship / business
   quality separate winners from also-rans). This proves the learning + calibration + walk-forward machinery
   is real and generalises out-of-sample; `provenance` states plainly it is not trained on real winners yet.

`load_training_dataset()` returns the real ledger rows once enough outcomes have matured, else the
bootstrap - so training is runnable TODAY and upgrades itself the moment real labels exist, with the
feature contract and export format unchanged.

DEPENDENCY-FREE: pure Python stdlib (no numpy/pandas), so it trains + backtests anywhere, including CI.
Research only - it informs a resemblance score, it never decides an action.
"""
from __future__ import annotations

import datetime
import random
from dataclasses import dataclass
from typing import Optional

from .domains import DOMAIN_REGISTRY, DOMAIN_WEIGHTS, score_domains

# The 10 domains in canonical order - the model's feature order. Kept in lockstep with DOMAIN_REGISTRY.
FEATURE_ORDER: list[str] = [fn(dict()).key for fn in DOMAIN_REGISTRY]

# Barrier definitions for the multi-bagger, 12-month, first-touch move. This is the +100% FIRST-TOUCH input
# (spec Decision B option 1); the LIVE training/health label is `label_from_outcome` (option 4), which adds
# the survival + liquidity conjuncts on top of this barrier.
UP_BARRIER_PCT = 100.0     # winner = +100% (multi-bagger)
DOWN_BARRIER_PCT = -80.0   # ruin = -80% (delisting / destructive dilution proxy)
HORIZON_TRADING_DAYS = 252  # ~12 months


# --- 1. features ----------------------------------------------------------------------------------

def domain_features(domain_results) -> tuple[list[float], float]:
    """The 10 domain scores as model features + the completeness scalar.

    Each domain -> (score - 50) / 50 in [-1, 1] when available, else 0.0 (neutral imputation). The model
    also receives `completeness` (fraction of domains available) so it can discount a thin read rather than
    treat a missing domain as a weak one - matching the deterministic classifier's coverage-honesty."""
    by_key = {d.key: d for d in domain_results}
    feats: list[float] = []
    present = 0
    for key in FEATURE_ORDER:
        d = by_key.get(key)
        if d is not None and d.score is not None:
            feats.append((d.score - 50.0) / 50.0)
            present += 1
        else:
            feats.append(0.0)
    completeness = present / len(FEATURE_ORDER) if FEATURE_ORDER else 0.0
    return feats, completeness


def features_from_raw(features: dict) -> tuple[list[float], float]:
    """Convenience: raw feature dict -> (model features, completeness) via the deterministic domains."""
    return domain_features(score_domains(features))


# --- 2. the first-touch barrier labeler -----------------------------------------------------------

def first_touch_barrier(
    forward_prices: list[float],
    entry_price: Optional[float] = None,
    up_pct: float = UP_BARRIER_PCT,
    down_pct: float = DOWN_BARRIER_PCT,
    horizon: int = HORIZON_TRADING_DAYS,
) -> str:
    """Which barrier is touched FIRST within the horizon: 'up_100' | 'down_80' | 'neither'.

    forward_prices are the prices AFTER entry, in order. entry_price defaults to the first forward price.
    First-touch is decided bar by bar so a name that ran +100% then collapsed is still a winner (it hit the
    up barrier first), and one that fell -80% then recovered is still ruin. No look-ahead within the bar:
    the down barrier is checked before the up barrier on the same bar (conservative)."""
    if not forward_prices:
        return "neither"
    base = entry_price if entry_price is not None else forward_prices[0]
    if base <= 0:
        return "neither"
    up_level = base * (1.0 + up_pct / 100.0)
    down_level = base * (1.0 + down_pct / 100.0)
    for price in forward_prices[:horizon]:
        if price <= down_level:
            return "down_80"
        if price >= up_level:
            return "up_100"
    return "neither"


def label_from_barrier(barrier: str) -> int:
    """The +100% first-touch barrier as a 0/1 (Decision B option 1). This is one CONJUNCT of the live label -
    the full training/health label is `label_from_outcome` (option 4), which also requires survival + liquidity."""
    return 1 if barrier == "up_100" else 0


def _conjunct_holds(value) -> bool:
    """A quality conjunct passes UNLESS it is affirmatively false. Missing / None = 'not yet measured' -> passes,
    so the label degrades cleanly to option 1 until the maturation job populates the field. Only a real False
    (or a false-y string from a JSON row) excludes a would-be winner."""
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip().lower() not in {"false", "f", "0", "no", ""}
    return bool(value)


def label_from_outcome(outcome: dict) -> int:
    """Binary winner label - Decision B **option 4** (composite quality-winner):

        winner = first-touch +100%  AND  still listed at horizon end  AND  dollar-liquidity grew.

    Why option 4 over the naive +100% (MODEL-SELECTION-AND-OSS-STACK.md 3.1): a bare first-touch label rewards
    pump-and-dumps and dead-cat spikes - exactly the high-MAX lottery population that Bali/Cakici/Whitelaw
    (JFE 2011) show is subsequently *negatively* priced. The survival + liquidity conjuncts filter that
    population out, so the model learns durable emergence rather than a transient spike.

    INERT SEAM today: outcome rows do not yet carry `still_listed` / `liquidity_grew` (that needs delisting +
    dollar-volume history the maturation job adds once the data gate is bought), so both conjuncts default to
    pass and this is byte-identical to option 1. It tightens automatically the moment those fields are written -
    no relabel, no retrain. Doing the seam now costs nothing; doing it after the dataset exists costs a relabel."""
    if label_from_barrier(str(outcome.get("barrier_hit"))) != 1:
        return 0
    if not _conjunct_holds(outcome.get("still_listed")):
        return 0
    if not _conjunct_holds(outcome.get("liquidity_grew")):
        return 0
    return 1


# --- point-in-time timestamp helpers (feed the purged walk-forward + per-cohort metrics) ------------

def predicted_at_ordinal(predicted_at: str) -> Optional[float]:
    """`predicted_at` -> an ordinal day number for time-ordering + purge/embargo. None if unparseable."""
    try:
        return float(datetime.date.fromisoformat(str(predicted_at)[:10]).toordinal())
    except (ValueError, TypeError):
        return None


def predicted_at_quarter(predicted_at: str) -> Optional[str]:
    """`predicted_at` -> a scoring-cohort key ('2026Q1') so precision@k is measured per quarter, not pooled."""
    try:
        d = datetime.date.fromisoformat(str(predicted_at)[:10])
        return f"{d.year}Q{(d.month - 1) // 3 + 1}"
    except (ValueError, TypeError):
        return None


# --- 3. real point-in-time assembly (ledger predictions x matured outcomes) ------------------------

@dataclass
class TrainingRow:
    features: list[float]
    completeness: float
    label: int
    symbol: str
    predicted_at: str


def assemble_training_rows(predictions: list[dict], outcomes: list[dict]) -> list[TrainingRow]:
    """Join immutable ledger predictions (features@T) to their matured outcomes (label) into training rows.

    predictions: rows from emerging_winner_predictions (need id, symbol, predicted_at, payload with the
                 domain state). outcomes: rows from emerging_winner_outcomes (prediction_id, barrier_hit).
    Only predictions with a matured outcome become rows - so there is never a look-ahead label."""
    outcome_by_pred: dict[str, dict] = {}
    for o in outcomes:
        pid = o.get("prediction_id")
        if pid is not None and o.get("barrier_hit"):
            outcome_by_pred[str(pid)] = o
    rows: list[TrainingRow] = []
    for p in predictions:
        pid = str(p.get("id"))
        outcome = outcome_by_pred.get(pid)
        if outcome is None:
            continue
        payload = p.get("payload") or {}
        domains = payload.get("domains") or payload.get("scorecard", {}).get("domains") or []
        feats, completeness = _features_from_payload_domains(domains)
        rows.append(TrainingRow(
            features=feats,
            completeness=completeness,
            label=label_from_outcome(outcome),
            symbol=str(p.get("symbol", "")),
            predicted_at=str(p.get("predicted_at", "")),
        ))
    return rows


def _features_from_payload_domains(domains: list[dict]) -> tuple[list[float], float]:
    """Rebuild the model feature vector from a stored payload's domain list (key + score)."""
    by_key = {d.get("key"): d for d in domains if isinstance(d, dict)}
    feats: list[float] = []
    present = 0
    for key in FEATURE_ORDER:
        d = by_key.get(key)
        score = d.get("score") if d else None
        if score is not None:
            feats.append((float(score) - 50.0) / 50.0)
            present += 1
        else:
            feats.append(0.0)
    completeness = present / len(FEATURE_ORDER) if FEATURE_ORDER else 0.0
    return feats, completeness


# --- 4. the reproducible bootstrap dataset --------------------------------------------------------

# The "true" propensity that LABELS bootstrap samples. Proportional to the hand-designed DOMAIN_WEIGHTS,
# so a well-fit model recovers the hypothesised importance (theme / government / sponsorship / business
# quality weigh most) and the walk-forward measures whether that hypothesis is learnable out-of-sample.
_TRUE_W: list[float] = [DOMAIN_WEIGHTS[k] / 12.0 for k in FEATURE_ORDER]
_TRUE_COMPLETENESS_W = 0.4  # a fuller read is mildly more likely to be a real winner
_TRUE_B = -3.1              # tuned for a rare-positive base rate (~4-7%), matching multi-bagger reality


def _sigmoid(z: float) -> float:
    import math
    if z >= 0:
        return 1.0 / (1.0 + math.exp(-z))
    e = math.exp(z)
    return e / (1.0 + e)


def make_bootstrap_dataset(n: int = 6000, seed: int = 42) -> tuple[list[list[float]], list[int], list[float]]:
    """Reproducible reference dataset over the 10 domain features. Returns (X, y, completeness_list).

    Each sample draws a domain score for every domain, drops a random subset to simulate today's coverage
    reality (some pipelines unbuilt), and is labelled by the hypothesis propensity. Rare positives by design."""
    rng = random.Random(seed)
    X: list[list[float]] = []
    y: list[int] = []
    comps: list[float] = []
    for _ in range(n):
        feats: list[float] = []
        present = 0
        for _key in FEATURE_ORDER:
            # ~25% of domains missing on average (coverage reality); present ones drawn 0-100.
            if rng.random() < 0.25:
                feats.append(0.0)
            else:
                score = rng.uniform(0.0, 100.0)
                feats.append((score - 50.0) / 50.0)
                present += 1
        completeness = present / len(FEATURE_ORDER)
        z = _TRUE_B + sum(tw * f for tw, f in zip(_TRUE_W, feats)) + _TRUE_COMPLETENESS_W * (completeness - 0.5)
        prob = _sigmoid(z)
        label = 1 if rng.random() < prob else 0
        X.append(feats)
        y.append(label)
        comps.append(completeness)
    return X, y, comps


def load_training_dataset(
    predictions: Optional[list[dict]] = None,
    outcomes: Optional[list[dict]] = None,
    min_matured: int = 200,
    n_bootstrap: int = 6000,
    seed: int = 42,
    source_label: Optional[str] = None,
    provenance_note: Optional[str] = None,
) -> dict:
    """Return the training dataset + its provenance. Real ledger rows once >= min_matured outcomes have
    matured, else the reproducible bootstrap. The classifier's feature contract is identical either way.

    `source_label` / `provenance_note` let a NON-ledger point-in-time supplier (the historical backtest
    corpus) state its own honest provenance instead of inheriting the ledger wording - the rows flow
    through the identical assembly, but the artifact must never claim they came from the 056 ledger."""
    if predictions is not None and outcomes is not None:
        rows = assemble_training_rows(predictions, outcomes)
        if len(rows) >= min_matured:
            times = [predicted_at_ordinal(r.predicted_at) for r in rows]
            cohorts = [predicted_at_quarter(r.predicted_at) for r in rows]
            # Purge/embargo needs a reliable timeline; if any timestamp is unparseable, fall back to
            # index-order (times=None) rather than purge on a partial/wrong clock.
            if any(t is None for t in times):
                times = None
            return {
                "X": [r.features for r in rows],
                "y": [r.label for r in rows],
                "completeness": [r.completeness for r in rows],
                "times": times,
                "cohorts": cohorts,
                "source": source_label or "point-in-time-ledger",
                "n": len(rows),
                "provenance": provenance_note or (
                    f"Real point-in-time rows: {len(rows)} matured predictions from the 056 shadow-live "
                    "ledger joined to their first-touch outcomes. No look-ahead - features were frozen "
                    "before the outcome existed."
                ),
            }
    X, y, comps = make_bootstrap_dataset(n_bootstrap, seed)
    return {
        "X": X,
        "y": y,
        "completeness": comps,
        # i.i.d. bootstrap draws have no timeline, so no label windows overlap: purge is correctly a no-op
        # and the walk-forward runs index-ordered. Real ledger rows above carry a genuine timeline.
        "times": None,
        "cohorts": None,
        "source": "bootstrap-synthetic",
        "n": len(X),
        "provenance": (
            f"Bootstrap-synthetic ({len(X)} rows, seed {seed}): a reproducible reference dataset whose "
            "data-generating process encodes the winner hypothesis (weights proportional to DOMAIN_WEIGHTS). "
            "Proves the learning + walk-forward + calibration machinery and its out-of-sample lift. NOT "
            "trained on real winners - retrains automatically once >= "
            f"{min_matured} real outcomes mature in the ledger."
        ),
    }
