"""Unit pins for the USAspending government-awards source (usaspending_source) - no network ever.

The honesty invariants these protect (from the 2026-08-02 name-bridge feasibility probe):
  * Normalization is invariant to CORP/CORPORATION/Inc. spelling drift and EDGAR state markers,
    and is applied identically to both sides of the exact compare.
  * The single-generic-token guard refuses CELSIUS-class collisions WITHOUT touching the network.
  * Point-in-time discipline: a transaction dated after as_of NEVER counts in any aggregate.
  * cached_only never networks and is all-or-nothing - a missing cache entry is None, never a
    fake partial.
  * Transient failures return None and are never cached; genuinely-empty answers ARE cached.
  * A bounded fetch that hit the page cap is LABELLED truncated, in the cache and the aggregates.
"""
import json
import os

import pytest

from workers.emerging_winner import usaspending_source as us
from workers.emerging_winner.usaspending_source import (
    aggregates_from_transactions,
    awards_asof,
    build_recipient_bridge,
    government_features,
    load_transactions,
    normalize_company_name,
    passes_single_token_guard,
    search_keyword,
)


def _no_network(monkeypatch):
    def _boom(*args, **kwargs):
        raise AssertionError("network call attempted - this test must never network")
    monkeypatch.setattr(us, "_post_json", _boom)


# --- (a) normalization table -------------------------------------------------------------------

def test_normalization_table_pins_the_probes_traps():
    # CORP vs CORPORATION collapse to the same form - the bridge's core invariance.
    assert normalize_company_name("LOCKHEED MARTIN CORPORATION") == "LOCKHEED MARTIN"
    assert normalize_company_name("LOCKHEED MARTIN CORP") == "LOCKHEED MARTIN"
    # EDGAR state-of-incorporation markers are stripped.
    assert normalize_company_name("NORTHROP GRUMMAN CORP /DE/") == "NORTHROP GRUMMAN"
    assert normalize_company_name("L3HARRIS TECHNOLOGIES, INC. /DE/") == "L3HARRIS TECHNOLOGIES"
    # Leading THE drops; suffix strip never eats the last token.
    assert normalize_company_name("The Boeing Company") == "BOEING"
    # Punctuation becomes token boundaries.
    assert normalize_company_name("e.l.f. Beauty, Inc.") == "E L F BEAUTY"
    assert normalize_company_name("KRATOS DEFENSE & SECURITY SOLUTIONS, INC.") == \
        "KRATOS DEFENSE SECURITY SOLUTIONS"
    # Iterative suffix stripping: HOLDINGS then INC both come off.
    assert normalize_company_name("Celsius Holdings, Inc.") == "CELSIUS"
    assert normalize_company_name("Leidos Holdings, Inc.") == "LEIDOS"
    # Degenerates.
    assert normalize_company_name("") == ""
    assert normalize_company_name("...") == ""


def test_single_token_guard_refuses_generic_words_and_short_tokens():
    assert passes_single_token_guard("LOCKHEED MARTIN") is True     # multi-token always passes
    assert passes_single_token_guard("CELSIUS") is False            # the probe's failure case
    assert passes_single_token_guard("DUOLINGO") is True            # 8 chars, not generic
    assert passes_single_token_guard("BOEING") is False             # single token under 8 chars
    assert passes_single_token_guard("AMERICAN") is False           # blocklisted despite length
    assert passes_single_token_guard("") is False


def test_celsius_holdings_never_matches_plain_celsius_and_never_networks(monkeypatch, tmp_path):
    _no_network(monkeypatch)
    out = build_recipient_bridge(1341766, "Celsius Holdings, Inc.", str(tmp_path))
    assert out is not None and out["match"] is None
    assert out["reason"] == "generic_single_token"
    assert out["normalized"] == "CELSIUS"
    # The guard rejection is a REAL answer - it must be cached.
    again = build_recipient_bridge(1341766, "Celsius Holdings, Inc.", str(tmp_path), cached_only=True)
    assert again == out


def test_search_keyword_preserves_internal_punctuation_but_strips_suffixes():
    # The live recipient keyword search is phrase-style and punctuation-sensitive (the Kratos
    # lesson): the QUERY keeps "&" and "." while the COMPARE form strips them.
    assert search_keyword("KRATOS DEFENSE & SECURITY SOLUTIONS, INC.") == \
        "KRATOS DEFENSE & SECURITY SOLUTIONS"
    assert search_keyword("LOCKHEED MARTIN CORP") == "LOCKHEED MARTIN"
    assert search_keyword("NORTHROP GRUMMAN CORP /DE/") == "NORTHROP GRUMMAN"
    assert search_keyword("The Boeing Company") == "BOEING"
    assert search_keyword("") == ""


