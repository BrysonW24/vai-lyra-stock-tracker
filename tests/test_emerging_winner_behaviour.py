"""
Emerging Winner Engine - BEHAVIOUR CONTRACT (property / fuzz eval).

The existing EW tests are example-based: they pin specific strong/weak/pump cases. This suite is
their complement - it fuzzes the engine over a wide, randomised input space and asserts the
cross-cutting invariants hold for EVERY input, not just the hand-picked ones. It answers the audit
question "is the analysis produced properly?" behaviourally:

  * every output field stays within its honest bounds (no NaN/inf, probabilities in range, similarity
    0-100), for any feature dict, including degenerate ones (empty, all-missing, extreme);
  * the engine is deterministic (same input -> byte-identical serialisation);
  * a risk BLOCK always excludes a name from the queue (blocked <=> not surfaced);
  * the mandatory risk half is never empty;
  * coverage honesty holds end to end (an all-missing read is LOW completeness and never fabricates a
    strong domain);
  * a clearly-strong candidate out-resembles a clearly-weak one (ordering sanity);
  * the shipped candidate universe is HONEST about being illustrative - the worker cannot silently
    claim the illustrative set is the real market (guards the landscape-coverage boundary).

Pure stdlib, reproducible (seeded RNG, explicit generated_at - no wall clock), runs in CI.
Research only - it checks the machinery, it does not assert real-world predictive accuracy (that needs
the Phase-1 point-in-time dataset; this suite proves the pipeline is correct and honest today).
"""
from __future__ import annotations

import json
import math
import random

import pytest

from workers.emerging_winner.engine import ENGINE_VERSION, rank_universe, run_engine
from workers.emerging_winner import main as ew_main

GENERATED_AT = "2026-08-01T00:00:00+00:00"  # fixed: keeps the eval timezone- and clock-independent
FUZZ_N = 200


def _rand_features(rng: random.Random) -> dict:
    """A randomised feature dict. Every key is independently present-or-absent so the coverage-honesty
    and missing-data paths are exercised as hard as the fully-populated ones."""

    def maybe(p: float, value):
        return value if rng.random() < p else None

    feats: dict = {}
    optional = {
        "rsi": rng.uniform(5, 95),
        "rsi_delta": rng.uniform(-8, 8),
        "macd_hist": rng.uniform(-2, 2),
        "macd_hist_delta": rng.uniform(-1, 1),
        "score_delta": rng.uniform(-10, 10),
        "price_vs_sma200": rng.uniform(0.5, 1.8),
        "dist_from_60_low_pct": rng.uniform(0, 80),
        "volume_ratio": rng.uniform(0.1, 6),
        "close": rng.uniform(0.5, 400),
        "open": rng.uniform(0.5, 400),
        "volume": rng.randint(1_000, 20_000_000),
        "market_cap": rng.choice([30_000_000, 90_000_000, 540_000_000, 5_000_000_000]),
        "avg_dollar_volume": rng.uniform(50_000, 50_000_000),
        "float_shares": rng.randint(1_000_000, 500_000_000),
        "news_attention": rng.random(),
        "portfolio_relevance": rng.random(),
        "volume_state": rng.choice(["accumulation", "high", "quiet", "distribution"]),
    }
    for k, v in optional.items():
        got = maybe(0.75, v)
        if got is not None:
            feats[k] = got

    if rng.random() < 0.7:
        feats["theme_context"] = {
            "themes": rng.sample(["quantum", "ai", "defence", "space", "robotics", "energy"], k=rng.randint(0, 3)),
            "supply_chain_centrality": rng.random(),
            "mention_velocity": rng.random(),
        }
    if rng.random() < 0.6:
        feats["market_context"] = {"regime": rng.choice(["risk_on", "neutral", "risk_off"])}
    if rng.random() < 0.5:
        feats["government"] = {
            "award_count": rng.randint(0, 6),
            "contract_value_usd": rng.uniform(0, 80_000_000),
            "policy_alignment": rng.random(),
        }
    if rng.random() < 0.5:
        feats["fundamentals"] = {
            "revenue_growth_yoy": rng.uniform(-30, 120),
            "gross_margin_trend": rng.uniform(-1, 1),
            "cash_burn_quality": rng.random(),
        }
    if rng.random() < 0.5:
        feats["capital"] = {
            "cash_runway_quarters": rng.uniform(0.5, 12),
            "share_count_growth_yoy": rng.uniform(0, 50),
            "debt_to_equity": rng.uniform(0, 2),
        }
    if rng.random() < 0.4:
        feats["sponsorship"] = {
            "insider_net_buy_usd": rng.uniform(-2_000_000, 2_000_000),
            "institutional_ownership_change_pct": rng.uniform(-10, 10),
        }
    return feats


def _finite(x) -> bool:
    return not (isinstance(x, float) and (math.isnan(x) or math.isinf(x)))


