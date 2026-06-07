from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from workers.stock_scanner.models import Candle


@dataclass(frozen=True)
class OutcomeResult:
    """Computed forward returns for a single signal."""
    symbol: str
    signal_candle_time: datetime
    signal_type: str
    signal_status: str
    signal_score: float
    return_1d: float | None
    return_5d: float | None
    return_20d: float | None
    return_60d: float | None
    max_upside_pct: float | None
    max_drawdown_pct: float | None
    sample_horizon_bars: dict[str, int]

    def to_record(self) -> dict[str, Any]:
        """Convert to database record."""
        return {
            "symbol": self.symbol,
            "signal_candle_time": self.signal_candle_time.isoformat(),
            "signal_type": self.signal_type,
            "signal_status": self.signal_status,
            "signal_score": self.signal_score,
            "return_1d": self.return_1d,
            "return_5d": self.return_5d,
            "return_20d": self.return_20d,
            "return_60d": self.return_60d,
            "max_upside_pct": self.max_upside_pct,
            "max_drawdown_pct": self.max_drawdown_pct,
            "sample_horizon_bars": self.sample_horizon_bars,
        }


@dataclass(frozen=True)
class OutcomeDistribution:
    """Aggregated outcome statistics for a signal type/status combo."""
    signal_type: str
    signal_status: str
    sample_size: int
    return_1d_median: float | None
    return_5d_median: float | None
    return_20d_median: float | None
    return_60d_median: float | None
    return_1d_win_rate: float  # % positive at horizon
    return_5d_win_rate: float
    return_20d_win_rate: float
    return_60d_win_rate: float
    max_upside_median: float | None
    worst_drawdown_min: float | None


def _compute_forward_returns(
    entry_price: float,
    candles_after: list[Candle],
    horizons_bars: dict[str, int],
) -> tuple[dict[str, float | None], float | None, float | None]:
    """
    Pure function: given entry price and subsequent candles, compute forward returns.

    Horizons:
      - 1d: ~7 hourly bars (or 1 daily candle equivalent)
      - 5d: ~35 hourly bars
      - 20d: ~140 hourly bars (monthly)
      - 60d: ~420 hourly bars (quarterly)

    Returns:
      - returns: dict of horizon -> % return from entry_price at horizon boundary (or final if fewer bars)
      - max_upside: max % gain reached
      - max_drawdown: worst % loss reached
    """
    returns = {
        "return_1d": None,
        "return_5d": None,
        "return_20d": None,
        "return_60d": None,
    }

    if not candles_after or entry_price <= 0:
        return returns, None, None

    # Sort by time to ensure correct order
    sorted_candles = sorted(candles_after, key=lambda c: c.candle_time)

    max_price = entry_price
    min_price = entry_price
    max_upside = 0.0
    max_drawdown = 0.0

    # Track returns at specific horizons; only capture at horizon boundaries
    horizon_1d_bars = horizons_bars.get("1d", 7)
    horizon_5d_bars = horizons_bars.get("5d", 35)
    horizon_20d_bars = horizons_bars.get("20d", 140)
    horizon_60d_bars = horizons_bars.get("60d", 420)

    # Iterate through candles and compute returns at each horizon boundary
    for i, candle in enumerate(sorted_candles):
        if candle.close is None:
            continue

        close = float(candle.close)
        max_price = max(max_price, close)
        min_price = min(min_price, close)

        pct_return = ((close - entry_price) / entry_price) * 100
        max_upside = max(max_upside, pct_return)
        min_drawdown = min(pct_return - (max_upside if max_upside > 0 else 0), 0)
        max_drawdown = min(max_drawdown, min_drawdown)

        # Capture return AT horizon boundary (1-indexed bar count)
        bar_count = i + 1

        if bar_count == horizon_1d_bars:
            returns["return_1d"] = pct_return
        if bar_count == horizon_5d_bars:
            returns["return_5d"] = pct_return
        if bar_count == horizon_20d_bars:
            returns["return_20d"] = pct_return
        if bar_count == horizon_60d_bars:
            returns["return_60d"] = pct_return

    # If we have fewer bars than horizon, use the final available bar
    if sorted_candles:
        last_close = sorted_candles[-1].close
        if last_close is not None:
            final_return = ((float(last_close) - entry_price) / entry_price) * 100
            if returns["return_1d"] is None:
                returns["return_1d"] = final_return
            if returns["return_5d"] is None:
                returns["return_5d"] = final_return
            if returns["return_20d"] is None:
                returns["return_20d"] = final_return
            if returns["return_60d"] is None:
                returns["return_60d"] = final_return

    max_upside_pct = ((max_price - entry_price) / entry_price) * 100 if max_price > entry_price else 0.0
    max_drawdown_pct = ((min_price - entry_price) / entry_price) * 100 if min_price < entry_price else 0.0

    return returns, max_upside_pct, max_drawdown_pct