# --- bridge: exact match + guards over a monkeypatched search ------------------------------------

def _recipient_response(rows):
    return {"results": rows, "page_metadata": {"page": 1, "hasNext": False}}


def test_bridge_exact_match_requires_uei_and_prefers_parent(monkeypatch, tmp_path):
    rows = [
        # Higher amount child record...
        {"id": "hash-c1-C", "uei": "UEICHILD1111", "name": "LOCKHEED MARTIN CORPORATION",
         "recipient_level": "C", "amount": 99e9},
        # ...but the parent must win the tie-break (its hash pulls linked children too).
        {"id": "hash-p1-P", "uei": "UEIPARENT111", "name": "LOCKHEED MARTIN CORP",
         "recipient_level": "P", "amount": 63e9},
        # Fuzzy stranger that does not normalize equal - must be ignored.
        {"id": "hash-x1-R", "uei": "UEISTRANGER1", "name": "LOCKHEED MARTIN INTEGRATED SYSTEMS LLC",
         "recipient_level": "R", "amount": 1e9},
    ]
    monkeypatch.setattr(us, "_post_json", lambda *a, **k: _recipient_response(rows))
    out = build_recipient_bridge(936468, "LOCKHEED MARTIN CORP", str(tmp_path))
    assert out["match"] == "exact"
    assert out["recipient_id"] == "hash-p1-P"
    assert out["uei"] == "UEIPARENT111"
    assert out["matched_name"] == "LOCKHEED MARTIN CORP"
    assert "registered_no_recent_awards" not in out


def test_bridge_uei_less_shells_are_an_honest_no_match_and_cached(monkeypatch, tmp_path):
    # The WINGSTOP class: exact-normalized franchisee DBA shells with no UEI.
    rows = [{"id": "hash-s1-R", "uei": None, "name": "WINGSTOP INC", "recipient_level": "R",
             "amount": 0.0}]
    monkeypatch.setattr(us, "_post_json", lambda *a, **k: _recipient_response(rows))
    out = build_recipient_bridge(1636222, "Wingstop Inc.", str(tmp_path))
    assert out["match"] is None and out["reason"] == "uei_less_name_shells_only"
    # Cached: serving again must not network.
    _no_network(monkeypatch)
    assert build_recipient_bridge(1636222, "Wingstop Inc.", str(tmp_path)) == out


def test_bridge_zero_amount_uei_match_is_registered_no_recent_awards(monkeypatch, tmp_path):
    # The KTOS pattern: a real UEI-bearing parent whose obligations sit under subsidiaries.
    rows = [{"id": "hash-k1-P", "uei": "UEIKRATOS111", "name": "KRATOS DEFENSE SECURITY SOLUTIONS",
             "recipient_level": "P", "amount": 0.0}]
    monkeypatch.setattr(us, "_post_json", lambda *a, **k: _recipient_response(rows))
    out = build_recipient_bridge(1069258, "KRATOS DEFENSE & SECURITY SOLUTIONS, INC.", str(tmp_path))
    assert out["match"] == "exact"
    assert out["registered_no_recent_awards"] is True


def test_bridge_twin_parent_tie_breaks_to_the_registered_hierarchy(monkeypatch, tmp_path):
    # The live Kratos lesson: two exact-matched P records, both $0. The UEI that ALSO appears at
    # C level marks the SAM-registered operating hierarchy (its parent hash rolls up the
    # subsidiary family); the P-only twin is a bare shell with zero transactions.
    rows = [
        {"id": "hash-shell-P", "uei": "UEISHELL1111",
         "name": "KRATOS DEFENSE & SECURITY SOLUTIONS, INC.", "recipient_level": "P", "amount": 0.0},
        {"id": "hash-real-P", "uei": "UEIFAMILY111",
         "name": "KRATOS DEFENSE & SECURITY SOLUTIONS, INC.", "recipient_level": "P", "amount": 0.0},
        {"id": "hash-real-C", "uei": "UEIFAMILY111",
         "name": "KRATOS DEFENSE & SECURITY SOLUTIONS, INC.", "recipient_level": "C", "amount": 0.0},
    ]
    monkeypatch.setattr(us, "_post_json", lambda *a, **k: _recipient_response(rows))
    out = build_recipient_bridge(1069258, "KRATOS DEFENSE & SECURITY SOLUTIONS, INC.", str(tmp_path))
    assert out["recipient_id"] == "hash-real-P"
    assert out["uei"] == "UEIFAMILY111"


