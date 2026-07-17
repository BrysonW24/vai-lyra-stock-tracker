"""
Component-efficacy ledger (#2 of the accumulator wave): the deterministic engine's
evidence base for retuning.

Scoring never reads outcomes - by doctrine the engine stays static and explainable. What
was missing is the LEDGER between them: which score components actually predicted the
outcomes we later labeled. This pass joins signal_outcomes (forward returns at 5d/20d)
to stock_signal_scores (per-component values at signal time) and REBUILDS
component_efficacy: per (strategy, component, band, horizon) -> n, win_rate, avg_return.

Full rebuild every night, never incremental - idempotent, no drift, no double-count.
Humans (via /signal-quality) read the ledger and retune with evidence; the ledger never
touches a weight itself. All counts and ratios, no model opinion.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from workers.stock_scanner.supabase_repo import SupabaseRepository

logger = logging.getLogger(__name__)

COMPONENTS = ("rsi", "macd", "price_location", "trend", "volume")
HORIZONS = {"5d": "return_5d", "20d": "return_20d"}
# Rebuild reads capped windows - large enough for years of nightly signals, small enough
# to stay a single pass. Hitting a cap logs loudly (no silent truncation - HARNESS rule).
MAX_ROWS = 20000


def band_of(value: float, lo: float, hi: float) -> str:
    """Deterministic tercile band from the observed value range of a component."""
    if hi <= lo:
        return "mid"
    third = (hi - lo) / 3.0
    if value < lo + third:
        return "low"
    if value < lo + 2 * third:
        return "mid"
    return "high"


def build_efficacy_rows(outcomes: list[dict], scores: list[dict]) -> list[dict[str, Any]]:
    """Pure join + aggregate: (strategy, component, band, horizon) -> n/win_rate/avg."""
    by_key: dict[tuple[str, str], dict] = {}
    for s in scores:
        key = (str(s.get("symbol")), str(s.get("candle_time")))
        by_key[key] = s

    # Observed value range per (strategy, component) for deterministic banding.
    ranges: dict[tuple[str, str], tuple[float, float]] = {}
    joined: list[tuple[str, dict, dict]] = []
    for o in outcomes:
        s = by_key.get((str(o.get("symbol")), str(o.get("signal_candle_time"))))
        if not s:
            continue
        strategy = str(s.get("strategy_code") or "momentum_recovery_v1")
        joined.append((strategy, o, s))
        for comp in COMPONENTS:
            v = s.get(f"{comp}_score")
            if v is None:
                continue
            v = float(v)
            lo, hi = ranges.get((strategy, comp), (v, v))
            ranges[(strategy, comp)] = (min(lo, v), max(hi, v))

    agg: dict[tuple[str, str, str, str], list[float]] = {}
    for strategy, o, s in joined:
        for comp in COMPONENTS:
            v = s.get(f"{comp}_score")
            if v is None:
                continue
            lo, hi = ranges[(strategy, comp)]
            band = band_of(float(v), lo, hi)
            for horizon, col in HORIZONS.items():
                ret = o.get(col)
                if ret is None:
                    continue
                agg.setdefault((strategy, comp, band, horizon), []).append(float(ret))

    now = datetime.now(tz=timezone.utc).isoformat()
    rows: list[dict[str, Any]] = []
    for (strategy, comp, band, horizon), returns in sorted(agg.items()):
        rows.append(
            {
                "strategy_code": strategy,
                "component": comp,
                "band": band,
                "horizon": horizon,
                "n": len(returns),
                "win_rate": round(sum(1 for r in returns if r > 0) / len(returns), 4),
                "avg_return": round(sum(returns) / len(returns), 4),
                "updated_at": now,
            }
        )
    return rows


def rebuild_component_efficacy(repo: SupabaseRepository) -> int:
    """Fetch, rebuild, upsert. Returns rows written; 0 on any failure (logged, non-fatal
    for the nightly - a lost rebuild self-heals tomorrow because it is a full rebuild)."""
    try:
        outcomes = (
            repo.client.table("signal_outcomes")
            .select("symbol, signal_candle_time, return_5d, return_20d")
            .limit(MAX_ROWS)
            .execute()
        ).data or []
        scores = (
            repo.client.table("stock_signal_scores")
            .select("symbol, candle_time, strategy_code, rsi_score, macd_score, price_location_score, trend_score, volume_score")
            .limit(MAX_ROWS)
            .execute()
        ).data or []
        if len(outcomes) >= MAX_ROWS or len(scores) >= MAX_ROWS:
            logger.error(
                "efficacy rebuild SATURATED a read cap (%d) - aggregates now under-count; raise MAX_ROWS",
                MAX_ROWS,
            )
        rows = build_efficacy_rows(outcomes, scores)
        if rows:
            repo.client.table("component_efficacy").upsert(
                rows, on_conflict="strategy_code,component,band,horizon"
            ).execute()
        logger.info(
            "component efficacy rebuilt: %d aggregate rows from %d outcomes x %d scores",
            len(rows), len(outcomes), len(scores),
        )
        return len(rows)
    except Exception as exc:  # noqa: BLE001 - the ledger must never block outcome labeling
        logger.error("component efficacy rebuild failed: %s", exc)
        return 0
