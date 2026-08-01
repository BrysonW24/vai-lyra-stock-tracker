"""
Point-in-time HISTORICAL data layer for the Emerging Winner backtest - real old data, honestly dated.

This is the "use old data" half of the real-world eval: it rebuilds, for any historical score date T,
exactly the feature dict the live `feature_source.assemble_features` produces today - technical +
accumulation + liquidity from the daily OHLCV series AS OF T, and the EDGAR-derived fundamentals using
ONLY facts whose `filed` date is <= T (so a restated or late-filed number can never leak backward in
time). Forward prices AFTER T supply the first-touch barrier label the live maturation job will one day
write. Together a (T, features, label) row is byte-compatible with the 056 ledger's training rows, so
the existing trainer (`train.py`) and dataset assembly (`dataset.assemble_training_rows`) run UNCHANGED
on decade-old data.

Sources (free, keyless, same trust ladder as the live paths):
  * Prices: Stooq daily CSV (full history, split-adjusted) with yfinance `period="max"` as fallback.
  * Fundamentals: SEC EDGAR companyfacts - the same endpoint `edgar_source.py` uses live, but every
    derivation here takes an `as_of` and filters on the fact's `filed` date first.

SURVIVORSHIP HONESTY - read this before trusting any number downstream: the corpus universe comes from
the CURRENT SEC listing, so names that delisted before today are absent. Winners that later died are
still winners (first-touch), but the LOSER population is censored - the -80% ruin rate in this corpus
understates reality, and precision measured here is an OPTIMISTIC BOUND. Every corpus carries this in
its provenance; the delisted-inclusive corpus remains the data gate the roadmap states.

Network functions are separated from pure derivations (repo convention): everything ending in `_asof`
or starting with `label_` is pure and unit-tested with no network; `fetch_*` touch the network and are
never called in CI.
"""
from __future__ import annotations

import csv
import io
import json
import os
import statistics
import time
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from .universe_source import DEFAULT_UA

STOOQ_DAILY_URL = "https://stooq.com/q/d/l/?s={sym}&i=d"

# Filed-date discipline: an EDGAR fact is only visible at T if it was FILED on or before T.
# Concept lists mirror edgar_source.py so live and backtest read the same tags in the same order.
_SHARES_GROWTH_CONCEPTS = [
    ("us-gaap", "WeightedAverageNumberOfSharesOutstandingBasic", "shares"),
    ("us-gaap", "WeightedAverageNumberOfDilutedSharesOutstanding", "shares"),
    ("us-gaap", "CommonStockSharesOutstanding", "shares"),
    ("dei", "EntityCommonStockSharesOutstanding", "shares"),
]
# Instantaneous share counts for market cap at T (flows like weighted-average would misstate a cap).
_SHARES_POINT_CONCEPTS = [
    ("dei", "EntityCommonStockSharesOutstanding", "shares"),
    ("us-gaap", "CommonStockSharesOutstanding", "shares"),
]
_REVENUE_CONCEPTS = [
    ("us-gaap", "RevenueFromContractWithCustomerExcludingAssessedTax", "USD"),
    ("us-gaap", "Revenues", "USD"),
    ("us-gaap", "SalesRevenueNet", "USD"),
]
_GROSS_PROFIT_CONCEPTS = [("us-gaap", "GrossProfit", "USD")]
# Best-effort debt/equity (matches the yfinance `debtToEquity` semantics: total debt / equity).
_DEBT_CONCEPTS = [
    ("us-gaap", "LongTermDebtNoncurrent", "USD"),
    ("us-gaap", "LongTermDebt", "USD"),
]
_DEBT_CURRENT_CONCEPTS = [
    ("us-gaap", "LongTermDebtCurrent", "USD"),
    ("us-gaap", "DebtCurrent", "USD"),
    ("us-gaap", "ShortTermBorrowings", "USD"),
]
_EQUITY_CONCEPTS = [("us-gaap", "StockholdersEquity", "USD")]

