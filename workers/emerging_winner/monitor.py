"""
Monitoring for the Emerging Winner Classifier - the fourth stage of the model lifecycle (train ->
deploy -> MONITOR -> infer).

Two jobs, both honest and dependency-free:

1. DRIFT GUARD (`verify_drift_guard`). The frozen champion artifact ships drift fixtures (domain scores ->
   probability). This re-runs each fixture through the DEPLOYED inference path and asserts they still match,
   so the training-time model and the serving-time model can never silently diverge (the same guarantee
   recovery_model.py gets from its TS mirror). Runs in CI via the test suite.

2. LIVE MODEL HEALTH (`model_health` + `run_monitor`). Reads the 056 shadow-live ledger: prediction volume,
   stage + confidence distribution, mean completeness (coverage), and - once outcomes mature - the LIVE
   calibration (predicted probability vs realised winner rate) + precision@k + lift over the base rate. This
   is how we decide, honestly and slowly, whether the shadow-live model has earned the right to be surfaced.

Nothing here surfaces a number to a user or decides an action. Research only.

    python -m workers.emerging_winner.monitor        # print the live model-health report (demo-safe)
"""
from __future__ import annotations

import json
import logging
import os
from typing import Optional

from .dataset import FEATURE_ORDER, label_from_barrier
from .train import calibration_bins, precision_at_k

logger = logging.getLogger("emerging_winner.monitor")

_ARTIFACT_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "src", "lib", "generated", "emerging-winner-model.json"
)


# --- 1. drift guard -------------------------------------------------------------------------------

def verify_drift_guard(path: str = _ARTIFACT_PATH) -> dict:
    """Re-run every frozen fixture through the deployed classifier and report the max probability error.
    max_error ~0 means training-time and serving-time inference agree exactly."""
    from .classifier import _classify_trained, load_champion_model
    from .domains import DomainResult

    model = load_champion_model(path)
    if model is None:
        return {"ok": False, "reason": "no champion artifact", "max_error": None, "n": 0}
    with open(os.path.abspath(path)) as fh:
        fixtures = json.load(fh).get("fixtures", [])
    max_error = 0.0
    for fx in fixtures:
        domains = [
            DomainResult(k, k, s, "full" if s is not None else "unavailable", "")
            for k, s in zip(FEATURE_ORDER, fx["scores"])
        ]
        got = _classify_trained(domains, model).probability
        max_error = max(max_error, abs(got - fx["probability"]))
    return {"ok": max_error < 1e-6, "max_error": max_error, "n": len(fixtures),
            "model_version": model.model_version}


# --- 2. live model health (pure functions over ledger rows) ---------------------------------------

def summarize_predictions(predictions: list[dict]) -> dict:
    """Volume + distribution summary of a set of ledger predictions."""
    n = len(predictions)
    if n == 0:
        return {"n": 0}
    stages: dict[str, int] = {}
    confid: dict[str, int] = {}
    sim_sum = 0.0
    comp_sum = 0.0
    for p in predictions:
        stages[str(p.get("stage_label", "?"))] = stages.get(str(p.get("stage_label", "?")), 0) + 1
        payload = p.get("payload") or {}
        conf = str(payload.get("confidence") or p.get("confidence") or "?")
        confid[conf] = confid.get(conf, 0) + 1
        sim_sum += float(p.get("winner_similarity") or 0.0)
        comp_sum += float(p.get("completeness") or 0.0)
    return {
        "n": n,
        "mean_similarity": round(sim_sum / n, 2),
        "mean_completeness": round(comp_sum / n, 3),
        "stage_distribution": stages,
        "confidence_distribution": confid,
    }


def matured_pairs(predictions: list[dict], outcomes: list[dict]) -> list[tuple[float, int]]:
    """(predicted probability, realised winner label) pairs for predictions whose outcome has matured."""
    prob_by_pred: dict[str, float] = {str(p.get("id")): float(p.get("probability") or 0.0) for p in predictions}
    pairs: list[tuple[float, int]] = []
    for o in outcomes:
        pid = str(o.get("prediction_id"))
        barrier = o.get("barrier_hit")
        if pid in prob_by_pred and barrier:
            pairs.append((prob_by_pred[pid], label_from_barrier(str(barrier))))
    return pairs


def model_health(predictions: list[dict], outcomes: list[dict], k_frac: float = 0.1) -> dict:
    """Combined live health report. Calibration + precision@k only appear once outcomes have matured."""
    report: dict = {"summary": summarize_predictions(predictions), "matured": len(outcomes)}
    pairs = matured_pairs(predictions, outcomes)
    if len(pairs) >= 20:  # need a minimum before calibration means anything
        p = [pr for pr, _ in pairs]
        y = [lb for _, lb in pairs]
        base = sum(y) / len(y)
        prec, k = precision_at_k(y, p, k_frac)
        report["live"] = {
            "n_matured_pairs": len(pairs),
            "base_rate": round(base, 4),
            "precision_at_k": round(prec, 4),
            "lift_at_k": round(prec / base, 3) if base > 0 else None,
            "k": k,
            "calibration": calibration_bins(y, p),
        }
        report["verdict"] = _verdict(report["live"])
    else:
        report["verdict"] = (
            f"shadow-live: {len(pairs)} matured pairs (< 20). Keep logging; calibration is not yet "
            "meaningful. The model stays behind the shadow gate."
        )
    return report


def _verdict(live: dict) -> str:
    lift = live.get("lift_at_k")
    calib = live.get("calibration") or []
    # Mean absolute calibration error over bins (weighted by n).
    tot = sum(b["n"] for b in calib) or 1
    ece = sum(abs(b["predicted"] - b["actual"]) * b["n"] for b in calib) / tot
    if lift and lift >= 2.0 and ece <= 0.1:
        return f"calibrated (ECE {ece:.3f}) with {lift}x lift - candidate to earn surfacing (founder-gated)."
    return f"not yet earned: lift {lift}, ECE {ece:.3f}. Stay shadow-live."


# --- worker (demo-safe) ---------------------------------------------------------------------------

def run_monitor() -> dict:
    """Read the ledger and produce the health report. Demo-safe: no Supabase -> reports drift-guard only."""
    drift = verify_drift_guard()
    try:
        from .repo import EmergingWinnerRepo
        repo = EmergingWinnerRepo()
        predictions = repo.fetch_predictions() if repo.enabled else []
        outcomes = repo.fetch_outcomes() if repo.enabled else []
    except Exception as exc:  # pragma: no cover - env/dependency degrades to drift-only
        logger.warning("ledger read unavailable: %s", exc)
        predictions, outcomes = [], []
    report = model_health(predictions, outcomes)
    report["drift_guard"] = drift
    return report


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    rep = run_monitor()
    dg = rep["drift_guard"]
    print(f"drift-guard: ok={dg['ok']} max_error={dg['max_error']} n={dg['n']} ({dg.get('model_version')})")
    s = rep["summary"]
    if s.get("n"):
        print(f"ledger: {s['n']} predictions | mean similarity {s['mean_similarity']} | "
              f"mean completeness {s['mean_completeness']} | stages {s['stage_distribution']}")
    else:
        print("ledger: no predictions yet (demo mode or empty ledger)")
    print(f"verdict: {rep['verdict']}")
