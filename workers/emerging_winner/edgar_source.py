"""
Real SEC EDGAR fundamentals for the Emerging Winner Engine - the honest realisation of the
`business_quality` and `capital` domains' TREND fields that a single yfinance snapshot cannot provide.

Why EDGAR, and why it is safe: the SEC's own `company_tickers.json` maps ticker -> CIK authoritatively,
so there is NO fuzzy name matching and therefore no risk of attaching one company's filings to another.
data.sec.gov/api/xbrl/companyfacts is free, public, no key. From the annual (10-K) XBRL facts we derive
exactly the two fields the domains want and yfinance cannot honestly give:

  - capital.share_count_growth_yoy  -> real dilution (year-over-year change in shares outstanding). This
    is the ONE signal in the whole model with grade-A, internationally-replicated asset-pricing evidence
    (net share issuance; Pontiff & Woodgate 2008), so lighting it up with real filings matters most.
  - fundamentals.gross_margin_trend -> change in gross margin (GrossProfit / Revenues) year over year.

Coverage-honest by construction: a field is only emitted when EDGAR actually has >=2 comparable annual
points for it. Missing concepts -> the field is simply absent, so the domain reads partial/unavailable
rather than a fabricated value. Network-touching (data.sec.gov), so it runs only in the worker; the pure
derivation `derive_edgar_features` is separated out and fully unit-tested with no network.
"""
from __future__ import annotations

import json
import os
import urllib.request
from typing import Optional

COMPANY_FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json"
DEFAULT_UA = "Lyra research audit (contact: research@vivacityai.com.au)"

# Concept fallbacks, tried in order. First taxonomy/concept/unit with >=2 annual points wins.
_SHARES_CONCEPTS = [
    ("us-gaap", "WeightedAverageNumberOfSharesOutstandingBasic", "shares"),
    ("us-gaap", "WeightedAverageNumberOfDilutedSharesOutstanding", "shares"),
    ("us-gaap", "CommonStockSharesOutstanding", "shares"),
    ("dei", "EntityCommonStockSharesOutstanding", "shares"),
]
_REVENUE_CONCEPTS = [
    ("us-gaap", "RevenueFromContractWithCustomerExcludingAssessedTax", "USD"),
    ("us-gaap", "Revenues", "USD"),
    ("us-gaap", "SalesRevenueNet", "USD"),
]
_GROSS_PROFIT_CONCEPTS = [("us-gaap", "GrossProfit", "USD")]


def fetch_company_facts(cik: int, *, timeout: int = 30, ua: Optional[str] = None) -> Optional[dict]:
    """Best-effort GET of the SEC companyfacts JSON for a CIK. Returns None on any failure (offline,
    rate-limited, no filings), so the caller degrades to 'unavailable' rather than crashing the run."""
    try:
        url = COMPANY_FACTS_URL.format(cik=int(cik))
        req = urllib.request.Request(url, headers={"User-Agent": ua or os.environ.get("SEC_USER_AGENT", DEFAULT_UA)})
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 - fixed, trusted SEC host
            return json.load(resp)
    except Exception:  # noqa: BLE001 - any failure means no EDGAR facts, stays unavailable
        return None


def _annual_series(facts: dict, taxonomy: str, concept: str, unit: str) -> list[tuple[int, float]]:
    """[(fiscal_year, value)] for ANNUAL (10-K, full-year) points of a concept, de-duped by fiscal year
    (latest-filed wins) and sorted ascending by year. Empty when the concept/unit is absent."""
    node = facts.get("facts", {}).get(taxonomy, {}).get(concept)
    if not node:
        return []
    rows = node.get("units", {}).get(unit)
    if not rows:
        return []
    by_year: dict[int, tuple[str, float]] = {}  # fy -> (filed, val), keep latest filed
    for e in rows:
        if e.get("form") not in ("10-K", "10-K/A"):
            continue
        if e.get("fp") != "FY":
            continue
        fy, val, filed = e.get("fy"), e.get("val"), e.get("filed", "")
        if not isinstance(fy, int) or val is None:
            continue
        prev = by_year.get(fy)
        if prev is None or filed >= prev[0]:
            by_year[fy] = (filed, float(val))
    return [(fy, by_year[fy][1]) for fy in sorted(by_year)]


def _first_series(facts: dict, concepts: list[tuple[str, str, str]]) -> list[tuple[int, float]]:
    for tax, concept, unit in concepts:
        s = _annual_series(facts, tax, concept, unit)
        if len(s) >= 2:
            return s
    return []


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def derive_edgar_features(facts: Optional[dict]) -> dict:
    """Pure: map SEC companyfacts -> the trend fields the domains read. Coverage-honest - only emits a
    field when >=2 comparable annual points exist. Returns {} when nothing can be derived."""
    if not facts:
        return {}
    out: dict = {}

    # Real dilution: YoY change in shares outstanding (higher = more dilution = worse). The capital domain
    # scores -share_count_growth_yoy, so a real value here is the highest-evidence signal in the model.
    shares = _first_series(facts, _SHARES_CONCEPTS)
    if len(shares) >= 2:
        prev, last = shares[-2][1], shares[-1][1]
        if prev > 0:
            out.setdefault("capital", {})["share_count_growth_yoy"] = round((last - prev) / prev * 100.0, 2)

    # Gross-margin trend: change in GrossProfit/Revenues across the two most recent annuals, clamped to
    # the [-1, 1] delta band the domain expects.
    rev = dict(_first_series(facts, _REVENUE_CONCEPTS))
    gp = dict(_first_series(facts, _GROSS_PROFIT_CONCEPTS))
    common = sorted(y for y in rev if y in gp and rev[y] > 0)
    if len(common) >= 2:
        y0, y1 = common[-2], common[-1]
        m0, m1 = gp[y0] / rev[y0], gp[y1] / rev[y1]
        out.setdefault("fundamentals", {})["gross_margin_trend"] = round(_clamp(m1 - m0, -1.0, 1.0), 4)

    return out


def fetch_edgar_features(cik: Optional[int], *, timeout: int = 30, ua: Optional[str] = None) -> dict:
    """Convenience: fetch + derive in one call. Returns {} when there is no CIK or no usable facts."""
    if not cik:
        return {}
    return derive_edgar_features(fetch_company_facts(cik, timeout=timeout, ua=ua))
