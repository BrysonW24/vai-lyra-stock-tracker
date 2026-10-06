"""
Unit tests for market context regime classification (testable without network).
"""

import pytest
from workers.stock_scanner.market_context import _classify_regime


class TestRegimeClassification:
    """Test deterministic regime classification logic."""

    def test_risk_off_high_vix(self):
        """Regime is risk_off when VIX > 25."""
        regime = _classify_regime(
            sp500_change=1.0,
            nasdaq_change=1.0,
            dow_change=1.0,
            vix_price=28.0,
            fear_greed=50,
        )
        assert regime == "risk_off"

    def test_risk_off_low_fear_greed(self):
        """Regime is risk_off when Fear & Greed < 30."""
        regime = _classify_regime(
            sp500_change=1.0,
            nasdaq_change=1.0,
            dow_change=1.0,
            vix_price=15.0,
            fear_greed=25,
        )
        assert regime == "risk_off"

    def test_risk_off_two_indices_down(self):
        """Regime is risk_off when 2+ indices are down."""
        regime = _classify_regime(
            sp500_change=-1.0,
            nasdaq_change=-1.0,
            dow_change=0.5,
            vix_price=15.0,
            fear_greed=50,
        )
        assert regime == "risk_off"

    def test_risk_on_all_conditions_met(self):
        """Regime is risk_on when VIX < 15, F&G > 70, and all indices green."""
        regime = _classify_regime(
            sp500_change=1.5,
            nasdaq_change=2.0,
            dow_change=1.0,
            vix_price=12.0,
            fear_greed=80,
        )
        assert regime == "risk_on"

    def test_risk_on_fails_if_one_index_down(self):
        """Regime is not risk_on if any index is down."""
        regime = _classify_regime(
            sp500_change=1.5,
            nasdaq_change=-0.5,
            dow_change=1.0,
            vix_price=12.0,
            fear_greed=80,
        )
        assert regime == "neutral"

    def test_risk_on_fails_if_vix_too_high(self):
        """Regime is not risk_on if VIX >= 15."""
        regime = _classify_regime(
            sp500_change=1.5,
            nasdaq_change=2.0,
            dow_change=1.0,
            vix_price=15.0,
            fear_greed=80,
        )
        assert regime == "neutral"

    def test_risk_on_fails_if_fear_greed_low(self):
        """Regime is not risk_on if Fear & Greed <= 70."""
        regime = _classify_regime(
            sp500_change=1.5,
            nasdaq_change=2.0,
            dow_change=1.0,
            vix_price=12.0,
            fear_greed=70,
        )
        assert regime == "neutral"

    def test_neutral_mixed_conditions(self):
        """Regime is neutral with mixed conditions."""
        regime = _classify_regime(
            sp500_change=1.0,
            nasdaq_change=-0.5,
            dow_change=0.5,
            vix_price=18.0,
            fear_greed=50,
        )
        assert regime == "neutral"

    def test_handles_none_values(self):
        """Regime classification handles None values gracefully."""
        # All None: should default to neutral
        regime = _classify_regime(
            sp500_change=None,
            nasdaq_change=None,
            dow_change=None,
            vix_price=None,
            fear_greed=None,
        )
        assert regime == "neutral"

        # Partial None: should still classify
        regime = _classify_regime(
            sp500_change=1.0,
            nasdaq_change=1.0,
            dow_change=None,
            vix_price=12.0,
            fear_greed=80,
        )
        assert regime == "risk_on"

    def test_zero_changes(self):
        """Regime classification handles zero changes."""
        regime = _classify_regime(
            sp500_change=0.0,
            nasdaq_change=0.0,
            dow_change=0.0,
            vix_price=15.0,
            fear_greed=50,
        )
        assert regime == "neutral"

    def test_vix_exactly_25(self):
        """VIX = 25 is at the boundary; should not trigger risk_off."""
        regime = _classify_regime(
            sp500_change=1.0,
            nasdaq_change=1.0,
            dow_change=1.0,
            vix_price=25.0,
            fear_greed=50,
        )
        # VIX > 25 is the trigger, so exactly 25 should be neutral
        assert regime == "neutral"

    def test_fear_greed_exactly_30(self):
        """Fear & Greed = 30 is at the boundary; should not trigger risk_off."""
        regime = _classify_regime(
            sp500_change=1.0,
            nasdaq_change=1.0,
            dow_change=1.0,
            vix_price=15.0,
            fear_greed=30,
        )
        # Fear & Greed < 30 is the trigger, so exactly 30 should be neutral
        assert regime == "neutral"


