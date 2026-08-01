"""
Tests for the Emerging Winner Engine pipeline (Models 2-5 + orchestrator).

Beyond "the math runs", these pin the behaviours that make the engine safe and honest: the risk gates
must BLOCK a pump-and-dump, unavailable data must never read as a clean pass, a blocked name must be
excluded from the queue, and the mandatory risk half must never be empty.
"""
from __future__ import annotations

from workers.emerging_winner.analogue import find_analogues
from workers.emerging_winner.classifier import classify
from workers.emerging_winner.domains import score_domains
from workers.emerging_winner.engine import ENGINE_VERSION, rank_universe, run_engine
from workers.emerging_winner.ranker import classify_archetype, rank
from workers.emerging_winner.risk_gates import BLOCK, INSUFFICIENT, PASS, assess_risk

FIXED_AT = "2026-07-29T00:00:00+00:00"

STRONG = {
    "rsi": 44.0, "rsi_delta": 2.1, "macd_hist": -0.3, "macd_hist_delta": 0.4, "score_delta": 5.0,
    "price_vs_sma200": 1.04, "dist_from_60_low_pct": 9.0,
    "volume_ratio": 1.9, "close": 12.4, "open": 11.8, "volume": 2_400_000, "volume_state": "accumulation",
    "market_cap": 680_000_000, "avg_dollar_volume": 29_760_000,
    "theme_context": {"themes": ["quantum", "ai", "defence"], "supply_chain_centrality": 0.72, "mention_velocity": 0.55},
    "market_context": {"regime": "risk_on"}, "news_attention": 0.55, "portfolio_relevance": 0.6,
    "government": {"award_count": 3, "contract_value_usd": 42_000_000, "policy_alignment": 0.8},
    "fundamentals": {"revenue_growth_yoy": 45.0, "gross_margin_trend": 0.4, "cash_burn_quality": 0.7},
    "capital": {"cash_runway_quarters": 6.0, "share_count_growth_yoy": 4.0, "debt_to_equity": 0.4},
    "sponsorship": {"insider_net_buy_usd": 1_200_000, "institutional_ownership_change_pct": 6.0},
}

PUMP = {
    "rsi": 63.0, "rsi_delta": 3.0, "macd_hist": 0.4, "macd_hist_delta": 0.2,
    "price_vs_sma200": 1.2, "dist_from_60_low_pct": 40.0,
    "volume_ratio": 3.4, "close": 2.1, "open": 1.7, "volume": 90_000, "volume_state": "high",
    "market_cap": 90_000_000, "avg_dollar_volume": 189_000, "float_shares": 3_000_000,
    "theme_context": {"themes": ["quantum"], "supply_chain_centrality": 0.2, "mention_velocity": 0.95},
    "market_context": {"regime": "risk_on"}, "news_attention": 0.95,
    "capital": {"cash_runway_quarters": 1.0, "share_count_growth_yoy": 35.0, "debt_to_equity": 1.2},
}

TECH_ONLY = {
    "rsi": 41.0, "rsi_delta": 1.8, "macd_hist": -0.5, "macd_hist_delta": 0.5,
    "price_vs_sma200": 1.01, "dist_from_60_low_pct": 11.0,
}


# --- Model 2: classifier --------------------------------------------------------------------------

def test_classifier_strong_beats_weak():
    strong = classify(score_domains(STRONG))
    weak = classify(score_domains({"rsi": 72, "rsi_delta": -3, "macd_hist": 0.3, "macd_hist_delta": -0.6,
                                   "price_vs_sma200": 0.85, "dist_from_60_low_pct": 1.0}))
    assert strong.winner_similarity > weak.winner_similarity
    assert strong.ordinal_stage >= weak.ordinal_stage
    assert 0.0 <= strong.probability <= 1.0


def test_classifier_contributions_sorted_and_bounded():
    r = classify(score_domains(STRONG))
    contribs = [abs(c.contribution) for c in r.contributions]
    assert contribs == sorted(contribs, reverse=True)
    assert 0.0 <= r.winner_similarity <= 100.0
    for v in r.class_probs.values():
        assert 0.0 <= v <= 1.0
    assert abs(sum(r.class_probs.values()) - 1.0) < 1e-6


def test_classifier_thin_coverage_is_low_confidence_and_capped():
    r = classify(score_domains(TECH_ONLY))
    assert r.completeness < 0.5
    assert r.confidence == "low"
    assert r.ordinal_stage <= 1  # cannot be a strong candidate on one domain


# --- Model 3: analogues ---------------------------------------------------------------------------

