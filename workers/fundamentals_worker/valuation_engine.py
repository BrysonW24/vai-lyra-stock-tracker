"""
Deterministic valuation metrics engine.

Computes research-grade valuation multiples and quality scores from fundamentals.
All formulas are documented and deterministic (no LLM).

Research software, NOT investment advice.
"""

from __future__ import annotations

from dataclasses import dataclass
import logging

from workers.fundamentals_worker.fundamentals_provider import Fundamentals

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ValuationMetrics:
    """Deterministic valuation metrics and flags."""

    symbol: str
    ev_to_ebitda: float | None
    price_to_sales: float | None
    pe_ratio: float | None
    ev_to_revenue: float | None
    fcf_margin: float | None  # percent
    rule_of_40: float | None  # revenue growth % + fcf margin %
    valuation_flag: str  # 'rich' | 'fair' | 'cheap'
    growth_durability_flag: str  # 'growth_durable' | 'challenged' | 'unsustainable'
    quality_score: float  # 0-100


def compute_valuation(fundamentals: Fundamentals) -> ValuationMetrics:
    """
    Compute deterministic valuation metrics and quality flags.

    Quality Score (0–100): Weighted composite of growth, profitability, and cash generation.
    Formula: (min(revGrowthYoY, 50) * 0.4) + (grossMargin * 0.3) + (min(max(fcfMargin, 0), 100) * 0.3)
    - Revenue growth capped at 50% to avoid extreme outliers.
    - Gross margin as-is (0–100).
    - FCF margin clamped to 0–100 range.

    Valuation Flag (3-way rule):
    - 'rich': EV/EBITDA > 30 OR P/E > (EPS growth * 1.2) OR P/S > 10
    - 'cheap': EV/EBITDA < 12 OR P/E < (EPS growth * 0.7) OR P/S < 2
    - 'fair': Everything else

    Growth Durability Flag:
    - 'growth_durable': Rule of 40 >= 40 (revGrowth + fcfMargin >= 40)
    - 'challenged': Rule of 40 < 20 (growth + profitability both weak)
    - 'unsustainable': Rule of 40 20-40 but negative FCF (growth on debt/equity, not cash)

    All thresholds are documented below; edit the constants if research-driven justification changes them.
    """

    # === EV/EBITDA ===
    ev_to_ebitda = None
    if (
        fundamentals.enterprise_value is not None
        and fundamentals.ebitda is not None
        and fundamentals.ebitda > 0
    ):
        # EV and EBITDA both in billions; unit cancels
        ev_to_ebitda = fundamentals.enterprise_value / fundamentals.ebitda

    # === P/S (Price-to-Sales) ===
    price_to_sales = None
    if fundamentals.price_to_sales is not None:
        price_to_sales = fundamentals.price_to_sales

    # === P/E (Trailing P/E) ===
    pe_ratio = None
    if fundamentals.pe is not None:
        pe_ratio = fundamentals.pe

    # === EV/Revenue ===
    ev_to_revenue = None
    if (
        fundamentals.enterprise_value is not None
        and fundamentals.revenue is not None
        and fundamentals.revenue > 0
    ):
        # EV in billions, revenue in millions; scale mismatch needs correction
        # EV in billions = EV * 1000 millions
        # EV/Revenue = (EV_billions * 1000) / revenue_millions
        ev_to_revenue = (fundamentals.enterprise_value * 1000) / fundamentals.revenue

    # === FCF Margin ===
    fcf_margin = None
    if (
        fundamentals.free_cash_flow is not None
        and fundamentals.revenue is not None
        and fundamentals.revenue > 0
    ):
        fcf_margin = (fundamentals.free_cash_flow / fundamentals.revenue) * 100

    # === Rule of 40 (Growth + FCF Margin) ===
    rule_of_40 = None
    rev_growth = fundamentals.revenue_growth_yoy or 0.0
    fcf_m = fcf_margin or 0.0
    rule_of_40 = rev_growth + fcf_m

    # === Quality Score ===
    # Components: revenue growth (capped 50), gross margin, fcf margin
    rev_growth_component = min(fundamentals.revenue_growth_yoy or 0, 50)
    gross_margin_component = fundamentals.gross_margin or 0
    fcf_margin_component = min(max(fcf_margin or 0, 0), 100)

    quality_score = (
        rev_growth_component * 0.4
        + gross_margin_component * 0.3
        + fcf_margin_component * 0.3
    )
    quality_score = min(max(quality_score, 0), 100)

    # === Valuation Flag (3-way: rich|fair|cheap) ===
    valuation_flag = "fair"

    # Rich: expensive across multiple dimensions
    is_rich = False
    if ev_to_ebitda is not None and ev_to_ebitda > 30:
        is_rich = True
    if pe_ratio is not None and fundamentals.eps_growth is not None:
        eps_g = fundamentals.eps_growth
        if eps_g > 0 and pe_ratio > (eps_g * 1.2):
            is_rich = True
    if price_to_sales is not None and price_to_sales > 10:
        is_rich = True

    # Cheap: inexpensive across multiple dimensions
    is_cheap = False
    if ev_to_ebitda is not None and ev_to_ebitda < 12:
        is_cheap = True
    if pe_ratio is not None and fundamentals.eps_growth is not None:
        eps_g = fundamentals.eps_growth
        if eps_g > 0 and pe_ratio < (eps_g * 0.7):
            is_cheap = True
    if price_to_sales is not None and price_to_sales < 2:
        is_cheap = True

    if is_rich and not is_cheap:
        valuation_flag = "rich"
    elif is_cheap and not is_rich:
        valuation_flag = "cheap"
    else:
        valuation_flag = "fair"

    # === Growth Durability Flag ===
    # Rule of 40 benchmark: revenue growth + FCF margin should exceed 40 for durable growth
    growth_durability_flag = "challenged"

    if rule_of_40 is not None:
        if rule_of_40 >= 40:
            growth_durability_flag = "growth_durable"
        elif rule_of_40 >= 20:
            # Rule of 40 in 20-40 range: check if FCF is negative (unsustainable)
            if fundamentals.free_cash_flow is not None and fundamentals.free_cash_flow < 0:
                growth_durability_flag = "unsustainable"
            else:
                growth_durability_flag = "challenged"
        else:
            # Rule of 40 < 20: weak on both dimensions
            growth_durability_flag = "challenged"

    return ValuationMetrics(
        symbol=fundamentals.symbol,
        ev_to_ebitda=ev_to_ebitda,
        price_to_sales=price_to_sales,
        pe_ratio=pe_ratio,
        ev_to_revenue=ev_to_revenue,
        fcf_margin=fcf_margin,
        rule_of_40=rule_of_40,
        valuation_flag=valuation_flag,
        growth_durability_flag=growth_durability_flag,
        quality_score=quality_score,
    )