class TestSessionChange:
    """The one-session change comes from the daily bars, never from chartPreviousClose."""

    @staticmethod
    def _result(meta: dict, bars: list[tuple[str, float | None]]) -> dict:
        from datetime import datetime, timezone

        timestamps = [int(datetime.fromisoformat(stamp).replace(tzinfo=timezone.utc).timestamp()) for stamp, _ in bars]
        return {
            "meta": meta,
            "timestamp": timestamps,
            "indicators": {"quote": [{"close": [close for _, close in bars]}]},
        }

    def test_closed_market_uses_the_previous_session_not_the_range_start(self):
        """Recorded 2026-10-05 (Monday pre-market): chartPreviousClose was the Sep 30 close, so the
        old code reported +0.93% for a session that moved +0.73%."""
        from workers.stock_scanner.market_context import _session_change

        result = self._result(
            {"regularMarketPrice": 7722.72, "chartPreviousClose": 7651.54, "gmtoffset": -14400},
            [("2026-09-30T13:30", 7651.54), ("2026-10-01T13:30", 7666.4502), ("2026-10-02T13:30", 7722.7202)],
        )
        change = _session_change(result)
        assert change["price"] == 7722.72
        assert round(change["change_pct"], 3) == round((7722.72 / 7666.4502 - 1) * 100, 3)
        assert change["session_date"] == "2026-10-02"

    def test_in_session_measures_against_yesterday(self):
        from workers.stock_scanner.market_context import _session_change

        result = self._result(
            {"regularMarketPrice": 16.12, "gmtoffset": -14400},
            [("2026-10-01T07:00", 16.39), ("2026-10-02T07:00", 15.31), ("2026-10-05T07:00", 16.12)],
        )
        change = _session_change(result)
        assert round(change["change_pct"], 3) == round((16.12 / 15.31 - 1) * 100, 3)
        assert change["session_date"] == "2026-10-05"

    def test_null_and_duplicate_bars_for_today_are_not_mistaken_for_yesterday(self):
        """Recorded for ^AXJO: a null placeholder bar at the local open plus a live bar later the
        same local day. Both are 'today'; the previous session is the bar before them."""
        from workers.stock_scanner.market_context import _session_change

        result = self._result(
            {"regularMarketPrice": 8686.4, "gmtoffset": 39600},
            [("2026-10-01T00:00", 8614.4), ("2026-10-02T00:00", 8682.0996), ("2026-10-04T23:00", None), ("2026-10-05T05:50", 8686.4004)],
        )
        change = _session_change(result)
        assert change["session_date"] == "2026-10-05"
        assert round(change["change_pct"], 3) == round((8686.4 / 8682.0996 - 1) * 100, 3)

    def test_missing_price_or_history_yields_no_change(self):
        from workers.stock_scanner.market_context import _session_change

        assert _session_change({"meta": {}, "timestamp": [], "indicators": {"quote": [{}]}})["change_pct"] is None
        only_today = self._result({"regularMarketPrice": 10.0, "gmtoffset": 0}, [("2026-10-05T13:30", 10.0)])
        assert _session_change(only_today)["change_pct"] is None
        assert _session_change(only_today)["session_date"] == "2026-10-05"
