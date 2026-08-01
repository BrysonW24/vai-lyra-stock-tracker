"""Unit pins for the 2026-08-01 domain sources - theme (SEC SIC), narrative (market regime) and
sponsorship (Form 4 insider flow). Pure functions only, no network.

The honesty invariants these protect:
  * SIC themes are a deterministic identity map - an unmapped code is ABSENT, never a present zero,
    and no stretch mappings (software is not "ai").
  * The regime is causal (uses only bars <= T) and refuses to call a trend on thin history.
  * Form 4 windows respect filed-date discipline; a known-empty window is a REAL 0.0 while an
    unreadable index is unavailable; only discretionary P/S open-market codes count; a truncated
    read says so.
"""
from workers.emerging_winner.form4_source import insider_window, parse_form4_xml
from workers.emerging_winner.regime_source import (
    NEUTRAL,
    RISK_OFF,
    RISK_ON,
    regime_at,
    regime_by_date,
    regime_for_day,
)
from workers.emerging_winner.submissions_source import compact_submissions, theme_context_from_sic


# --- theme (SIC) ------------------------------------------------------------------------------------

def test_sic_map_hits_only_defensible_themes():
    assert theme_context_from_sic(3674)["themes"] == ["semiconductors"]
    assert "defence" in theme_context_from_sic(3761)["themes"]  # guided missiles & space vehicles
    assert theme_context_from_sic(4911)["themes"] == ["power"]
    assert theme_context_from_sic(None) is None
    assert theme_context_from_sic(7372) is None, "prepackaged software must NOT stretch to 'ai'"
    assert theme_context_from_sic(6022) is None, "a bank has no hot-theme membership"


def test_sic_theme_carries_its_provenance():
    ctx = theme_context_from_sic(3674, "Semiconductors & Related Devices")
    assert ctx["source"] == "sec_sic" and ctx["sic"] == 3674


def test_compact_submissions_extracts_identity_and_form4_index():
    subs = {
        "sic": "3674", "sicDescription": "Semiconductors",
        "filings": {"recent": {
            "form": ["4", "10-K", "4/A", "8-K"],
            "filingDate": ["2026-07-01", "2026-02-01", "2026-06-15", "2026-05-01"],
            "accessionNumber": ["0001-26-000001", "0001-26-000002", "0001-26-000003", "0001-26-000004"],
            "primaryDocument": ["xslF345X05/form4.xml", "k.htm", "form4a.xml", "e.htm"],
        }},
    }
    b = compact_submissions(subs)
    assert b["sic"] == 3674
    assert [e["filed"] for e in b["form4_index"]] == ["2026-07-01", "2026-06-15"]
    assert compact_submissions(None) == {}


# --- narrative (market regime) -----------------------------------------------------------------------

def _series(n: int, price) -> list[float]:
    return [price(i) if callable(price) else float(price) for i in range(n)]


def test_regime_is_risk_on_in_a_steady_uptrend():
    closes = _series(300, lambda i: 100.0 + i * 0.3)
    assert regime_at(closes, 299) == RISK_ON


def test_regime_is_risk_off_below_trend_in_a_deep_drawdown():
    closes = _series(260, lambda i: 100.0 + i * 0.3) + _series(60, lambda i: 178.0 - i * 1.2)
    assert regime_at(closes, len(closes) - 1) == RISK_OFF


def test_regime_neutral_between_the_bands():
    # Above trend but in a >10% drawdown from the trailing high -> neither risk_on nor risk_off.
    closes = _series(280, lambda i: 100.0 + i * 0.5) + _series(20, 215.0)
    r = regime_at(closes, len(closes) - 1)
    assert r == NEUTRAL


def test_regime_refuses_thin_history():
    assert regime_at(_series(100, 100.0), 99) is None, "no 200-day trend, no regime call"


def test_regime_lookup_snaps_back_within_gap_only():
    from workers.emerging_winner.history_source import DailyBar

    bars = [DailyBar(f"2020-{m:02d}-01", 100, 101, 99, 100.0 + i, 1000, 100.0)
            for i, m in enumerate(range(1, 13))]
    by_date = regime_by_date(bars)  # thin series -> empty map, still a dict
    assert by_date == {}
    assert regime_for_day({"2020-06-01": RISK_ON}, "2020-06-03") == RISK_ON
    assert regime_for_day({"2020-06-01": RISK_ON}, "2020-06-30") is None


# --- sponsorship (Form 4) ------------------------------------------------------------------------------

_FORM4 = """<?xml version="1.0"?>
<ownershipDocument xmlns="http://www.sec.gov/edgar/document/thirteenf/informationtable">
  <nonDerivativeTable>
    <nonDerivativeTransaction>
      <transactionCoding><transactionCode>P</transactionCode></transactionCoding>
      <transactionAmounts>
        <transactionShares><value>10000</value></transactionShares>
        <transactionPricePerShare><value>5.50</value></transactionPricePerShare>
        <transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode>
      </transactionAmounts>
    </nonDerivativeTransaction>
    <nonDerivativeTransaction>
      <transactionCoding><transactionCode>S</transactionCode></transactionCoding>
      <transactionAmounts>
        <transactionShares><value>2000</value></transactionShares>
        <transactionPricePerShare><value>6.00</value></transactionPricePerShare>
        <transactionAcquiredDisposedCode><value>D</value></transactionAcquiredDisposedCode>
      </transactionAmounts>
    </nonDerivativeTransaction>
    <nonDerivativeTransaction>
      <transactionCoding><transactionCode>A</transactionCode></transactionCoding>
      <transactionAmounts>
        <transactionShares><value>50000</value></transactionShares>
        <transactionPricePerShare><value>0</value></transactionPricePerShare>
        <transactionAcquiredDisposedCode><value>A</value></transactionAcquiredDisposedCode>
      </transactionAmounts>
    </nonDerivativeTransaction>
  </nonDerivativeTable>
</ownershipDocument>"""


