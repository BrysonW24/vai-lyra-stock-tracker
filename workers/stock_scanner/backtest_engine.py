"""
Deterministic backtest engine for strategy evaluation.

RESEARCH SOFTWARE ONLY. No broker integration, no real orders, no live trading.
All backtests are hypothetical and do not constitute trading advice.

This module replays historical signals against candle data and simulates
trade execution with deterministic entry/exit logic, computing performance
metrics (win rate, drawdown, profit factor, etc.) for research purposes.

Assumptions:
  - Entry: Assumes next candle open after signal trigger (realistic delay).
  - Exit: Occurs at horizon candles, stop loss, target price, or when signal
    is invalidated. Earliest condition wins.
  - Slippage: 0 unless explicitly modeled.
  - Commissions: 0 unless explicitly modeled.
  - Position size: Fixed quantity per entry (configurable per strategy).
  - Data quality: Assumes clean, chronologically sorted OHLCV data.

All computation is pure and deterministic; no randomness or network I/O.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Callable


@dataclass(frozen=True)
class BacktestTrade:
    """A single hypothetical trade outcome."""

    sequence_num: int
    symbol: str
    entry_signal_time: datetime
    entry_time: datetime
    entry_price: float
    quantity: int
    exit_signal_time: datetime | None
    exit_time: datetime | None
    exit_price: float | None
    exit_reason: str
    realised_pl: float | None
    realised_pl_pct: float | None
    bars_held: int | None

    def to_record(self) -> dict[str, Any]:
        return {
            "sequence_num": self.sequence_num,
            "symbol": self.symbol,
            "entry_signal_time": self.entry_signal_time.isoformat(),
            "entry_time": self.entry_time.isoformat(),
            "entry_price": self.entry_price,
            "quantity": self.quantity,
            "exit_signal_time": self.exit_signal_time.isoformat() if self.exit_signal_time else None,
            "exit_time": self.exit_time.isoformat() if self.exit_time else None,
            "exit_price": self.exit_price,
            "exit_reason": self.exit_reason,
            "realised_pl": self.realised_pl,
            "realised_pl_pct": self.realised_pl_pct,
            "bars_held": self.bars_held,
        }


@dataclass(frozen=True)
class BacktestResults:
    """Aggregate performance metrics from a backtest run."""

    symbol: str
    win_rate: float
    win_count: int
    loss_count: int
    avg_return: float | None
    median_return: float | None
    max_return: float | None
    min_return: float | None
    max_drawdown: float
    profit_factor: float
    expectancy: float | None
    sample_size: int
    trades: list[BacktestTrade]

    def to_record(self) -> dict[str, Any]:
        return {
            "symbol": self.symbol,
            "win_rate": self.win_rate,
            "win_count": self.win_count,
            "loss_count": self.loss_count,
            "avg_return": self.avg_return,
            "median_return": self.median_return,
            "max_return": self.max_return,
            "min_return": self.min_return,
            "max_drawdown": self.max_drawdown,
            "profit_factor": self.profit_factor,
            "expectancy": self.expectancy,
            "sample_size": self.sample_size,
        }


def _compute_max_drawdown(equity_curve: list[float]) -> float:
    """
    Compute max drawdown from an equity curve.

    Args:
        equity_curve: List of cumulative equity values over time.

    Returns:
        Max drawdown as a percentage (0-100), or 0 if no decline.
    """
    if not equity_curve or len(equity_curve) < 2:
        return 0.0

    max_dd = 0.0
    peak = equity_curve[0]

    for value in equity_curve[1:]:
        if value < peak:
            dd = ((peak - value) / peak) * 100
            max_dd = max(max_dd, dd)
        peak = max(peak, value)

    return max_dd


def _median(values: list[float]) -> float | None:
    """Compute median of a list of floats."""
    if not values:
        return None
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    if n % 2 == 1:
        return sorted_vals[n // 2]
    return (sorted_vals[n // 2 - 1] + sorted_vals[n // 2]) / 2


def run_backtest(
    symbol: str,
    signals: list[tuple[datetime, str]],
    candles: dict[datetime, tuple[float, float, float, float]],
    entry_rule: Callable[[str], bool],
    exit_rule: Callable[[str, float], bool] | None = None,
    horizon_bars: int = 10,
    quantity: int = 100,
    stop_loss_pct: float | None = None,
    take_profit_pct: float | None = None,
) -> BacktestResults:
    """
    Run a deterministic backtest over historical signals and candles.

    Args:
        symbol: Stock ticker symbol.
        signals: List of (signal_time, signal_status) tuples, sorted by time.
        candles: Dict of {candle_time: (open, high, low, close)}.
        entry_rule: Callable(signal_status) -> bool. Returns True if signal
                    triggers a buy entry.
        exit_rule: Optional callable(signal_status, current_price) -> bool.
                   Returns True if position should close.
        horizon_bars: Number of candles to hold before forced exit.
        quantity: Fixed shares per entry trade.
        stop_loss_pct: Stop loss threshold as percentage below entry.
                       E.g., 2.0 = exit if price falls 2% below entry.
        take_profit_pct: Take profit threshold as percentage above entry.
                         E.g., 5.0 = exit if price rises 5% above entry.

    Returns:
        BacktestResults with trade list and aggregate metrics.

    Assumptions:
        - Entry occurs at the OPEN of the candle AFTER signal trigger.
        - Candles must be chronologically sorted.
        - Slippage and commissions are 0.
        - Data quality is clean (no NaNs in OHLCV).
    """

    if not signals or not candles:
        return BacktestResults(
            symbol=symbol,
            win_rate=0.0,
            win_count=0,
            loss_count=0,
            avg_return=None,
            median_return=None,
            max_return=None,
            min_return=None,
            max_drawdown=0.0,
            profit_factor=0.0,
            expectancy=None,
            sample_size=0,
            trades=[],
        )

    sorted_signals = sorted(signals, key=lambda x: x[0])
    sorted_candles = sorted(candles.items())

    trades: list[BacktestTrade] = []
    equity_curve = [1.0]
    cumulative_pl = 0.0

    open_position: tuple[int, datetime, float, int] | None = None
    signal_idx = 0

    for i, (candle_time, (open_price, high, low, close)) in enumerate(sorted_candles):
        if open_position is None and signal_idx < len(sorted_signals):
            signal_time, signal_status = sorted_signals[signal_idx]
            if candle_time > signal_time and entry_rule(signal_status):
                open_position = (quantity, signal_time, open_price, i)
                signal_idx += 1

        if open_position is not None:
            qty, entry_time, entry_price, entry_bar_idx = open_position
            bars_held = i - entry_bar_idx

            exit_price_val: float | None = None
            exit_reason = ""

            if stop_loss_pct is not None:
                stop_loss_price = entry_price * (1 - stop_loss_pct / 100)
                if low <= stop_loss_price:
                    exit_price_val = stop_loss_price
                    exit_reason = "stop_loss"

            if take_profit_pct is not None and exit_price_val is None:
                take_profit_price = entry_price * (1 + take_profit_pct / 100)
                if high >= take_profit_price:
                    exit_price_val = take_profit_price
                    exit_reason = "take_profit"

            if exit_rule and exit_price_val is None:
                next_signal_idx = signal_idx
                while next_signal_idx < len(sorted_signals):
                    next_sig_time, next_sig_status = sorted_signals[next_signal_idx]
                    if next_sig_time <= candle_time:
                        if exit_rule(next_sig_status, close):
                            exit_price_val = close
                            exit_reason = "signal_exit"
                            break
                    next_signal_idx += 1

            if bars_held >= horizon_bars and exit_price_val is None:
                exit_price_val = close
                exit_reason = "horizon_exit"

            if exit_price_val is not None:
                pl = (exit_price_val - entry_price) * qty
                pl_pct = ((exit_price_val - entry_price) / entry_price) * 100
                cumulative_pl += pl

                trade = BacktestTrade(
                    sequence_num=len(trades) + 1,
                    symbol=symbol,
                    entry_signal_time=entry_time,
                    entry_time=candle_time,
                    entry_price=entry_price,
                    quantity=qty,
                    exit_signal_time=candle_time,
                    exit_time=candle_time,
                    exit_price=exit_price_val,
                    exit_reason=exit_reason,
                    realised_pl=pl,
                    realised_pl_pct=pl_pct,
                    bars_held=bars_held,
                )
                trades.append(trade)
                equity_curve.append(1.0 + (cumulative_pl / (entry_price * qty)))
                open_position = None

    if not trades:
        return BacktestResults(
            symbol=symbol,
            win_rate=0.0,
            win_count=0,
            loss_count=0,
            avg_return=None,
            median_return=None,
            max_return=None,
            min_return=None,
            max_drawdown=0.0,
            profit_factor=0.0,
            expectancy=None,
            sample_size=0,
            trades=[],
        )

    returns = [t.realised_pl_pct for t in trades if t.realised_pl_pct is not None]
    wins = [r for r in returns if r > 0]
    losses = [abs(r) for r in returns if r < 0]

    win_rate = (len(wins) / len(returns)) * 100 if returns else 0.0
    avg_return = sum(returns) / len(returns) if returns else None
    median_return = _median(returns) if returns else None
    max_return = max(returns) if returns else None
    min_return = min(returns) if returns else None

    gross_profit = sum(w for w in wins) if wins else 0.0
    gross_loss = sum(losses) if losses else 0.0
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else (1.0 if gross_profit > 0 else 0.0)

    expectancy = avg_return if avg_return is not None else None

    max_dd = _compute_max_drawdown(equity_curve)

    return BacktestResults(
        symbol=symbol,
        win_rate=win_rate,
        win_count=len(wins),
        loss_count=len(losses),
        avg_return=avg_return,
        median_return=median_return,
        max_return=max_return,
        min_return=min_return,
        max_drawdown=max_dd,
        profit_factor=profit_factor,
        expectancy=expectancy,
        sample_size=len(trades),
        trades=trades,
    )
