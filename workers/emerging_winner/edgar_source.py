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


def _days_between(a: str, b: str) -> Optional[int]:
    import datetime as _dt

    try:
        return (_dt.date.fromisoformat(str(b)[:10]) - _dt.date.fromisoformat(str(a)[:10])).days
    except ValueError:
        return None


# Two consecutive fiscal years are 330-430 days apart by END date (52/53-week calendars drift across
# Jan 1, so calendar-year arithmetic silently loses them); two points under 200 days apart are the
# SAME fiscal year seen through different filings (restatement/amendment - latest filed wins).
_ANNUAL_GAP_MIN, _ANNUAL_GAP_MAX = 330, 430
_SAME_SLOT_MAX_DAYS = 200


def annual_points_from_rows(rows: list[dict], *, as_of: Optional[str] = None) -> list[tuple[str, str, float]]:
    """Validated ANNUAL (10-K, full-year) points as [(end_date, filed, value)], ascending by end date,
    de-duplicated per fiscal slot.

    Discipline rules learned from real companyfacts payloads (2026-08-01 audits):
      * Key by the PERIOD END DATE, never the filing's `fy` - every comparative period restated inside
        a 10-K carries the FILING's fy/fp, so fy-keying lets a 2021 comparative overwrite the 2023 slot.
      * When `start` is present the duration must look annual (330-400 days) - a Q4-only flow tagged
        fp=FY inside a 10-K is not a fiscal year.
      * Points whose ends are < 200 days apart are the same fiscal year (amended/restated filing) -
        the latest-filed one wins. Date-clustering, not year-arithmetic, so 52/53-week fiscal
        calendars that drift across Jan 1 are handled.
      * `as_of` (optional) drops facts FILED after that date - the point-in-time view for backtests;
        None keeps the live behaviour (best current truth, restatements included).
    """
    valid: list[tuple[str, str, float]] = []
    for e in rows or []:
        if e.get("form") not in ("10-K", "10-K/A"):
            continue
        if e.get("fp") != "FY":
            continue
        val, filed, end = e.get("val"), e.get("filed", ""), e.get("end")
        if val is None or not end:
            continue
        if as_of is not None and filed > as_of:
            continue
        start = e.get("start")
        if start:
            dur = _days_between(start, end)
            if dur is None or not 330 <= dur <= 400:
                continue
        valid.append((str(end)[:10], str(filed), float(val)))
    valid.sort()
    out: list[tuple[str, str, float]] = []
    for end, filed, val in valid:
        if out:
            gap = _days_between(out[-1][0], end)
            if gap is not None and gap < _SAME_SLOT_MAX_DAYS:
                # Same fiscal slot: keep the latest-filed reading (tie -> the later end date).
                if filed >= out[-1][1]:
                    out[-1] = (end, filed, val)
                continue
        out.append((end, filed, val))
    return out


def _concept_series(facts: dict, taxonomy: str, concept: str, unit: str,
                    *, as_of: Optional[str] = None) -> list[tuple[str, str, float]]:
    node = facts.get("facts", {}).get(taxonomy, {}).get(concept)
    if not node:
        return []
    rows = node.get("units", {}).get(unit)
    if not rows:
        return []
    return annual_points_from_rows(rows, as_of=as_of)


def quarterly_points_from_rows(rows: list[dict], *, as_of: Optional[str] = None) -> list[tuple[str, str, float]]:
    """Validated QUARTERLY flow points as [(end_date, filed, value)], ascending, de-duplicated per
    quarter (latest filed wins). Accepts 10-Q and 10-K rows whose duration looks like one quarter
    (75-105 days) - the same end-date-clustering discipline as the annual parser, so restatements
    and 13/14-week retail quarters are handled. Used to derive the quarter-vs-year-ago-quarter
    revenue growth that matches the LIVE path's yfinance `revenueGrowth` semantics."""
    valid: list[tuple[str, str, float]] = []
    for e in rows or []:
        if e.get("form") not in ("10-Q", "10-Q/A", "10-K", "10-K/A"):
            continue
        val, filed, end, start = e.get("val"), e.get("filed", ""), e.get("end"), e.get("start")
        if val is None or not end or not start:
            continue  # quarterly derivation is flows-only: no duration, no quarter
        if as_of is not None and filed > as_of:
            continue
        dur = _days_between(start, end)
        if dur is None or not 75 <= dur <= 105:
            continue
        valid.append((str(end)[:10], str(filed), float(val)))
    valid.sort()
    out: list[tuple[str, str, float]] = []
    for end, filed, val in valid:
        if out:
            gap = _days_between(out[-1][0], end)
            if gap is not None and gap < 60:  # same quarter re-reported: latest filed wins
                if filed >= out[-1][1]:
                    out[-1] = (end, filed, val)
                continue
        out.append((end, filed, val))
    return out


def latest_quarterly_yoy_pair(series: list[tuple[str, str, float]]) -> Optional[tuple[str, float, str, float]]:
    """(end0, val0, end1, val1) where end1 is the newest quarter and end0 the quarter one year
    earlier (330-430 days by end date), else None."""
    if len(series) < 2:
        return None
    e1, _f1, v1 = series[-1]
    for e0, _f0, v0 in reversed(series[:-1]):
        gap = _days_between(e0, e1)
        if gap is None:
            continue
        if _ANNUAL_GAP_MIN <= gap <= _ANNUAL_GAP_MAX:
            return (e0, v0, e1, v1)
        if gap > _ANNUAL_GAP_MAX:
            return None
    return None


