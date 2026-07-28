"""Engine-level pin for the watch-rule score floor (2026-07-27 audit V4 P1).

The route defends against target_signal_score = 0 by flooring it to 60 (see
src/lib/watchlist-rule.ts). These tests document WHY that floor exists at the engine level: a bare
rule with target_signal_score = 0 fires on EVERY scan because signal_score >= 0 is always true, and
they prove a floored threshold (60) correctly withholds "triggered" from a weak signal.
"""
from __future__ import annotations

from datetime import datetime, timezone

from tests.test_signal_engine import snapshot
from workers.stock_scanner.models import SignalResult, WatchlistItem
from workers.stock_scanner.watchlist_engine import watchlist_trigger_state


def _signal(score: float, status: str = "no_signal") -> SignalResult:
    return SignalResult(
        symbol="AMD",
        timeframe="1h",
        candle_time=datetime(2026, 7, 20, 14, 0, tzinfo=timezone.utc),
        signal_type="oversold_recovery",
        signal_status=status,
        signal_score=score,
        previous_signal_score=None,
        signal_score_delta=None,
        action_state="hold",
        lifecycle_state="unchanged",
        explanation={},
        raw_payload={},
    )


def test_bare_rule_with_zero_target_always_triggers() -> None:
    # A bare rule: no price target, default 0-100 RSI band, no volume/macd requirement, and the
    # dataclass default target_signal_score = 0. Even a WEAK signal (score 20) reads "triggered"
    # because 20 >= 0 - the false green the route floor was added to prevent.
    indicator = snapshot(rsi=46.0, histogram=-0.45, volume=1300.0, volume_ratio=1.3, close=164.0)
    bare = WatchlistItem(id="w-bare", symbol="AMD", target_price=None)  # target_signal_score defaults to 0.0
    assert bare.target_signal_score == 0.0
    assert watchlist_trigger_state(bare, indicator, _signal(20.0)) == "triggered"


def test_floored_threshold_withholds_trigger_from_a_weak_signal() -> None:
    # The same bare rule but with the route's floor (60) applied: a weak signal (score 20) is now
    # "not_ready" (20 < 60 and 20 < 60-10), not a false "triggered".
    indicator = snapshot(rsi=46.0, histogram=-0.45, volume=1300.0, volume_ratio=1.3, close=164.0)
    floored = WatchlistItem(id="w-floor", symbol="AMD", target_price=None, target_signal_score=60.0)
    assert watchlist_trigger_state(floored, indicator, _signal(20.0)) == "not_ready"


def test_floored_threshold_still_triggers_on_a_genuine_strong_setup() -> None:
    # The floor never blocks a real setup: a strong signal (score 80) that clears the 60 threshold and
    # meets the permissive price/rsi/volume conditions still reads "triggered".
    indicator = snapshot(rsi=46.0, histogram=-0.45, volume=1300.0, volume_ratio=1.3, close=164.0)
    floored = WatchlistItem(id="w-floor", symbol="AMD", target_price=None, target_signal_score=60.0)
    assert watchlist_trigger_state(floored, indicator, _signal(80.0, status="strong_setup")) == "triggered"