def test_bridge_queries_with_punctuated_keyword_and_falls_back_to_normalized(monkeypatch, tmp_path):
    # Primary query carries the punctuation-preserving keyword; when it finds nothing usable the
    # bridge tries the normalized form ONCE, then settles. Pin both the keyword strings and the
    # bounded call count.
    seen: list[str] = []

    def _by_keyword(url, payload, **k):
        kw = payload["keyword"]
        seen.append(kw)
        if kw == "KRATOS DEFENSE & SECURITY SOLUTIONS":
            return _recipient_response([
                {"id": "hash-k1-P", "uei": "UEIKRATOS111",
                 "name": "KRATOS DEFENSE & SECURITY SOLUTIONS, INC.",
                 "recipient_level": "P", "amount": 0.0}])
        return _recipient_response([])

    monkeypatch.setattr(us, "_post_json", _by_keyword)
    out = build_recipient_bridge(1069258, "KRATOS DEFENSE & SECURITY SOLUTIONS, INC.", str(tmp_path))
    assert out["match"] == "exact" and out["recipient_id"] == "hash-k1-P"
    assert seen == ["KRATOS DEFENSE & SECURITY SOLUTIONS"], "punctuated hit needs no fallback"

    # Reverse drift: punctuated phrase misses, normalized phrase hits - exactly two calls.
    seen.clear()

    def _normalized_only(url, payload, **k):
        kw = payload["keyword"]
        seen.append(kw)
        if kw == "SMITH WESSON BRANDS":
            return _recipient_response([
                {"id": "hash-s2-R", "uei": "UEISMITH1111", "name": "SMITH WESSON BRANDS INC",
                 "recipient_level": "R", "amount": 5.0e6}])
        return _recipient_response([])

    monkeypatch.setattr(us, "_post_json", _normalized_only)
    out = build_recipient_bridge(1092796, "SMITH & WESSON BRANDS, INC.", str(tmp_path))
    assert out["match"] == "exact" and out["recipient_id"] == "hash-s2-R"
    assert seen == ["SMITH & WESSON BRANDS", "SMITH WESSON BRANDS"]


def test_bridge_fallback_failure_is_transient_and_uncached(monkeypatch, tmp_path):
    # Primary look completes empty, fallback dies: no-match may NOT be cached off half a search.
    def _flaky(url, payload, **k):
        if payload["keyword"] == "SMITH WESSON BRANDS":
            raise ConnectionError("simulated outage on fallback")
        return _recipient_response([])

    monkeypatch.setattr(us, "_post_json", _flaky)
    assert build_recipient_bridge(1092796, "SMITH & WESSON BRANDS, INC.", str(tmp_path)) is None
    assert not os.path.exists(us._cache_path(str(tmp_path), "bridge", "1092796"))


# --- (b) as-of discipline -------------------------------------------------------------------------

def _blob(txs, truncated=False):
    return {"recipient_id": "hash-t1-P", "fetched_through": "2026-08-03",
            "transactions": txs, "truncated": truncated}


def test_transaction_after_as_of_never_counts():
    txs = [
        {"action_date": "2024-01-10", "amount_usd": 100.0, "award_id": "AW-OLD"},
        {"action_date": "2025-06-01", "amount_usd": 250.0, "award_id": "AW-1"},
        {"action_date": "2026-09-15", "amount_usd": 1_000_000.0, "award_id": "AW-FUTURE"},
    ]
    agg = aggregates_from_transactions(_blob(txs), "2026-08-01")
    # The 2026-09-15 transaction is after as_of: not in the count, not in the sum, not the first
    # date. 2024-01-10 (before as_of minus 730d = 2024-08-01) is outside the trailing window so it
    # never enters the 2y aggregates, but it IS visible history for first_award_date.
    assert agg == {
        "award_count_2y": 1,
        "obligations_2y_usd": 250.0,
        "first_award_date": "2024-01-10",
        "as_of": "2026-08-01",
        "truncated": False,
    }


def test_as_of_before_all_transactions_is_a_real_zero_with_no_first_date():
    txs = [{"action_date": "2025-06-01", "amount_usd": 250.0, "award_id": "AW-1"}]
    agg = aggregates_from_transactions(_blob(txs), "2024-01-01")
    assert agg["award_count_2y"] == 0
    assert agg["obligations_2y_usd"] == 0.0
    assert agg["first_award_date"] is None


