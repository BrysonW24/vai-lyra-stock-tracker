"""
USAspending government awards - the GOVERNMENT domain's first real data, bridged by exact
normalized-name matching (feasibility ratified in
lyra-modelling/research/2026-08-02-usaspending-name-bridge-feasibility.md).

Why the shape is what it is:
  1. There is no CIK on USAspending, so identity must cross a name bridge. The probe showed exact
     normalized-name matching is honest ONLY with three guards riding along: (a) the matched
     recipient record must carry a UEI (kills the franchisee DBA shells - "MEMAW'S SHAKE SHACK
     LLC"), (b) a $0-obligation match is at most "registered, no awards", never evidence of
     federal business, and (c) a normalized name that collapses to a single generic dictionary
     token (CELSIUS from "Celsius Holdings, Inc.") is refused outright - no corroborating signal,
     no match. Unmatched stays unmatched; never fuzzy-fill.
  2. Identity resolution uses POST /api/v2/recipient/ (keyword search), NOT the autocomplete
     endpoint: autocomplete now returns uei/duns/recipient_level as null always (verified live
     2026-08-03), so it cannot support guard (a). The recipient search returns UEI,
     recipient_level (P parent / C child / R) and an amount per record - the real identity
     surface the probe used. That keyword search is PHRASE-style and punctuation-sensitive
     (verified live 2026-08-03: "KRATOS DEFENSE SECURITY SOLUTIONS" returns 0 recipients while
     "KRATOS DEFENSE & SECURITY SOLUTIONS" returns 3), so the QUERY keyword preserves internal
     punctuation (search_keyword) while the COMPARE stays fully normalized
     (normalize_company_name), with one bounded fallback query on the normalized form when the
     punctuated keyword finds nothing.
  3. Awards are fetched BY recipient_id (the recipient hash) via
     POST /api/v2/search/spending_by_transaction/ - never by recipient name search, which is
     token-fuzzy (querying "PALANTIR TECHNOLOGIES" returns "PALANTIR USG INC" rows). The
     recipient_id filter was verified live 2026-08-03; a P-level parent hash also returns
     transactions booked by SAM-linked children (Lockheed's parent hash returns SIKORSKY rows),
     which recovers part of the subsidiary-booking undercount.

Honesty notes (house rules):
  * Totals are a FLOOR, not the truth. Subsidiaries outside the SAM parent-child link (the KTOS
    pattern: awards under "KRATOS ANTENNA SOLUTIONS CORPORATION" while the parent shows ~$0) are
    NOT captured by v1. Ship labelled; widen via hierarchy walking in v2.
  * Point-in-time by Action Date: aggregates only ever count transactions with
    action_date <= as_of, so a backtest can never see an award before it happened.
  * The raw transaction list is disk-cached immutably per recipient (bounded pages, truncation
    LABELLED), and every aggregate is computed from that cache - so any as_of can be answered
    offline later, identically.
  * cached_only=True never touches the network and is all-or-nothing per query: a partial answer
    is None, never a fake partial. Transient fetch failures return None and are NEVER cached;
    genuinely-empty answers (a real no-match, a real zero-transaction recipient) ARE cached.
  * Seam note: domains.domain_government reads {"award_count", "contract_value_usd",
    "policy_alignment"}. This module emits {"award_count_2y", "obligations_2y_usd", ...}; the
    engine wiring maps award_count_2y -> award_count and obligations_2y_usd -> contract_value_usd
    when the domain is lit up (wiring is deliberately out of this module's scope).
"""
from __future__ import annotations

import json
import logging
import os
import re
import time
import urllib.request
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

from .universe_source import DEFAULT_UA

logger = logging.getLogger("emerging_winner.usaspending")

USASPENDING_API = "https://api.usaspending.gov/api/v2"
RECIPIENT_SEARCH_URL = f"{USASPENDING_API}/recipient/"
TRANSACTION_SEARCH_URL = f"{USASPENDING_API}/search/spending_by_transaction/"

# Contract award types only (A/B/C/D = definitive contracts + purchase orders); IDVs, grants and
# loans are out of scope for the government domain's v1 read.
CONTRACT_AWARD_TYPE_CODES = ["A", "B", "C", "D"]

# USAspending publishes transaction-level data from FY2008 onward.
EARLIEST_ACTION_DATE = "2007-10-01"

