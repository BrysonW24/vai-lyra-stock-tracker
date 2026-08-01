"""
FX normalisation for the multi-market universe - free, keyless, coverage-honest.

Why this exists: the risk gates and cap-tier logic threshold `market_cap` and `avg_dollar_volume` in
USD. A name listed on the ASX reports those in AUD - reading AUD as USD misstates them by ~35%, so a
global pool needs one tiny FX step before those two fields are comparable.

Source: the Frankfurter API (ECB reference rates, free, no key) - one fetch per currency per day,
cached on disk. Degradation ladder, in order:

  1. live rate (fetched today, cached ~24h)          -> source "live"/"cache"
  2. stale cache (fetch failed, an older rate exists) -> source "stale" (a day-old ECB rate is fine
     for cap-tier bucketing; this is not an execution system)
  3. pinned approximate rate (never fetched at all)   -> source "pinned", logged - close enough for
     order-of-magnitude cap tiers, refreshed with the codebase
  4. unknown currency, nothing available              -> None: the CALLER must drop the USD-semantics
     fields rather than mislabel them (absent beats wrong - the standing honesty rule)

Reference-rate cadence note: ECB rates update once per working day - that is exactly the freshness this
needs and why one cached fetch per day is the right amount of network.
"""
from __future__ import annotations

import json
import logging
import os
import tempfile
import time
import urllib.request

logger = logging.getLogger("emerging_winner.fx")

FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest?base={base}&symbols=USD"
_CACHE_TTL_SECONDS = int(os.environ.get("FX_CACHE_TTL_HOURS", "24")) * 3600
_CACHE_PATH = os.path.join(tempfile.gettempdir(), "lyra_fx_usd_rates.json")

# Approximate last-resort rates (1 unit of currency in USD). Order-of-magnitude correct for cap-tier
# bucketing when the live source has never been reachable; every use is logged as approximate.
PINNED_USD_RATES: dict[str, float] = {
    "AUD": 0.65, "GBP": 1.27, "EUR": 1.08, "CAD": 0.73, "NZD": 0.59,
    "CHF": 1.10, "JPY": 0.0067, "HKD": 0.128, "SGD": 0.74, "SEK": 0.095,
    "NOK": 0.093, "DKK": 0.145, "GBX": 0.0127,  # GBX = pence quotes on the LSE
}


def _read_cache() -> dict:
    try:
        if os.path.exists(_CACHE_PATH):
            with open(_CACHE_PATH, encoding="utf-8") as fh:
                data = json.load(fh)
            if isinstance(data, dict):
                return data
    except Exception:  # noqa: BLE001 - a bad cache just means refetch
        pass
    return {}


def _write_cache(cache: dict) -> None:
    try:
        with open(_CACHE_PATH, "w", encoding="utf-8") as fh:
            json.dump(cache, fh)
    except Exception:  # noqa: BLE001 - cache is best-effort
        pass


def parse_frankfurter_usd(payload: dict) -> float | None:
    """Pure: extract the USD rate from a Frankfurter `latest` response. None when absent/malformed."""
    try:
        rate = payload.get("rates", {}).get("USD")
        return float(rate) if isinstance(rate, (int, float)) and rate > 0 else None
    except Exception:  # noqa: BLE001 - malformed payload = no rate
        return None


def _fetch_live(currency: str, *, timeout: int = 10) -> float | None:
    req = urllib.request.Request(
        FRANKFURTER_URL.format(base=currency),
        headers={"User-Agent": os.environ.get("SEC_USER_AGENT", "Lyra research audit")},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 - fixed, trusted ECB-mirror host
        return parse_frankfurter_usd(json.load(resp))


def usd_rate(currency: str, *, timeout: int = 10, use_cache: bool = True) -> tuple[float, str] | None:
    """(rate, source) turning 1 unit of `currency` into USD, or None when the currency is unknown and no
    rate can be sourced - in which case the caller must treat USD-semantics fields as unavailable."""
    ccy = (currency or "").upper().strip()
    if not ccy:
        return None
    if ccy == "USD":
        return (1.0, "identity")
    # GBX (LSE pence) is not an ISO currency Frankfurter serves - derive it from GBP.
    if ccy == "GBX":
        gbp = usd_rate("GBP", timeout=timeout, use_cache=use_cache)
        return (gbp[0] / 100.0, gbp[1]) if gbp else ((PINNED_USD_RATES["GBX"], "pinned"))

    cache = _read_cache() if use_cache else {}
    entry = cache.get(ccy)
    if entry and (time.time() - float(entry.get("at", 0))) < _CACHE_TTL_SECONDS:
        return (float(entry["rate"]), "cache")

    try:
        live = _fetch_live(ccy, timeout=timeout)
    except Exception:  # noqa: BLE001 - offline/rate-limited: fall down the ladder
        live = None
    if live:
        if use_cache:
            cache[ccy] = {"rate": live, "at": time.time()}
            _write_cache(cache)
        return (live, "live")

    if entry:  # stale cache beats a pin - it was a real observed rate
        return (float(entry["rate"]), "stale")
    pinned = PINNED_USD_RATES.get(ccy)
    if pinned:
        logger.warning("fx: using pinned approximate %s->USD rate %.4f (live source unreachable)", ccy, pinned)
        return (pinned, "pinned")
    logger.warning("fx: no %s->USD rate available - USD-semantics fields must stay unavailable", ccy)
    return None
