"""Python half of the cross-language score parity contract.

The SAME golden vectors (contracts/score-golden-vectors.json) are asserted by the TS scorer in
src/lib/__tests__/score-parity.test.ts. Together they guarantee the two independent
implementations of Lyra's deterministic score agree. The pre-existing Pine test only checked
that TS constants matched documented values - it could never catch Python-side drift. This can:
if signal_engine.py::calculate_score drifts from the shared numbers, this test goes red.

A vector carries only the fields the score reads; every other IndicatorSnapshot field is filled
with a null/neutral placeholder that the scorer does not look at.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from workers.stock_scanner.models import IndicatorSnapshot
from workers.stock_scanner.signal_engine import calculate_score

GOLDEN = json.loads(
    (Path(__file__).resolve().parents[1] / "contracts" / "score-golden-vectors.json").read_text()
)


def _snapshot(v: dict) -> IndicatorSnapshot:
    """Build a snapshot carrying exactly the vector's scored fields (rest are unread placeholders)."""
    return IndicatorSnapshot(
        symbol="TEST",
        timeframe="1h",
        candle_time=datetime(2026, 6, 2, 20, 0, tzinfo=timezone.utc),
        close=v["close"],
        volume=v["volume"],
        rsi_14=v["rsi14"],
        rsi_delta_1=v["rsiD1"],
        rsi_delta_2=v["rsiD2"],
        rsi_state="",
        macd=v["macd"],
        macd_signal=v["macdSignal"],
        macd_histogram=v["hist"],
        macd_histogram_delta_1=v["histD1"],
        macd_histogram_delta_2=v["histD2"],
        macd_state="",
        sma_20=v["sma20"],
        sma_50=v["sma50"],
        sma_200=v["sma200"],
        ema_12=None,
        ema_26=None,
        volume_sma_20=None,
        volume_ratio=v["volumeRatio"],
        volume_state="",
        price_vs_sma_20=None,
        price_vs_sma_50=None,
        price_vs_sma_200=None,
        distance_from_20_period_low=None,
        distance_from_60_period_low=v["distFrom60Low"],
        distance_from_120_period_low=None,
        trend_state="",
    )


def _previous(v: dict) -> IndicatorSnapshot | None:
    """A prior snapshot carrying only prevVolume, for the volume-increased term."""
    if v["prevVolume"] is None:
        return None
    prev = _snapshot(v)
    object.__setattr__(prev, "volume", v["prevVolume"])
    return prev


def test_golden_vector_set_is_non_trivial() -> None:
    assert len(GOLDEN["cases"]) >= 5


@pytest.mark.parametrize("case", GOLDEN["cases"], ids=[c["name"] for c in GOLDEN["cases"]])
def test_score_matches_golden(case: dict) -> None:
    v = case["inputs"]
    exp = case["expected"]
    result = calculate_score(_snapshot(v), _previous(v))
    assert result.rsi_score == exp["rsiScore"]
    assert result.macd_score == exp["macdScore"]
    assert result.price_location_score == exp["priceLocationScore"]
    assert result.trend_score == exp["trendScore"]
    assert result.volume_score == exp["volumeScore"]
    assert result.final_score == exp["final"]
