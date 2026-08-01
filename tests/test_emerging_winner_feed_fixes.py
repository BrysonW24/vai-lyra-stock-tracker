"""Regression pins for the 2026-08-01 feature-semantics audit fixes - "is the right data fed through?"

Each test pins one live-path defect found by the audit so it can never silently return:
  1. volume_state real vocabulary (scanner enum) scores - it was silently dead on every live scan.
  2. Theme matching is word-level - multiword/singular labels ("quantum computing", "semiconductor")
     hit the hot set; before, the top-weighted domain scored a PRESENT 0 on real names.
  3. Curated theme context survives the yfinance industry/sector merge (it was clobbered).
  4. The FX-drop marker stops the listing-currency close x volume fallback from defeating
     "absent beats wrong" in both the liquidity domain and the liquidity risk gate.
  5. macd_turn is price-normalised - the same proportional histogram move scores the same for a
     $0.50 micro-cap and a $500 large-cap.
  6. The ranker renormalises over available signals instead of fabricating neutral 50s for
     news_attention / portfolio_relevance (25% of the priority weight was silent default).
  7. GBp (pence) never collapses to GBP.
  8. EDGAR annual series are end-year keyed, duration-validated, tag-migration-unioned, and
     YoY calcs demand CONSECUTIVE years.
  9. The Stooq bot-wall is detected as a walled provider, never parsed as "no data".
"""
from workers.emerging_winner.classifier import ClassifierResult, _classify_reference
from workers.emerging_winner.domains import (
    domain_accumulation,
    domain_liquidity,
    domain_technical,
    hot_theme_hits,
    score_domains,
)
from workers.emerging_winner.edgar_source import annual_points_from_rows, derive_edgar_features
from workers.emerging_winner.feature_source import normalise_currency_code
from workers.emerging_winner.ranker import rank
from workers.emerging_winner.risk_gates import assess_risk
from workers.stock_scanner.market_data import StooqProvider


# --- 1. volume_state vocabulary ---------------------------------------------------------------------

def test_scanner_volume_state_vocabulary_scores():
    for state, expected in (("above_average", 70.0), ("rising", 60.0), ("falling", 40.0), ("below_average", 30.0)):
        d = domain_accumulation({"volume_state": state})
        sub = next(s for s in d.subsignals if s.name == "volume_state")
        assert sub.score == expected, f"real enum value {state!r} must score, not fall through"


def test_domain_volume_state_vocabulary_still_scores():
    d = domain_accumulation({"volume_state": "accumulation"})
    sub = next(s for s in d.subsignals if s.name == "volume_state")
    assert sub.score == 85.0


# --- 2. word-level theme matching -------------------------------------------------------------------

def test_multiword_and_singular_theme_labels_hit_the_hot_set():
    assert hot_theme_hits(["quantum computing"]) == 1
    assert hot_theme_hits(["aerospace & defense"]) == 1          # aerospace->space alias + defense
    assert hot_theme_hits(["semiconductor"]) == 1                # singular of semiconductors
    assert hot_theme_hits(["semiconductor equipment & materials"]) == 1
    assert hot_theme_hits(["ai infrastructure", "robotics platform"]) == 2
    assert hot_theme_hits(["consumer staples", "utilities - regulated gas"]) == 0
    assert hot_theme_hits([]) == 0


def test_theme_domain_scores_real_yahoo_label():
    domains = {d.key: d for d in score_domains({"theme_context": {"themes": ["quantum computing"]}})}
    theme = domains["theme"]
    assert theme.score is not None and theme.score > 0, "a hot multiword label must not score a present 0"


# --- 4. FX-drop marker vs the close x volume fallback ------------------------------------------------

def test_liquidity_fallback_disabled_after_deliberate_fx_drop():
    feats = {"close": 2.5, "volume": 4_000_000, "usd_semantics_dropped": True}
    d = domain_liquidity(feats)
    adv_sub = next(s for s in d.subsignals if s.name == "avg_dollar_volume")
    assert adv_sub.score is None, "listing-currency close x volume must not be compared to USD bands"

    gate = next(g for g in assess_risk(feats).gates if g.key == "liquidity")
    assert gate.verdict == "insufficient", "the gate must read unproven, not judge a mislabeled number"


def test_liquidity_fallback_still_works_without_the_drop_marker():
    d = domain_liquidity({"close": 2.5, "volume": 4_000_000})
    adv_sub = next(s for s in d.subsignals if s.name == "avg_dollar_volume")
    assert adv_sub.score is not None


# --- 5. price-normalised macd_turn -------------------------------------------------------------------

def _macd_turn_score(close: float, delta: float) -> float:
    d = domain_technical({"close": close, "macd_hist": -0.1, "macd_hist_delta": delta})
    return next(s for s in d.subsignals if s.name == "macd_turn").score


def test_macd_turn_is_scale_free_across_price_levels():
    micro = _macd_turn_score(close=0.50, delta=0.004)   # 0.8% of price
    large = _macd_turn_score(close=500.0, delta=4.0)    # 0.8% of price
    assert abs(micro - large) < 1e-9, "same proportional move must score the same at any price level"
    assert micro > 50.0, "a positive early turn must read above neutral for a micro-cap too"


