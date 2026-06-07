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
