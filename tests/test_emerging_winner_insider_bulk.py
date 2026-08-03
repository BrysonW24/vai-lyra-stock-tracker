"""Pins for bulk insider ingestion (BUILD-BACKLOG T1).

The bulk path feeds HISTORY at a scale per-document fetching cannot reach (one quarterly bundle
covers ~4,700 issuers; the entire per-document backfill covered 991). These pins guard the
properties that make it safe to train on:
  * FILING_DATE is the as-of key, never TRANS_DATE - a trade is not knowable before it is filed,
  * open-market codes only (P/S) - grants and tax withholding are compensation, not conviction,
  * the cluster/role/size features exist and count what they claim to count,
  * cache semantics match the other sources (transient != empty, cached_only never networks).
"""
import json
import os

from workers.emerging_winner.insider_bulk_source import (
    OPEN_MARKET_CODES,
    compile_quarters,
    insider_features_asof,
    load_issuer_transactions,
    parse_sec_date,
    quarters_between,
)


def _seed(cache_dir, cik="1234", txns=None):
    d = os.path.join(cache_dir, "insider-bulk", "by-cik")
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, f"{cik}.json"), "w", encoding="utf-8") as fh:
        json.dump({"cik": cik, "n": len(txns or []), "transactions": txns or []}, fh)


def _txn(filed, code="P", shares=1000.0, price=10.0, owner="9", officer=False,
         director=False, ten=False, after=None, acc=None):
    return {"filed": filed, "trans_date": filed, "code": code, "acquired": "A" if code == "P" else "D",
            "shares": shares, "price": price, "usd": shares * price, "owner_cik": owner,
            "is_officer": officer, "is_director": director, "is_ten_pct": ten,
            "shares_after": after, "accession": acc or f"acc-{filed}-{owner}-{code}"}


def test_sec_date_parsing_and_quarter_math():
    assert parse_sec_date("29-MAR-2024") == "2024-03-29"
    assert parse_sec_date("01-JAN-2015") == "2015-01-01"
    assert parse_sec_date("garbage") is None and parse_sec_date(None) is None
    assert quarters_between("2015q3", "2016q2") == ["2015q3", "2015q4", "2016q1", "2016q2"]


def test_filed_date_is_the_as_of_key(tmp_path):
    """A filing dated AFTER as_of must never enter the window, even if its trade predates it."""
    c = str(tmp_path)
    _seed(c, txns=[
        _txn("2024-03-01"),                       # knowable
        {**_txn("2024-04-10"), "trans_date": "2024-02-15"},  # traded before, FILED after
    ])
    f = insider_features_asof(1234, c, "2024-03-31")
    assert f["form4_filings_90d"] == 1, "a filing after as_of leaked into the window"
    assert f["buy_usd"] == 10000.0


def test_cluster_role_and_recency_features(tmp_path):
    c = str(tmp_path)
    _seed(c, txns=[
        _txn("2024-03-01", owner="1", officer=True, after=5000.0),
        _txn("2024-03-05", owner="2", director=True),
        _txn("2024-03-08", owner="3", ten=True),
        _txn("2024-03-10", code="S", owner="4", shares=500.0),
    ])
    f = insider_features_asof(1234, c, "2024-03-31")
    assert f["distinct_buyers"] == 3, "three distinct insiders bought - that is the cluster"
    assert f["distinct_sellers"] == 1
    assert (f["officer_buys"], f["director_buys"], f["ten_pct_buys"]) == (1, 1, 1)
    assert f["buy_sell_usd_ratio"] == 6.0        # 30000 bought / 5000 sold
    assert f["max_buy_stake_frac"] == 0.2        # 1000 of 5000 held after
    assert f["days_since_last_buy"] == 23        # 2024-03-08 -> 2024-03-31


def test_window_is_half_open_on_filed_date(tmp_path):
    c = str(tmp_path)
    _seed(c, txns=[_txn("2024-01-01"), _txn("2024-03-31")])
    f = insider_features_asof(1234, c, "2024-03-31", window_days=90)
    assert f["form4_filings_90d"] == 1, "the window is (as_of - N, as_of] - the far edge is out"


def test_unknown_issuer_is_none_not_zero(tmp_path):
    assert insider_features_asof(999999, str(tmp_path), "2024-03-31") is None
    assert load_issuer_transactions(999999, str(tmp_path)) is None


def test_cached_only_never_networks(tmp_path, monkeypatch):
    import workers.emerging_winner.insider_bulk_source as m

    def boom(*a, **k):
        raise AssertionError("cached_only made a network call")

    monkeypatch.setattr(m.urllib.request, "urlopen", boom)
    res = compile_quarters(str(tmp_path), ["2024q1"], cached_only=True)
    assert res["quarters_missing"] == ["2024q1"] and res["issuers"] == 0


def test_open_market_codes_are_the_only_ones_kept():
    assert OPEN_MARKET_CODES == {"P", "S"}, (
        "grants (A), tax withholding (F) and option exercises (M) are compensation plumbing - "
        "including them turns conviction into noise"
    )


def test_real_bundle_parses_if_present():
    """When a real quarterly bundle is cached, the parser must produce dated open-market rows
    with issuer CIKs (skipped when the bundle is not on this machine)."""
    import glob

    from workers.emerging_winner.insider_bulk_source import parse_quarter

    hits = glob.glob(".ew-backtest-cache/insider-bulk/zips/*_form345.zip")
    if not hits:
        return
    parsed = parse_quarter(sorted(hits)[0])
    assert len(parsed) > 500, "a real quarter covers thousands of issuers"
    sample = next(iter(parsed.values()))[0]
    assert sample["filed"] and len(sample["filed"]) == 10
    assert sample["code"] in OPEN_MARKET_CODES