# Bounded fetch: 3 pages x 100 rows, most recent first. More rows than the cap = labelled
# truncation, never a silent partial.
PAGE_LIMIT = 100
MAX_PAGES = 3

# Polite pacing: strictly under 2 req/s across the whole module (single-threaded callers).
_MIN_REQUEST_INTERVAL_S = 0.6
_last_request_at = 0.0

# Trailing suffix tokens stripped iteratively during normalization (probe's list).
_SUFFIX_TOKENS = frozenset({
    "INC", "INCORPORATED", "CORP", "CORPORATION", "CO", "COMPANY", "COS",
    "LTD", "LIMITED", "PLC", "LP", "LLP", "LLC", "PC",
    "HOLDINGS", "HOLDING", "GROUP", "USA",
    "SA", "NV", "AG", "SE", "AB", "ASA", "SPA",
})

# Guard (c): a single-token normalized name is refused when the token is a common dictionary word.
# Explicit blocklist from the probe (CELSIUS is the ratified failure case) plus generic words long
# enough to survive the length rule below. Small and explicit on purpose - additions need a probe.
GENERIC_SINGLE_TOKENS = frozenset({
    "CELSIUS", "AMERICAN", "NATIONAL", "GENERAL", "STERLING", "ATLANTIC", "PACIFIC",
    "LIBERTY", "HERITAGE", "FRONTIER", "GUARDIAN", "PHOENIX", "HORIZON", "MERIDIAN",
    "PINNACLE", "IMPERIAL", "SUMMIT", "CATALYST", "VELOCITY",
})
_MIN_SINGLE_TOKEN_LEN = 8

# EDGAR state-of-incorporation markers ("/DE/", "/MD", "/NEW/") that ride on registrant titles.
_STATE_MARKER_RE = re.compile(r"/[A-Z]{2,4}/?")
_NON_ALNUM_RE = re.compile(r"[^A-Z0-9]+")


# --- normalization + guards (pure) -------------------------------------------------------------

def normalize_company_name(name: str) -> str:
    """Uppercase, strip EDGAR state markers and punctuation, drop a leading THE, iteratively strip
    trailing corporate suffix tokens (never below one token), collapse whitespace.

    The whole bridge rests on this being applied IDENTICALLY to both sides of the compare
    (EDGAR titles and USAspending recipient names), so exact-match is invariant to
    CORP vs CORPORATION vs Inc. spelling drift."""
    if not name:
        return ""
    upper = _STATE_MARKER_RE.sub(" ", str(name).upper())
    tokens = [t for t in _NON_ALNUM_RE.split(upper) if t]
    if tokens and tokens[0] == "THE":
        tokens = tokens[1:]
    while len(tokens) > 1 and tokens[-1] in _SUFFIX_TOKENS:
        tokens.pop()
    return " ".join(tokens)


def search_keyword(name: str) -> str:
    """The QUERY form of a company name: uppercase, EDGAR state markers and trailing corporate
    suffixes removed, but INTERNAL punctuation kept ("&", "."). The /api/v2/recipient/ keyword
    search is phrase-style and punctuation-sensitive, so querying the fully-normalized form loses
    real recipients (the Kratos case); the normalized form is for comparing, never for querying."""
    if not name:
        return ""
    upper = _STATE_MARKER_RE.sub(" ", str(name).upper())
    tokens = upper.split()

    def alnum(tok: str) -> str:
        return _NON_ALNUM_RE.sub("", tok)

    if tokens and alnum(tokens[0]) == "THE":
        tokens = tokens[1:]
    while len(tokens) > 1 and alnum(tokens[-1]) in _SUFFIX_TOKENS:
        tokens.pop()
    return " ".join(tokens).strip(" ,.;:&-")


def passes_single_token_guard(normalized: str) -> bool:
    """Guard (c), pure: multi-token names always pass; a single-token name passes only when it is
    both reasonably long (>= 8 chars) and not on the explicit generic-word blocklist. Conservative
    by design - the probe's one dangerous survivor (CELSIUS -> "CELSIUS GROUP") came from exactly
    this class, and a false no-match costs an honest "unavailable" while a false match attaches a
    stranger's awards."""
    tokens = normalized.split()
    if len(tokens) >= 2:
        return True
    if not tokens:
        return False
    tok = tokens[0]
    return len(tok) >= _MIN_SINGLE_TOKEN_LEN and tok not in GENERIC_SINGLE_TOKENS