def test_award_count_dedupes_transaction_modifications():
    # Three transactions on one award + one on another = 2 awards, sums keep everything.
    txs = [
        {"action_date": "2026-01-10", "amount_usd": 10.0, "award_id": "AW-1"},
        {"action_date": "2026-02-10", "amount_usd": 20.0, "award_id": "AW-1"},
        {"action_date": "2026-03-10", "amount_usd": -5.0, "award_id": "AW-1"},  # deobligation
        {"action_date": "2026-04-10", "amount_usd": 40.0, "award_id": "AW-2"},
    ]
    agg = aggregates_from_transactions(_blob(txs), "2026-08-01")
    assert agg["award_count_2y"] == 2
    assert agg["obligations_2y_usd"] == 65.0


def test_window_days_boundary_is_half_open():
    # Window is (as_of - window_days, as_of]: a transaction exactly window_days old is excluded,
    # one dated exactly as_of is included.
    txs = [
        {"action_date": "2024-08-01", "amount_usd": 1.0, "award_id": "AW-EDGE"},   # = as_of - 730d
        {"action_date": "2026-08-01", "amount_usd": 2.0, "award_id": "AW-TODAY"},  # = as_of
    ]
    agg = aggregates_from_transactions(_blob(txs), "2026-08-01", window_days=730)
    assert agg["award_count_2y"] == 1
    assert agg["obligations_2y_usd"] == 2.0


# --- (c) cached_only never networks ---------------------------------------------------------------

def test_cached_only_bridge_returns_none_when_cache_absent(monkeypatch, tmp_path):
    _no_network(monkeypatch)
    assert build_recipient_bridge(936468, "LOCKHEED MARTIN CORP", str(tmp_path),
                                  cached_only=True) is None


def test_cached_only_awards_return_none_when_cache_absent(monkeypatch, tmp_path):
    _no_network(monkeypatch)
    assert awards_asof("hash-p1-P", str(tmp_path), "2026-08-01", cached_only=True) is None


def test_cached_only_government_features_all_or_nothing(monkeypatch, tmp_path):
    _no_network(monkeypatch)
    cache_dir = str(tmp_path)
    # Seed ONLY the bridge cache - the transactions half is missing, so the whole read is None.
    bridge = {"cik": 936468, "name": "LOCKHEED MARTIN CORP", "normalized": "LOCKHEED MARTIN",
              "match": "exact", "recipient_id": "hash-p1-P", "uei": "UEIPARENT111",
              "matched_name": "LOCKHEED MARTIN CORP", "recipient_level": "P"}
    path = us._cache_path(cache_dir, "bridge", "936468")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(bridge, fh)
    assert government_features(936468, "LOCKHEED MARTIN CORP", cache_dir, "2026-08-01",
                               cached_only=True) is None
    # Now seed the transactions too - the read completes offline.
    tx_path = us._cache_path(cache_dir, "transactions", "hash-p1-P")
    with open(tx_path, "w", encoding="utf-8") as fh:
        json.dump(_blob([{"action_date": "2026-05-01", "amount_usd": 5.0, "award_id": "AW-1"}]), fh)
    out = government_features(936468, "LOCKHEED MARTIN CORP", cache_dir, "2026-08-01",
                              cached_only=True)
    assert out["available"] is True
    assert out["award_count_2y"] == 1 and out["obligations_2y_usd"] == 5.0
    assert out["recipient_id"] == "hash-p1-P" and out["uei"] == "UEIPARENT111"


def test_unmatched_bridge_reads_as_unavailable_reason(monkeypatch, tmp_path):
    _no_network(monkeypatch)
    out = government_features(1341766, "Celsius Holdings, Inc.", str(tmp_path), "2026-08-01")
    assert out == {"available": False, "reason": "no_recipient_match"}


# --- (d) transient failure never cached / empty answer cached -------------------------------------

def test_transient_bridge_failure_returns_none_and_caches_nothing(monkeypatch, tmp_path):
    def _fail(*a, **k):
        raise ConnectionError("simulated outage")
    monkeypatch.setattr(us, "_post_json", _fail)
    assert build_recipient_bridge(936468, "LOCKHEED MARTIN CORP", str(tmp_path)) is None
    assert not os.path.exists(us._cache_path(str(tmp_path), "bridge", "936468"))


def test_empty_recipient_search_caches_an_honest_no_match(monkeypatch, tmp_path):
    monkeypatch.setattr(us, "_post_json", lambda *a, **k: _recipient_response([]))
    out = build_recipient_bridge(1090727, "CHIPOTLE MEXICAN GRILL INC", str(tmp_path))
    assert out["match"] is None and out["reason"] == "no_exact_normalized_match"
    # Cached: a later cached_only read serves the no-match without any network.
    _no_network(monkeypatch)
    assert build_recipient_bridge(1090727, "CHIPOTLE MEXICAN GRILL INC", str(tmp_path),
                                  cached_only=True) == out