# --- 6. ranker renormalisation ------------------------------------------------------------------------

def _clf(similarity: float = 70.0, confidence: str = "medium") -> ClassifierResult:
    domains = score_domains({"rsi": 45.0, "volume_ratio": 1.5, "close": 10.0, "open": 9.5})
    res = _classify_reference(domains)
    res.winner_similarity = similarity
    res.confidence = confidence
    return res


def test_rank_without_optional_signals_renormalises_not_defaults():
    clf = _clf()
    prio_missing, _, signals = rank(clf, risk_penalty=10.0, blocked=False)
    assert signals["catalyst_freshness"] == "unavailable"
    assert signals["portfolio_relevance"] == "unavailable"
    # Renormalised positive part: (70*0.50 + 70*0.15) * (0.90/0.65) - 10*0.40
    expected = (70.0 * 0.50 + 70.0 * 0.15) * (0.90 / 0.65) - 4.0
    assert abs(prio_missing - expected) < 1e-9

    prio_neutral_50, _, _ = rank(clf, risk_penalty=10.0, blocked=False,
                                 catalyst_freshness=50.0, portfolio_relevance=50.0)
    assert prio_missing != prio_neutral_50, "missing must not be treated as a fabricated neutral 50"


def test_rank_with_all_signals_matches_original_formula():
    clf = _clf()
    prio, _, _ = rank(clf, risk_penalty=10.0, blocked=False,
                      catalyst_freshness=60.0, portfolio_relevance=40.0)
    expected = 70.0 * 0.50 + 60.0 * 0.15 + 40.0 * 0.10 + 70.0 * 0.15 - 10.0 * 0.40
    assert abs(prio - expected) < 1e-9


# --- 7. pence stays pence ------------------------------------------------------------------------------

def test_gbp_pence_never_collapses_to_pounds():
    assert normalise_currency_code("GBp") == "GBX"
    assert normalise_currency_code("GBX") == "GBX"
    assert normalise_currency_code("gbp_pence") == "GBX"
    assert normalise_currency_code("GBP") == "GBP"
    assert normalise_currency_code("aud") == "AUD"


# --- 8. EDGAR annual-series discipline -----------------------------------------------------------------

def _entry(val, end, filed, form="10-K", fp="FY", start=None):
    e = {"val": val, "end": end, "filed": filed, "form": form, "fp": fp}
    if start:
        e["start"] = start
    return e


def test_comparative_period_inside_a_10k_lands_in_its_own_slot():
    # A FY2023 10-K restates the 2021/2022 comparatives; all three share the filing's fy/fp in
    # companyfacts. End-DATE keying places each period where it belongs regardless of array order.
    rows = [
        _entry(300, "2023-12-31", "2024-02-15", start="2023-01-01"),
        _entry(100, "2021-12-31", "2024-02-15", start="2021-01-01"),  # comparative, same filing
        _entry(200, "2022-12-31", "2024-02-15", start="2022-01-01"),  # comparative, same filing
    ]
    pts = annual_points_from_rows(rows)
    assert [(end, val) for end, _f, val in pts] == [
        ("2021-12-31", 100.0), ("2022-12-31", 200.0), ("2023-12-31", 300.0)]


def test_non_annual_duration_flow_is_rejected_even_when_tagged_fy():
    rows = [
        _entry(500, "2023-12-31", "2024-02-15", start="2023-10-01"),  # Q4-only flow mislabeled FY
        _entry(400, "2022-12-31", "2023-02-15", start="2022-01-01"),
    ]
    pts = annual_points_from_rows(rows)
    assert [end for end, _f, _v in pts] == ["2022-12-31"]


def test_as_of_hides_facts_filed_later():
    rows = [
        _entry(100, "2021-12-31", "2022-02-15", start="2021-01-01"),
        _entry(150, "2021-12-31", "2024-06-01", start="2021-01-01"),  # restatement filed years later
    ]
    live = annual_points_from_rows(rows)
    asof = annual_points_from_rows(rows, as_of="2022-12-31")
    assert live[-1][2] == 150.0, "live view keeps the best current truth"
    assert asof[-1][2] == 100.0, "point-in-time view must only see what was filed by then"


def test_52_53_week_fiscal_drift_keeps_its_yoy():
    # A 53-week retail calendar: FY ends 2022-12-28 then 2024-01-02 (370 days later, crossing Jan 1).
    # Calendar-year arithmetic would key them 2022/2024 and drop the pair; date-gap logic keeps it.
    from workers.emerging_winner.edgar_source import latest_annual_pair

    rows = [
        _entry(1_000_000, "2022-12-28", "2023-02-20", start="2021-12-30"),
        _entry(1_100_000, "2024-01-02", "2024-02-20", start="2022-12-29"),
    ]
    pair = latest_annual_pair(annual_points_from_rows(rows))
    assert pair is not None, "52/53-week Dec-boundary fiscal years must not lose their YoY"
    assert pair[1] == 1_000_000 and pair[3] == 1_100_000


