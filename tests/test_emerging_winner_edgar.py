"""Unit tests for the SEC EDGAR fundamentals derivation (pure, no network).

Pins the two trend fields EDGAR is here to provide - real share-count dilution and gross-margin trend -
and, critically, the COVERAGE HONESTY: a field is emitted only when >=2 comparable ANNUAL (10-K) points
exist, and quarterly / partial data never leaks a fabricated value.
"""
from workers.emerging_winner.edgar_source import derive_edgar_features


def _fact(val, fy, form="10-K", fp="FY", filed=None):
    return {"val": val, "fy": fy, "fp": fp, "form": form, "filed": filed or f"{fy + 1}-02-01", "end": f"{fy}-12-31"}


def _facts(shares=None, revenue=None, gross=None):
    us = {}
    if shares is not None:
        us["WeightedAverageNumberOfSharesOutstandingBasic"] = {"units": {"shares": shares}}
    if revenue is not None:
        us["Revenues"] = {"units": {"USD": revenue}}
    if gross is not None:
        us["GrossProfit"] = {"units": {"USD": gross}}
    return {"facts": {"us-gaap": us}}


def test_derives_real_dilution_and_margin_trend():
    facts = _facts(
        shares=[_fact(1_000_000, 2022), _fact(1_100_000, 2023)],
        revenue=[_fact(1000, 2022), _fact(1500, 2023)],
        gross=[_fact(400, 2022), _fact(750, 2023)],  # margin 0.40 -> 0.50
    )
    out = derive_edgar_features(facts)
    assert out["capital"]["share_count_growth_yoy"] == 10.0  # (1.1M - 1.0M) / 1.0M * 100
    assert out["fundamentals"]["gross_margin_trend"] == 0.1  # 0.50 - 0.40


def test_quarterly_and_non_10k_points_are_ignored():
    # A stray 10-Q / non-FY point must not be used for the annual YoY calc.
    facts = _facts(
        shares=[
            _fact(1_000_000, 2022),
            _fact(5_000_000, 2023, form="10-Q", fp="Q3"),  # noise - must be ignored
            _fact(1_020_000, 2023),
        ]
    )
    out = derive_edgar_features(facts)
    assert out["capital"]["share_count_growth_yoy"] == 2.0  # uses the two 10-K FY points only


def test_missing_gross_profit_leaves_margin_absent():
    facts = _facts(
        shares=[_fact(1_000_000, 2022), _fact(1_050_000, 2023)],
        revenue=[_fact(1000, 2022), _fact(1500, 2023)],
        # no GrossProfit
    )
    out = derive_edgar_features(facts)
    assert "share_count_growth_yoy" in out["capital"]
    assert "fundamentals" not in out  # margin trend not fabricated without gross profit


def test_single_annual_point_is_not_enough_for_a_delta():
    out = derive_edgar_features(_facts(shares=[_fact(1_000_000, 2023)]))
    assert out == {}  # one point cannot make a YoY change - stays unavailable


def test_empty_or_none_facts_yield_nothing():
    assert derive_edgar_features(None) == {}
    assert derive_edgar_features({}) == {}
    assert derive_edgar_features({"facts": {"us-gaap": {}}}) == {}
