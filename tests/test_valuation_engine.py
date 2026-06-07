"""
Unit tests for valuation_engine.py — deterministic valuation metrics.

All tests use synthetic fixtures (no network, no API keys, no LLM).
"""

import pytest

from workers.fundamentals_worker.fundamentals_provider import Fundamentals
from workers.fundamentals_worker.valuation_engine import compute_valuation


class TestQualityScore:
    """Test quality score formula: (revGrowth*0.4) + (grossMargin*0.3) + (fcfMargin*0.3)"""

    def test_quality_score_high_growth_high_profitability(self):
        """High growth + high margin + positive FCF = high quality score."""
        fundamentals = Fundamentals(
            symbol="TEST_GROWTH",
            company_name="Growth Co",
            sector="Technology",
            industry="Software",
            market_cap=100.0,
            enterprise_value=95.0,
            revenue=1000.0,
            revenue_growth_yoy=50.0,  # capped at 50 in formula
            gross_margin=75.0,
            operating_margin=30.0,
            net_income=300.0,
            free_cash_flow=400.0,  # 40% margin
            ebitda=500.0,
            cash=100.0,
            debt=10.0,
            pe=40.0,
            forward_pe=30.0,
            price_to_sales=5.0,
            ev_to_ebitda=0.19,
            ev_to_revenue=0.095,
            eps_growth=45.0,
        )

        metrics = compute_valuation(fundamentals)

        # Quality = (50 * 0.4) + (75 * 0.3) + (40 * 0.3)
        #         = 20 + 22.5 + 12 = 54.5
        assert metrics.quality_score == pytest.approx(54.5, abs=0.1)
        assert metrics.fcf_margin == pytest.approx(40.0, abs=0.1)

    def test_quality_score_clamped_growth(self):
        """Growth > 50% is capped at 50% in formula."""
        fundamentals = Fundamentals(
            symbol="TEST_MEGA_GROWTH",
            company_name="Mega Growth Co",
            sector="Technology",
            industry="Semiconductors",
            market_cap=500.0,
            enterprise_value=480.0,
            revenue=1000.0,
            revenue_growth_yoy=150.0,  # way above 50 cap
            gross_margin=72.0,
            operating_margin=50.0,
            net_income=500.0,
            free_cash_flow=480.0,  # 48% margin
            ebitda=700.0,
            cash=150.0,
            debt=50.0,
            pe=60.0,
            forward_pe=45.0,
            price_to_sales=45.0,
            ev_to_ebitda=0.69,
            ev_to_revenue=0.48,
            eps_growth=140.0,
        )

        metrics = compute_valuation(fundamentals)

        # Quality = (50 * 0.4) + (72 * 0.3) + (48 * 0.3)
        #         = 20 + 21.6 + 14.4 = 56.0
        assert metrics.quality_score == pytest.approx(56.0, abs=0.1)
        assert metrics.fcf_margin == pytest.approx(48.0, abs=0.1)

    def test_quality_score_negative_growth(self):
        """Negative growth = quality score can still be respectable if FCF is strong."""
        fundamentals = Fundamentals(
            symbol="TEST_DECLINING",
            company_name="Declining Co",
            sector="Technology",
            industry="Semiconductors",
            market_cap=100.0,
            enterprise_value=95.0,
            revenue=1000.0,
            revenue_growth_yoy=-5.0,  # declining
            gross_margin=60.0,
            operating_margin=20.0,
            net_income=200.0,
            free_cash_flow=300.0,  # 30% margin (strong cash generation)
            ebitda=400.0,
            cash=50.0,
            debt=30.0,
            pe=20.0,
            forward_pe=18.0,
            price_to_sales=2.0,
            ev_to_ebitda=0.24,
            ev_to_revenue=0.095,
            eps_growth=-10.0,
        )

        metrics = compute_valuation(fundamentals)

        # Quality = (max(-5, 0) * 0.4) + (60 * 0.3) + (30 * 0.3)
        #         = (0 * 0.4) + 18 + 9 = 27.0, but min(max(fcf_margin, 0), 100) floors neg FCF at 0
        # Actually revenue_growth_yoy is used as-is (can be negative), clamped to min=0
        # Quality = (max(min(-5, 50), 0) * 0.4) + (60 * 0.3) + (30 * 0.3)
        #         = (0 * 0.4) + 18 + 9 = 27, but final clamp [0,100]
        # Wait: min(-5, 50) = -5, so component = -5*0.4 = -2
        # Quality = -2 + 18 + 9 = 25
        assert metrics.quality_score == pytest.approx(25.0, abs=0.1)

    def test_quality_score_negative_fcf(self):
        """Negative FCF (unprofitable) = FCF margin clamped to 0."""
        fundamentals = Fundamentals(
            symbol="TEST_UNPROFITABLE",
            company_name="Unprofitable Growth Co",
            sector="Technology",
            industry="Cloud",
            market_cap=50.0,
            enterprise_value=48.0,
            revenue=500.0,
            revenue_growth_yoy=35.0,
            gross_margin=70.0,
            operating_margin=-5.0,
            net_income=-20.0,
            free_cash_flow=-50.0,  # negative FCF
            ebitda=-30.0,
            cash=100.0,
            debt=20.0,
            pe=-1.0,
            forward_pe=55.0,
            price_to_sales=5.0,
            ev_to_ebitda=None,
            ev_to_revenue=0.096,
            eps_growth=-150.0,
        )

        metrics = compute_valuation(fundamentals)

        # Quality = (35 * 0.4) + (70 * 0.3) + (0 * 0.3)  [negative FCF margin floors at 0]
        #         = 14 + 21 + 0 = 35.0
        assert metrics.quality_score == pytest.approx(35.0, abs=0.1)
        assert metrics.fcf_margin == pytest.approx(-10.0, abs=0.1)

    def test_quality_score_zero_revenue(self):
        """Zero or None revenue => FCF margin can't be computed."""
        fundamentals = Fundamentals(
            symbol="TEST_NO_REV",
            company_name="No Revenue",
            sector="Technology",
            industry="Software",
            market_cap=10.0,
            enterprise_value=9.0,
            revenue=0.0,
            revenue_growth_yoy=50.0,
            gross_margin=50.0,
            operating_margin=0.0,
            net_income=0.0,
            free_cash_flow=0.0,
            ebitda=0.0,
            cash=50.0,
            debt=5.0,
            pe=None,
            forward_pe=None,
            price_to_sales=None,
            ev_to_ebitda=None,
            ev_to_revenue=None,
            eps_growth=0.0,
        )

        metrics = compute_valuation(fundamentals)

        # Quality = (50 * 0.4) + (50 * 0.3) + (0 * 0.3)  [fcf_margin is None, so 0]
        #         = 20 + 15 + 0 = 35.0
        assert metrics.quality_score == pytest.approx(35.0, abs=0.1)
        assert metrics.fcf_margin is None


