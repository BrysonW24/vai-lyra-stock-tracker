"""Tests for Trade Day Snapshot Engine.

Unit tests for pure snapshot building logic with synthetic fixtures.
No network, no database, deterministic assertions.
"""
from datetime import datetime, timedelta, timezone

import pytest

from workers.stock_scanner.models import Candle, IndicatorSnapshot, SignalResult
from workers.stock_scanner.trade_snapshot_engine import (
    TradeDaySnapshot,
    _classify_entry_quality,
    _classify_trade_type,
    build_trade_day_snapshot,
)


@pytest.fixture
def base_date():
    """Base entry date: 2026-06-01."""
    return datetime(2026, 6, 1, 10, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def strong_entry_indicators(base_date):
    """Strong entry setup: RSI in recovery band, MACD bullish, volume elevated."""
    return IndicatorSnapshot(
        symbol="NVDA",
        timeframe="1h",
        candle_time=base_date,
        close=820.0,
        volume=8500000.0,
        rsi_14=52.0,
        rsi_delta_1=2.5,
        rsi_delta_2=3.0,
        rsi_state="recovering",
        macd=2.5,
        macd_signal=1.8,
        macd_histogram=0.7,
        macd_histogram_delta_1=0.15,
        macd_histogram_delta_2=0.2,
        macd_state="bullish",
        sma_20=795.0,
        sma_50=800.0,
        sma_200=750.0,
        ema_12=810.0,
        ema_26=805.0,
        volume_sma_20=7000000.0,
        volume_ratio=1.21,
        volume_state="elevated",
        price_vs_sma_20=3.15,
        price_vs_sma_50=2.5,
        price_vs_sma_200=9.33,
        distance_from_20_period_low=8.5,
        distance_from_60_period_low=12.2,
        distance_from_120_period_low=15.8,
        trend_state="uptrend",
    )


@pytest.fixture
def weak_entry_indicators(base_date):
    """Weak entry setup: overextended, MACD weakening, volume declining."""
    return IndicatorSnapshot(
        symbol="SNOW",
        timeframe="1h",
        candle_time=base_date,
        close=150.0,
        volume=4200000.0,
        rsi_14=71.0,
        rsi_delta_1=-1.5,
        rsi_delta_2=-2.0,
        rsi_state="overbought",
        macd=3.8,
        macd_signal=4.2,
        macd_histogram=-0.4,
        macd_histogram_delta_1=-0.2,
        macd_histogram_delta_2=-0.3,
        macd_state="bearish",
        sma_20=135.0,
        sma_50=130.0,
        sma_200=125.0,
        ema_12=145.0,
        ema_26=142.0,
        volume_sma_20=6500000.0,
        volume_ratio=0.65,
        volume_state="declining",
        price_vs_sma_20=11.11,
        price_vs_sma_50=15.38,
        price_vs_sma_200=20.0,
        distance_from_20_period_low=4.2,
        distance_from_60_period_low=8.1,
        distance_from_120_period_low=12.5,
        trend_state="overextended",
    )


@pytest.fixture
def strong_signal(base_date):
    """Strong signal score at entry."""
    return SignalResult(
        symbol="NVDA",
        timeframe="1h",
        candle_time=base_date,
        signal_type="momentum_recovery_v1",
        signal_status="strong_setup",
        signal_score=78.0,
        previous_signal_score=62.0,
        signal_score_delta=16.0,
        action_state="buy_signal",
        lifecycle_state="active",
        explanation={
            "rsi_points": 10,
            "macd_points": 12,
            "price_location_points": 5,
            "trend_points": 10,
            "volume_points": 10,
        },
        raw_payload={},
    )


@pytest.fixture
def weak_signal(base_date):
    """Weak signal score at entry."""
    return SignalResult(
        symbol="SNOW",
        timeframe="1h",
        candle_time=base_date,
        signal_type="momentum_recovery_v1",
        signal_status="weak_setup",
        signal_score=35.0,
        previous_signal_score=42.0,
        signal_score_delta=-7.0,
        action_state="no_signal",
        lifecycle_state="inactive",
        explanation={
            "rsi_points": 0,
            "macd_points": 0,
            "price_location_points": 0,
            "trend_points": 5,
            "volume_points": 0,
        },
        raw_payload={},
    )


@pytest.fixture
def forward_candles_bullish(base_date):
    """Forward candles showing strong upside after entry."""
    candles = []
    for i in range(1, 51):  # 50 hours of forward data
        close = 820.0 + (i * 1.2)  # steady climb: ~+60 points over 50h
        candles.append(
            Candle(
                symbol="NVDA",
                timeframe="1h",
                candle_time=base_date + timedelta(hours=i),
                open=close - 0.5,
                high=close + 1.0,
                low=close - 1.5,
                close=close,
                adjusted_close=close,
                volume=7500000 + (i * 10000),
                source="yfinance",
            )
        )
    return candles


@pytest.fixture
def forward_candles_bearish(base_date):
    """Forward candles showing drawdown after entry."""
    candles = []
    for i in range(1, 51):
        close = 150.0 - (i * 0.8)  # steady decline: ~-40 points over 50h
        candles.append(
            Candle(
                symbol="SNOW",
                timeframe="1h",
                candle_time=base_date + timedelta(hours=i),
                open=close + 0.5,
                high=close + 1.0,
                low=close - 1.5,
                close=close,
                adjusted_close=close,
                volume=5000000 - (i * 15000),
                source="yfinance",
            )
        )
    return candles


def test_classify_trade_type_momentum_continuation():
    """Test momentum continuation classification."""
    trade_type = _classify_trade_type(
        rsi_on_entry=52.0,
        macd_state="bullish",
        price_vs_sma_50=5.0,  # moderately above SMA, not at threshold
        distance_from_low=12.2,
    )
    assert trade_type == "momentum_continuation"


def test_classify_trade_type_oversold_bounce():
    """Test oversold bounce classification."""
    trade_type = _classify_trade_type(
        rsi_on_entry=35.0,
        macd_state="bullish",
        price_vs_sma_50=-3.0,
        distance_from_low=8.5,
    )
    assert trade_type == "oversold_bounce"


def test_classify_trade_type_overextended_entry():
    """Test overextended entry classification."""
    trade_type = _classify_trade_type(
        rsi_on_entry=71.0,
        macd_state="bearish",
        price_vs_sma_50=15.0,
        distance_from_low=50.0,  # far from low (overextended)
    )
    assert trade_type == "overextended_entry"


def test_classify_entry_quality_strong():
    """Test strong entry quality classification."""
    quality = _classify_entry_quality(
        trade_type="momentum_continuation",
        signal_score=78.0,
        volume_ratio=1.21,
        rsi_on_entry=52.0,
        macd_state="bullish",
        price_vs_sma_50=2.5,
    )
    assert quality == "strong"


def test_classify_entry_quality_weak():
    """Test weak entry quality classification."""
    quality = _classify_entry_quality(
        trade_type="overextended_entry",
        signal_score=35.0,
        volume_ratio=0.65,
        rsi_on_entry=71.0,
        macd_state="bearish",
        price_vs_sma_50=15.0,
    )
    assert quality == "weak"


def test_build_snapshot_strong_entry(base_date, strong_entry_indicators, strong_signal, forward_candles_bullish):
    """Test building snapshot from strong entry with bullish forward price."""
    snapshot = build_trade_day_snapshot(
        symbol="NVDA",
        buy_date=base_date,
        entry_price=820.0,
        indicators_on_date=strong_entry_indicators,
        signal_on_date=strong_signal,
        candles_after_entry=forward_candles_bullish,
    )

    # Assert entry context captured
    assert snapshot.symbol == "NVDA"
    assert snapshot.entry_price == 820.0
    assert snapshot.rsi_on_entry == 52.0
    assert snapshot.macd_state_on_entry == "bullish"
    assert snapshot.volume_ratio_on_entry == 1.21
    assert snapshot.signal_score_on_entry == 78.0

    # Assert forward returns captured
    assert snapshot.return_5d is not None
    assert snapshot.return_20d is not None
    assert snapshot.return_60d is not None
    assert snapshot.max_upside_after_entry is not None
    assert snapshot.max_upside_after_entry > 0

    # Assert learning summary generated
    assert snapshot.learning_summary is not None
    assert len(snapshot.learning_summary) > 0
    # Check for momentum continuation note
    assert any("momentum continuation" in note.lower() for note in snapshot.learning_summary)
    # Check for strong quality note
    assert any("strong" in note.lower() for note in snapshot.learning_summary)


def test_build_snapshot_weak_entry(base_date, weak_entry_indicators, weak_signal, forward_candles_bearish):
    """Test building snapshot from weak entry with bearish forward price."""
    snapshot = build_trade_day_snapshot(
        symbol="SNOW",
        buy_date=base_date,
        entry_price=150.0,
        indicators_on_date=weak_entry_indicators,
        signal_on_date=weak_signal,
        candles_after_entry=forward_candles_bearish,
    )

    # Assert entry context captured
    assert snapshot.symbol == "SNOW"
    assert snapshot.entry_price == 150.0
    assert snapshot.rsi_on_entry == 71.0
    assert snapshot.macd_state_on_entry == "bearish"
    assert snapshot.volume_ratio_on_entry == 0.65
    assert snapshot.signal_score_on_entry == 35.0

    # Assert forward returns captured (should be negative)
    assert snapshot.return_5d is not None
    assert snapshot.max_drawdown_after_entry is not None
    assert snapshot.max_drawdown_after_entry < 0

    # Assert learning summary generated
    assert snapshot.learning_summary is not None
    # Check for extended price note
    assert any("extended" in note.lower() for note in snapshot.learning_summary)
    # Check for weak quality note
    assert any("weak" in note.lower() for note in snapshot.learning_summary)


def test_build_snapshot_no_indicators(base_date, strong_signal):
    """Test snapshot building when indicators are missing."""
    snapshot = build_trade_day_snapshot(
        symbol="MSFT",
        buy_date=base_date,
        entry_price=400.0,
        indicators_on_date=None,
        signal_on_date=strong_signal,
        candles_after_entry=None,
    )

    assert snapshot.symbol == "MSFT"
    assert snapshot.entry_price == 400.0
    # Indicators should be None
    assert snapshot.rsi_on_entry is None
    assert snapshot.macd_state_on_entry is None
    # Signal score should still be captured
    assert snapshot.signal_score_on_entry == 78.0


def test_snapshot_to_record(base_date, strong_entry_indicators, strong_signal):
    """Test snapshot conversion to database record."""
    snapshot = build_trade_day_snapshot(
        symbol="NVDA",
        buy_date=base_date,
        entry_price=820.0,
        indicators_on_date=strong_entry_indicators,
        signal_on_date=strong_signal,
        candles_after_entry=None,
    )

    record = snapshot.to_record()

    # Check all fields are present in record
    assert record["symbol"] == "NVDA"
    assert record["entry_price"] == 820.0
    assert record["rsi_on_entry"] == 52.0
    assert "purchase_date" in record
    assert "learning_summary" in record
    assert record["learning_summary"] is not None
    # Check dates are ISO formatted
    assert isinstance(record.get("created_at"), str)


def test_learning_summary_momentum_continuation(base_date, strong_entry_indicators, strong_signal):
    """Test that momentum continuation trades generate appropriate learning notes."""
    snapshot = build_trade_day_snapshot(
        symbol="NVDA",
        buy_date=base_date,
        entry_price=820.0,
        indicators_on_date=strong_entry_indicators,
        signal_on_date=strong_signal,
        candles_after_entry=None,
    )

    assert snapshot.learning_summary is not None
    summary_text = " ".join(snapshot.learning_summary).lower()

    # Should mention momentum continuation
    assert "momentum continuation" in summary_text or "momentum" in summary_text


def test_learning_summary_volume_analysis(base_date, strong_entry_indicators, strong_signal):
    """Test that volume is analyzed in learning summary."""
    snapshot = build_trade_day_snapshot(
        symbol="NVDA",
        buy_date=base_date,
        entry_price=820.0,
        indicators_on_date=strong_entry_indicators,
        signal_on_date=strong_signal,
        candles_after_entry=None,
    )

    assert snapshot.learning_summary is not None
    summary_text = " ".join(snapshot.learning_summary).lower()

    # Should mention volume since volume_ratio is 1.21 (elevated)
    assert "volume" in summary_text


def test_deterministic_forward_returns(base_date, strong_entry_indicators, strong_signal, forward_candles_bullish):
    """Test that forward returns are deterministic (same input = same output)."""
    snapshot1 = build_trade_day_snapshot(
        symbol="NVDA",
        buy_date=base_date,
        entry_price=820.0,
        indicators_on_date=strong_entry_indicators,
        signal_on_date=strong_signal,
        candles_after_entry=forward_candles_bullish,
    )

    snapshot2 = build_trade_day_snapshot(
        symbol="NVDA",
        buy_date=base_date,
        entry_price=820.0,
        indicators_on_date=strong_entry_indicators,
        signal_on_date=strong_signal,
        candles_after_entry=forward_candles_bullish,
    )

    # Forward returns should be identical
    assert snapshot1.return_5d == snapshot2.return_5d
    assert snapshot1.return_20d == snapshot2.return_20d
    assert snapshot1.return_60d == snapshot2.return_60d
    assert snapshot1.max_upside_after_entry == snapshot2.max_upside_after_entry
    assert snapshot1.max_drawdown_after_entry == snapshot2.max_drawdown_after_entry
