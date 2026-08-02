"""Pins for the volatility-only null (the honest chance bar for a barrier-touch label).

Why this null exists: "touches +X% within 12 months" is a first-passage event - a wild stock
touches any barrier more often than a calm one with zero information involved. Random selection
is therefore too easy a bar; the standing reference is the parameter-free trailing-sigma sort
(gen-2 holdout: 1.41x pooled, 6.15x inside the large tier where the champion's 2.84x had looked
like a finding). These pins keep the null itself honest.
"""
import json
import math
import os

from workers.emerging_winner.backtest import (
    VOL_NULL_MIN_BARS,
    VOL_NULL_WINDOW_BARS,
    _trailing_vol_scores,
    _weak_calibration,
)


def _write_price_cache(tmp_path, symbol, closes):
    d = tmp_path / "prices"
    d.mkdir(exist_ok=True)
    bars = [[f"2024-{1 + i // 21:02d}-{1 + i % 21:02d}", c, c, c, c, 1000, c]
            for i, c in enumerate(closes)]
    (d / f"{symbol}.json").write_text(json.dumps({"bars": bars, "source": "test"}))


def test_wilder_series_scores_higher_and_is_cache_only(tmp_path):
    calm = [100 * (1.001 ** i) for i in range(90)]
    wild = [100 * (1 + (0.08 if i % 2 else -0.07)) ** 1 for i in range(90)]
    wild = [100.0]
    for i in range(89):
        wild.append(wild[-1] * (1.08 if i % 2 else 0.93))
    _write_price_cache(tmp_path, "CALM", calm)
    _write_price_cache(tmp_path, "WILD", wild)
    rows = [{"symbol": "CALM", "predicted_at": "2024-05-01"},
            {"symbol": "WILD", "predicted_at": "2024-05-01"},
            {"symbol": "MISSING", "predicted_at": "2024-05-01"}]
    scores = _trailing_vol_scores(rows, str(tmp_path))
    assert scores[1] > scores[0] > 0.0, "the jumpy series must out-score the calm one"
    assert scores[2] == 0.0, "no cached bars = 0.0 (sinks to the bottom), never a network call"


def test_insufficient_history_scores_zero(tmp_path):
    _write_price_cache(tmp_path, "SHORT", [100.0 + i for i in range(VOL_NULL_MIN_BARS - 5)])
    rows = [{"symbol": "SHORT", "predicted_at": "2024-02-15"}]
    assert _trailing_vol_scores(rows, str(tmp_path)) == [0.0]


def test_window_constant_is_the_precommitted_one():
    assert VOL_NULL_WINDOW_BARS == 63 and VOL_NULL_MIN_BARS == 40, (
        "the null's window was pre-committed 2026-08-02; changing it re-opens forking-paths risk"
    )


def test_weak_calibration_survives_non_probability_scores():
    """Regression pin: raw sigma scores (>1, clipped to 1-eps) overflowed the Newton fit's
    unguarded exp() when the vol null was first benchmarked. Non-probability inputs must yield
    finite statistics, never a crash."""
    y = [1 if i % 7 == 0 else 0 for i in range(500)]
    p = [min(2.5, 0.05 + (i % 50) / 10.0) for i in range(500)]  # many values clip at 1-eps
    out = _weak_calibration(y, [min(1 - 1e-9, x) for x in p])
    assert out["slope"] is not None and math.isfinite(out["slope"])
    assert out["spiegelhalter_z"] is None or math.isfinite(out["spiegelhalter_z"])
