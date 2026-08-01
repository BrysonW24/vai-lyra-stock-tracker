"""
Real candidate universe for the Emerging Winner Engine - the actual listed landscape, now MULTI-MARKET.

Source of truth per market, all free and keyless:

  * US ("us"): the SEC's `company_tickers.json` (every US company that files with the SEC, ~10k names,
    small-caps and micro-caps included). Authoritative, and the key that unlocks EDGAR (ticker -> CIK).
  * Other markets ("au" ASX, "uk" LSE, ...): the FinanceDatabase open reference listing (one CSV per
    exchange on GitHub, symbols already Yahoo-suffixed e.g. `XRO.AX`, with a market-cap bucket and a
    delisted flag per name). Delisted names are excluded; names are ordered smallest-cap-first so the
    engine's target class (nano/micro/small) leads the pool - the emergence-first doctrine, generalised.

Because scoring every listing on every run is not practical (yfinance is best-effort and rate-limited),
a run scans a BOUNDED slice, EMERGENCE-FIRST, through a ROTATING WINDOW: the curated small-cap emergence
names come first every run, then each enabled market contributes a deterministic slice of its full pool
that advances by one budget-width per UTC day. Over a full cycle (~pool/budget days) every listed name in
every enabled market gets scanned - small caps through mega caps - instead of the front of the list being
rescanned forever. `EW_UNIVERSE_LIMIT` bounds the slice, `EW_MARKETS` picks the markets (default
"us,au"), and the worker logs "scanned N of M, window day D" so coverage is always honest.

Deliberately NOT survivorship-corrected: this is the CURRENT listing, so delisted names (the small-caps
that went to zero) are absent. Honest winner training needs a delisted-inclusive point-in-time dataset -
that remains the data gate. This module gives real breadth for live scanning, not a training corpus.
"""
from __future__ import annotations

import csv
import io
import json
import logging
import os
import re
import tempfile
import time
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime, timezone

from ..stock_scanner.universe import NASDAQ_TECH_UNIVERSE

logger = logging.getLogger("emerging_winner.universe")

SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
FINDB_EQUITY_URL = "https://raw.githubusercontent.com/JerBouma/FinanceDatabase/main/database/equities/{file}.csv"
DEFAULT_UA = "Lyra research audit (contact: research@vivacityai.com.au)"

# Dynamic + fresh: listings are fetched LIVE, so new registrants and fresh IPOs are picked up
# automatically. A short disk cache (default 24h) means we refetch daily - new names appear within a day
# without hammering the sources every run. Ephemeral CI filesystems just refetch each run.
_CACHE_TTL_SECONDS = int(os.environ.get("SEC_CACHE_TTL_HOURS", "24")) * 3600
_CACHE_PATH = os.path.join(tempfile.gettempdir(), "lyra_sec_company_tickers.json")


# --------------------------------------------------------------------------------------------------
# Market registry - one entry per scannable market. Adding a market is ONE line here (plus a verified
# FinanceDatabase exchange file). Suffixes are Yahoo Finance conventions, so the existing market-data
# provider works unchanged; `currency` is what that market's caps/volumes are denominated in, so the
# feature assembler can normalise to USD (fx.py) before the USD-thresholded liquidity gates read them.
# --------------------------------------------------------------------------------------------------

@dataclass(frozen=True)
class Market:
    key: str
    label: str
    suffix: str  # Yahoo symbol suffix ("" for US, ".AX" for ASX, ".L" for LSE)
    currency: str
    source: str  # "sec" or a FinanceDatabase equities file name (e.g. "ASX", "LSE")


