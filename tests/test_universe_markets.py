"""
Multi-market dynamic pool - CI-safe (no network).

Proves the global-ingestion upgrade to the Emerging Winner universe holds its promises offline:

  * the FinanceDatabase listing parser is coverage-honest: delisted names excluded, symbols validated,
    smallest-cap-bucket-first ordering (the engine's target class leads), malformed input parses to [];
  * the rotating window is deterministic per UTC day, advances daily, wraps, and covers the WHOLE pool
    over a full cycle - small caps through mega caps, nothing rescanned forever at the front;
  * multi-market assembly keeps the standing invariants: curated emergence names first every run, budget
    split across markets proportional to pool size, de-duplication, the limit respected, and the offline
    fallback (curated names only) intact.

Timezone rule honoured: every rotation test passes an EXPLICIT `datetime.date` - never the machine clock.
"""
from __future__ import annotations

import datetime

from workers.emerging_winner import universe_source as us

DAY_1 = datetime.date(2026, 6, 1)
DAY_2 = datetime.date(2026, 6, 2)

FINDB_CSV = (
    "symbol,name,summary,currency,sector,industry_group,industry,exchange,mic,market,country,state,city,"
    "zipcode,website,market_cap,isin,cusip,figi,composite_figi,shareclass_figi,delisted\n"
    'BIG.AX,Mega Corp,"A mega, cap.",AUD,Technology,Software,Software,ASX,XASX,Australian Securities Exchange,'
    "Australia,NSW,Sydney,2000,http://big.example,Mega Cap,,,,,,False\n"
    'TINY.AX,Tiny Ltd,"Tiny name\nwith a newline summary",AUD,Energy,Energy,Uranium,ASX,XASX,'
    "Australian Securities Exchange,Australia,WA,Perth,6000,http://tiny.example,Nano Cap,,,,,,False\n"
    "GONE.AX,Gone Ltd,Delisted name,AUD,Energy,Energy,Coal,ASX,XASX,Australian Securities Exchange,"
    "Australia,QLD,Brisbane,4000,,Small Cap,,,,,,True\n"
    "SML.AX,Small Ltd,A small cap,AUD,Industrials,Capital Goods,Machinery,ASX,XASX,"
    "Australian Securities Exchange,Australia,VIC,Melbourne,3000,,Small Cap,,,,,,False\n"
    "WRONG.L,Wrong Market,On the wrong exchange file,GBP,Energy,Energy,Oil,LSE,XLON,London,"
    "United Kingdom,,London,,,Mid Cap,,,,,,False\n"
    "bad symbol,Bad,inconsistent,AUD,,,,ASX,,,,,,,,Micro Cap,,,,,,False\n"
)


# --------------------------------------------------------------------------------------------------
# FinanceDatabase listing parser
# --------------------------------------------------------------------------------------------------

def test_findb_parse_is_delisted_free_validated_and_small_first():
    syms = us.parse_findb_listing(FINDB_CSV, expect_suffix=".AX")
    # Delisted excluded, wrong-suffix and malformed symbols excluded.
    assert "GONE.AX" not in syms and "WRONG.L" not in syms
    assert all(sym.endswith(".AX") for sym in syms)
    # Smallest cap bucket first (nano before small before mega) - the engine's target class leads.
    assert syms == ["TINY.AX", "SML.AX", "BIG.AX"]


def test_findb_parse_handles_garbage_honestly():
    assert us.parse_findb_listing("") == []
    assert us.parse_findb_listing("no,symbol,column\n1,2,3\n") == []


# --------------------------------------------------------------------------------------------------
# Rotating window
# --------------------------------------------------------------------------------------------------

def test_rotating_window_is_deterministic_and_advances_daily():
    pool = [f"S{i}" for i in range(10)]
    w1 = us.rotating_window(pool, 3, day=DAY_1)
    assert w1 == us.rotating_window(pool, 3, day=DAY_1)  # same day -> same window (rerun-stable)
    w2 = us.rotating_window(pool, 3, day=DAY_2)
    assert w1 != w2  # a new day -> the window moved
    assert len(w1) == len(w2) == 3


