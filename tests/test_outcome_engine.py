from datetime import datetime, timedelta, timezone

import pytest

from workers.stock_scanner.models import Candle
from workers.stock_scanner.outcome_engine import (
    OutcomeDistribution,
    OutcomeResult,
    aggregate_outcomes,
    compute_outcome,
)


@pytest.fixture
def base_time():
    return datetime(2026, 6, 1, 10, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def entry_candle(base_time):
    """Signal entry point at $100."""
    return Candle(
        symbol="NVDA",
        timeframe="1h",
        candle_time=base_time,
        open=99.5,
        high=101.0,
        low=99.0,
        close=100.0,
        adjusted_close=100.0,
        volume=5000000,
        source="yfinance",
    )


def test_compute_outcome_flat_price(base_time, entry_candle):
    """Test outcome when price stays flat (no return)."""
    candles_after = [
        Candle(
            symbol="NVDA",
            timeframe="1h",
            candle_time=base_time + timedelta(hours=1),
            open=100.0,
            high=100.5,
            low=99.5,
            close=100.0,
            adjusted_close=100.0,
            volume=4500000,
            source="yfinance",
        ),
        Candle(
            symbol="NVDA",
            timeframe="1h",
            candle_time=base_time + timedelta(hours=2),
            open=100.0,
            high=100.5,
            low=99.5,
            close=100.0,
            adjusted_close=100.0,
            volume=4500000,
            source="yfinance",
        ),
    ]

    result = compute_outcome(
        symbol="NVDA",
        signal_candle_time=base_time,
        signal_type="momentum_recovery_v1",
        signal_status="strong_setup",
        signal_score=85.0,
        entry_price=100.0,
        candles_after=candles_after,
    )

    assert result.symbol == "NVDA"
    assert result.return_1d == 0.0
    assert result.return_5d == 0.0
    assert result.max_upside_pct == 0.0
    assert result.max_drawdown_pct == 0.0


def test_compute_outcome_uptrend(base_time):
    """Test outcome with consistent price appreciation over many bars."""
    candles_after = [
        Candle(
            symbol="AMD",
            timeframe="1h",
            candle_time=base_time + timedelta(hours=i),
            open=100.0 + (i * 0.5),
            high=100.5 + (i * 0.5),
            low=99.5 + (i * 0.5),
            close=100.0 + (i * 0.5),
            adjusted_close=100.0 + (i * 0.5),
            volume=5000000,
            source="yfinance",
        )
        for i in range(1, 450)  # 450 bars to cover all horizons
    ]

    result = compute_outcome(
        symbol="AMD",
        signal_candle_time=base_time,
        signal_type="momentum_recovery_v1",
        signal_status="strong_setup",
        signal_score=80.0,
        entry_price=100.0,
        candles_after=candles_after,
    )

    # Price increases consistently, so all horizons should be positive
    assert result.return_1d is not None
    assert result.return_1d > 0.0
    assert result.return_5d is not None
    assert result.return_5d > result.return_1d  # 5d should have more time
    assert result.return_20d is not None
    assert result.return_20d > result.return_5d
    assert result.max_upside_pct > 0.0
    assert result.max_drawdown_pct == 0.0


def test_compute_outcome_downtrend_then_recovery(base_time):
    """Test outcome with initial drawdown, then recovery."""
    prices = [
        100.0,
        98.0,   # -2%
        96.0,   # -4% (worst drawdown)
        98.0,   # -2%
        100.0,  # 0%
        102.0,  # +2% (best upside)
        101.0,  # +1%
    ]

    candles_after = [
        Candle(
            symbol="CRM",
            timeframe="1h",
            candle_time=base_time + timedelta(hours=i),
            open=prices[i],
            high=prices[i] + 0.5,
            low=prices[i] - 0.5,
            close=prices[i],
            adjusted_close=prices[i],
            volume=5000000,
            source="yfinance",
        )
        for i in range(1, len(prices))
    ]

    result = compute_outcome(
        symbol="CRM",
        signal_candle_time=base_time,
        signal_type="momentum_recovery_v1",
        signal_status="strong_setup",
        signal_score=75.0,
        entry_price=100.0,
        candles_after=candles_after,
    )

    assert result.max_drawdown_pct == pytest.approx(-4.0, abs=0.1)
    assert result.max_upside_pct == pytest.approx(2.0, abs=0.1)
    # 1d horizon (7 bars) captures final available candle at +1%
    assert result.return_1d == pytest.approx(1.0, abs=0.1)


def test_compute_outcome_with_none_closes(base_time):
    """Test outcome when some candles have None close prices."""
    candles_after = [
        Candle(
            symbol="MSFT",
            timeframe="1h",
            candle_time=base_time + timedelta(hours=1),
            open=100.0,
            high=101.0,
            low=99.0,
            close=None,  # Missing data
            adjusted_close=None,
            volume=5000000,
            source="yfinance",
        ),
        Candle(
            symbol="MSFT",
            timeframe="1h",
            candle_time=base_time + timedelta(hours=2),
            open=102.0,
            high=103.0,
            low=101.0,
            close=102.0,
            adjusted_close=102.0,
            volume=5000000,
            source="yfinance",
        ),
    ]

    result = compute_outcome(
        symbol="MSFT",
        signal_candle_time=base_time,
        signal_type="momentum_recovery_v1",
        signal_status="strong_setup",
        signal_score=78.0,
        entry_price=100.0,
        candles_after=candles_after,
    )

    # First bar is skipped (no close), 2nd bar (index 1) gets captured at 1d horizon
    assert result.return_1d == pytest.approx(2.0, abs=0.1)
    assert result.return_5d == pytest.approx(2.0, abs=0.1)  # Same as final value


def test_compute_outcome_with_custom_horizons(base_time):
    """Test outcome with custom horizon bar counts."""
    candles_after = [
        Candle(
            symbol="AAPL",
            timeframe="1h",
            candle_time=base_time + timedelta(hours=i),
            open=100.0 + (i * 0.1),
            high=100.5 + (i * 0.1),
            low=99.5 + (i * 0.1),
            close=100.0 + (i * 0.1),
            adjusted_close=100.0 + (i * 0.1),
            volume=5000000,
            source="yfinance",
        )
        for i in range(1, 21)
    ]

    horizons = {"1d": 3, "5d": 10, "20d": 15, "60d": 30}
    result = compute_outcome(
        symbol="AAPL",
        signal_candle_time=base_time,
        signal_type="momentum_recovery_v1",
        signal_status="strong_setup",
        signal_score=82.0,
        entry_price=100.0,
        candles_after=candles_after,
        horizons_bars=horizons,
    )

    assert result.sample_horizon_bars == horizons
    assert result.return_1d is not None
    assert result.return_5d is not None
    assert result.return_20d is not None
    # 60d horizon has no candles (only 20 candles provided), so backfill with final
    assert result.return_60d is not None


def test_aggregate_outcomes_single_group(base_time):
    """Test aggregation with single signal type/status group."""
    outcomes = [
        OutcomeResult(
            symbol="NVDA",
            signal_candle_time=base_time,
            signal_type="momentum_recovery_v1",
            signal_status="strong_setup",
            signal_score=80.0,
            return_1d=1.0,
            return_5d=3.5,
            return_20d=7.2,
            return_60d=12.1,
            max_upside_pct=15.0,
            max_drawdown_pct=-2.0,
            sample_horizon_bars={"1d": 7, "5d": 35, "20d": 140, "60d": 420},
        ),
        OutcomeResult(
            symbol="AMD",
            signal_candle_time=base_time + timedelta(hours=24),
            signal_type="momentum_recovery_v1",
            signal_status="strong_setup",
            signal_score=85.0,
            return_1d=0.5,
            return_5d=2.8,
            return_20d=6.4,
            return_60d=11.5,
            max_upside_pct=13.0,
            max_drawdown_pct=-3.0,
            sample_horizon_bars={"1d": 7, "5d": 35, "20d": 140, "60d": 420},
        ),
        OutcomeResult(
            symbol="CRM",
            signal_candle_time=base_time + timedelta(hours=48),
            signal_type="momentum_recovery_v1",
            signal_status="strong_setup",
            signal_score=75.0,
            return_1d=1.5,
            return_5d=4.2,
            return_20d=8.1,
            return_60d=13.0,
            max_upside_pct=16.0,
            max_drawdown_pct=-1.5,
            sample_horizon_bars={"1d": 7, "5d": 35, "20d": 140, "60d": 420},
        ),
    ]

    distributions = aggregate_outcomes(outcomes)

    assert "momentum_recovery_v1|strong_setup" in distributions
    dist = distributions["momentum_recovery_v1|strong_setup"]

    assert dist.sample_size == 3
    assert dist.return_1d_median == pytest.approx(1.0, abs=0.1)
    assert dist.return_5d_median == pytest.approx(3.5, abs=0.1)
    assert dist.return_20d_median == pytest.approx(7.2, abs=0.1)
    assert dist.return_60d_median == pytest.approx(12.1, abs=0.1)
    assert dist.return_1d_win_rate == 100.0  # all positive
    assert dist.return_5d_win_rate == 100.0
    assert dist.max_upside_median == pytest.approx(15.0, abs=0.1)
    assert dist.worst_drawdown_min == pytest.approx(-3.0, abs=0.1)


def test_aggregate_outcomes_mixed_groups(base_time):
    """Test aggregation with multiple signal type/status groups."""
    outcomes = [
        OutcomeResult(
            symbol="NVDA",
            signal_candle_time=base_time,
            signal_type="momentum_recovery_v1",
            signal_status="strong_setup",
            signal_score=80.0,
            return_1d=1.0,
            return_5d=3.5,
            return_20d=7.2,
            return_60d=12.0,
            max_upside_pct=15.0,
            max_drawdown_pct=-2.0,
            sample_horizon_bars={"1d": 7, "5d": 35, "20d": 140, "60d": 420},
        ),
        OutcomeResult(
            symbol="AMD",
            signal_candle_time=base_time + timedelta(hours=24),
            signal_type="momentum_recovery_v1",
            signal_status="watchlist_setup",
            signal_score=65.0,
            return_1d=-0.5,
            return_5d=1.2,
            return_20d=3.1,
            return_60d=6.5,
            max_upside_pct=8.0,
            max_drawdown_pct=-4.0,
            sample_horizon_bars={"1d": 7, "5d": 35, "20d": 140, "60d": 420},
        ),
        OutcomeResult(
            symbol="CRM",
            signal_candle_time=base_time + timedelta(hours=48),
            signal_type="momentum_recovery_v1",
            signal_status="watchlist_setup",
            signal_score=62.0,
            return_1d=0.2,
            return_5d=1.8,
            return_20d=4.5,
            return_60d=7.2,
            max_upside_pct=9.5,
            max_drawdown_pct=-2.5,
            sample_horizon_bars={"1d": 7, "5d": 35, "20d": 140, "60d": 420},
        ),
    ]

    distributions = aggregate_outcomes(outcomes)

    assert len(distributions) == 2

    strong = distributions["momentum_recovery_v1|strong_setup"]
    assert strong.sample_size == 1
    assert strong.return_1d_median == 1.0

    watchlist = distributions["momentum_recovery_v1|watchlist_setup"]
    assert watchlist.sample_size == 2
    assert watchlist.return_1d_median == pytest.approx(-0.15, abs=0.1)  # median(-0.5, 0.2)
    assert watchlist.return_1d_win_rate == pytest.approx(50.0, abs=1)  # 1 positive, 1 negative


def test_aggregate_outcomes_win_rate_calculation(base_time):
    """Test win rate calculation with mixed positive/negative returns."""
    outcomes = [
        OutcomeResult(
            symbol="A",
            signal_candle_time=base_time,
            signal_type="momentum_recovery_v1",
            signal_status="strong_setup",
            signal_score=80.0,
            return_1d=2.0,
            return_5d=5.0,
            return_20d=10.0,
            return_60d=15.0,
            max_upside_pct=20.0,
            max_drawdown_pct=0.0,
            sample_horizon_bars={"1d": 7, "5d": 35, "20d": 140, "60d": 420},
        ),
        OutcomeResult(
            symbol="B",
            signal_candle_time=base_time + timedelta(hours=24),
            signal_type="momentum_recovery_v1",
            signal_status="strong_setup",
            signal_score=75.0,
            return_1d=-1.5,
            return_5d=0.5,
            return_20d=3.0,
            return_60d=8.0,
            max_upside_pct=10.0,
            max_drawdown_pct=-3.0,
            sample_horizon_bars={"1d": 7, "5d": 35, "20d": 140, "60d": 420},
        ),
        OutcomeResult(
            symbol="C",
            signal_candle_time=base_time + timedelta(hours=48),
            signal_type="momentum_recovery_v1",
            signal_status="strong_setup",
            signal_score=82.0,
            return_1d=0.0,
            return_5d=2.0,
            return_20d=5.5,
            return_60d=11.0,
            max_upside_pct=12.0,
            max_drawdown_pct=-1.0,
            sample_horizon_bars={"1d": 7, "5d": 35, "20d": 140, "60d": 420},
        ),
        OutcomeResult(
            symbol="D",
            signal_candle_time=base_time + timedelta(hours=72),
            signal_type="momentum_recovery_v1",
            signal_status="strong_setup",
            signal_score=78.0,
            return_1d=1.2,
            return_5d=3.5,
            return_20d=7.2,
            return_60d=12.5,
            max_upside_pct=14.0,
            max_drawdown_pct=-2.0,
            sample_horizon_bars={"1d": 7, "5d": 35, "20d": 140, "60d": 420},
        ),
    ]

    distributions = aggregate_outcomes(outcomes)
    dist = distributions["momentum_recovery_v1|strong_setup"]

    assert dist.sample_size == 4
    # 1d: 2.0, -1.5, 0.0, 1.2 -> wins: 3 out of 4 (0.0 counts as non-negative) = 75%
    assert dist.return_1d_win_rate == pytest.approx(75.0, abs=1)
    # 5d: all positive -> wins: 4 out of 4 = 100%
    assert dist.return_5d_win_rate == 100.0


def test_aggregate_outcomes_empty():
    """Test aggregation with empty outcomes list."""
    distributions = aggregate_outcomes([])
    assert len(distributions) == 0


def test_aggregate_outcomes_with_none_values(base_time):
    """Test aggregation when some returns are None."""
    outcomes = [
        OutcomeResult(
            symbol="NVDA",
            signal_candle_time=base_time,
            signal_type="momentum_recovery_v1",
            signal_status="strong_setup",
            signal_score=80.0,
            return_1d=None,
            return_5d=3.5,
            return_20d=7.2,
            return_60d=12.0,
            max_upside_pct=15.0,
            max_drawdown_pct=-2.0,
            sample_horizon_bars={"1d": 7, "5d": 35, "20d": 140, "60d": 420},
        ),
        OutcomeResult(
            symbol="AMD",
            signal_candle_time=base_time + timedelta(hours=24),
            signal_type="momentum_recovery_v1",
            signal_status="strong_setup",
            signal_score=85.0,
            return_1d=0.5,
            return_5d=None,
            return_20d=6.4,
            return_60d=11.5,
            max_upside_pct=13.0,
            max_drawdown_pct=-3.0,
            sample_horizon_bars={"1d": 7, "5d": 35, "20d": 140, "60d": 420},
        ),
    ]

    distributions = aggregate_outcomes(outcomes)
    dist = distributions["momentum_recovery_v1|strong_setup"]

    assert dist.sample_size == 2
    assert dist.return_1d_median == 0.5  # only one value
    assert dist.return_5d_median == 3.5  # only one value
    assert dist.return_1d_win_rate == 100.0
    assert dist.return_5d_win_rate == 100.0