# --- paced HTTP (the only seam that networks; tests monkeypatch this) ---------------------------

def _post_json(url: str, payload: dict, *, timeout: int = 30, ua: Optional[str] = None) -> Any:
    """POST JSON to USAspending, paced under 2 req/s. Raises on any failure - callers translate
    exceptions into the transient-None convention (and never cache them)."""
    global _last_request_at
    wait = _MIN_REQUEST_INTERVAL_S - (time.monotonic() - _last_request_at)
    if wait > 0:
        time.sleep(wait)
    _last_request_at = time.monotonic()
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": ua or os.environ.get("USASPENDING_USER_AGENT", DEFAULT_UA),
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 - fixed, trusted host
        return json.load(resp)


# --- cache plumbing ------------------------------------------------------------------------------

def _cache_path(cache_dir: str, sub: str, key: str) -> str:
    folder = os.path.join(cache_dir, "usaspending", sub)
    os.makedirs(folder, exist_ok=True)
    safe = re.sub(r"[^A-Za-z0-9_-]", "_", str(key))
    return os.path.join(folder, f"{safe}.json")


def _read_cache(path: str) -> Optional[dict]:
    if not os.path.exists(path):
        return None
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else None
    except Exception:  # noqa: BLE001 - bad cache reads as absent -> refetch
        return None


def _write_cache(path: str, data: dict) -> None:
    try:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(data, fh)
    except Exception:  # noqa: BLE001 - cache is best-effort
        logger.warning("usaspending cache write failed for %s", path)


# --- the name bridge ------------------------------------------------------------------------------

def build_recipient_bridge(cik: int, company_name: str, cache_dir: str, *,
                           cached_only: bool = False, timeout: int = 30,
                           ua: Optional[str] = None) -> Optional[dict]:
    """Resolve an EDGAR identity (CIK + registrant title) to ONE USAspending recipient record, or
    an honest no-match. Both outcomes are cached per CIK (a no-match is a real answer); None means
    a transient fetch failure and is NEVER cached.

    Matched:   {"cik", "name", "normalized", "match": "exact", "recipient_id", "uei",
                "matched_name", "recipient_level", plus "registered_no_recent_awards": True when
                the matched record shows $0 on the recipient search (guard (b): registration is
                not evidence of federal business)}
    No match:  {"cik", "name", "normalized", "match": None, "reason": <why>}

    Guard (c) rejections are deterministic (no network needed), so they resolve and cache even
    under cached_only - the contract is "never network", not "never compute".
    Candidate selection among exact-normalized UEI-bearing records: prefer the P (parent) level
    record - its hash also pulls SAM-linked children's transactions - then the largest amount,
    then the UEI seen at the most levels in the result set (a UEI present at both P and C is the
    SAM-registered operating hierarchy; a P-only twin can be a bare shell - the Kratos case,
    verified live 2026-08-03: parent Q6GURCYL7V59 has zero transactions while parent
    H6BWMHGJ5AF5, whose UEI also appears at C level, rolls up the whole subsidiary family)."""
    path = _cache_path(cache_dir, "bridge", str(int(cik)))
    cached = _read_cache(path)
    if cached is not None:
        return cached

    normalized = normalize_company_name(company_name)
    base = {"cik": int(cik), "name": company_name, "normalized": normalized}
    if not normalized:
        out = {**base, "match": None, "reason": "empty_normalized_name"}
        _write_cache(path, out)
        return out
    if not passes_single_token_guard(normalized):
        out = {**base, "match": None, "reason": "generic_single_token"}
        _write_cache(path, out)
        return out

    if cached_only:
        return None

    def _search(keyword: str) -> list[dict]:
        resp = _post_json(RECIPIENT_SEARCH_URL, {
            "keyword": keyword, "limit": 50, "page": 1,
            "sort": "amount", "order": "desc", "award_type": "all",
        }, timeout=timeout, ua=ua)
        return [r for r in (resp.get("results", []) or []) if isinstance(r, dict)]

    keyword = search_keyword(company_name) or normalized
    try:
        results = _search(keyword)
        # Bounded fallback: if the punctuation-preserving phrase found no exact-normalized
        # UEI-bearing record and the normalized form is a different string, try it once - this
        # covers the reverse punctuation drift (EDGAR punctuated, SAM plain). A transient failure
        # here still voids the whole query: no-match may only be cached when BOTH looks completed.
        def _usable(rows: list[dict]) -> bool:
            return any(r.get("uei") and
                       normalize_company_name(str(r.get("name") or "")) == normalized
                       for r in rows)
        if not _usable(results) and normalized != keyword:
            results = results + _search(normalized)
    except Exception:  # noqa: BLE001 - transient failure: do NOT cache
        logger.warning("usaspending recipient search failed for cik=%s (%r) - left uncached",
                       cik, keyword)
        return None

    exact = [r for r in results
             if normalize_company_name(str(r.get("name") or "")) == normalized]
    with_uei = [r for r in exact if r.get("uei")]
    if not with_uei:
        reason = "uei_less_name_shells_only" if exact else "no_exact_normalized_match"
        out = {**base, "match": None, "reason": reason}
        _write_cache(path, out)
        return out

    uei_level_counts: dict[str, int] = {}
    for r in exact:
        if r.get("uei"):
            uei_level_counts[str(r["uei"])] = uei_level_counts.get(str(r["uei"]), 0) + 1

    def _rank(r: dict) -> tuple:
        level_pref = {"P": 0, "R": 1, "C": 2}.get(str(r.get("recipient_level") or ""), 3)
        return (level_pref,
                -float(r.get("amount") or 0.0),
                -uei_level_counts.get(str(r.get("uei")), 0),
                str(r.get("id")))

    best = sorted(with_uei, key=_rank)[0]
    out = {
        **base,
        "match": "exact",
        "recipient_id": str(best.get("id")),
        "uei": str(best.get("uei")),
        "matched_name": str(best.get("name")),
        "recipient_level": best.get("recipient_level"),
    }
    if not float(best.get("amount") or 0.0):
        out["registered_no_recent_awards"] = True
    _write_cache(path, out)
    return out