# Every concept the compact per-CIK bundle retains (keyed "taxonomy:Concept:unit").
_BUNDLE_CONCEPTS: list[tuple[str, str, str]] = sorted(
    set(
        _SHARES_GROWTH_CONCEPTS
        + _SHARES_POINT_CONCEPTS
        + _REVENUE_CONCEPTS
        + _GROSS_PROFIT_CONCEPTS
        + _DEBT_CONCEPTS
        + _DEBT_CURRENT_CONCEPTS
        + _EQUITY_CONCEPTS
    )
)


# --------------------------------------------------------------------------------------------------
# Daily bars (pure container + parsing)
# --------------------------------------------------------------------------------------------------

@dataclass(frozen=True)
class DailyBar:
    """One daily bar. o/h/l/close are the ADJUSTED series (splits + dividends - the consistent series
    indicators and barrier labels need); raw_close is the price the market actually printed that day -
    the only honest input for market cap (shares-as-of x raw price). For dividend payers the two
    diverge badly a decade back (POWL 2015: adjusted $6.65 vs raw ~$26 - a 4x cap misstatement)."""
    day: str  # ISO date "YYYY-MM-DD"
    open: Optional[float]
    high: Optional[float]
    low: Optional[float]
    close: Optional[float]
    volume: Optional[float]
    raw_close: Optional[float] = None


def parse_stooq_csv(text: str) -> list[DailyBar]:
    """Pure parse of a Stooq daily CSV -> ascending DailyBars. Throttle/HTML/empty bodies parse to []
    (the caller treats [] as 'source unusable', never as 'the stock had no history')."""
    if not text or text.lstrip().startswith("<"):
        return []
    out: list[DailyBar] = []
    try:
        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames or "Date" not in reader.fieldnames or "Close" not in reader.fieldnames:
            return []
        for row in reader:
            day = (row.get("Date") or "").strip()
            if len(day) != 10:
                continue

            def num(key: str) -> Optional[float]:
                raw = (row.get(key) or "").strip()
                try:
                    return float(raw) if raw else None
                except ValueError:
                    return None

            close = num("Close")
            if close is None or close <= 0:
                continue
            # Stooq closes are split-adjusted ANCHORED TO TODAY, so treating them as the printed price
            # would embed FUTURE split information in market cap (shares-as-of x price) and the price
            # filter - a label-correlated look-ahead (splits follow run-ups). raw_close stays None:
            # market cap is honestly absent for Stooq-sourced series (absent beats wrong).
            out.append(DailyBar(day, num("Open"), num("High"), num("Low"), close, num("Volume"), None))
    except Exception:  # noqa: BLE001 - a malformed file is an unusable source, never a crash
        return []
    out.sort(key=lambda b: b.day)
    return out


