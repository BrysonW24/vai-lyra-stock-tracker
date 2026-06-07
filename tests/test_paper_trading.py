"""Tests for paper trading with synthetic fixtures."""

from datetime import datetime, timedelta, timezone

from workers.stock_scanner.paper_trading import (
    close_paper_trade,
    open_paper_trade,
    portfolio_state,
)


def test_open_paper_trade():
    """Test opening a new paper trade."""
    opened_at = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)
    trade = open_paper_trade(
        trade_id="trade_001",
        symbol="AAPL",
        opened_at=opened_at,
        entry_price=150.0,
        quantity=100,
        stop_price=145.0,
        target_price=160.0,
        notes="Test trade",
    )

    assert trade.id == "trade_001"
    assert trade.symbol == "AAPL"
    assert trade.entry_price == 150.0
    assert trade.quantity == 100
    assert trade.status == "open"
    assert trade.closed_at is None
    assert trade.exit_price is None
    assert trade.realised_pl is None


def test_close_paper_trade_profit():
    """Test closing a paper trade at a profit."""
    opened_at = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)
    closed_at = datetime(2026, 1, 1, 16, 0, tzinfo=timezone.utc)

    opened_trade = open_paper_trade(
        trade_id="trade_001",
        symbol="AAPL",
        opened_at=opened_at,
        entry_price=150.0,
        quantity=100,
    )

    closed_trade = close_paper_trade(
        opened_trade,
        closed_at=closed_at,
        exit_price=155.0,
        exit_reason="take_profit",
    )

    assert closed_trade.status == "closed"
    assert closed_trade.exit_price == 155.0
    assert closed_trade.exit_reason == "take_profit"
    assert closed_trade.realised_pl == 500.0
    assert closed_trade.realised_pl_pct == pytest.approx(3.33, rel=0.01)


def test_close_paper_trade_loss():
    """Test closing a paper trade at a loss."""
    opened_at = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)
    closed_at = datetime(2026, 1, 1, 16, 0, tzinfo=timezone.utc)

    opened_trade = open_paper_trade(
        trade_id="trade_001",
        symbol="AAPL",
        opened_at=opened_at,
        entry_price=150.0,
        quantity=100,
    )

    closed_trade = close_paper_trade(
        opened_trade,
        closed_at=closed_at,
        exit_price=145.0,
        exit_reason="stop_loss",
    )

    assert closed_trade.status == "closed"
    assert closed_trade.exit_price == 145.0
    assert closed_trade.exit_reason == "stop_loss"
    assert closed_trade.realised_pl == -500.0
    assert closed_trade.realised_pl_pct == pytest.approx(-3.33, rel=0.01)


def test_portfolio_state_empty():
    """Test portfolio state with no trades."""
    state = portfolio_state(
        trades=[],
        current_prices={},
        initial_capital=100000.0,
    )

    assert state.initial_capital == 100000.0
    assert state.current_equity == 100000.0
    assert state.realised_pl == 0.0
    assert state.unrealised_pl == 0.0
    assert state.total_pl == 0.0
    assert state.total_pl_pct == 0.0
    assert state.open_positions_count == 0
    assert state.closed_trades_count == 0


def test_portfolio_state_single_open_trade():
    """Test portfolio state with one open position."""
    opened_at = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)
    trade = open_paper_trade(
        trade_id="trade_001",
        symbol="AAPL",
        opened_at=opened_at,
        entry_price=150.0,
        quantity=100,
    )

    state = portfolio_state(
        trades=[trade],
        current_prices={"AAPL": 155.0},
        initial_capital=100000.0,
    )

    assert state.open_positions_count == 1
    assert state.closed_trades_count == 0
    assert state.realised_pl == 0.0
    assert state.unrealised_pl == 500.0
    assert state.total_pl == 500.0
    assert state.current_equity == 100500.0
    assert state.total_pl_pct == pytest.approx(0.5, rel=0.01)


def test_portfolio_state_single_closed_trade():
    """Test portfolio state with one closed trade."""
    opened_at = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)
    closed_at = datetime(2026, 1, 1, 16, 0, tzinfo=timezone.utc)

    opened_trade = open_paper_trade(
        trade_id="trade_001",
        symbol="AAPL",
        opened_at=opened_at,
        entry_price=150.0,
        quantity=100,
    )

    closed_trade = close_paper_trade(
        opened_trade,
        closed_at=closed_at,
        exit_price=160.0,
    )

    state = portfolio_state(
        trades=[closed_trade],
        current_prices={},
        initial_capital=100000.0,
    )

    assert state.closed_trades_count == 1
    assert state.open_positions_count == 0
    assert state.realised_pl == 1000.0
    assert state.unrealised_pl == 0.0
    assert state.total_pl == 1000.0
    assert state.current_equity == 101000.0
    assert state.total_pl_pct == pytest.approx(1.0, rel=0.01)