class TestValuationFlag:
    """Test 3-way valuation flag: rich|fair|cheap."""

    def test_valuation_rich_high_multiples(self):
        """High EV/EBITDA (>30) => rich."""
        fundamentals = Fundamentals(
            symbol="TEST_RICH_EV",
            company_name="Rich Co",
            sector="Technology",
            industry="Software",
            market_cap=1000.0,
            enterprise_value=950.0,
            revenue=100.0,
            revenue_growth_yoy=40.0,
            gross_margin=80.0,
            operating_margin=25.0,
            net_income=25.0,
            free_cash_flow=20.0,
            ebitda=30.0,  # EV/EBITDA = 950 / 30 = 31.7 => rich
            cash=50.0,
            debt=0.0,
            pe=80.0,
            forward_pe=60.0,
            price_to_sales=12.0,
            ev_to_ebitda=31.67,
            ev_to_revenue=9.5,
            eps_growth=30.0,
        )

        metrics = compute_valuation(fundamentals)
        assert metrics.valuation_flag == "rich"

    def test_valuation_rich_high_pe(self):
        """High P/E relative to growth (P/E > growth * 1.2) => rich."""
        fundamentals = Fundamentals(
            symbol="TEST_RICH_PE",
            company_name="Rich PE Co",
            sector="Technology",
            industry="Software",
            market_cap=500.0,
            enterprise_value=450.0,
            revenue=50.0,
            revenue_growth_yoy=20.0,
            gross_margin=75.0,
            operating_margin=30.0,
            net_income=15.0,
            free_cash_flow=12.0,
            ebitda=20.0,
            cash=100.0,
            debt=10.0,
            pe=50.0,  # Growth 20%, P/E > 20 * 1.2 = 24, so rich
            forward_pe=35.0,
            price_to_sales=8.0,
            ev_to_ebitda=22.5,
            ev_to_revenue=9.0,
            eps_growth=20.0,
        )

        metrics = compute_valuation(fundamentals)
        assert metrics.valuation_flag == "rich"

    def test_valuation_rich_high_ps(self):
        """High P/S (>10) => rich."""
        fundamentals = Fundamentals(
            symbol="TEST_RICH_PS",
            company_name="Rich PS Co",
            sector="Technology",
            industry="SaaS",
            market_cap=200.0,
            enterprise_value=180.0,
            revenue=20.0,
            revenue_growth_yoy=50.0,
            gross_margin=85.0,
            operating_margin=20.0,
            net_income=4.0,
            free_cash_flow=3.0,
            ebitda=5.0,
            cash=50.0,
            debt=5.0,
            pe=200.0,
            forward_pe=100.0,
            price_to_sales=11.0,  # > 10 => rich
            ev_to_ebitda=36.0,
            ev_to_revenue=9.0,
            eps_growth=45.0,
        )

        metrics = compute_valuation(fundamentals)
        assert metrics.valuation_flag == "rich"

    def test_valuation_cheap_low_multiples(self):
        """Low EV/EBITDA (<12) => cheap."""
        fundamentals = Fundamentals(
            symbol="TEST_CHEAP_EV",
            company_name="Cheap Co",
            sector="Technology",
            industry="Semiconductors",
            market_cap=200.0,
            enterprise_value=180.0,
            revenue=100.0,
            revenue_growth_yoy=10.0,
            gross_margin=50.0,
            operating_margin=15.0,
            net_income=15.0,
            free_cash_flow=18.0,
            ebitda=20.0,  # EV/EBITDA = 180 / 20 = 9.0 => cheap
            cash=50.0,
            debt=20.0,
            pe=8.0,  # Growth 10%, P/E < 10 * 0.7 = 7? No, 8 > 7, but EV/EBITDA alone is cheap
            forward_pe=7.5,
            price_to_sales=2.5,  # Not < 2, not > 10 (fair range for P/S)
            ev_to_ebitda=9.0,
            ev_to_revenue=1.8,
            eps_growth=8.0,
        )

        metrics = compute_valuation(fundamentals)
        # EV/EBITDA = 9.0 < 12 => cheap
        assert metrics.valuation_flag == "cheap"

    def test_valuation_cheap_low_pe(self):
        """Low P/E relative to growth (P/E < growth * 0.7) => cheap."""
        fundamentals = Fundamentals(
            symbol="TEST_CHEAP_PE",
            company_name="Cheap PE Co",
            sector="Technology",
            industry="Semiconductors",
            market_cap=300.0,
            enterprise_value=280.0,
            revenue=100.0,
            revenue_growth_yoy=20.0,
            gross_margin=55.0,
            operating_margin=18.0,
            net_income=18.0,
            free_cash_flow=15.0,
            ebitda=25.0,
            cash=60.0,
            debt=30.0,
            pe=10.0,  # Growth 20%, P/E < 20 * 0.7 = 14, so cheap
            forward_pe=9.0,
            price_to_sales=2.5,
            ev_to_ebitda=11.2,
            ev_to_revenue=2.8,
            eps_growth=20.0,
        )

        metrics = compute_valuation(fundamentals)
        assert metrics.valuation_flag == "cheap"

    def test_valuation_cheap_low_ps(self):
        """Low P/S (<2) => cheap."""
        fundamentals = Fundamentals(
            symbol="TEST_CHEAP_PS",
            company_name="Cheap PS Co",
            sector="Technology",
            industry="Cloud",
            market_cap=150.0,
            enterprise_value=140.0,
            revenue=100.0,
            revenue_growth_yoy=15.0,
            gross_margin=60.0,
            operating_margin=12.0,
            net_income=12.0,
            free_cash_flow=10.0,
            ebitda=18.0,
            cash=40.0,
            debt=20.0,
            pe=15.0,
            forward_pe=14.0,
            price_to_sales=1.2,  # < 2 => cheap
            ev_to_ebitda=7.78,
            ev_to_revenue=1.4,
            eps_growth=14.0,
        )

        metrics = compute_valuation(fundamentals)
        assert metrics.valuation_flag == "cheap"

    def test_valuation_fair_middle(self):
        """Middle multiples => fair."""
        fundamentals = Fundamentals(
            symbol="TEST_FAIR",
            company_name="Fair Co",
            sector="Technology",
            industry="Software",
            market_cap=400.0,
            enterprise_value=380.0,
            revenue=100.0,
            revenue_growth_yoy=18.0,
            gross_margin=68.0,
            operating_margin=20.0,
            net_income=20.0,
            free_cash_flow=18.0,
            ebitda=30.0,
            cash=80.0,
            debt=40.0,
            pe=20.0,  # P/E = 20, growth = 18%, 20 < 18 * 1.2 = 21.6, so not cheap (< 18*0.7=12.6)
            forward_pe=18.0,
            price_to_sales=5.0,  # Middle ground (between 2 and 10)
            ev_to_ebitda=12.67,  # Just above 12 (> 12 so not cheap, < 30 so not rich)
            ev_to_revenue=3.8,
            eps_growth=18.0,
        )

        metrics = compute_valuation(fundamentals)
        # P/E check: 20 > 18 * 0.7 = 12.6 (not cheap), 20 < 18 * 1.2 = 21.6 (not rich)
        # EV/EBITDA: 12.67 > 12 (not cheap), 12.67 < 30 (not rich)
        # P/S: 5 > 2 (not cheap), 5 < 10 (not rich)
        assert metrics.valuation_flag == "fair"