def latest_annual_pair(series: list[tuple[str, str, float]]) -> Optional[tuple[str, float, str, float]]:
    """(end0, val0, end1, val1) for the newest two points one fiscal year apart (330-430 days by end
    date), else None - a delta across a filing gap is not a YoY and is dropped, not mislabelled."""
    if len(series) < 2:
        return None
    (e0, _, v0), (e1, _, v1) = series[-2], series[-1]
    gap = _days_between(e0, e1)
    if gap is None or not _ANNUAL_GAP_MIN <= gap <= _ANNUAL_GAP_MAX:
        return None
    return (e0, v0, e1, v1)


def freshest_pair_series(facts: dict, concepts: list[tuple[str, str, str]],
                         *, as_of: Optional[str] = None) -> list[tuple[str, str, float]]:
    """The series of the SINGLE concept variant with a valid latest YoY pair and the freshest latest
    end date (priority order breaks ties). NEVER a cross-concept union: mixing e.g. a dei cover-date
    share snapshot with a us-gaap fiscal-year weighted average manufactures a ~14-month pseudo-YoY
    that sign-flipped real dilution reads (19 of 101 audited companies). Within one concept the
    semantics are constant; picking the freshest variant still solves tag migration (an issuer that
    stopped filing one tag keeps its YoY through the successor tag)."""
    best: Optional[tuple[tuple[str, int], list[tuple[str, str, float]]]] = None
    for i, (tax, concept, unit) in enumerate(concepts):
        s = _concept_series(facts, tax, concept, unit, as_of=as_of)
        if latest_annual_pair(s) is None:
            continue
        key = (s[-1][0], -i)  # freshest end wins; tie -> earlier-listed concept
        if best is None or key > best[0]:
            best = (key, s)
    return best[1] if best else []


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def margin_series(rev_series: list[tuple[str, str, float]],
                  gp_series: list[tuple[str, str, float]]) -> list[tuple[str, str, float]]:
    """Per-fiscal-slot gross margins [(end, filed, GP/Rev)] where a revenue and gross-profit point share
    the same fiscal slot (ends within 100 days - normally identical dates). Positive revenue only."""
    out: list[tuple[str, str, float]] = []
    for r_end, r_filed, rev in rev_series:
        if rev <= 0:
            continue
        for g_end, _g_filed, gp in gp_series:
            gap = _days_between(r_end, g_end)
            if gap is not None and abs(gap) < 100:
                out.append((r_end, r_filed, gp / rev))
                break
    return out


def derive_edgar_features(facts: Optional[dict], *, as_of: Optional[str] = None,
                          max_age_years: Optional[int] = None) -> dict:
    """Pure: map SEC companyfacts -> the trend fields the domains read. Coverage-honest - only emits a
    field when two points ONE FISCAL YEAR apart exist within a single concept (a change measured across
    a filing gap, or across two different concepts, is not a "YoY" and is dropped, not mislabelled).
    Returns {} when nothing can be derived.

    `as_of` restricts to facts FILED on or before that date (point-in-time view for backtests).
    `max_age_years` (optional) drops a derivation whose latest annual is older than that many years
    relative to `as_of` - a decade-old dilution read presented as current is worse than absent."""
    if not facts:
        return {}
    out: dict = {}

    def fresh_enough(latest_end: str) -> bool:
        if max_age_years is None or as_of is None:
            return True
        age = _days_between(latest_end, as_of)
        return age is not None and age <= max_age_years * 365 + 60

    # Real dilution: YoY change in shares outstanding (higher = more dilution = worse). The capital domain
    # scores -share_count_growth_yoy, so a real value here is the highest-evidence signal in the model.
    pair = latest_annual_pair(freshest_pair_series(facts, _SHARES_CONCEPTS, as_of=as_of))
    if pair is not None:
        _e0, prev, e1, last = pair
        if prev > 0 and fresh_enough(e1):
            out.setdefault("capital", {})["share_count_growth_yoy"] = round((last - prev) / prev * 100.0, 2)

    # Gross-margin trend: change in GrossProfit/Revenues across the two most recent same-slot annuals,
    # clamped to the [-1, 1] delta band the domain expects.
    rev_series = freshest_pair_series(facts, _REVENUE_CONCEPTS, as_of=as_of)
    gp_series = freshest_pair_series(facts, _GROSS_PROFIT_CONCEPTS, as_of=as_of)
    m_pair = latest_annual_pair(margin_series(rev_series, gp_series))
    if m_pair is not None:
        _e0, m0, e1, m1 = m_pair
        if fresh_enough(e1):
            out.setdefault("fundamentals", {})["gross_margin_trend"] = round(_clamp(m1 - m0, -1.0, 1.0), 4)

    return out


def fetch_edgar_features(cik: Optional[int], *, timeout: int = 30, ua: Optional[str] = None) -> dict:
    """Convenience: fetch + derive in one call. Returns {} when there is no CIK or no usable facts.
    Live reads carry a 3-year recency guard: an issuer whose last 10-K is older than that no longer
    gets a "current" dilution/margin trend from ancient filings."""
    if not cik:
        return {}
    import datetime as _dt

    today = _dt.date.today().isoformat()
    return derive_edgar_features(
        fetch_company_facts(cik, timeout=timeout, ua=ua), as_of=today, max_age_years=3,
    )
