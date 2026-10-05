"""Which candles a scan actually needs to WRITE.

The scanner fetches the full lookback (180 days of hourly bars) every run because the indicators
need it. It does not need to STORE it every run: between two scans only the newest bar or two are
new. Until 2026-10 the worker re-upserted the whole lookback for every ticker on every run - about
120,000 rows a run, 48 runs a day - and PostgREST echoed every row back. That echo alone was
~40 MB of response per run and it exhausted the Supabase free-tier egress quota: the project was
restricted (HTTP 402 `exceed_egress_quota`) from 2026-09-26 to 2026-09-30 and every scan failed.

The rule here is stateless - it needs nothing but the previous stored signal for the ticker:

  * no previous signal          -> first scan: write everything (backfill).
  * a new trading day began     -> write everything once (re-syncs split / dividend adjustments,
                                   which rewrite history upstream, across the whole lookback).
  * same trading day            -> write only the tail: every bar since the previous signal, plus a
                                   small overlap so a late upstream revision to a just-closed bar
                                   is still picked up.

A scanner outage of any length heals itself: the previous signal is then older than the newest
bar's trading day, so the next run takes the full-lookback path.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from workers.stock_scanner.models import Candle

# Bars re-written before the previous signal's bar. Hourly bars are occasionally revised (volume,
# mostly) shortly after they close; three bars of overlap covers that without re-sending history.
TAIL_OVERLAP_BARS = 3


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def previous_signal_time(previous_signal: dict[str, Any] | None) -> datetime | None:
    """The stored candle_time of the previous signal row, or None when there is none / it is unparseable."""
    if not previous_signal:
        return None
    raw = previous_signal.get("candle_time")
    if isinstance(raw, datetime):
        return _as_utc(raw)
    if not raw:
        return None
    try:
        return _as_utc(datetime.fromisoformat(str(raw).replace("Z", "+00:00")))
    except ValueError:
        return None


def candles_to_persist(
    candles: list[Candle],
    previous_time: datetime | None,
    overlap_bars: int = TAIL_OVERLAP_BARS,
) -> list[Candle]:
    """The slice of `candles` worth writing this run (see the module docstring for the rule)."""
    if not candles:
        return []
    ordered = sorted(candles, key=lambda candle: candle.candle_time)
    if previous_time is None:
        return ordered

    previous_utc = _as_utc(previous_time)
    latest_utc = _as_utc(ordered[-1].candle_time)
    if previous_utc.date() != latest_utc.date():
        return ordered

    first_since_previous = next(
        (index for index, candle in enumerate(ordered) if _as_utc(candle.candle_time) >= previous_utc),
        len(ordered),
    )
    return ordered[max(0, first_since_previous - max(0, overlap_bars)):]