# --- transactions: immutable raw cache + point-in-time aggregates --------------------------------

def _fetch_transactions(recipient_id: str, *, timeout: int = 30,
                        ua: Optional[str] = None) -> Optional[dict]:
    """Fetch the recipient's contract transactions, newest first, bounded to MAX_PAGES x PAGE_LIMIT
    with truncation labelled. All-or-nothing across pages: any page failure returns None so a
    rate-limited night can never produce a silently short list."""
    transactions: list[dict] = []
    truncated = False
    today = datetime.now(timezone.utc).date().isoformat()
    for page in range(1, MAX_PAGES + 1):
        payload = {
            "filters": {
                "recipient_id": recipient_id,
                "award_type_codes": list(CONTRACT_AWARD_TYPE_CODES),
                "time_period": [{"start_date": EARLIEST_ACTION_DATE, "end_date": today}],
            },
            "fields": ["Action Date", "Transaction Amount", "Recipient Name",
                       "Award ID", "Awarding Agency"],
            "limit": PAGE_LIMIT, "page": page, "sort": "Action Date", "order": "desc",
        }
        try:
            resp = _post_json(TRANSACTION_SEARCH_URL, payload, timeout=timeout, ua=ua)
        except Exception:  # noqa: BLE001 - transient failure: whole fetch is void, nothing cached
            logger.warning("usaspending transaction fetch failed for %s page %d - left uncached",
                           recipient_id, page)
            return None
        rows = resp.get("results", []) or []
        for row in rows:
            transactions.append({
                "action_date": str(row.get("Action Date") or ""),
                "amount_usd": float(row.get("Transaction Amount") or 0.0),
                "recipient_name": row.get("Recipient Name"),
                "award_id": row.get("Award ID"),
                "awarding_agency": row.get("Awarding Agency"),
            })
        has_next = bool((resp.get("page_metadata") or {}).get("hasNext"))
        if not has_next:
            break
        if page == MAX_PAGES:
            truncated = True
    return {
        "recipient_id": recipient_id,
        "fetched_through": today,
        "transactions": transactions,
        "truncated": truncated,
    }


