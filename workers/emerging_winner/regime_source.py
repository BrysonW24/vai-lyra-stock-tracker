"""
Market-regime source for the NARRATIVE domain - deterministic, causal, free.

The narrative domain reads `market_context.regime` ("risk_on" | "neutral" | "risk_off") and has been
honestly unavailable since the engine shipped: nothing supplied a regime. This source derives it
from a benchmark index's own daily series with two trailing measures any chart reader would accept:

    trend     close vs its 200-day simple moving average
    drawdown  close vs its trailing 252-day high

    risk_on   above trend AND drawdown better than -10%
    risk_off  below trend AND drawdown worse than -15%
    neutral   everything between

Causal by construction (both measures are trailing), so the SAME function serves the live scan and
any historical score date in the backtest corpus - no separate "as of" variant needed. Pure maths
here; the one network touch (fetching benchmark bars) reuses the existing price machinery.
"""
from __future__ import annotations

from typing import Optional

BENCHMARK_SYMBOL = "SPY"  # the broad-market proxy; free daily history everywhere
TREND_WINDOW = 200
HIGH_WINDOW = 252
RISK_ON_MAX_DRAWDOWN = -0.10
RISK_OFF_MIN_DRAWDOWN = -0.15

RISK_ON, NEUTRAL, RISK_OFF = "risk_on", "neutral", "risk_off"


def regime_at(closes: list[float], idx: int) -> Optional[str]:
    """Pure: the regime at bar `idx` using ONLY closes[:idx+1]. None when history is too thin to
    call a trend (absent beats a guessed regime)."""
    if idx < TREND_WINDOW - 1 or idx >= len(closes):
        return None
    window = closes[max(0, idx - TREND_WINDOW + 1): idx + 1]
    sma = sum(window) / len(window)
    high = max(closes[max(0, idx - HIGH_WINDOW + 1): idx + 1])
    close = closes[idx]
    if not sma or not high or close <= 0:
        return None
    drawdown = close / high - 1.0
    above_trend = close >= sma
    if above_trend and drawdown >= RISK_ON_MAX_DRAWDOWN:
        return RISK_ON
    if not above_trend and drawdown <= RISK_OFF_MIN_DRAWDOWN:
        return RISK_OFF
    return NEUTRAL


def regime_by_date(bars) -> dict[str, str]:
    """{iso_date: regime} for a benchmark DailyBar series - precomputed once, then any score date T
    looks up the last benchmark day <= T. Thin early history simply has no entry (honest absence)."""
    closes = [b.close for b in bars]
    out: dict[str, str] = {}
    for i, b in enumerate(bars):
        r = regime_at(closes, i)
        if r is not None:
            out[b.day] = r
    return out


def regime_for_day(by_date: dict[str, str], day: str, *, max_gap_days: int = 7) -> Optional[str]:
    """The regime as of `day`: the latest benchmark reading on or before it, within a small gap."""
    import datetime as _dt

    if day in by_date:
        return by_date[day]
    try:
        d = _dt.date.fromisoformat(day)
    except ValueError:
        return None
    for back in range(1, max_gap_days + 1):
        key = (d - _dt.timedelta(days=back)).isoformat()
        if key in by_date:
            return by_date[key]
    return None


def current_regime(provider=None) -> Optional[dict]:
    """Live helper for the worker: today's regime as the market_context dict the narrative domain
    reads, or None when the benchmark series is unavailable (domain stays honestly unavailable).
    Network-touching - never called from the pure engine or CI."""
    from ..stock_scanner.market_data import create_provider

    provider = provider or create_provider("yfinance")
    candles = provider.fetch_ohlcv(BENCHMARK_SYMBOL, "1d", HIGH_WINDOW + TREND_WINDOW + 80)
    closes = [c.close for c in candles if c.close]
    if len(closes) < TREND_WINDOW:
        return None
    regime = regime_at(closes, len(closes) - 1)
    if regime is None:
        return None
    return {"regime": regime, "source": f"{BENCHMARK_SYMBOL} trend/drawdown", "benchmark": BENCHMARK_SYMBOL}
