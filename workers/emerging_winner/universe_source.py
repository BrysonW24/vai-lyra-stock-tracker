"""
Real candidate universe for the Emerging Winner Engine - the actual whole US-listed landscape.

Source of truth: the SEC's `company_tickers.json` (every US company that files with the SEC, ~10k names,
small-caps and micro-caps included). Free, public, no key. This is what makes the engine scan the real
market rather than a hardcoded illustrative set.

Because scoring the entire listing on every run is not practical (yfinance is best-effort and
rate-limited), a run scans a BOUNDED slice, EMERGENCE-FIRST: the curated small-cap emergence names the
engine is designed for (from the scanner universe) come first, then the rest of the real SEC listing,
de-duplicated. `EW_UNIVERSE_LIMIT` bounds the slice; the worker logs "scanned N of M" so the coverage is
always honest and never overstated.

Deliberately NOT survivorship-corrected: this is the CURRENT listing, so delisted names (the small-caps
that went to zero) are absent. Honest winner training needs a delisted-inclusive point-in-time dataset -
that remains the data gate. This module gives real breadth for live scanning, not a training corpus.
"""
from __future__ import annotations

import json
import os
import tempfile
import time
import urllib.request

from ..stock_scanner.universe import NASDAQ_TECH_UNIVERSE

SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
DEFAULT_UA = "Lyra research audit (contact: research@vivacityai.com.au)"

# Dynamic + fresh: the listing is fetched LIVE, so new SEC registrants and fresh IPOs are picked up
# automatically. A short disk cache (default 24h) means we refetch daily - new names appear within a day
# without hammering SEC every run. Ephemeral CI filesystems just refetch each run, which is even fresher.
_CACHE_TTL_SECONDS = int(os.environ.get("SEC_CACHE_TTL_HOURS", "24")) * 3600
_CACHE_PATH = os.path.join(tempfile.gettempdir(), "lyra_sec_company_tickers.json")


def _cached_listing() -> list[str] | None:
    try:
        if os.path.exists(_CACHE_PATH) and (time.time() - os.path.getmtime(_CACHE_PATH)) < _CACHE_TTL_SECONDS:
            with open(_CACHE_PATH, encoding="utf-8") as fh:
                data = json.load(fh)
            return data if isinstance(data, list) and data else None
    except Exception:  # noqa: BLE001 - a bad cache just means refetch
        return None
    return None


def _write_cache(tickers: list[str]) -> None:
    try:
        with open(_CACHE_PATH, "w", encoding="utf-8") as fh:
            json.dump(tickers, fh)
    except Exception:  # noqa: BLE001 - cache is best-effort
        pass


def _emergence_first() -> list[str]:
    """The curated small-cap emergence names the engine targets, in universe order."""
    return [t.symbol.upper() for t in NASDAQ_TECH_UNIVERSE if t.category == "small_cap_emergence"]


def load_sec_listing(*, timeout: int = 30, use_cache: bool = True) -> list[str]:
    """Every US-listed common-stock ticker from the SEC listing (the whole landscape), fetched LIVE so new
    registrants are picked up automatically. Alpha-only tickers (drops warrants/units/preferreds with
    punctuation) so the downstream price pull stays clean. Cached ~24h to avoid refetching every run."""
    if use_cache:
        cached = _cached_listing()
        if cached is not None:
            return cached
    req = urllib.request.Request(
        SEC_TICKERS_URL,
        headers={"User-Agent": os.environ.get("SEC_USER_AGENT", DEFAULT_UA)},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 - fixed, trusted SEC host
        data = json.load(resp)
    out: list[str] = []
    seen: set[str] = set()
    for row in data.values():
        tkr = str(row.get("ticker", "")).upper().strip()
        if tkr and tkr.isalpha() and tkr not in seen:  # isalpha drops BRK.B / units / warrants
            seen.add(tkr)
            out.append(tkr)
    if use_cache and out:
        _write_cache(out)
    return out


def load_candidate_symbols(*, limit: int | None = None, include_sec: bool = True) -> list[str]:
    """The scan universe: emergence names first, then the full real SEC listing, de-duplicated and bounded
    by `limit`. `include_sec=False` (or an offline/failed fetch) falls back to just the curated names, so
    the worker still scans REAL market data even without the SEC round-trip."""
    ordered: list[str] = []
    seen: set[str] = set()

    def add(sym: str) -> None:
        s = sym.upper()
        if s not in seen:
            seen.add(s)
            ordered.append(s)

    for s in _emergence_first():
        add(s)

    if include_sec:
        try:
            for s in load_sec_listing():
                add(s)
        except Exception:  # noqa: BLE001 - offline/rate-limited: fall back to the curated real names
            pass

    return ordered[:limit] if limit else ordered


def cik_by_symbol(*, timeout: int = 30) -> dict[str, int]:
    """Authoritative ticker -> CIK map straight from the SEC listing (no fuzzy matching). This is the key
    that lets the EDGAR fundamentals fetch attach filings to the RIGHT company. Best-effort: returns {} on
    an offline/failed fetch so the caller degrades to no-EDGAR (domains stay unavailable) rather than
    guessing an identity."""
    try:
        req = urllib.request.Request(
            SEC_TICKERS_URL,
            headers={"User-Agent": os.environ.get("SEC_USER_AGENT", DEFAULT_UA)},
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 - fixed, trusted SEC host
            data = json.load(resp)
    except Exception:  # noqa: BLE001 - offline/rate-limited: no CIK map, EDGAR stays unavailable
        return {}
    out: dict[str, int] = {}
    for row in data.values():
        tkr = str(row.get("ticker", "")).upper().strip()
        cik = row.get("cik_str")
        if tkr and isinstance(cik, int):
            out[tkr] = cik
    return out


def theme_by_symbol() -> dict[str, dict]:
    """Theme context for the curated names we actually know a theme for (from the scanner category). Names
    without a known theme get no theme_context, so the theme domain reads `unavailable` rather than guessing."""
    themes: dict[str, dict] = {}
    for t in NASDAQ_TECH_UNIVERSE:
        if t.category and t.category != "small_cap_emergence":
            themes[t.symbol.upper()] = {"themes": [t.category.replace("_", " ")]}
    # Emergence names carry a themed industry too (e.g. Quantum Computing, Robotics, Lidar).
    for t in NASDAQ_TECH_UNIVERSE:
        if t.category == "small_cap_emergence" and t.industry:
            themes[t.symbol.upper()] = {"themes": [t.industry.lower()]}
    return themes