def test_growth_never_mixes_concepts():
    # dei cover-page share counts (instant, end ~Feb of the NEXT year) must never pair with a
    # us-gaap fiscal-year weighted average - the cross-concept pseudo-YoY sign-flipped real names.
    facts = {"facts": {
        "us-gaap": {"WeightedAverageNumberOfSharesOutstandingBasic": {"units": {"shares": [
            _entry(10_000_000, "2022-12-31", "2023-02-15", start="2022-01-01"),
        ]}}},
        "dei": {"EntityCommonStockSharesOutstanding": {"units": {"shares": [
            _entry(8_800_000, "2024-02-15", "2024-02-20"),  # buyback-looking cover-date count
        ]}}},
    }}
    out = derive_edgar_features(facts)
    assert out == {}, "one point per concept can never make a YoY - no cross-concept pairing"


def test_purge_horizon_is_calendar_days():
    # A training row 300 CALENDAR days before the fold boundary has a 12-month label window still
    # open inside the test fold and must be purged (the old trading-day horizon kept it).
    from workers.emerging_winner.train import (
        PURGE_EMBARGO_CALENDAR_DAYS,
        PURGE_HORIZON_CALENDAR_DAYS,
        _purged_train_indices,
    )

    base = 738000.0
    times = [base, base + 400.0, base + 700.0]  # boundary at index 2
    keep = _purged_train_indices(times, 2, PURGE_HORIZON_CALENDAR_DAYS, PURGE_EMBARGO_CALENDAR_DAYS)
    assert 0 in keep, "700 days before the boundary is safely matured"
    assert 1 not in keep, "300 days before the boundary must be purged - its label window is open"


def _facts(concept_rows: dict) -> dict:
    us = {c: {"units": {"USD": rows}} for c, rows in concept_rows.items() if c != "shares"}
    if "shares" in concept_rows:
        us["WeightedAverageNumberOfSharesOutstandingBasic"] = {"units": {"shares": concept_rows["shares"]}}
    return {"facts": {"us-gaap": us}}


def test_tag_migration_selects_the_freshest_concept_series():
    # Issuer filed RevenueFromContractWithCustomer... through FY2022 then switched to Revenues.
    # Concept selection must follow the migration (freshest series wins) WITHOUT mixing concepts.
    facts = _facts({
        "RevenueFromContractWithCustomerExcludingAssessedTax": [
            _entry(1000, "2021-12-31", "2022-02-15", start="2021-01-01"),
            _entry(1200, "2022-12-31", "2023-02-15", start="2022-01-01"),
        ],
        "Revenues": [
            _entry(1400, "2023-12-31", "2024-02-15", start="2023-01-01"),
            _entry(1800, "2024-12-31", "2025-02-15", start="2024-01-01"),
        ],
        "GrossProfit": [
            _entry(700, "2023-12-31", "2024-02-15", start="2023-01-01"),   # margin 0.50
            _entry(1080, "2024-12-31", "2025-02-15", start="2024-01-01"),  # margin 0.60
        ],
    })
    out = derive_edgar_features(facts)
    assert out["fundamentals"]["gross_margin_trend"] == 0.1, (
        "selection must use the freshest concept's series (2023/2024), not the stale first variant"
    )


def test_yoy_requires_consecutive_years():
    facts = _facts({"shares": [
        _entry(1_000_000, "2019-12-31", "2020-02-15"),
        _entry(2_000_000, "2023-12-31", "2024-02-15"),  # 4-year gap - not a YoY
    ]})
    assert derive_edgar_features(facts) == {}


def test_recency_guard_drops_ancient_derivations():
    facts = _facts({"shares": [
        _entry(1_000_000, "2014-12-31", "2015-02-15"),
        _entry(1_100_000, "2015-12-31", "2016-02-15"),
    ]})
    assert derive_edgar_features(facts, as_of="2026-08-01", max_age_years=3) == {}
    assert derive_edgar_features(facts)["capital"]["share_count_growth_yoy"] == 10.0


# --- 9. stooq bot-wall detection -------------------------------------------------------------------------

_CHALLENGE = (
    '<!DOCTYPE html><html><head><script>async function verify(){const h=await crypto.subtle.digest('
    '"SHA-256", data); fetch("/__verify", {method:"POST"});}</script></head>'
    "<body>This site requires JavaScript to verify your browser.</body></html>"
)


def test_bot_challenge_page_is_detected_as_walled():
    assert StooqProvider.looks_bot_walled(_CHALLENGE) is True
    assert StooqProvider.looks_bot_walled("Date,Open,High,Low,Close,Volume\n2024-01-02,1,1,1,1,100") is False
    assert StooqProvider.looks_bot_walled("") is False


def test_challenge_page_parses_to_no_candles_not_fake_data():
    assert StooqProvider().parse_csv(_CHALLENGE, symbol="AAPL", timeframe="1d") == []
