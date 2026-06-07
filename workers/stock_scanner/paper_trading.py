"""
Deterministic paper trading ledger for hypothetical position tracking.

RESEARCH SOFTWARE ONLY. This is a simulation ledger with no broker integration,
no real money, no actual orders. Paper trades are hypothetical records only.
This module does NOT place real orders or connect to any financial institution.

A paper trade simulates a hypothetical buy/sell transaction with price,
quantity, entry/exit timing, and P/L calculation. The ledger tracks open
and closed positions, computes portfolio equity, and stores transaction history.

All computation is pure and deterministic over passed-in data structures.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass(frozen=True)
class PaperTrade:
    """A single hypothetical paper trade record."""

    id: str
    symbol: str
    opened_at: datetime
    entry_price: float
    quantity: int
    stop_price: float | None
    target_price: float | None
    closed_at: datetime | None
    exit_price: float | None
    exit_reason: str | None
    realised_pl: float | None
    realised_pl_pct: float | None
    status: str
    notes: str | None

    def to_record(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "symbol": self.symbol,
            "opened_at": self.opened_at.isoformat(),
            "entry_price": self.entry_price,
            "quantity": self.quantity,
            "stop_price": self.stop_price,
            "target_price": self.target_price,
            "closed_at": self.closed_at.isoformat() if self.closed_at else None,
            "exit_price": self.exit_price,
            "exit_reason": self.exit_reason,
            "realised_pl": self.realised_pl,
            "realised_pl_pct": self.realised_pl_pct,
            "status": self.status,
            "notes": self.notes,
        }


@dataclass(frozen=True)
class PortfolioState:
    """Snapshot of total portfolio P/L and position state."""

    initial_capital: float
    current_equity: float
    realised_pl: float
    unrealised_pl: float
    total_pl: float
    total_pl_pct: float
    open_positions_count: int
    closed_trades_count: int
    open_trades: list[PaperTrade]
    closed_trades: list[PaperTrade]

    def to_record(self) -> dict[str, Any]:
        return {
            "initial_capital": self.initial_capital,
            "current_equity": self.current_equity,
            "realised_pl": self.realised_pl,
            "unrealised_pl": self.unrealised_pl,
            "total_pl": self.total_pl,
            "total_pl_pct": self.total_pl_pct,
            "open_positions_count": self.open_positions_count,
            "closed_trades_count": self.closed_trades_count,
        }


def open_paper_trade(
    trade_id: str,
    symbol: str,
    opened_at: datetime,
    entry_price: float,
    quantity: int,
    stop_price: float | None = None,
    target_price: float | None = None,
    notes: str | None = None,
) -> PaperTrade:
    """
    Create a new open paper trade.

    Args:
        trade_id: Unique identifier for this trade.
        symbol: Stock ticker symbol (e.g., "AAPL").
        opened_at: Timestamp when position was opened.
        entry_price: Price at which the position was entered.
        quantity: Number of shares in the position.
        stop_price: Optional stop-loss price.
        target_price: Optional take-profit target price.
        notes: Optional notes about the trade.

    Returns:
        A PaperTrade with status='open' and no exit data.
    """
    return PaperTrade(
        id=trade_id,
        symbol=symbol,
        opened_at=opened_at,
        entry_price=entry_price,
        quantity=quantity,
        stop_price=stop_price,
        target_price=target_price,
        closed_at=None,
        exit_price=None,
        exit_reason=None,
        realised_pl=None,
        realised_pl_pct=None,
        status="open",
        notes=notes,
    )


def close_paper_trade(
    trade: PaperTrade,
    closed_at: datetime,
    exit_price: float,
    exit_reason: str = "manual",
) -> PaperTrade:
    """
    Close an open paper trade and compute realized P/L.

    Args:
        trade: The open PaperTrade to close.
        closed_at: Timestamp when the position was closed.
        exit_price: Price at which the position was exited.
        exit_reason: Human-readable reason for exit
                     (e.g., "stop_loss", "take_profit", "signal_exit").

    Returns:
        A new PaperTrade with status='closed' and P/L computed.
    """
    pl = (exit_price - trade.entry_price) * trade.quantity
    pl_pct = ((exit_price - trade.entry_price) / trade.entry_price) * 100

    return PaperTrade(
        id=trade.id,
        symbol=trade.symbol,
        opened_at=trade.opened_at,
        entry_price=trade.entry_price,
        quantity=trade.quantity,
        stop_price=trade.stop_price,
        target_price=trade.target_price,
        closed_at=closed_at,
        exit_price=exit_price,
        exit_reason=exit_reason,
        realised_pl=pl,
        realised_pl_pct=pl_pct,
        status="closed",
        notes=trade.notes,
    )


def portfolio_state(
    trades: list[PaperTrade],
    current_prices: dict[str, float],
    initial_capital: float = 100000.0,
) -> PortfolioState:
    """
    Compute aggregate portfolio state from a list of trades.

    Args:
        trades: List of PaperTrade objects (open and closed).
        current_prices: Dict of {symbol: current_price} for unrealized P/L calc.
        initial_capital: Starting capital for portfolio (default 100k).

    Returns:
        PortfolioState with totals, equity, and position counts.

    Notes:
        - Realised P/L comes from closed trades only.
        - Unrealised P/L is computed from open positions at current_prices.
        - Total equity = initial_capital + realised_pl + unrealised_pl.
    """
    open_trades = [t for t in trades if t.status == "open"]
    closed_trades = [t for t in trades if t.status == "closed"]

    realised_pl = sum(
        t.realised_pl for t in closed_trades if t.realised_pl is not None
    )

    unrealised_pl = 0.0
    for trade in open_trades:
        current_price = current_prices.get(trade.symbol, trade.entry_price)
        unrealised_pl += (current_price - trade.entry_price) * trade.quantity

    total_pl = realised_pl + unrealised_pl
    current_equity = initial_capital + total_pl
    total_pl_pct = (total_pl / initial_capital) * 100 if initial_capital > 0 else 0.0

    return PortfolioState(
        initial_capital=initial_capital,
        current_equity=current_equity,
        realised_pl=realised_pl,
        unrealised_pl=unrealised_pl,
        total_pl=total_pl,
        total_pl_pct=total_pl_pct,
        open_positions_count=len(open_trades),
        closed_trades_count=len(closed_trades),
        open_trades=open_trades,
        closed_trades=closed_trades,
    )