MARKETS: dict[str, Market] = {
    "us": Market("us", "United States (SEC listing)", "", "USD", "sec"),
    "au": Market("au", "Australia (ASX)", ".AX", "AUD", "ASX"),
    # Available but not in the default set - flip on with EW_MARKETS="us,au,uk".
    # Fallback currency is GBX (pence): Yahoo quotes the overwhelming majority of LSE equities in
    # pence, so a GBP fallback would overstate USD-semantics fields ~100x whenever the provider's own
    # currency read is unavailable (exactly the throttled case where the fallback fires).
    "uk": Market("uk", "United Kingdom (LSE)", ".L", "GBX", "LSE"),
}

DEFAULT_MARKETS = "us,au"


def enabled_markets(markets: str | None = None) -> list[Market]:
    """The markets this run scans, from `markets` or the EW_MARKETS env (default "us,au"). Unknown keys
    are logged and skipped rather than failing the run."""
    raw = markets if markets is not None else os.environ.get("EW_MARKETS", DEFAULT_MARKETS)
    out: list[Market] = []
    for key in (p.strip().lower() for p in raw.split(",")):
        if not key:
            continue
        market = MARKETS.get(key)
        if market is None:
            logger.warning("unknown market %r in EW_MARKETS - skipped (known: %s)", key, ",".join(MARKETS))
        elif market not in out:
            out.append(market)
    return out or [MARKETS["us"]]


def currency_for_symbol(symbol: str) -> str:
    """The listing currency implied by a symbol's Yahoo suffix ("XRO.AX" -> AUD, bare -> USD). Used as
    the fallback when the market-data provider does not state a currency for the name."""
    sym = symbol.upper()
    for market in MARKETS.values():
        if market.suffix and sym.endswith(market.suffix):
            return market.currency
    return "USD"


# --------------------------------------------------------------------------------------------------
# Cache helpers (per-source disk cache, best-effort, stale-tolerant)
# --------------------------------------------------------------------------------------------------

def _cache_read(path: str, *, ignore_ttl: bool = False) -> list[str] | None:
    try:
        if not os.path.exists(path):
            return None
        if not ignore_ttl and (time.time() - os.path.getmtime(path)) >= _CACHE_TTL_SECONDS:
            return None
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, list) and data else None
    except Exception:  # noqa: BLE001 - a bad cache just means refetch
        return None


def _cache_write(path: str, tickers: list[str]) -> None:
    try:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(tickers, fh)
    except Exception:  # noqa: BLE001 - cache is best-effort
        pass


def _cached_listing() -> list[str] | None:
    return _cache_read(_CACHE_PATH)


def _write_cache(tickers: list[str]) -> None:
    _cache_write(_CACHE_PATH, tickers)


def _emergence_first() -> list[str]:
    """The curated small-cap emergence names the engine targets, in universe order."""
    return [t.symbol.upper() for t in NASDAQ_TECH_UNIVERSE if t.category == "small_cap_emergence"]


# --------------------------------------------------------------------------------------------------
# US listing (SEC) - unchanged behaviour
# --------------------------------------------------------------------------------------------------

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


# --------------------------------------------------------------------------------------------------
# Non-US listings (FinanceDatabase per-exchange CSVs, Yahoo-suffixed symbols + cap buckets)
# --------------------------------------------------------------------------------------------------

# Small-first: the engine's target class leads the pool, mega caps still covered by the rotation.
_CAP_ORDER = {"nano cap": 0, "micro cap": 1, "small cap": 2, "mid cap": 3, "large cap": 4, "mega cap": 5}
_SUFFIXED_SYMBOL = re.compile(r"^[A-Z0-9]+(\.[A-Z]+)+$")