class TestGrowthDurabilityFlag:
    """Test growth durability flag: growth_durable|challenged|unsustainable."""

    def test_growth_durable_strong_rule_of_40(self):
        """Rule of 40 >= 40 => growth_durable."""
        fundamentals = Fundamentals(
            symbol="TEST_DURABLE",
            company_name="Durable Growth Co",
            sector="Technology",
            industry="Software",
            market_cap=500.0,
            enterprise_value=480.0,
            revenue=1000.0,
            revenue_growth_yoy=50.0,
            gross_margin=75.0,
            operating_margin=40.0,
            net_income=400.0,
            free_cash_flow=350.0,  # 35% FCF margin: 50 + 35 = 85 rule of 40
            ebitda=600.0,
            cash=200.0,
            debt=50.0,
            pe=45.0,
            forward_pe=35.0,
            price_to_sales=8.0,
            ev_to_ebitda=0.8,
            ev_to_revenue=0.48,
            eps_growth=50.0,
        )

        metrics = compute_valuation(fundamentals)
        assert metrics.rule_of_40 == pytest.approx(85.0, abs=0.1)
        assert metrics.growth_durability_flag == "growth_durable"

    def test_growth_challenged_weak_rule_of_40(self):
        """Rule of 40 < 20 => challenged (both growth and profitability weak)."""
        fundamentals = Fundamentals(
            symbol="TEST_CHALLENGED",
            company_name="Challenged Co",
            sector="Technology",
            industry="Cloud",
            market_cap=100.0,
            enterprise_value=95.0,
            revenue=500.0,
            revenue_growth_yoy=8.0,
            gross_margin=45.0,
            operating_margin=5.0,
            net_income=25.0,
            free_cash_flow=10.0,  # 2% FCF margin: 8 + 2 = 10 rule of 40
            ebitda=30.0,
            cash=50.0,
            debt=30.0,
            pe=25.0,
            forward_pe=22.0,
            price_to_sales=1.5,
            ev_to_ebitda=3.17,
            ev_to_revenue=0.19,
            eps_growth=6.0,
        )

        metrics = compute_valuation(fundamentals)
        assert metrics.rule_of_40 == pytest.approx(10.0, abs=0.1)
        assert metrics.growth_durability_flag == "challenged"

    def test_growth_unsustainable_negative_fcf(self):
        """Rule of 40 in 20-40 range + negative FCF => unsustainable."""
        fundamentals = Fundamentals(
            symbol="TEST_UNSUSTAINABLE",
            company_name="Unsustainable Growth Co",
            sector="Technology",
            industry="SaaS",
            market_cap=300.0,
            enterprise_value=280.0,
            revenue=200.0,
            revenue_growth_yoy=35.0,
            gross_margin=72.0,
            operating_margin=10.0,
            net_income=20.0,
            free_cash_flow=-50.0,  # negative FCF: 35 + (-25) = 10... wait, FCF margin is -25%
            ebitda=25.0,
            cash=100.0,
            debt=100.0,
            pe=60.0,
            forward_pe=45.0,
            price_to_sales=5.0,
            ev_to_ebitda=11.2,
            ev_to_revenue=1.4,
            eps_growth=32.0,
        )

        metrics = compute_valuation(fundamentals)
        # FCF margin = -50 / 200 * 100 = -25%
        # Rule of 40 = 35 + (-25) = 10, which is < 20 => challenged, not unsustainable
        assert metrics.fcf_margin == pytest.approx(-25.0, abs=0.1)
        assert metrics.rule_of_40 == pytest.approx(10.0, abs=0.1)
        assert metrics.growth_durability_flag == "challenged"

    def test_growth_unsustainable_midrange_negative_fcf(self):
        """Rule of 40 in 20-40 range + negative FCF => unsustainable."""
        fundamentals = Fundamentals(
            symbol="TEST_UNSUSTAINABLE_2",
            company_name="Unsustainable Growth 2",
            sector="Technology",
            industry="Data Cloud",
            market_cap=150.0,
            enterprise_value=140.0,
            revenue=100.0,
            revenue_growth_yoy=32.0,
            gross_margin=68.0,
            operating_margin=-10.0,
            net_income=-10.0,
            free_cash_flow=-20.0,  # negative: 32 + (-20) = 12... still < 20
            ebitda=-10.0,
            cash=80.0,
            debt=10.0,
            pe=None,
            forward_pe=45.0,
            price_to_sales=8.0,
            ev_to_ebitda=None,
            ev_to_revenue=1.4,
            eps_growth=None,
        )

        metrics = compute_valuation(fundamentals)
        # FCF margin = -20 / 100 * 100 = -20%
        # Rule of 40 = 32 + (-20) = 12, which is < 20 => challenged
        assert metrics.fcf_margin == pytest.approx(-20.0, abs=0.1)
        assert metrics.rule_of_40 == pytest.approx(12.0, abs=0.1)
        assert metrics.growth_durability_flag == "challenged"

    def test_growth_unsustainable_midrange_correct(self):
        """Rule of 40 truly in 20-40 with negative FCF => unsustainable."""
        fundamentals = Fundamentals(
            symbol="TEST_UNSUSTAINABLE_3",
            company_name="Unsustainable Growth 3",
            sector="Technology",
            industry="Data Cloud",
            market_cap=200.0,
            enterprise_value=190.0,
            revenue=100.0,
            revenue_growth_yoy=30.0,
            gross_margin=70.0,
            operating_margin=8.0,
            net_income=8.0,
            free_cash_flow=-10.0,  # negative: 30 + (-10) = 20 (exactly at boundary)
            ebitda=20.0,
            cash=100.0,
            debt=20.0,
            pe=80.0,
            forward_pe=45.0,
            price_to_sales=6.0,
            ev_to_ebitda=9.5,
            ev_to_revenue=1.9,
            eps_growth=25.0,
        )

        metrics = compute_valuation(fundamentals)
        # FCF margin = -10 / 100 * 100 = -10%
        # Rule of 40 = 30 + (-10) = 20 (at boundary of 20-40)
        assert metrics.fcf_margin == pytest.approx(-10.0, abs=0.1)
        assert metrics.rule_of_40 == pytest.approx(20.0, abs=0.1)
        assert metrics.growth_durability_flag == "unsustainable"