def test_rotating_window_covers_the_whole_pool_over_a_cycle():
    pool = [f"S{i}" for i in range(10)]
    budget = 3
    seen: set[str] = set()
    for offset in range((len(pool) + budget - 1) // budget + 1):  # one full cycle (+1 day of slack)
        seen.update(us.rotating_window(pool, budget, day=DAY_1 + datetime.timedelta(days=offset)))
    assert seen == set(pool)  # small caps through mega caps: every name scanned within the cycle


def test_rotating_window_edges():
    pool = ["A", "B", "C"]
    assert us.rotating_window(pool, 99, day=DAY_1) == pool  # budget >= pool -> everything
    assert us.rotating_window([], 5, day=DAY_1) == []
    assert us.rotating_window(pool, 0, day=DAY_1) == []
    # Wrap-around keeps length and stays inside the pool.
    w = us.rotating_window(pool, 2, day=DAY_2)
    assert len(w) == 2 and set(w) <= set(pool)


# --------------------------------------------------------------------------------------------------
# Budget split across markets
# --------------------------------------------------------------------------------------------------

def test_split_budget_is_proportional_and_exact():
    shares = us._split_budget(100, {"us": 8000, "au": 2000})
    assert sum(shares.values()) == 100
    assert shares["us"] > shares["au"] > 0  # proportional, nobody starved


def test_split_budget_edges():
    assert us._split_budget(0, {"us": 10}) == {"us": 0}
    assert us._split_budget(10, {"us": 0}) == {"us": 0}
    shares = us._split_budget(5, {"us": 3, "au": 1000})
    assert sum(shares.values()) == 5
    assert shares["us"] >= 1  # min-1 for a non-empty market when the budget allows
    assert shares["us"] <= 3  # never more than the pool holds


# --------------------------------------------------------------------------------------------------
# Multi-market assembly (loaders stubbed - no network)
# --------------------------------------------------------------------------------------------------

def test_candidates_are_emergence_first_then_rotating_markets(monkeypatch):
    monkeypatch.setattr(us, "load_sec_listing", lambda **kw: [f"US{i}" for i in range(50)])
    monkeypatch.setattr(us, "load_findb_listing", lambda f, **kw: [f"AU{i}.AX" for i in range(50)])
    syms = us.load_candidate_symbols(limit=30, markets="us,au", today=DAY_1)
    assert len(syms) == 30
    emergence = us._emergence_first()
    assert syms[: len(emergence)] == emergence  # curated names first, every run
    assert any(s.endswith(".AX") for s in syms)  # the AU market really contributes
    assert len(set(syms)) == len(syms)  # de-duplicated


def test_candidates_rotate_across_days(monkeypatch):
    monkeypatch.setattr(us, "load_sec_listing", lambda **kw: [f"US{i}" for i in range(200)])
    monkeypatch.setattr(us, "load_findb_listing", lambda f, **kw: [f"AU{i}.AX" for i in range(200)])
    day1 = set(us.load_candidate_symbols(limit=40, markets="us,au", today=DAY_1))
    day2 = set(us.load_candidate_symbols(limit=40, markets="us,au", today=DAY_2))
    assert day1 != day2  # the window really moves - the back of the pool is not unreachable
    assert set(us._emergence_first()) <= day1 and set(us._emergence_first()) <= day2


def test_us_only_run_has_no_suffixed_symbols(monkeypatch):
    monkeypatch.setattr(us, "load_sec_listing", lambda **kw: ["AAA", "BBB"])
    syms = us.load_candidate_symbols(limit=25, markets="us", today=DAY_1)
    assert all("." not in s for s in syms)


def test_offline_fallback_is_curated_only_and_unchanged():
    syms = us.load_candidate_symbols(limit=8, include_sec=False)
    assert len(syms) >= 1
    assert all(s.isupper() and s.isalpha() for s in syms)  # bare US emergence names, no suffixes


def test_a_dark_market_never_fails_the_run(monkeypatch):
    def boom(**kw):
        raise RuntimeError("offline")

    monkeypatch.setattr(us, "load_sec_listing", boom)
    monkeypatch.setattr(us, "load_findb_listing", lambda f, **kw: ["AU0.AX", "AU1.AX"])
    syms = us.load_candidate_symbols(limit=20, markets="us,au", today=DAY_1)
    assert set(us._emergence_first()) <= set(syms)  # emergence names survive
    assert any(s.endswith(".AX") for s in syms)  # the healthy market still contributes


# --------------------------------------------------------------------------------------------------
# Registry + currency mapping + honest coverage note
# --------------------------------------------------------------------------------------------------

def test_enabled_markets_parses_and_skips_unknown(monkeypatch):
    keys = [m.key for m in us.enabled_markets("au, us, nope")]
    assert keys == ["au", "us"]
    monkeypatch.delenv("EW_MARKETS", raising=False)
    assert [m.key for m in us.enabled_markets()] == ["us", "au"]  # the shipped default
    monkeypatch.setenv("EW_MARKETS", "uk")
    assert [m.key for m in us.enabled_markets()] == ["uk"]


def test_currency_for_symbol_follows_the_suffix():
    assert us.currency_for_symbol("AAPL") == "USD"
    assert us.currency_for_symbol("XRO.AX") == "AUD"
    assert us.currency_for_symbol("rr.l") == "GBP"


def test_coverage_note_states_pool_and_cycle():
    note = us.coverage_note({"us": ["A"] * 900, "au": ["B.AX"] * 100}, limit=100, today=DAY_1)
    assert "pool 1000" in note and "us=900" in note and "au=100" in note
    assert "cycle ~10d" in note  # full-coverage cycle stated, never implied