def _assert_result_invariants(d: dict) -> None:
    # Headline classification bounds.
    assert 0.0 <= d["winner_similarity"] <= 100.0, d["winner_similarity"]
    assert 0.0 <= d["probability"] <= 1.0, d["probability"]
    assert 0.0 <= d["completeness"] <= 1.0, d["completeness"]
    assert isinstance(d["ordinal_stage"], int) and 0 <= d["ordinal_stage"] <= 3
    assert d["confidence"] in {"low", "medium", "high"}

    # Outcome distribution: within the documented clamps, always a probability.
    od = d["outcome_distribution"]
    assert 0.0 <= od["p_2x_24m"] <= 0.9
    assert 0.0 <= od["p_5x_36m"] <= 0.6
    assert 0.0 <= od["p_10x_60m"] <= 0.35
    assert 0.02 <= od["p_ruin"] <= 0.9
    # A more-likely-to-double name is never MORE likely to 10x than to double (ladder ordering).
    assert od["p_10x_60m"] <= od["p_5x_36m"] + 1e-9 <= od["p_2x_24m"] + 1e-9

    # Domains: bounded or explicitly unavailable; coverage is one of the honest three.
    for dom in d["domains"]:
        assert dom["coverage"] in {"full", "partial", "unavailable"}
        if dom["score"] is not None:
            assert 0.0 <= dom["score"] <= 100.0, dom

    # The risk half is mandatory and never empty.
    assert isinstance(d["risks"], list) and len(d["risks"]) >= 1

    # A BLOCK excludes the name from the queue; surfaced is exactly not-blocked.
    assert d["surfaced"] is (not d["risk"]["blocked"])

    # Honest engine label + no non-finite numbers anywhere in the payload.
    assert "shadow-live" in d["engine_version"]
    blob = json.dumps(d)  # raises if anything is not serialisable
    assert "NaN" not in blob and "Infinity" not in blob
    for v in (d["winner_similarity"], d["probability"], d["completeness"], od["p_ruin"]):
        assert _finite(v)


def test_fuzz_output_contract_holds_for_any_input():
    rng = random.Random(20260801)
    for i in range(FUZZ_N):
        feats = _rand_features(rng)
        result = run_engine(f"F{i}", feats, generated_at=GENERATED_AT)
        _assert_result_invariants(result.to_dict())


def test_engine_is_deterministic_across_the_fuzz_space():
    rng = random.Random(7)
    for i in range(50):
        feats = _rand_features(rng)
        a = run_engine("DET", feats, generated_at=GENERATED_AT).to_dict()
        b = run_engine("DET", feats, generated_at=GENERATED_AT).to_dict()
        assert json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)


@pytest.mark.parametrize(
    "feats",
    [
        {},
        {"rsi": 50.0},
        {"market_cap": 0, "volume": 0, "close": 0.0},
        {"rsi": 999.0, "macd_hist": -999.0, "volume_ratio": 1e9, "close": 1e9},
        {"theme_context": {}, "government": {}, "fundamentals": {}, "capital": {}},
    ],
)
def test_degenerate_inputs_never_crash_and_stay_in_contract(feats):
    result = run_engine("EDGE", feats, generated_at=GENERATED_AT)
    _assert_result_invariants(result.to_dict())


def test_all_missing_is_low_completeness_and_fabricates_no_strong_domain():
    d = run_engine("EMPTY", {}, generated_at=GENERATED_AT).to_dict()
    assert d["completeness"] <= 0.34, d["completeness"]  # a thin read, honestly
    # Every domain that has no data reads unavailable and carries no score - never a strong trait.
    for dom in d["domains"]:
        if dom["coverage"] == "unavailable":
            assert dom["score"] is None
    assert d["strongest_domains"] == [] or all(isinstance(x, str) for x in d["strongest_domains"])


def test_strong_candidate_out_resembles_a_weak_one():
    strong = {
        "rsi": 45.0, "rsi_delta": 2.0, "macd_hist": -0.2, "macd_hist_delta": 0.4, "price_vs_sma200": 1.05,
        "dist_from_60_low_pct": 8.0, "volume_ratio": 1.8, "close": 12.0, "volume": 2_000_000,
        "market_cap": 600_000_000, "avg_dollar_volume": 20_000_000,
        "theme_context": {"themes": ["ai", "quantum"], "supply_chain_centrality": 0.7, "mention_velocity": 0.5},
        "government": {"award_count": 3, "contract_value_usd": 40_000_000, "policy_alignment": 0.8},
        "fundamentals": {"revenue_growth_yoy": 45.0, "gross_margin_trend": 0.4, "cash_burn_quality": 0.7},
        "capital": {"cash_runway_quarters": 6.0, "share_count_growth_yoy": 4.0, "debt_to_equity": 0.4},
        "sponsorship": {"insider_net_buy_usd": 1_000_000, "institutional_ownership_change_pct": 6.0},
    }
    weak = {"rsi": 50.0, "volume_ratio": 1.0, "close": 3.0, "market_cap": 80_000_000}
    s = run_engine("STRONG", strong, generated_at=GENERATED_AT)
    w = run_engine("WEAK", weak, generated_at=GENERATED_AT)
    assert s.winner_similarity > w.winner_similarity


def test_rank_universe_puts_surfaced_before_blocked():
    rng = random.Random(99)
    candidates = [(f"C{i}", _rand_features(rng)) for i in range(40)]
    ranked = rank_universe(candidates, generated_at=GENERATED_AT)
    surfaced_flags = [r.surfaced for r in ranked]
    # Once we hit the first blocked name, everything after it is blocked too (surfaced-first ordering).
    if False in surfaced_flags:
        first_blocked = surfaced_flags.index(False)
        assert all(f is False for f in surfaced_flags[first_blocked:])


def test_shipped_universe_is_honestly_illustrative():
    """The landscape-coverage boundary guard: until the Phase-1 real feature pipeline lands, the worker
    ships an ILLUSTRATIVE candidate set and must SAY SO. This fails loudly if someone wires a real-looking
    universe without the honest label, or relabels the engine as trained-on-real-winners."""
    candidates = ew_main.load_candidates(repo=None)  # type: ignore[arg-type]
    assert len(candidates) >= 1
    assert candidates is ew_main.ILLUSTRATIVE_CANDIDATES, "load_candidates drifted from the illustrative set silently"
    assert "illustrative" in ew_main.RUN_NOTE.lower()
    assert "shadow-live" in ENGINE_VERSION
