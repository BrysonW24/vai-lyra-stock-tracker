"""Pins for the paired-difference test + weak-calibration statistics.

Why these exist: the gen-2 challenger was refused partly by eyeballing two overlapping marginal
CIs. That comparison is not a valid test of difference - two CIs can overlap substantially while
the paired difference is decisively one-sided, so the overlap habit will eventually block a
genuinely better challenger silently. From gen-3 the difference verdict is paired_delta_ci's
ci_excludes_zero on identical rows. ECE-only calibration reporting has the analogous hole: it
verifies moderate calibration and says nothing about weak (slope/intercept), which is where the
corpus-vs-deployment prevalence problem lives.
"""
import random

from workers.emerging_winner.backtest import _weak_calibration, paired_delta_ci


def _clustered_dataset(n_symbols: int = 120, rows_per: int = 8, seed: int = 5):
    """Symbol-clustered rows with a latent quality driving both label odds and a base score."""
    rng = random.Random(seed)
    y, p_a, symbols = [], [], []
    for s in range(n_symbols):
        quality = rng.uniform(0, 1)
        for _ in range(rows_per):
            yi = 1 if rng.random() < 0.05 + 0.25 * quality else 0
            y.append(yi)
            p_a.append(min(0.95, max(0.02, quality * 0.3 + rng.uniform(-0.05, 0.05))))
            symbols.append(f"SYM{s}")
    return y, p_a, symbols


def test_identical_models_show_zero_delta_and_no_verdict():
    y, p, symbols = _clustered_dataset()
    out = paired_delta_ci(y, p, list(p), symbols)
    assert out["point_delta_lift_at_k"] == 0.0
    assert out["lift_at_k"]["p05"] == 0.0 and out["lift_at_k"]["p95"] == 0.0
    assert out["lift_at_k"]["ci_excludes_zero"] is False


def test_paired_test_detects_what_marginal_overlap_hides():
    """The motivating failure mode, constructed: B is a small consistent improvement over A on the
    same rows. The two MARGINAL lift CIs overlap (the invalid overlap test would refuse B), while
    the PAIRED delta CI cleanly excludes zero (the valid test detects the improvement)."""
    from workers.emerging_winner.backtest import _symbol_bootstrap_ci

    rng = random.Random(9)
    y, p_a, symbols = _clustered_dataset(seed=9)
    # B = A plus a small positive bump on true winners only - a consistent per-row improvement,
    # sized so the marginal intervals still overlap while the paired test cleanly detects it.
    p_b = [min(0.97, pa + (0.012 if yi else 0.0) + rng.uniform(-0.001, 0.001))
           for pa, yi in zip(p_a, y)]
    ci_a = _symbol_bootstrap_ci(y, p_a, symbols, 0.05)["lift_at_k"]
    ci_b = _symbol_bootstrap_ci(y, p_b, symbols, 0.05)["lift_at_k"]
    assert ci_b["p05"] < ci_a["p95"], "construction check: the marginal CIs must overlap"
    paired = paired_delta_ci(y, p_a, p_b, symbols)
    assert paired["lift_at_k"]["ci_excludes_zero"] is True
    assert paired["lift_at_k"]["p05"] > 0, "the paired test must detect the consistent improvement"


def test_paired_delta_is_deterministic():
    y, p_a, symbols = _clustered_dataset(seed=13)
    p_b = [min(0.97, v + 0.01) for v in p_a]
    assert paired_delta_ci(y, p_a, p_b, symbols) == paired_delta_ci(y, p_a, p_b, symbols)


def test_weak_calibration_near_ideal_on_calibrated_probabilities():
    """When p IS the true rate, recalibration finds nothing: slope ~1, intercept ~0, |z| small."""
    rng = random.Random(21)
    y, p = [], []
    for _ in range(6000):
        pi = rng.choice([0.05, 0.1, 0.2, 0.35])
        p.append(pi)
        y.append(1 if rng.random() < pi else 0)
    out = _weak_calibration(y, p)
    assert 0.85 < out["slope"] < 1.15
    assert abs(out["intercept"]) < 0.15
    assert abs(out["spiegelhalter_z"]) < 2.5


def test_weak_calibration_intercept_catches_prevalence_shift():
    """Probabilities stated at a higher prevalence than reality: ECE-style binning can look decent
    while the intercept goes clearly negative - the corpus-13%-vs-deployment-3% failure, measured."""
    rng = random.Random(22)
    y, p = [], []
    for _ in range(6000):
        pi = rng.choice([0.1, 0.2, 0.3])
        p.append(pi)
        true = pi / (pi + (1 - pi) * 4.0)  # true odds are 4x lower than stated
        y.append(1 if rng.random() < true else 0)
    out = _weak_calibration(y, p)
    assert out["intercept"] < -0.6, "systematic overconfidence must show as a negative intercept"
    assert abs(out["spiegelhalter_z"]) > 3, "and Spiegelhalter's z must reject at any sane level"


def test_metric_block_carries_weak_calibration():
    from workers.emerging_winner.backtest import _metric_block

    rng = random.Random(3)
    y = [1 if rng.random() < 0.15 else 0 for _ in range(800)]
    p = [rng.uniform(0.01, 0.5) for _ in range(800)]
    block = _metric_block(y, p, ["2024Q1"] * 800)
    wk = block["calibration_weak"]
    assert set(wk) >= {"slope", "intercept", "spiegelhalter_z", "spiegelhalter_p"}