def test_transient_transaction_failure_returns_none_and_caches_nothing(monkeypatch, tmp_path):
    def _fail(*a, **k):
        raise TimeoutError("simulated timeout")
    monkeypatch.setattr(us, "_post_json", _fail)
    assert load_transactions("hash-p1-P", str(tmp_path)) is None
    assert not os.path.exists(us._cache_path(str(tmp_path), "transactions", "hash-p1-P"))


def test_zero_transaction_recipient_is_a_real_empty_and_cached(monkeypatch, tmp_path):
    monkeypatch.setattr(us, "_post_json",
                        lambda *a, **k: {"results": [], "page_metadata": {"hasNext": False}})
    blob = load_transactions("hash-k1-P", str(tmp_path))
    assert blob["transactions"] == [] and blob["truncated"] is False
    agg = awards_asof("hash-k1-P", str(tmp_path), "2026-08-01")
    assert agg["award_count_2y"] == 0 and agg["obligations_2y_usd"] == 0.0
    assert agg["first_award_date"] is None
    # And it now serves offline.
    _no_network(monkeypatch)
    assert awards_asof("hash-k1-P", str(tmp_path), "2026-08-01", cached_only=True) == agg


def test_partial_page_failure_voids_the_whole_fetch(monkeypatch, tmp_path):
    # Page 1 succeeds with hasNext, page 2 dies: the whole fetch must be None with nothing cached -
    # a silently short list would bias every aggregate computed from it.
    calls = {"n": 0}

    def _flaky(url, payload, **k):
        calls["n"] += 1
        if payload.get("page", 1) >= 2:
            raise ConnectionError("simulated mid-pagination outage")
        return {"results": [{"Action Date": "2026-05-01", "Transaction Amount": 1.0,
                             "Recipient Name": "X", "Award ID": "AW-1", "Awarding Agency": "DoD"}],
                "page_metadata": {"hasNext": True}}
    monkeypatch.setattr(us, "_post_json", _flaky)
    assert load_transactions("hash-p9-P", str(tmp_path)) is None
    assert calls["n"] == 2
    assert not os.path.exists(us._cache_path(str(tmp_path), "transactions", "hash-p9-P"))


# --- (e) truncation is labelled --------------------------------------------------------------------

def test_truncation_is_labelled_in_cache_and_aggregates(monkeypatch, tmp_path):
    def _pages(url, payload, **k):
        page = payload.get("page", 1)
        rows = [{"Action Date": f"2026-0{page}-15", "Transaction Amount": 10.0,
                 "Recipient Name": "BIGCO", "Award ID": f"AW-{page}-{i}",
                 "Awarding Agency": "DoD"} for i in range(us.PAGE_LIMIT)]
        return {"results": rows, "page_metadata": {"hasNext": True}}  # always more than the cap
    monkeypatch.setattr(us, "_post_json", _pages)
    blob = load_transactions("hash-big-P", str(tmp_path))
    assert blob["truncated"] is True
    assert len(blob["transactions"]) == us.PAGE_LIMIT * us.MAX_PAGES
    agg = awards_asof("hash-big-P", str(tmp_path), "2026-08-01")
    assert agg["truncated"] is True


def test_untruncated_fetch_is_labelled_false(monkeypatch, tmp_path):
    monkeypatch.setattr(us, "_post_json",
                        lambda *a, **k: {"results": [{"Action Date": "2026-05-01",
                                                      "Transaction Amount": 3.0,
                                                      "Recipient Name": "SMALLCO",
                                                      "Award ID": "AW-1",
                                                      "Awarding Agency": "NASA"}],
                                         "page_metadata": {"hasNext": False}})
    blob = load_transactions("hash-small-P", str(tmp_path))
    assert blob["truncated"] is False
    agg = awards_asof("hash-small-P", str(tmp_path), "2026-08-01")
    assert agg["truncated"] is False


# --- misc honesty edges -----------------------------------------------------------------------------

def test_bad_as_of_reads_as_unavailable_not_a_crash():
    assert aggregates_from_transactions(_blob([]), "not-a-date") is None


def test_bridge_result_keys_match_the_contract(monkeypatch, tmp_path):
    rows = [{"id": "hash-p1-P", "uei": "UEIPARENT111", "name": "PALANTIR TECHNOLOGIES INC",
             "recipient_level": "P", "amount": 1.8e9}]
    monkeypatch.setattr(us, "_post_json", lambda *a, **k: _recipient_response(rows))
    out = build_recipient_bridge(1321655, "Palantir Technologies Inc.", str(tmp_path))
    for key in ("cik", "name", "normalized", "recipient_id", "uei", "matched_name", "match"):
        assert key in out