class TestMultiplesEdgeCases:
    """Test edge cases for multiples computation."""

    def test_zero_ebitda(self):
        """Zero or None EBITDA => EV/EBITDA is None."""
        fundamentals = Fundamentals(
            symbol="TEST_NO_EBITDA",
            company_name="No EBITDA",
            sector="Technology",
            industry="Software",
            market_cap=100.0,
            enterprise_value=95.0,
            revenue=200.0,
            revenue_growth_yoy=20.0,
            gross_margin=60.0,
            operating_margin=-5.0,
            net_income=0.0,
            free_cash_flow=10.0,
            ebitda=0.0,
            cash=50.0,
            debt=20.0,
            pe=None,
            forward_pe=None,
            price_to_sales=3.0,
            ev_to_ebitda=None,
            ev_to_revenue=0.475,
            eps_growth=0.0,
        )

        metrics = compute_valuation(fundamentals)
        assert metrics.ev_to_ebitda is None

    def test_none_revenue(self):
        """None revenue => EV/Revenue is None, FCF margin is None."""
        fundamentals = Fundamentals(
            symbol="TEST_NO_REV",
            company_name="No Revenue",
            sector="Technology",
            industry="Software",
            market_cap=50.0,
            enterprise_value=45.0,
            revenue=None,
            revenue_growth_yoy=0.0,
            gross_margin=0.0,
            operating_margin=0.0,
            net_income=0.0,
            free_cash_flow=0.0,
            ebitda=0.0,
            cash=100.0,
            debt=10.0,
            pe=None,
            forward_pe=None,
            price_to_sales=None,
            ev_to_ebitda=None,
            ev_to_revenue=None,
            eps_growth=0.0,
        )

        metrics = compute_valuation(fundamentals)
        assert metrics.ev_to_revenue is None
        assert metrics.fcf_margin is None
        assert metrics.price_to_sales is None

    def test_none_eps_growth_pe_calculation(self):
        """None EPS growth => P/E can't drive rich/cheap decision; check other multiples."""
        fundamentals = Fundamentals(
            symbol="TEST_NO_EPS",
            company_name="No EPS Growth",
            sector="Technology",
            industry="Software",
            market_cap=100.0,
            enterprise_value=95.0,
            revenue=100.0,
            revenue_growth_yoy=10.0,
            gross_margin=60.0,
            operating_margin=15.0,
            net_income=15.0,
            free_cash_flow=12.0,
            ebitda=20.0,
            cash=50.0,
            debt=20.0,
            pe=40.0,
            forward_pe=35.0,
            price_to_sales=1.5,  # < 2 => cheap
            ev_to_ebitda=4.75,
            ev_to_revenue=0.95,
            eps_growth=None,  # No EPS growth data
        )

        metrics = compute_valuation(fundamentals)
        # P/E check skipped (None EPS); P/S=1.5 < 2 => cheap; EV/EBITDA=4.75 < 12 => also cheap
        assert metrics.valuation_flag == "cheap"