def test_portfolio_state_multiple_trades():
    """Test portfolio state with mixed open and closed trades."""
    opened_at = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)
    closed_at = datetime(2026, 1, 1, 16, 0, tzinfo=timezone.utc)

    closed_trade = close_paper_trade(
        open_paper_trade("trade_001", "AAPL", opened_at, 150.0, 100),
        closed_at=closed_at,
        exit_price=160.0,
    )

    open_trade = open_paper_trade(
        trade_id="trade_002",
        symbol="MSFT",
        opened_at=opened_at,
        entry_price=300.0,
        quantity=50,
    )

    state = portfolio_state(
        trades=[closed_trade, open_trade],
        current_prices={"MSFT": 310.0},
        initial_capital=100000.0,
    )

    assert state.closed_trades_count == 1
    assert state.open_positions_count == 1
    assert state.realised_pl == 1000.0
    assert state.unrealised_pl == 500.0
    assert state.total_pl == 1500.0
    assert state.current_equity == 101500.0
    assert state.total_pl_pct == pytest.approx(1.5, rel=0.01)


def test_portfolio_state_multiple_symbols():
    """Test portfolio with positions in multiple symbols."""
    opened_at = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)

    trades = [
        open_paper_trade("trade_001", "AAPL", opened_at, 150.0, 100),
        open_paper_trade("trade_002", "MSFT", opened_at, 300.0, 50),
        open_paper_trade("trade_003", "NVDA", opened_at, 800.0, 25),
    ]

    current_prices = {
        "AAPL": 155.0,
        "MSFT": 310.0,
        "NVDA": 820.0,
    }

    state = portfolio_state(
        trades=trades,
        current_prices=current_prices,
        initial_capital=100000.0,
    )

    assert state.open_positions_count == 3
    assert state.unrealised_pl == pytest.approx(500.0 + 500.0 + 500.0, rel=0.01)


def test_portfolio_state_negative_equity():
    """Test portfolio state with significant losses."""
    opened_at = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)
    closed_at = datetime(2026, 1, 1, 16, 0, tzinfo=timezone.utc)

    closed_trade = close_paper_trade(
        open_paper_trade("trade_001", "AAPL", opened_at, 150.0, 1000),
        closed_at=closed_at,
        exit_price=100.0,
    )

    state = portfolio_state(
        trades=[closed_trade],
        current_prices={},
        initial_capital=100000.0,
    )

    assert state.realised_pl == -50000.0
    assert state.current_equity == 50000.0
    assert state.total_pl_pct == -50.0


def test_paper_trade_record_conversion():
    """Test conversion of paper trade to record dict."""
    opened_at = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)
    closed_at = datetime(2026, 1, 1, 16, 0, tzinfo=timezone.utc)

    trade = close_paper_trade(
        open_paper_trade("trade_001", "AAPL", opened_at, 150.0, 100),
        closed_at=closed_at,
        exit_price=155.0,
    )

    record = trade.to_record()

    assert record["id"] == "trade_001"
    assert record["symbol"] == "AAPL"
    assert record["entry_price"] == 150.0
    assert record["exit_price"] == 155.0
    assert record["realised_pl"] == 500.0
    assert isinstance(record["opened_at"], str)
    assert isinstance(record["closed_at"], str)


def test_portfolio_state_record_conversion():
    """Test conversion of portfolio state to record dict."""
    opened_at = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)

    trade = open_paper_trade("trade_001", "AAPL", opened_at, 150.0, 100)

    state = portfolio_state(
        trades=[trade],
        current_prices={"AAPL": 160.0},
        initial_capital=100000.0,
    )

    record = state.to_record()

    assert record["initial_capital"] == 100000.0
    assert record["current_equity"] == pytest.approx(101000.0, rel=0.01)
    assert record["realised_pl"] == 0.0
    assert record["unrealised_pl"] == pytest.approx(1000.0, rel=0.01)


# Helper import for pytest.approx
try:
    import pytest
except ImportError:
    # Fallback for environments without pytest
    class pytest:
        @staticmethod
        def approx(value, rel=0.0001):
            class Approx:
                def __init__(self, val, tol):
                    self.val = val
                    self.tol = tol

                def __eq__(self, other):
                    return abs(self.val - other) <= abs(self.val * self.tol)

                def __repr__(self):
                    return f"approx({self.val})"

            return Approx(value, rel)
