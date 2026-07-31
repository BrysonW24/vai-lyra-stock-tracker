"""
Outcome-distribution estimator (spec Gate 7 / models 16-19, 56-58).

Mean-return prediction is insufficient for extremely skewed small-cap outcomes, so the engine reports a
distribution: P(2x), P(5x), P(10x), P(-80%/delisting), survivability, expected time-to-catalyst and
expected drawdown - matching the finding format in the spec (lines 2025-2033).

v1 is an HONEST REFERENCE mapping from the classifier probability + risk penalty + coverage to a coarse
distribution. It is NOT a trained competing-risk / distributional model (that is Production v2, spec
lines 2066-2073). The point of shipping it now is the output contract + the surface; a real quantile /
competing-risk model drops in behind this interface later. Every value is flagged `reference-v1`.

The distribution respects the spec's core objective (lines 5-13): asymmetric payoff is only attractive
if survival-weighted and after ruin risk - so a high upside with a high P(-80%) is reported honestly,
never smoothed away.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class OutcomeDistribution:
    p_2x_24m: float
    p_5x_36m: float
    p_10x_60m: float
    p_ruin: float                 # P(-80% / delisting / destructive dilution)
    survivability: str            # low / medium / medium-high / high
    expected_time_to_catalyst_months: int
    expected_max_drawdown_pct: float
    provenance: str = (
        "reference-v1 (shadow-live): coarse distribution derived from the classifier probability and "
        "risk penalty; not a trained competing-risk model. Modelled estimate, not a promise."
    )

    def to_dict(self) -> dict:
        return {
            "p_2x_24m": round(self.p_2x_24m, 3),
            "p_5x_36m": round(self.p_5x_36m, 3),
            "p_10x_60m": round(self.p_10x_60m, 3),
            "p_ruin": round(self.p_ruin, 3),
            "survivability": self.survivability,
            "expected_time_to_catalyst_months": self.expected_time_to_catalyst_months,
            "expected_max_drawdown_pct": round(self.expected_max_drawdown_pct, 1),
            "provenance": self.provenance,
        }


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def estimate_distribution(probability: float, risk_penalty: float, completeness: float) -> OutcomeDistribution:
    """probability in [0,1] (classifier), risk_penalty in [0,100], completeness in [0,1]."""
    risk = risk_penalty / 100.0

    # Upside probabilities scale with winner probability and decay for rarer multiples; risk shrinks them.
    p_2x = _clamp(probability * 0.55 * (1.0 - 0.4 * risk), 0.0, 0.9)
    p_5x = _clamp(probability * 0.22 * (1.0 - 0.5 * risk), 0.0, 0.6)
    p_10x = _clamp(probability * 0.08 * (1.0 - 0.6 * risk), 0.0, 0.35)

    # Ruin probability rises with risk and falls (mildly) with a stronger structural profile.
    p_ruin = _clamp(0.10 + 0.6 * risk - 0.15 * probability, 0.02, 0.9)

    # Survivability bucket from ruin probability.
    if p_ruin < 0.12:
        surv = "high"
    elif p_ruin < 0.25:
        surv = "medium-high"
    elif p_ruin < 0.45:
        surv = "medium"
    else:
        surv = "low"

    # Stronger, less-risky names tend to have a nearer catalyst; thin coverage widens the estimate.
    ttc = int(round(6 + (1 - probability) * 12 + risk * 6 + (1 - completeness) * 4))
    exp_dd = -_clamp(20 + risk * 45 + (1 - probability) * 15, 15.0, 80.0)

    return OutcomeDistribution(
        p_2x_24m=p_2x, p_5x_36m=p_5x, p_10x_60m=p_10x, p_ruin=p_ruin,
        survivability=surv, expected_time_to_catalyst_months=ttc, expected_max_drawdown_pct=exp_dd,
    )