def load_transactions(recipient_id: str, cache_dir: str, *, cached_only: bool = False,
                      timeout: int = 30, ua: Optional[str] = None) -> Optional[dict]:
    """The raw per-recipient transaction blob, disk-cached immutably (bounded + labelled). A real
    zero-transaction recipient caches as an empty list; transient failures cache nothing."""
    path = _cache_path(cache_dir, "transactions", recipient_id)
    cached = _read_cache(path)
    if cached is not None and "transactions" in cached:
        return cached
    if cached_only:
        return None
    blob = _fetch_transactions(recipient_id, timeout=timeout, ua=ua)
    if blob is None:
        return None
    _write_cache(path, blob)
    return blob


def aggregates_from_transactions(blob: dict, as_of: str, *, window_days: int = 730) -> Optional[dict]:
    """Pure: point-in-time-safe aggregates from a cached transaction blob. A transaction with
    action_date > as_of NEVER counts anywhere (no lookahead). The trailing window is
    (as_of - window_days, as_of] on Action Date, matching the form4 window convention.
    award_count_2y counts DISTINCT Award IDs in the window (one award accrues many transaction
    modifications; counting rows would inflate it). first_award_date is the earliest KNOWN
    action_date <= as_of - under labelled truncation it is a latest-bound, and counts/sums are
    floors."""
    try:
        end = date.fromisoformat(str(as_of)[:10])
    except ValueError:
        return None
    start_iso = (end - timedelta(days=window_days)).isoformat()
    end_iso = end.isoformat()
    visible = [t for t in blob.get("transactions", [])
               if t.get("action_date") and t["action_date"] <= end_iso]
    in_window = [t for t in visible if t["action_date"] > start_iso]
    award_ids = {t.get("award_id") or f"row:{i}" for i, t in enumerate(in_window)}
    return {
        "award_count_2y": len(award_ids),
        "obligations_2y_usd": round(sum(t.get("amount_usd") or 0.0 for t in in_window), 2),
        "first_award_date": min((t["action_date"] for t in visible), default=None),
        "as_of": end_iso,
        "truncated": bool(blob.get("truncated")),
    }


def awards_asof(recipient_id: str, cache_dir: str, as_of: str, *, window_days: int = 730,
                cached_only: bool = False, timeout: int = 30,
                ua: Optional[str] = None) -> Optional[dict]:
    """Point-in-time award aggregates for a recipient at as_of, computed exclusively from the
    immutable raw cache (fetched on first use unless cached_only). None when the raw list is
    unavailable - an aggregate from data we do not hold would be a guess, not a floor."""
    blob = load_transactions(recipient_id, cache_dir, cached_only=cached_only,
                             timeout=timeout, ua=ua)
    if blob is None:
        return None
    return aggregates_from_transactions(blob, as_of, window_days=window_days)


# --- composition: the government domain's context ------------------------------------------------

def government_features(cik: int, company_name: str, cache_dir: str, as_of: str, *,
                        window_days: int = 730, cached_only: bool = False, timeout: int = 30,
                        ua: Optional[str] = None) -> Optional[dict]:
    """The government-domain read for one company at as_of.

    Honest no-match  -> {"available": False, "reason": "no_recipient_match"} (a real answer: this
                        company has no UEI-bearing exact-normalized recipient, or its name failed
                        a guard - the domain reports unavailable-with-reason, it never guesses).
    Matched          -> {"available": True, "recipient_id", "uei", "matched_name",
                         "award_count_2y", "obligations_2y_usd", "first_award_date", "as_of",
                         "truncated"} - totals are a floor (subsidiary booking, labelled caps).
    None             -> transient: some needed piece could not be resolved THIS RUN (or, under
                        cached_only, is absent from the cache). All-or-nothing: a matched bridge
                        with unavailable awards is None, never a fake partial."""
    bridge = build_recipient_bridge(cik, company_name, cache_dir,
                                    cached_only=cached_only, timeout=timeout, ua=ua)
    if bridge is None:
        return None
    if bridge.get("match") is None:
        return {"available": False, "reason": "no_recipient_match"}
    aggregates = awards_asof(bridge["recipient_id"], cache_dir, as_of, window_days=window_days,
                             cached_only=cached_only, timeout=timeout, ua=ua)
    if aggregates is None:
        return None
    return {
        "available": True,
        "recipient_id": bridge["recipient_id"],
        "uei": bridge["uei"],
        "matched_name": bridge["matched_name"],
        **aggregates,
    }