def test_analogue_winner_like_matches_winners():
    r = find_analogues(score_domains(STRONG))
    assert r.nearest_winners
    assert r.winner_similarity > 0
    # A structurally strong name should look more like winners than failures.
    assert r.winner_failure_ratio >= 1.0


def test_analogue_pump_leans_to_failures():
    r = find_analogues(score_domains(PUMP))
    # The speculative pump vector should resemble the failure profiles at least as much as winners.
    assert r.failure_similarity >= r.winner_similarity - 5


# --- Model 5: risk gates --------------------------------------------------------------------------

def test_risk_gates_block_the_pump():
    r = assess_risk(PUMP)
    assert r.blocked is True
    assert r.verdict == BLOCK
    # Liquidity (thin ADV) or dilution should be the culprit.
    verdicts = {g.key: g.verdict for g in r.gates}
    assert verdicts["liquidity"] == BLOCK or verdicts["dilution"] == BLOCK


def test_risk_gates_missing_data_is_insufficient_not_pass():
    r = assess_risk(TECH_ONLY)
    verdicts = {g.key: g.verdict for g in r.gates}
    # No capital/fundamentals -> survivability + dilution must be INSUFFICIENT, never a silent pass.
    assert verdicts["survivability"] == INSUFFICIENT
    assert verdicts["dilution"] == INSUFFICIENT


def test_risk_gates_healthy_name_passes_liquidity():
    r = assess_risk(STRONG)
    verdicts = {g.key: g.verdict for g in r.gates}
    assert verdicts["liquidity"] == PASS


# --- Model 4: archetype + rank --------------------------------------------------------------------

def test_archetype_from_theme():
    domains = score_domains(STRONG)
    analogue = find_analogues(domains)
    arch, _ = classify_archetype(domains, STRONG["theme_context"], analogue)
    # Quantum theme with solid (not dominant) government -> a quantum/strategic-tech archetype.
    assert arch in ("Quantum Infrastructure", "Government-Backed Strategic Tech")


def test_archetype_strong_government_promotes_to_strategic_tech():
    feats = {**STRONG, "government": {"award_count": 5, "contract_value_usd": 90_000_000, "policy_alignment": 0.95}}
    domains = score_domains(feats)
    arch, _ = classify_archetype(domains, feats["theme_context"], find_analogues(domains))
    assert arch == "Government-Backed Strategic Tech"


def test_rank_blocked_is_zero_priority():
    clf = classify(score_domains(PUMP))
    priority, action, _ = rank(clf, risk_penalty=100.0, blocked=True)
    assert priority == 0.0
    assert action == "needs_review"


# --- pipeline -------------------------------------------------------------------------------------

def test_pipeline_strong_is_surfaced_and_ranked():
    r = run_engine("QBIT", STRONG, generated_at=FIXED_AT)
    assert r.engine_version == ENGINE_VERSION
    assert r.surfaced is True
    assert r.priority_score > 0
    # The action TIER follows the champion's learned probability (the real-v1 model does not equate
    # a pretty scorecard with winner odds - that hypothesis was refuted on real outcomes), so a
    # clean candidate may honestly land anywhere in the research vocabulary; the invariant is that
    # it is a surfaced research action, never a review/block.
    assert r.action in ("deep_research", "paper_bot_candidate", "watchlist_candidate")
    assert r.risks  # mandatory risk half is never empty


def test_pipeline_pump_is_blocked_and_excluded():
    r = run_engine("HYPE", PUMP, generated_at=FIXED_AT)
    assert r.surfaced is False
    assert r.priority_score == 0.0
    assert r.risk["verdict"] == "block"
    assert r.outcome_distribution["p_ruin"] >= 0.3
    assert any("BLOCKED" in x for x in r.risks)


def test_pipeline_deterministic():
    a = run_engine("QBIT", STRONG, generated_at=FIXED_AT).to_dict()
    b = run_engine("QBIT", STRONG, generated_at=FIXED_AT).to_dict()
    assert a == b


def test_rank_universe_orders_surfaced_first():
    ranked = rank_universe([("HYPE", PUMP), ("QBIT", STRONG), ("TCNO", TECH_ONLY)], generated_at=FIXED_AT)
    # Surfaced names rank above blocked ones; the blocked pump sinks to the bottom.
    assert ranked[0].symbol == "QBIT"
    assert ranked[-1].symbol == "HYPE"
    assert ranked[-1].surfaced is False


def test_pipeline_serialises_with_all_sections():
    d = run_engine("QBIT", STRONG, generated_at=FIXED_AT).to_dict()
    for key in ("winner_similarity", "archetype", "contributions", "analogues",
                "outcome_distribution", "risk", "priority_score", "risks", "domains"):
        assert key in d
    assert len(d["domains"]) == 10