def fetch_stooq_history(symbol: str, *, timeout: int = 30,
                        ua: Optional[str] = None) -> Optional[list[DailyBar]]:
    """Full split-adjusted daily history from Stooq for a US symbol ('LUNR' -> 'lunr.us').

    None  = the SOURCE failed (offline / bot-walled / HTML challenge) - transient, do not cache.
    []    = the source answered but had no usable rows for this symbol - cacheable emptiness."""
    sym = symbol.lower().strip()
    if "." not in sym:
        sym = f"{sym}.us"
    try:
        req = urllib.request.Request(
            STOOQ_DAILY_URL.format(sym=sym),
            headers={"User-Agent": ua or os.environ.get("SEC_USER_AGENT", DEFAULT_UA)},
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 - fixed, trusted host
            text = resp.read().decode("utf-8", errors="replace")
    except Exception:  # noqa: BLE001 - offline/blocked: source failure, not symbol emptiness
        return None
    if text.lstrip().startswith("<"):
        return None  # bot-wall / HTML challenge = source failure, never "this stock has no history"
    return parse_stooq_csv(text)


def fetch_yfinance_history(symbol: str) -> Optional[list[DailyBar]]:
    """Full daily history via yfinance with BOTH series: raw Close (what the market printed - for
    market cap) and the dividend+split adjusted series (for indicators/labels), built by scaling
    O/H/L/C by the per-bar Adj Close / Close factor. Worker-only (network).

    None = the source failed (network/DNS/throttle) - transient, do not cache as emptiness.
    []   = Yahoo answered with no data (delisted/unknown symbol) - cacheable emptiness."""
    try:
        import yfinance as yf

        frame = yf.Ticker(symbol).history(period="max", interval="1d", auto_adjust=False,
                                          raise_errors=True)
    except Exception as exc:  # noqa: BLE001 - classify: transient transport vs genuine no-data
        msg = str(exc).lower()
        transient = any(t in msg for t in (
            "could not resolve", "curl", "timed out", "timeout", "connection",
            "too many requests", "rate limit", "429", "temporarily",
        ))
        return None if transient else []
    if frame is None or getattr(frame, "empty", True):
        return []
    records: list[tuple[str, dict]] = []
    for ts, row in frame.iterrows():
        records.append((str(ts.date()), row))
    records.sort(key=lambda r: r[0])

    # Yahoo's Close with auto_adjust=False is STILL split-adjusted (only dividends are excluded).
    # The true printed price at T = Close(T) x product of all split ratios dated AFTER T - without
    # this, shares-as-of(T) x close(T) understates market cap by the split factor for any name that
    # split later (e.g. POWL 3:1 on 2026-04-06 makes its 2015 cap read 3x too small).
    n = len(records)
    unsplit = [1.0] * n
    running = 1.0
    for i in range(n - 1, -1, -1):
        unsplit[i] = running  # splits ON day i affect prices BEFORE day i, not day i itself
        try:
            ratio = float(records[i][1].get("Stock Splits", 0) or 0)
        except (TypeError, ValueError):
            ratio = 0.0
        if ratio > 0:
            running *= ratio

    out: list[DailyBar] = []
    for i, (day, row) in enumerate(records):
        def val(key: str) -> Optional[float]:
            try:
                v = float(row[key])
                return v if v == v else None  # drop NaN
            except (KeyError, TypeError, ValueError):
                return None

        split_adj_close = val("Close")
        if split_adj_close is None or split_adj_close <= 0:
            continue
        adj_close = val("Adj Close")
        factor = (adj_close / split_adj_close) if (adj_close is not None and adj_close > 0) else 1.0

        def adj(key: str) -> Optional[float]:
            v = val(key)
            return v * factor if v is not None else None

        out.append(DailyBar(
            day, adj("Open"), adj("High"), adj("Low"),
            adj_close if adj_close is not None else split_adj_close,
            val("Volume"), split_adj_close * unsplit[i],
        ))
    return out


def load_price_history(symbol: str, cache_dir: str, *, prefer: str = "stooq",
                       min_bars: int = 260) -> tuple[list[DailyBar], str]:
    """Daily history for `symbol` with a disk cache: (bars, source). source in {stooq, yfinance,
    cache-*, none, error}. A cached result is never refetched (this is a HISTORICAL corpus -
    yesterday's close does not change last decade's bars).

    Cache-poisoning guard: a TRANSIENT source failure (DNS blip, throttle, bot wall - fetchers return
    None) is reported as source="error" and NOT cached, so one bad network window cannot brand a
    thousand live symbols as historyless. Only a real answer (data, or answered-empty) is cached."""
    os.makedirs(os.path.join(cache_dir, "prices"), exist_ok=True)
    path = os.path.join(cache_dir, "prices", f"{symbol.upper()}.json")
    if os.path.exists(path):
        try:
            with open(path, encoding="utf-8") as fh:
                data = json.load(fh)
            bars = [DailyBar(*row) for row in data.get("bars", [])]
            src = data.get("source", "unknown")
            # An empty cached entry is a KNOWN-BAD symbol (source answered: no usable history).
            return bars, f"cache-{src}"
        except Exception:  # noqa: BLE001 - bad cache -> refetch
            pass
    order = ["stooq", "yfinance"] if prefer == "stooq" else ["yfinance", "stooq"]
    bars: list[DailyBar] = []
    source = "none"
    any_answered = False
    for src in order:
        result = fetch_stooq_history(symbol) if src == "stooq" else fetch_yfinance_history(symbol)
        if result is None:
            continue  # source failure - try the next source, and never cache this as emptiness
        any_answered = True
        if len(result) >= min_bars:
            bars = result
            source = src
            break
    if not any_answered:
        return [], "error"
    payload = {
        "source": source,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "bars": [[b.day, b.open, b.high, b.low, b.close, b.volume, b.raw_close] for b in bars],
    }
    try:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(payload, fh)
    except Exception:  # noqa: BLE001 - cache is best-effort
        pass
    return bars, source


# --------------------------------------------------------------------------------------------------
# EDGAR compact bundles + as-of derivations (filed-date discipline)
# --------------------------------------------------------------------------------------------------

def compact_company_facts(facts: Optional[dict]) -> dict:
    """Extract ONLY the concepts the backtest needs from a full companyfacts JSON (which can be MBs)
    into {\"tax:Concept:unit\": [{end, filed, val, fy, fp, form}, ...]} - small enough to cache per CIK."""
    out: dict[str, list[dict]] = {}
    if not facts:
        return out
    for tax, concept, unit in _BUNDLE_CONCEPTS:
        node = facts.get("facts", {}).get(tax, {}).get(concept)
        if not node:
            continue
        rows = node.get("units", {}).get(unit)
        if not rows:
            continue
        keep: list[dict] = []
        for e in rows:
            val, filed, end = e.get("val"), e.get("filed"), e.get("end")
            if val is None or not filed or not end:
                continue
            entry = {
                "end": str(end), "filed": str(filed), "val": float(val),
                "fy": e.get("fy"), "fp": e.get("fp"), "form": e.get("form"),
            }
            if e.get("start"):  # flows carry start; the annual-duration check needs it
                entry["start"] = str(e["start"])
            keep.append(entry)
        if keep:
            out[f"{tax}:{concept}:{unit}"] = keep
    return out


def fetch_edgar_bundle(cik: int, cache_dir: str, *, timeout: int = 30,
                       ua: Optional[str] = None) -> Optional[dict]:
    """Compact concept bundle for a CIK, disk-cached. None when EDGAR has nothing for the CIK."""
    from .edgar_source import fetch_company_facts

    os.makedirs(os.path.join(cache_dir, "edgar"), exist_ok=True)
    path = os.path.join(cache_dir, "edgar", f"{int(cik)}.json")
    if os.path.exists(path):
        try:
            with open(path, encoding="utf-8") as fh:
                data = json.load(fh)
            if isinstance(data, dict):
                return data if data else None  # {} cached = known-empty, don't refetch
        except Exception:  # noqa: BLE001 - bad cache -> refetch
            pass
    facts = fetch_company_facts(cik, timeout=timeout, ua=ua)
    bundle = compact_company_facts(facts)
    try:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(bundle, fh)
    except Exception:  # noqa: BLE001 - cache is best-effort
        pass
    return bundle or None


def _entries(bundle: Optional[dict], tax: str, concept: str, unit: str) -> list[dict]:
    if not bundle:
        return []
    return bundle.get(f"{tax}:{concept}:{unit}", [])


def _freshest_pair_series_asof(bundle: Optional[dict], concepts: list[tuple[str, str, str]],
                               as_of: str) -> list:
    """The single concept variant with a valid latest YoY pair and the freshest end, using only facts
    FILED on or before `as_of`. Shares the live parser and the live no-cross-concept rule (mixing a
    dei cover-date count with a fiscal-year weighted average sign-flipped real dilution reads)."""
    from .edgar_source import annual_points_from_rows, latest_annual_pair

    best = None
    for i, (tax, concept, unit) in enumerate(concepts):
        s = annual_points_from_rows(_entries(bundle, tax, concept, unit), as_of=as_of)
        if latest_annual_pair(s) is None:
            continue
        key = (s[-1][0], -i)
        if best is None or key > best[0]:
            best = (key, s)
    return best[1] if best else []


def shares_outstanding_asof(bundle: Optional[dict], as_of: str) -> Optional[float]:
    """Most recent INSTANTANEOUS share count known at `as_of` (max period-end among facts filed <= as_of,
    latest filed as tiebreak). None when EDGAR had published no usable count by then. Stale counts (period
    end > 400 days before as_of) are rejected - a years-old share count silently misstates market cap."""
    cutoff = (date.fromisoformat(as_of) - timedelta(days=400)).isoformat()
    best: Optional[tuple[str, str, float]] = None  # (end, filed, val)
    for tax, concept, unit in _SHARES_POINT_CONCEPTS:
        for e in _entries(bundle, tax, concept, unit):
            if e["filed"] > as_of or e["end"] > as_of or e["end"] < cutoff or e["val"] <= 0:
                continue
            key = (e["end"], e["filed"], e["val"])
            if best is None or (key[0], key[1]) > (best[0], best[1]):
                best = key
        if best is not None:
            return best[2]
    return None


def _latest_instant_asof(bundle: Optional[dict], concepts: list[tuple[str, str, str]],
                         as_of: str, *, max_age_days: int = 400) -> Optional[float]:
    """Latest instantaneous value (max period-end, filed <= as_of) across a concept list."""
    cutoff = (date.fromisoformat(as_of) - timedelta(days=max_age_days)).isoformat()
    best: Optional[tuple[str, str, float]] = None
    for tax, concept, unit in concepts:
        for e in _entries(bundle, tax, concept, unit):
            if e["filed"] > as_of or e["end"] > as_of or e["end"] < cutoff:
                continue
            key = (e["end"], e["filed"], e["val"])
            if best is None or (key[0], key[1]) > (best[0], best[1]):
                best = key
        if best is not None:
            return best[2]
    return None


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def edgar_features_asof(bundle: Optional[dict], as_of: str) -> dict:
    """Pure: the EDGAR-derived feature fields as they were knowable at `as_of`. Same fields + units the
    live path supplies (edgar_source trends + the yfinance-shaped levels), coverage-honest: a field is
    only emitted when >= 2 comparable annual points (or a usable instant) existed by `as_of`.

      capital.share_count_growth_yoy   pct  (edgar_source parity)
      fundamentals.gross_margin_trend  -1..1 delta (edgar_source parity)
      fundamentals.revenue_growth_yoy  pct  (annual YoY from 10-Ks; live gets this from yfinance)
      capital.debt_to_equity           ratio (best-effort total debt / equity; live gets it from yfinance)
    """
    out: dict = {}
    if not bundle:
        return out

    from .edgar_source import latest_annual_pair, margin_series

    def fresh(latest_end: str) -> bool:
        # Freshness relative to T: an annual older than ~2 years at score time was not "current" then.
        gap = (date.fromisoformat(as_of) - date.fromisoformat(latest_end)).days
        return gap <= 2 * 365 + 60

    pair = latest_annual_pair(_freshest_pair_series_asof(bundle, _SHARES_GROWTH_CONCEPTS, as_of))
    if pair is not None:
        _e0, prev, e1, last = pair
        if prev > 0 and fresh(e1):
            out.setdefault("capital", {})["share_count_growth_yoy"] = round((last - prev) / prev * 100.0, 2)

    rev_series = _freshest_pair_series_asof(bundle, _REVENUE_CONCEPTS, as_of)
    gp_series = _freshest_pair_series_asof(bundle, _GROSS_PROFIT_CONCEPTS, as_of)
    m_pair = latest_annual_pair(margin_series(rev_series, gp_series))
    if m_pair is not None:
        _e0, m0, e1, m1 = m_pair
        if fresh(e1):
            out.setdefault("fundamentals", {})["gross_margin_trend"] = round(_clamp(m1 - m0, -1.0, 1.0), 4)

    # Revenue growth: QUARTERLY year-over-year preferred (the same semantics the live path's
    # yfinance `revenueGrowth` carries - most-recent quarter vs its year-ago quarter), derived from
    # the 10-Q flows already in the cached bundles; annual YoY is the fallback for non-quarterly
    # filers. Freshness for a quarterly read is tighter: a year-old "latest quarter" is not current.
    from .edgar_source import latest_quarterly_yoy_pair, quarterly_points_from_rows

    q_pair = None
    for tax, concept, unit in _REVENUE_CONCEPTS:
        q_series = quarterly_points_from_rows(_entries(bundle, tax, concept, unit), as_of=as_of)
        pair_c = latest_quarterly_yoy_pair(q_series)
        if pair_c is not None and (q_pair is None or pair_c[2] > q_pair[2]):
            q_pair = pair_c
    if q_pair is not None:
        _e0, r0, e1, r1 = q_pair
        q_fresh = (date.fromisoformat(as_of) - date.fromisoformat(e1)).days <= 200
        if r0 > 0 and q_fresh:
            out.setdefault("fundamentals", {})["revenue_growth_yoy"] = round((r1 - r0) / r0 * 100.0, 2)
    if "revenue_growth_yoy" not in out.get("fundamentals", {}):
        r_pair = latest_annual_pair(rev_series)
        if r_pair is not None:
            _e0, r0, e1, r1 = r_pair
            if r0 > 0 and fresh(e1):
                out.setdefault("fundamentals", {})["revenue_growth_yoy"] = round((r1 - r0) / r0 * 100.0, 2)

    equity = _latest_instant_asof(bundle, _EQUITY_CONCEPTS, as_of)
    if equity is not None and equity > 0:
        lt = _latest_instant_asof(bundle, _DEBT_CONCEPTS, as_of)
        st = _latest_instant_asof(bundle, _DEBT_CURRENT_CONCEPTS, as_of)
        if lt is not None or st is not None:
            total_debt = (lt or 0.0) + (st or 0.0)
            out.setdefault("capital", {})["debt_to_equity"] = round(total_debt / equity, 4)

    return out


# --------------------------------------------------------------------------------------------------
# Point-in-time feature assembly (mirrors feature_source.assemble_features field-for-field)
# --------------------------------------------------------------------------------------------------

def bar_index_at(bars: list[DailyBar], as_of: str, *, max_gap_days: int = 7) -> Optional[int]:
    """Index of the last bar on or before `as_of`, or None if the name was not trading around T
    (no bar within `max_gap_days` calendar days - halted/not yet listed/already dead)."""
    lo, hi = 0, len(bars) - 1
    idx = -1
    while lo <= hi:
        mid = (lo + hi) // 2
        if bars[mid].day <= as_of:
            idx = mid
            lo = mid + 1
        else:
            hi = mid - 1
    if idx < 0:
        return None
    gap = (date.fromisoformat(as_of) - date.fromisoformat(bars[idx].day)).days
    return idx if gap <= max_gap_days else None


def assemble_features_asof(
    bars: list[DailyBar],
    snapshots: list,
    idx: int,
    *,
    edgar_bundle: Optional[dict] = None,
    as_of: Optional[str] = None,
    theme: Optional[dict] = None,
    market_context: Optional[dict] = None,
    sponsorship: Optional[dict] = None,
) -> Optional[dict]:
    """The live feature dict as it was assemblable at bar `idx` (bars[idx].day). `snapshots` must be
    the indicator snapshots computed over the SAME bars (one per bar, causal maths only) - snapshot i
    uses only bars <= i, so sampling at idx is point-in-time by construction.

    Field-for-field parity with feature_source.assemble_features: same keys, same units, same
    'absent beats wrong' handling. Deep domains stay absent unless EDGAR had filed facts by T."""
    if idx < 0 or idx >= len(snapshots) or len(snapshots) != len(bars):
        return None
    latest = snapshots[idx]
    last_candle = bars[idx]

    feats: dict = {}

    def put(key: str, value) -> None:
        if value is not None:
            feats[key] = value

    put("rsi", latest.rsi_14)
    put("rsi_delta", latest.rsi_delta_1)
    put("macd_hist", latest.macd_histogram)
    put("macd_hist_delta", latest.macd_histogram_delta_1)
    if latest.close is not None and latest.sma_200:
        feats["price_vs_sma200"] = latest.close / latest.sma_200
    put("dist_from_60_low_pct", latest.distance_from_60_period_low)

    put("volume_ratio", latest.volume_ratio)
    put("volume", latest.volume)
    if latest.volume_state:
        feats["volume_state"] = latest.volume_state
    # Honest ADV denominator: the FULL 20-bar window, no-trade days counted as $0 - dropping them
    # overstates executable liquidity on exactly the thin names the gates exist to catch.
    window = bars[max(0, idx - 19): idx + 1]
    if window:
        feats["avg_dollar_volume"] = (
            sum((b.close or 0.0) * (b.volume or 0.0) for b in window) / len(window)
        )

    put("close", latest.close)
    put("open", last_candle.open)

    if theme and theme.get("themes"):
        feats["theme_context"] = theme

    # Narrative domain: the benchmark regime AS OF this bar (regime_source is causal, so the same
    # maths serves live and history). Supplied by the caller; never computed from the name itself.
    if market_context and market_context.get("regime"):
        feats["market_context"] = market_context

    # Sponsorship domain: point-in-time Form 4 insider flow from the pre-fetched document cache
    # (form4_source with cached_only) - all-or-nothing per window, filed-date disciplined.
    if sponsorship is not None:
        feats["sponsorship"] = sponsorship

    if edgar_bundle and as_of:
        for section, vals in edgar_features_asof(edgar_bundle, as_of).items():
            feats.setdefault(section, {}).update(vals)
        shares = shares_outstanding_asof(edgar_bundle, as_of)
        # Market cap = shares-as-of x the RAW close (the price the market printed at T). The adjusted
        # close understates dividend payers' caps by the cumulative adjustment factor - a 4x error a
        # decade back is common. No raw close -> no cap (absent beats wrong).
        raw = last_candle.raw_close
        if shares is not None and raw:
            feats["market_cap"] = shares * raw

    return feats or None


# --------------------------------------------------------------------------------------------------
# Forward outcome (the label the maturation job will one day write)
# --------------------------------------------------------------------------------------------------

def label_forward(
    bars: list[DailyBar],
    idx: int,
    *,
    up_pct: float = 100.0,
    down_pct: float = -80.0,
    horizon: int = 252,
    delist_grace_days: int = 45,
    data_end: Optional[str] = None,
) -> Optional[dict]:
    """First-touch outcome for an entry at bars[idx].close, over the next `horizon` trading days.

    Returns the outcome-row shape `dataset.label_from_outcome` reads (option-4 conjuncts included,
    computed from data INSIDE the outcome window - legitimate for a label, never for a feature):

      barrier_hit     'up_100' | 'down_80' | 'neither'
      still_listed    True when the series demonstrably traded to the horizon end (or beyond the
                      window); False when it goes dark > `delist_grace_days` before `data_end` while
                      the window was still open (delisting proxy); None when the window is simply not
                      yet mature (caller must drop the row - an immature label is not a label).
      liquidity_grew  20-day average dollar volume at the window end >= at entry (durable emergence,
                      not a transient spike). None when not computable.
      max_fwd_return  diagnostic: max close-to-close return inside the window, pct.
      fwd_bars        how many forward bars the window actually observed.
    """
    from .dataset import first_touch_barrier

    if idx < 0 or idx >= len(bars) or not bars[idx].close:
        return None
    entry = bars[idx].close
    fwd = [b.close for b in bars[idx + 1: idx + 1 + horizon] if b.close]
    if not fwd:
        return None
    barrier = first_touch_barrier(fwd, entry_price=entry, up_pct=up_pct, down_pct=down_pct, horizon=horizon)

    end = data_end or (bars[-1].day if bars else None)
    window_complete = len(fwd) >= horizon
    still_listed: Optional[bool]
    if window_complete:
        still_listed = True
    else:
        last_day = bars[min(idx + len(fwd), len(bars) - 1)].day
        went_dark = end is not None and (
            (date.fromisoformat(end) - date.fromisoformat(last_day)).days > delist_grace_days
        )
        if went_dark:
            still_listed = False  # traded, then vanished long before the data ends: delisting proxy
        elif barrier == "neither":
            return {"barrier_hit": "neither", "still_listed": None, "liquidity_grew": None,
                    "max_fwd_return": None, "fwd_bars": len(fwd), "immature": True}
        else:
            still_listed = None  # barrier resolved early; listing state at horizon unknown but label final

    liquidity_grew: Optional[bool] = None
    if window_complete:
        j = idx + horizon
        entry_recent = [b for b in bars[max(0, idx - 19): idx + 1] if b.close and b.volume]
        end_recent = [b for b in bars[max(0, j - 19): j + 1] if b.close and b.volume]
        if entry_recent and end_recent:
            adv_entry = statistics.mean(b.close * b.volume for b in entry_recent)
            adv_end = statistics.mean(b.close * b.volume for b in end_recent)
            if adv_entry > 0:
                liquidity_grew = adv_end >= adv_entry

    max_ret = max((p / entry - 1.0) * 100.0 for p in fwd) if entry > 0 else None
    return {
        "barrier_hit": barrier,
        "still_listed": still_listed,
        "liquidity_grew": liquidity_grew,
        "max_fwd_return": None if max_ret is None else round(max_ret, 2),
        "fwd_bars": len(fwd),
        "immature": False,
    }


# --------------------------------------------------------------------------------------------------
# Convenience: bars -> Candle list for the scanner's indicator maths
# --------------------------------------------------------------------------------------------------

def bars_to_candles(symbol: str, bars: list[DailyBar]):
    """DailyBars -> the scanner's Candle shape so `calculate_indicators` runs unchanged (causal maths:
    snapshot i uses only bars <= i, verified by the indicator implementation's rolling/shift-only ops)."""
    from ..stock_scanner.models import Candle

    out = []
    for b in bars:
        out.append(Candle(
            symbol=symbol,
            timeframe="1d",
            candle_time=datetime.fromisoformat(b.day + "T00:00:00+00:00"),
            open=b.open, high=b.high, low=b.low, close=b.close,
            adjusted_close=b.close, volume=b.volume, source="history",
        ))
    return out


def price_cache_fetch_date(symbol: str, cache_dir: str) -> Optional[str]:
    """ISO date of when this symbol's price series was actually fetched. The delisting proxy must
    compare a series' last bar against ITS OWN observation time - comparing against the freshest
    symbol's data end brands every stale cache entry a delisting (false ruin labels)."""
    path = os.path.join(cache_dir, "prices", f"{symbol.upper()}.json")
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        return str(data.get("fetched_at", ""))[:10] or None
    except Exception:  # noqa: BLE001 - no cache, no date
        return None


def polite_sleep(seconds: float = 0.12) -> None:
    """Rate-limit courtesy for bulk fetch loops (SEC fair-use asks < 10 req/s)."""
    time.sleep(seconds)
