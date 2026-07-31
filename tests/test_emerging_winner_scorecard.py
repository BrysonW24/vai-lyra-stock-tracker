"""
Tests for the Emerging Winner Engine first slice - the deterministic domain scorecard.

The point of these tests is not just that the math runs, but that the COVERAGE-HONESTY invariants hold:
an unbuilt data pipeline must never masquerade as a weak trait, completeness counts only assessable
domains, and a thin read can never be dressed up as a strong candidate.
"""
from __future__ import annotations

from workers.emerging_winner.domains import (
    DOMAIN_REGISTRY,
    PRESENT_THRESHOLD,
    score_domains,
)
from workers.emerging_winner.scorecard import build_scorecard

# A technical-only feature set: only the price/indicator domain can be assessed from it.
TECH_ONLY = {
    "rsi": 44.0,
    "rsi_delta": 2.0,
    "macd_hist": -0.3,
    "macd_hist_delta": 0.4,
    "price_vs_sma200": 1.03,
    "dist_from_60_low_pct": 10.0,
}

# A richly-sourced small cap with several context pipelines supplied.
RICH = {
    **TECH_ONLY,
    "volume_ratio": 1.9,
    "close": 12.4,
    "open": 11.8,
    "volume": 2_400_000,
    "volume_state": "accumulation",
    "market_cap": 700_000_000,
    "theme_context": {"themes": ["quantum", "ai", "defence"], "supply_chain_centrality": 0.72, "mention_velocity": 0.55},
    "market_context": {"regime": "risk_on"},
    "news_attention": 0.55,
    "government": {"award_count": 3, "contract_value_usd": 42_000_000, "policy_alignment": 0.8},
    "fundamentals": {"revenue_growth_yoy": 45.0, "gross_margin_trend": 0.4, "cash_burn_quality": 0.7},
    "capital": {"cash_runway_quarters": 6.0, "share_count_growth_yoy": 4.0, "debt_to_equity": 0.4},
    "sponsorship": {"insider_net_buy_usd": 1_200_000, "institutional_ownership_change_pct": 6.0},
}


def test_registry_has_ten_domains():
    assert len(DOMAIN_REGISTRY) == 10
    keys = [d.key for d in score_domains(RICH)]
    assert len(set(keys)) == 10


def test_technical_strong_scores_higher_than_broken():
    strong = build_scorecard("S", TECH_ONLY)
    broken = build_scorecard(
        "B",
        {"rsi": 72.0, "rsi_delta": -2.5, "macd_hist": 0.2, "macd_hist_delta": -0.6,
         "price_vs_sma200": 0.9, "dist_from_60_low_pct": 2.0},
    )
    s_tech = next(d for d in strong.domains if d.key == "technical").score
    b_tech = next(d for d in broken.domains if d.key == "technical").score
    assert s_tech is not None and b_tech is not None
    assert s_tech > b_tech


def test_all_domain_scores_bounded():
    for d in score_domains(RICH):
        if d.score is not None:
            assert 0.0 <= d.score <= 100.0
        for s in d.subsignals:
            if s.score is not None:
                assert 0.0 <= s.score <= 100.0


def test_unavailable_is_not_a_weak_trait():
    """A domain with no data must be 'unavailable' (score None) with an honest reason - never a 0 that
    drags the name down, and never counted as a present trait."""
    card = build_scorecard("X", TECH_ONLY)
    bq = next(d for d in card.domains if d.key == "business_quality")
    assert bq.score is None
    assert bq.coverage == "unavailable"
    assert "EDGAR" in bq.reason  # names the pipeline to build
    assert bq.available is False
    assert bq.is_present_trait is False
    assert "Business quality" not in card.present_traits


def test_completeness_counts_only_available_domains():
    tech = build_scorecard("T", TECH_ONLY)
    # Only the technical domain is assessable from a technical-only feature set.
    available = [d for d in tech.domains if d.available]
    assert [d.key for d in available] == ["technical"]
    assert tech.completeness == 1 / 10

    rich = build_scorecard("R", RICH)
    assert rich.completeness > tech.completeness


def test_composite_normalised_over_available_only():
    """With only the technical domain available, winner_similarity must equal that domain's score -
    unbuilt domains must not pull the composite toward zero."""
    card = build_scorecard("T", TECH_ONLY)
    tech = next(d for d in card.domains if d.key == "technical")
    assert abs(card.winner_similarity - tech.score) < 1e-9


def test_thin_coverage_caps_the_opportunity_class():
    """A high technical read on very few domains must not be labelled a strong candidate (class 2+).
    Under 50% coverage the class is capped at 1 (emerging)."""
    card = build_scorecard("TCNO", {**TECH_ONLY, "volume_ratio": 1.6, "close": 8.2, "open": 7.9,
                                    "volume": 900_000, "volume_state": "high", "market_cap": 540_000_000})
    assert card.completeness < 0.5
    assert card.winner_similarity >= 60  # would be class 2 without the cap
    assert card.opportunity_class <= 1
    assert card.confidence == "low"


def test_context_pipelines_light_up_domains():
    """When a data pipeline's inputs arrive, its domain flips from unavailable to assessed with no
    engine change - the whole point of the coverage-driven design."""
    tech = build_scorecard("T", TECH_ONLY)
    rich = build_scorecard("R", RICH)

    for key in ("business_quality", "capital", "government", "sponsorship", "theme"):
        assert next(d for d in tech.domains if d.key == key).available is False
        rd = next(d for d in rich.domains if d.key == key)
        assert rd.available is True
        assert 0.0 <= rd.score <= 100.0


def test_missing_domains_and_risks_are_never_empty():
    card = build_scorecard("T", TECH_ONLY)
    # Every unavailable domain is surfaced with its reason.
    assert len(card.missing_domains) == 9
    assert all(" - " in m for m in card.missing_domains)
    # The mandatory risk / what's-missing half is never empty and states it is not advice.
    assert card.risks
    assert any("not advice" in r.lower() for r in card.risks)
    # Thin coverage is disclosed as a risk.
    assert any("under-assessed" in r.lower() for r in card.risks)


def test_archetype_government_backed_strategic_tech():
    card = build_scorecard("R", RICH)
    assert card.archetype == "Government-backed strategic tech"
    # Theme + government + sponsorship + fundamentals are all sourced here -> not low confidence.
    assert card.archetype_confidence in ("medium", "high")


def test_archetype_unclassified_when_structural_domains_absent():
    card = build_scorecard("T", TECH_ONLY)
    assert card.archetype.startswith("Unclassified")
    assert card.archetype_confidence == "low"


def test_present_trait_threshold():
    card = build_scorecard("R", RICH)
    for label in card.present_traits:
        d = next(dd for dd in card.domains if dd.label == label)
        assert d.score is not None and d.score >= PRESENT_THRESHOLD


def test_deterministic():
    a = build_scorecard("R", RICH).to_dict()
    b = build_scorecard("R", RICH).to_dict()
    assert a == b


def test_scorecard_serialises_cleanly():
    card = build_scorecard("R", RICH).to_dict()
    assert card["symbol"] == "R"
    assert card["model_stage"] == "v0-deterministic-scorecard"
    assert 0 <= card["opportunity_class"] <= 3
    assert 0.0 <= card["winner_similarity"] <= 100.0
    assert len(card["domains"]) == 10