def test_form4_parse_counts_only_discretionary_open_market_codes():
    out = parse_form4_xml(_FORM4)
    assert out["buy_usd"] == 55000.0     # 10,000 x 5.50 purchase
    assert out["sell_usd"] == 12000.0    # 2,000 x 6.00 sale
    assert out["net_usd"] == 43000.0
    assert out["n_transactions"] == 2, "the code-A grant must not count as intent"


def test_form4_parse_survives_garbage():
    assert parse_form4_xml("<not-xml")["n_transactions"] == 0
    assert parse_form4_xml("")["net_usd"] == 0.0


def test_insider_window_respects_filed_discipline():
    index = [
        {"filed": "2026-05-01", "accession": "a0", "doc": "f.xml"},  # 92 days back - outside 90d
        {"filed": "2026-05-10", "accession": "a1", "doc": "f.xml"},
        {"filed": "2026-07-20", "accession": "a2", "doc": "f.xml"},
        {"filed": "2026-08-02", "accession": "a3", "doc": "f.xml"},  # filed AFTER as-of
    ]
    window = insider_window(index, end="2026-08-01", window_days=90)
    assert [e["accession"] for e in window] == ["a1", "a2"]
    assert insider_window(index, end="2026-08-01", window_days=5) == []


def test_sponsorship_known_empty_window_is_a_real_zero(tmp_path):
    from workers.emerging_winner.form4_source import sponsorship_features

    bundle = {"form4_index": []}
    out = sponsorship_features(1234, bundle, str(tmp_path), as_of="2026-08-01")
    assert out == {"insider_net_buy_usd": 0.0, "form4_filings_90d": 0}
    assert sponsorship_features(1234, None, str(tmp_path), as_of="2026-08-01") is None
    assert sponsorship_features(None, bundle, str(tmp_path), as_of="2026-08-01") is None


def test_sponsorship_cached_only_is_all_or_nothing(tmp_path):
    """Corpus reads must never produce a partial insider sum whose missing docs could bias it -
    a window with any uncached document is unavailable, and no network is ever touched."""
    import json as _json
    import os as _os

    from workers.emerging_winner.form4_source import sponsorship_features

    bundle = {"form4_index": [
        {"filed": "2020-05-10", "accession": "0001-20-000001", "doc": "f.xml"},
        {"filed": "2020-05-20", "accession": "0001-20-000002", "doc": "f.xml"},
    ]}
    # Only one of the two window docs is cached -> unavailable, not a half-sum.
    _os.makedirs(tmp_path / "form4", exist_ok=True)
    (tmp_path / "form4" / "000120000001.json").write_text(
        _json.dumps({"net_usd": 100000.0, "buy_usd": 100000.0, "sell_usd": 0.0, "n_transactions": 1}))
    assert sponsorship_features(1234, bundle, str(tmp_path), as_of="2020-06-01",
                                cached_only=True) is None
    # Both cached -> the full-window sum, no truncation field.
    (tmp_path / "form4" / "000120000002.json").write_text(
        _json.dumps({"net_usd": -40000.0, "buy_usd": 0.0, "sell_usd": 40000.0, "n_transactions": 1}))
    out = sponsorship_features(1234, bundle, str(tmp_path), as_of="2020-06-01", cached_only=True)
    assert out == {"insider_net_buy_usd": 60000.0, "form4_filings_90d": 2}


# --- quarterly fundamentals (revenue growth semantics parity) --------------------------------------------

def test_quarterly_yoy_prefers_matching_quarters_and_respects_filed():
    from workers.emerging_winner.edgar_source import (
        latest_quarterly_yoy_pair,
        quarterly_points_from_rows,
    )

    def q(val, start, end, filed, form="10-Q"):
        return {"val": val, "start": start, "end": end, "filed": filed, "form": form, "fp": "Q"}

    rows = [
        q(100, "2023-01-01", "2023-03-31", "2023-05-01"),
        q(120, "2023-04-01", "2023-06-30", "2023-08-01"),
        q(150, "2024-01-01", "2024-03-31", "2024-05-01"),
        # A FULL-YEAR flow must be rejected by the quarterly duration filter:
        {"val": 999, "start": "2023-01-01", "end": "2023-12-31", "filed": "2024-02-15",
         "form": "10-K", "fp": "FY"},
    ]
    series = quarterly_points_from_rows(rows)
    assert [v for _e, _f, v in series] == [100.0, 120.0, 150.0]
    pair = latest_quarterly_yoy_pair(series)
    assert pair is not None and pair[1] == 100.0 and pair[3] == 150.0  # Q1 2024 vs Q1 2023
    # Point-in-time: before the 2024 Q1 report was FILED, the pair must not exist.
    early = quarterly_points_from_rows(rows, as_of="2024-04-15")
    assert latest_quarterly_yoy_pair(early) is None or latest_quarterly_yoy_pair(early)[3] != 150.0