def compute_outcome(
    symbol: str,
    signal_candle_time: datetime,
    signal_type: str,
    signal_status: str,
    signal_score: float,
    entry_price: float,
    candles_after: list[Candle],
    horizons_bars: dict[str, int] | None = None,
) -> OutcomeResult:
    """
    Deterministic outcome computation for a single signal.

    Args:
        symbol: stock ticker
        signal_candle_time: when the signal occurred
        signal_type: e.g. "momentum_recovery_v1"
        signal_status: e.g. "strong_setup"
        signal_score: numeric score at signal time
        entry_price: price at signal_candle_time (close)
        candles_after: list of subsequent 1h candles to measure returns against
        horizons_bars: horizon bar counts (default: 1d=7, 5d=35, 20d=140, 60d=420)

    Returns:
        OutcomeResult with computed forward returns and drawdown metrics.
    """
    if horizons_bars is None:
        horizons_bars = {"1d": 7, "5d": 35, "20d": 140, "60d": 420}

    returns, max_upside, max_drawdown = _compute_forward_returns(entry_price, candles_after, horizons_bars)

    return OutcomeResult(
        symbol=symbol,
        signal_candle_time=signal_candle_time,
        signal_type=signal_type,
        signal_status=signal_status,
        signal_score=signal_score,
        return_1d=returns["return_1d"],
        return_5d=returns["return_5d"],
        return_20d=returns["return_20d"],
        return_60d=returns["return_60d"],
        max_upside_pct=max_upside,
        max_drawdown_pct=max_drawdown,
        sample_horizon_bars=horizons_bars,
    )


def aggregate_outcomes(
    outcomes: list[OutcomeResult],
) -> dict[str, OutcomeDistribution]:
    """
    Pure function: aggregate outcomes by (signal_type, signal_status).

    Args:
        outcomes: list of computed OutcomeResult from multiple signals

    Returns:
        dict mapping "signal_type|signal_status" -> OutcomeDistribution with
        medians, win rates, and worst case metrics.
    """
    # Group by (signal_type, signal_status)
    groups: dict[str, list[OutcomeResult]] = {}
    for outcome in outcomes:
        key = f"{outcome.signal_type}|{outcome.signal_status}"
        if key not in groups:
            groups[key] = []
        groups[key].append(outcome)

    distributions: dict[str, OutcomeDistribution] = {}

    for key, group_outcomes in groups.items():
        signal_type, signal_status = key.split("|")
        n = len(group_outcomes)

        if n == 0:
            continue

        # Collect returns (filter None)
        returns_1d = [o.return_1d for o in group_outcomes if o.return_1d is not None]
        returns_5d = [o.return_5d for o in group_outcomes if o.return_5d is not None]
        returns_20d = [o.return_20d for o in group_outcomes if o.return_20d is not None]
        returns_60d = [o.return_60d for o in group_outcomes if o.return_60d is not None]
        max_upsides = [o.max_upside_pct for o in group_outcomes if o.max_upside_pct is not None]
        max_drawdowns = [o.max_drawdown_pct for o in group_outcomes if o.max_drawdown_pct is not None]

        # Compute medians
        def median(values: list[float]) -> float | None:
            if not values:
                return None
            sorted_vals = sorted(values)
            mid = len(sorted_vals) // 2
            if len(sorted_vals) % 2 == 0:
                return (sorted_vals[mid - 1] + sorted_vals[mid]) / 2.0
            return float(sorted_vals[mid])

        # Compute win rates (% with positive return)
        def win_rate(values: list[float]) -> float:
            if not values:
                return 0.0
            wins = sum(1 for v in values if v >= 0)
            return (wins / len(values)) * 100

        distributions[key] = OutcomeDistribution(
            signal_type=signal_type,
            signal_status=signal_status,
            sample_size=n,
            return_1d_median=median(returns_1d),
            return_5d_median=median(returns_5d),
            return_20d_median=median(returns_20d),
            return_60d_median=median(returns_60d),
            return_1d_win_rate=win_rate(returns_1d),
            return_5d_win_rate=win_rate(returns_5d),
            return_20d_win_rate=win_rate(returns_20d),
            return_60d_win_rate=win_rate(returns_60d),
            max_upside_median=median(max_upsides),
            worst_drawdown_min=min(max_drawdowns) if max_drawdowns else None,
        )

    return distributions
