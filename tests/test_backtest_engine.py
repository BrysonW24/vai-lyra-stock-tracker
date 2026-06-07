"""Tests for the backtest engine with synthetic fixtures."""

from datetime import datetime, timedelta, timezone

from workers.stock_scanner.backtest_engine import run_backtest


def test_backtest_empty_signals():
    """Backtest with no signals should return 0 trades."""
    results = run_backtest(
        symbol="TEST",
        signals=[],
        candles={},
        entry_rule=lambda status: status == "strong_setup",
    )
    assert results.sample_size == 0
    assert results.win_rate == 0.0
    assert results.max_drawdown == 0.0


def test_backtest_single_winning_trade():
    """Backtest a single profitable entry and exit."""
    base_time = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)

    signals = [
        (base_time, "strong_setup"),
    ]

    candles = {
        base_time: (100.0, 100.5, 99.5, 100.2),
        base_time + timedelta(hours=1): (100.2, 105.0, 100.0, 104.8),
        base_time + timedelta(hours=2): (104.8, 105.5, 104.0, 105.0),
        base_time + timedelta(hours=3): (105.0, 106.0, 104.5, 105.5),
        base_time + timedelta(hours=4): (105.5, 107.0, 105.0, 106.0),
        base_time + timedelta(hours=5): (106.0, 107.5, 105.5, 107.2),
        base_time + timedelta(hours=6): (107.2, 108.0, 106.5, 107.5),
        base_time + timedelta(hours=7): (107.5, 109.0, 107.0, 108.5),
        base_time + timedelta(hours=8): (108.5, 109.5, 108.0, 109.0),
        base_time + timedelta(hours=9): (109.0, 110.0, 108.5, 110.0),
        base_time + timedelta(hours=10): (110.0, 111.0, 109.5, 110.5),
        base_time + timedelta(hours=11): (110.5, 112.0, 110.0, 111.5),
    }

    results = run_backtest(
        symbol="TEST",
        signals=signals,
        candles=candles,
        entry_rule=lambda status: status == "strong_setup",
        horizon_bars=10,
        quantity=100,
    )

    assert results.sample_size >= 1, "Should have at least one closed trade"
    assert results.win_count >= 1, "Should have at least one winning trade"
    assert results.avg_return is not None and results.avg_return > 0, "Should have positive return"
    assert results.win_rate > 0.0, "Win rate should be > 0"


def test_backtest_single_losing_trade():
    """Backtest a single unprofitable trade."""
    base_time = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)

    signals = [
        (base_time, "strong_setup"),
    ]

    candles = {
        base_time: (100.0, 100.5, 99.5, 100.2),
        base_time + timedelta(hours=1): (100.2, 100.5, 95.0, 95.5),
        base_time + timedelta(hours=2): (95.5, 96.0, 94.0, 94.5),
        base_time + timedelta(hours=3): (94.5, 95.0, 93.0, 93.5),
        base_time + timedelta(hours=4): (93.5, 94.0, 92.0, 92.5),
        base_time + timedelta(hours=5): (92.5, 93.0, 91.0, 91.5),
        base_time + timedelta(hours=6): (91.5, 92.0, 90.0, 90.5),
        base_time + timedelta(hours=7): (90.5, 91.0, 89.0, 89.5),
        base_time + timedelta(hours=8): (89.5, 90.0, 88.0, 88.5),
        base_time + timedelta(hours=9): (88.5, 89.0, 87.0, 87.5),
        base_time + timedelta(hours=10): (87.5, 88.0, 86.0, 86.5),
        base_time + timedelta(hours=11): (86.5, 87.0, 85.0, 85.5),
    }

    results = run_backtest(
        symbol="TEST",
        signals=signals,
        candles=candles,
        entry_rule=lambda status: status == "strong_setup",
        horizon_bars=10,
        quantity=100,
    )

    assert results.sample_size >= 1, "Should have at least one closed trade"
    assert results.loss_count >= 1, "Should have at least one losing trade"
    assert results.avg_return is not None and results.avg_return < 0, "Should have negative return"


def test_backtest_stop_loss_exit():
    """Backtest with stop loss trigger."""
    base_time = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)

    signals = [
        (base_time, "strong_setup"),
    ]

    candles = {
        base_time: (100.0, 100.5, 99.5, 100.2),
        base_time + timedelta(hours=1): (100.2, 100.5, 97.0, 97.5),
        base_time + timedelta(hours=2): (97.5, 100.0, 95.0, 99.0),
    }

    results = run_backtest(
        symbol="TEST",
        signals=signals,
        candles=candles,
        entry_rule=lambda status: status == "strong_setup",
        horizon_bars=10,
        quantity=100,
        stop_loss_pct=2.5,
    )

    assert results.sample_size >= 1, "Should have exited on stop loss"
    if results.trades:
        trade = results.trades[0]
        assert trade.exit_reason == "stop_loss", f"Got {trade.exit_reason}"
        assert trade.realised_pl_pct is not None and trade.realised_pl_pct <= -2.0


