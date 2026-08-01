"""Pins for the outcome-maturation job's pure labeling seam (mature_prediction).

The invariant that matters most: live maturation and the backtest corpus share ONE label
implementation (history_source.label_forward), so a row matured tonight and a row matured in the
historical corpus can never disagree about what a winner is."""
import datetime as dt

from workers.emerging_winner.history_source import DailyBar
from workers.emerging_winner.outcome_job import mature_prediction


def _bar(day: str, close: float, volume: float = 500_000.0) -> DailyBar:
    return DailyBar(day, close, close * 1.02, close * 0.98, close, volume, close)


def _weekdays(start: str, n: int, price) -> list[DailyBar]:
    out = []
    d = dt.date.fromisoformat(start)
    i = 0
    while len(out) < n:
        if d.weekday() < 5:
            out.append(_bar(d.isoformat(), price(i) if callable(price) else float(price)))
            i += 1
        d += dt.timedelta(days=1)
    return out


def test_winner_matures_the_moment_the_barrier_resolves():
    bars = _weekdays("2025-01-01", 40, lambda i: 10.0 if i < 20 else 25.0)  # +150% jump at bar 20
    out = mature_prediction("2025-01-06", bars, data_end="2025-03-01")
    assert out is not None and out["barrier_hit"] == "up_100"
    assert out["entry_price"] == 10.0
    assert out["horizon_days"] == 252


def test_ruin_matures_early_too():
    bars = _weekdays("2025-01-01", 40, lambda i: 10.0 if i < 15 else 1.5)
    out = mature_prediction("2025-01-06", bars, data_end="2025-03-01")
    assert out is not None and out["barrier_hit"] == "down_80"


def test_unresolved_open_window_stays_immature():
    bars = _weekdays("2025-01-01", 60, lambda i: 10.0 + 0.01 * i)  # drifting, no barrier
    assert mature_prediction("2025-01-06", bars, data_end="2025-04-01") is None


def test_gone_dark_matures_as_delisting_proxy():
    bars = _weekdays("2025-01-01", 30, 10.0)  # series stops in Feb while data runs to July
    out = mature_prediction("2025-01-06", bars, data_end="2025-07-01")
    assert out is not None
    assert out["barrier_hit"] == "neither" and out["still_listed"] is False


def test_prediction_before_any_bars_is_not_labelable():
    bars = _weekdays("2025-06-01", 30, 10.0)
    assert mature_prediction("2025-01-06", bars, data_end="2025-08-01") is None