def parse_findb_listing(text: str, *, expect_suffix: str | None = None) -> list[str]:
    """Pure parse of a FinanceDatabase equities CSV -> Yahoo-suffixed symbols, delisted names excluded,
    ordered smallest-cap-bucket-first (stable within a bucket, unknown buckets last). Malformed rows are
    skipped; a file with no `symbol` column parses to [] (the caller treats that as an unusable source)."""
    try:
        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames or "symbol" not in reader.fieldnames:
            return []
        rows: list[tuple[int, int, str]] = []
        seen: set[str] = set()
        for i, row in enumerate(reader):
            sym = (row.get("symbol") or "").upper().strip()
            if not sym or sym in seen or not _SUFFIXED_SYMBOL.match(sym):
                continue
            if expect_suffix and not sym.endswith(expect_suffix):
                continue
            if (row.get("delisted") or "").strip().lower() == "true":
                continue
            cap_rank = _CAP_ORDER.get((row.get("market_cap") or "").strip().lower(), len(_CAP_ORDER))
            seen.add(sym)
            rows.append((cap_rank, i, sym))
        rows.sort()
        return [sym for _, _, sym in rows]
    except Exception:  # noqa: BLE001 - an unparseable file is an unusable source, never a crash
        return []


def load_findb_listing(exchange_file: str, *, expect_suffix: str | None = None,
                       timeout: int = 30, use_cache: bool = True) -> list[str]:
    """The full listing for one exchange from the FinanceDatabase reference CSVs (free, keyless, symbols
    already Yahoo-suffixed). Cached ~24h; on a failed fetch the last cache is served even when stale
    (a day-old listing beats an empty market), else []."""
    cache_path = os.path.join(tempfile.gettempdir(), f"lyra_findb_{exchange_file.lower()}.json")
    if use_cache:
        cached = _cache_read(cache_path)
        if cached is not None:
            return cached
    try:
        req = urllib.request.Request(
            FINDB_EQUITY_URL.format(file=exchange_file),
            headers={"User-Agent": os.environ.get("SEC_USER_AGENT", DEFAULT_UA)},
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 - fixed, trusted GitHub raw host
            text = resp.read().decode("utf-8", errors="replace")
    except Exception:  # noqa: BLE001 - offline/rate-limited: serve stale cache if any, else empty
        stale = _cache_read(cache_path, ignore_ttl=True)
        if stale:
            logger.warning("findb %s fetch failed - serving stale cached listing (%d names)", exchange_file, len(stale))
        return stale or []
    out = parse_findb_listing(text, expect_suffix=expect_suffix)
    if use_cache and out:
        _cache_write(cache_path, out)
    return out


# --------------------------------------------------------------------------------------------------
# Pools + the rotating scan window
# --------------------------------------------------------------------------------------------------

def _load_market_listing(market: Market) -> list[str]:
    if market.source == "sec":
        return load_sec_listing()
    return load_findb_listing(market.source, expect_suffix=market.suffix or None)


def load_market_pools(*, markets: str | None = None, include_remote: bool = True) -> dict[str, list[str]]:
    """Full listed pool per enabled market ({market_key: [symbols]}). A market whose listing cannot be
    fetched contributes [] and is logged - the scan proceeds on what IS available, never fails the run."""
    pools: dict[str, list[str]] = {}
    for market in enabled_markets(markets):
        if not include_remote:
            pools[market.key] = []
            continue
        try:
            pools[market.key] = _load_market_listing(market)
        except Exception:  # noqa: BLE001 - one dark market never fails the run
            pools[market.key] = []
        if not pools[market.key]:
            logger.warning("market %s listing unavailable this run (offline/rate-limited) - scanning without it", market.key)
    return pools


def rotating_window(pool: list[str], budget: int, *, day: date) -> list[str]:
    """Deterministic slice of `pool` that advances by `budget` names per UTC day, wrapping around, so the
    WHOLE pool is scanned over ceil(len/budget) days. Same UTC day -> same window (rerun-stable); pass an
    explicit `day` so tests never read the machine clock. budget >= len(pool) -> the whole pool."""
    n = len(pool)
    if n == 0 or budget <= 0:
        return []
    if budget >= n:
        return list(pool)
    start = (day.toordinal() * budget) % n
    end = start + budget
    if end <= n:
        return pool[start:end]
    return pool[start:] + pool[: end - n]


def _split_budget(budget: int, sizes: dict[str, int]) -> dict[str, int]:
    """Split a scan budget across markets proportionally to pool size (largest-remainder rounding), with
    every non-empty market getting at least 1 slot when the budget allows. Deterministic."""
    keys = [k for k, s in sizes.items() if s > 0]
    total = sum(sizes[k] for k in keys)
    if not keys or budget <= 0 or total == 0:
        return {k: 0 for k in sizes}
    shares = {k: (budget * sizes[k]) // total for k in keys}
    if budget >= len(keys):
        for k in keys:
            if shares[k] == 0:
                shares[k] = 1
    # Largest-remainder distribution of whatever is left, stable order.
    leftover = budget - sum(shares.values())
    if leftover > 0:
        by_remainder = sorted(keys, key=lambda k: ((budget * sizes[k]) % total, sizes[k], k), reverse=True)
        for k in by_remainder:
            if leftover <= 0:
                break
            shares[k] += 1
            leftover -= 1
    elif leftover < 0:  # min-1 floors overshot a tiny budget - trim from the largest shares
        for k in sorted(keys, key=lambda kk: (shares[kk], sizes[kk], kk), reverse=True):
            if leftover >= 0:
                break
            if shares[k] > 0:
                shares[k] -= 1
                leftover += 1
    out = {k: 0 for k in sizes}
    out.update({k: min(shares[k], sizes[k]) for k in keys})
    return out


def load_candidate_symbols(*, limit: int | None = None, include_sec: bool = True,
                           markets: str | None = None, today: date | None = None,
                           pools: dict[str, list[str]] | None = None) -> list[str]:
    """The scan universe for one run: curated emergence names first (every run), then each enabled
    market's rotating window over its FULL listed pool, budget split proportionally to pool size,
    de-duplicated and bounded by `limit`. Over a full rotation cycle every name in every enabled market -
    small caps through mega caps - gets scanned. `include_sec=False` (or offline/failed fetches) falls
    back to just the curated names, so the worker still scans REAL market data without the round-trips."""
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
        if pools is None:
            pools = load_market_pools(markets=markets)
        budget = (limit - len(ordered)) if limit else None
        day = today or datetime.now(timezone.utc).date()
        if budget is None:
            for pool in pools.values():
                for s in pool:
                    add(s)
        elif budget > 0:
            shares = _split_budget(budget, {k: len(p) for k, p in pools.items()})
            for key, pool in pools.items():
                for s in rotating_window(pool, shares.get(key, 0), day=day):
                    add(s)

    return ordered[:limit] if limit else ordered


def coverage_note(pools: dict[str, list[str]], *, limit: int | None, today: date | None = None) -> str:
    """One honest line for the run log: per-market pool sizes, the day's window position, and the full
    cycle length - so "scanned N of M" is always stated, never implied."""
    day = today or datetime.now(timezone.utc).date()
    total = sum(len(p) for p in pools.values())
    parts = [f"{k}={len(p)}" for k, p in pools.items()]
    cycle = "-"
    if limit and total > limit:
        cycle = f"~{(total + limit - 1) // limit}d"
    return (
        f"pool {total} ({', '.join(parts)}); window day {day.toordinal() % 10_000}, "
        f"budget {limit or 'all'}, full-coverage cycle {cycle}"
    )


# --------------------------------------------------------------------------------------------------
# US identity + theme maps (unchanged)
# --------------------------------------------------------------------------------------------------

def cik_by_symbol(*, timeout: int = 30) -> dict[str, int]:
    """Authoritative ticker -> CIK map straight from the SEC listing (no fuzzy matching). This is the key
    that lets the EDGAR fundamentals fetch attach filings to the RIGHT company. US names only by nature -
    suffixed non-US symbols simply have no CIK, so EDGAR stays honestly unavailable for them. Best-effort:
    returns {} on an offline/failed fetch so the caller degrades to no-EDGAR (domains stay unavailable)
    rather than guessing an identity."""
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