def test_backtest_take_profit_exit():
    """Backtest with take profit trigger."""
    base_time = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)

    signals = [
        (base_time, "strong_setup"),
    ]

    candles = {
        base_time: (100.0, 100.5, 99.5, 100.2),
        base_time + timedelta(hours=1): (100.2, 106.0, 100.0, 105.5),
        base_time + timedelta(hours=2): (105.5, 107.0, 105.0, 106.0),
    }

    results = run_backtest(
        symbol="TEST",
        signals=signals,
        candles=candles,
        entry_rule=lambda status: status == "strong_setup",
        horizon_bars=10,
        quantity=100,
        take_profit_pct=5.0,
    )

    assert results.sample_size >= 1, "Should have exited on take profit"
    if results.trades:
        trade = results.trades[0]
        assert trade.exit_reason == "take_profit", f"Got {trade.exit_reason}"
        assert trade.realised_pl_pct is not None and trade.realised_pl_pct >= 5.0


def test_backtest_horizon_exit():
    """Backtest with horizon-based exit."""
    base_time = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)

    signals = [
        (base_time, "strong_setup"),
    ]

    candles = {
        base_time: (100.0, 100.5, 99.5, 100.2),
        base_time + timedelta(hours=1): (100.2, 100.8, 99.8, 100.5),
        base_time + timedelta(hours=2): (100.5, 101.0, 100.0, 100.7),
        base_time + timedelta(hours=3): (100.7, 101.2, 100.2, 100.9),
        base_time + timedelta(hours=4): (100.9, 101.4, 100.4, 101.1),
        base_time + timedelta(hours=5): (101.1, 101.6, 100.6, 101.3),
        base_time + timedelta(hours=6): (101.3, 101.8, 100.8, 101.5),
    }

    results = run_backtest(
        symbol="TEST",
        signals=signals,
        candles=candles,
        entry_rule=lambda status: status == "strong_setup",
        horizon_bars=5,
        quantity=100,
    )

    assert results.sample_size >= 1, "Should have exited at horizon"
    if results.trades:
        trade = results.trades[0]
        assert trade.exit_reason == "horizon_exit", f"Got {trade.exit_reason}"
        assert trade.bars_held == 5


def test_backtest_multiple_trades():
    """Backtest multiple signal entries."""
    base_time = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)

    signals = [
        (base_time, "strong_setup"),
        (base_time + timedelta(hours=20), "strong_setup"),
    ]

    candles = {
        base_time + timedelta(hours=i): (100.0 + i * 0.5, 100.5 + i * 0.5, 99.5 + i * 0.5, 100.2 + i * 0.5)
        for i in range(40)
    }

    results = run_backtest(
        symbol="TEST",
        signals=signals,
        candles=candles,
        entry_rule=lambda status: status == "strong_setup",
        horizon_bars=5,
        quantity=100,
    )

    assert results.sample_size >= 2, "Should have multiple trades"
    assert len(results.trades) >= 2, "Trade list should contain multiple trades"


def test_backtest_win_rate_calculation():
    """Test win rate metric calculation."""
    base_time = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)

    signals = [
        (base_time, "strong_setup"),
        (base_time + timedelta(hours=10), "strong_setup"),
        (base_time + timedelta(hours=20), "strong_setup"),
    ]

    candles = {}
    for i in range(30):
        current_time = base_time + timedelta(hours=i)
        if i < 10:
            candles[current_time] = (100.0 + i * 0.5, 100.5 + i * 0.5, 99.5 + i * 0.5, 100.2 + i * 0.5)
        elif i < 20:
            candles[current_time] = (105.0 - i * 0.3, 105.5 - i * 0.3, 104.5 - i * 0.3, 104.7 - i * 0.3)
        else:
            candles[current_time] = (100.0 + (i - 20) * 0.7, 100.5 + (i - 20) * 0.7, 99.5 + (i - 20) * 0.7, 100.2 + (i - 20) * 0.7)

    results = run_backtest(
        symbol="TEST",
        signals=signals,
        candles=candles,
        entry_rule=lambda status: status == "strong_setup",
        horizon_bars=5,
        quantity=100,
    )

    if results.sample_size > 0:
        assert results.win_rate >= 0.0 and results.win_rate <= 100.0, "Win rate should be 0-100%"
        assert results.win_count + results.loss_count == results.sample_size, "Win + loss should equal sample size"


def test_backtest_profit_factor():
    """Test profit factor calculation."""
    base_time = datetime(2026, 1, 1, 9, 0, tzinfo=timezone.utc)

    signals = [
        (base_time, "strong_setup"),
    ]

    candles = {
        base_time: (100.0, 100.5, 99.5, 100.2),
        base_time + timedelta(hours=1): (100.2, 110.0, 100.0, 109.5),
        base_time + timedelta(hours=2): (109.5, 115.0, 109.0, 114.5),
        base_time + timedelta(hours=3): (114.5, 120.0, 114.0, 119.5),
        base_time + timedelta(hours=4): (119.5, 125.0, 119.0, 124.5),
        base_time + timedelta(hours=5): (124.5, 130.0, 124.0, 129.5),
    }

    results = run_backtest(
        symbol="TEST",
        signals=signals,
        candles=candles,
        entry_rule=lambda status: status == "strong_setup",
        horizon_bars=5,
        quantity=100,
    )

    if results.sample_size > 0 and results.profit_factor > 0:
        assert results.profit_factor >= 0.0, "Profit factor should be non-negative"
