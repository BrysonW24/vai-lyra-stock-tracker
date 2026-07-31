"""Model 6 (Timing & Network Intelligence) - the shadow challenger that completes the 6-model stack.

Pins the three properties that make M6 honest:
1. Coverage honesty - absent inputs mean "not assessed" (None score), never a low score.
2. The crowding read - extreme attention with no structure is called "crowded", not "confirming".
3. SHADOW-ONLY - M6 annotates the finding but never steers priority, ranking, or risk verdicts.
"""
from __future__ import annotations

import inspect

from workers.emerging_winner import timing as m6
from workers.emerging_winner.engine import run_engine
from workers.emerging_winner.ranker import rank


def test_temporal_confirming_on_strong_deltas():
    r = m6.assess({"score_delta": 5.0, "rsi_delta": 2.0, "macd_hist_delta": 0.5, "volume_ratio": 1.9})
    assert r.timing_state == m6.CONFIRMING
    assert r.timing_score is not None and r.timing_score >= 68
    assert "near" in r.catalyst_window


def test_temporal_dormant_on_negative_deltas():
    r = m6.assess({"score_delta": -3.0, "rsi_delta": -2.0, "macd_hist_delta": -0.4, "volume_ratio": 0.8})
    assert r.timing_state == m6.DORMANT
    assert r.timing_score is not None and r.timing_score < 52


def test_temporal_not_assessed_without_deltas():
    r = m6.assess({"volume_ratio": 2.0, "news_attention": 0.5})
    assert r.timing_state == m6.NOT_ASSESSED
    assert r.timing_score is None
    assert r.catalyst_window == "not assessed"


def test_crowding_overrides_confirmation():
    # Strong deltas but extreme attention: the honest read is "you are late", not "confirming".
    r = m6.assess({
        "score_delta": 5.0, "rsi_delta": 3.0, "macd_hist_delta": 0.5, "volume_ratio": 3.0,
        "news_attention": 0.95, "theme_context": {"mention_velocity": 0.95},
    })
    assert r.timing_state == m6.CROWDED
    assert "timing edge gone" in r.catalyst_window


def test_network_not_assessed_without_inputs():
    r = m6.assess({"score_delta": 2.0})
    assert r.network_score is None
    assert "not assessed" in r.network_state
    assert r.network_notes == []


def test_network_well_connected_with_full_cluster():
    r = m6.assess({
        "sponsorship": {"insider_net_buy_usd": 1_200_000, "institutional_ownership_change_pct": 6.0},
        "theme_context": {"supply_chain_centrality": 0.72},
        "government": {"award_count": 3},
    })
    assert r.network_score is not None and r.network_score >= 70
    assert r.network_state.startswith("well-connected")
    assert any("insider" in n.lower() for n in r.network_notes)
    assert any("government" in n.lower() for n in r.network_notes)


def test_network_penalises_insider_selling():
    selling = m6.assess({"sponsorship": {"insider_net_buy_usd": -400_000}})
    buying = m6.assess({"sponsorship": {"insider_net_buy_usd": 600_000}})
    assert selling.network_score is not None and buying.network_score is not None
    assert selling.network_score < buying.network_score
    assert any("net sellers" in n for n in selling.network_notes)


def test_engine_result_carries_timing_annotation():
    result = run_engine("TEST", {"rsi": 45.0, "score_delta": 5.0, "volume_ratio": 1.5})
    d = result.to_dict()
    assert d["timing_state"] == d["timing"]["timing_state"]
    for key in ("timing_score", "catalyst_window", "network_state", "network_score",
                "network_notes", "challenger_note", "provenance"):
        assert key in d["timing"]
    assert "shadow challenger" in d["timing"]["challenger_note"]


def test_shadow_only_temporal_inputs_never_move_priority():
    # score_delta is consumed ONLY by Model 6; flipping it must change the timing annotation and
    # nothing champion-owned (similarity, priority, action, risk verdict).
    base_features = {"rsi": 45.0, "volume_ratio": 1.5, "close": 10.0, "open": 9.8,
                     "market_cap": 500_000_000, "avg_dollar_volume": 5_000_000}
    hot = run_engine("TEST", {**base_features, "score_delta": 6.0})
    cold = run_engine("TEST", {**base_features, "score_delta": -6.0})
    assert hot.timing_state != cold.timing_state
    assert hot.priority_score == cold.priority_score
    assert hot.winner_similarity == cold.winner_similarity
    assert hot.action == cold.action
    assert hot.risk["verdict"] == cold.risk["verdict"]


def test_ranker_signature_has_no_timing_input():
    # Structural enforcement of the challenger rule: the champion ranker cannot even receive M6 output.
    params = set(inspect.signature(rank).parameters)
    assert not any("timing" in p or "network" in p for p in params)


def test_crowded_state_adds_risk_line():
    result = run_engine("PUMP", {
        "rsi": 60.0, "score_delta": 5.0, "rsi_delta": 3.0, "macd_hist_delta": 0.5,
        "volume_ratio": 3.0, "news_attention": 0.95,
        "theme_context": {"themes": ["quantum"], "mention_velocity": 0.95},
    })
    assert result.timing_state == m6.CROWDED
    assert any("attention is ahead of evidence" in r for r in result.risks)
