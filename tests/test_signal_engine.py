from datetime import datetime, timezone

from workers.stock_scanner.config import Settings
from workers.stock_scanner.models import IndicatorSnapshot, Ticker
from workers.stock_scanner.signal_engine import calculate_signal


def settings() -> Settings:
    return Settings(
        supabase_url="",
        supabase_service_role_key="",
        telegram_bot_token="",
        telegram_chat_id="",
        market_data_provider="yfinance",
        ticker_symbols=(),
        default_timeframe="1h",
        lookback_period_days=180,
        alert_score_threshold=75,
        watchlist_score_threshold=60,
        signal_change_threshold=8,
        enable_telegram_alerts=False,
        enable_watchlist_alerts=False,
        enable_hourly_digest=False,
        enable_market_hours_guard=False,
        force_scan=True,
    )


def snapshot(
    rsi: float,
    histogram: float,
    volume: float,
    volume_ratio: float,
    close: float = 100.0,
    rsi_delta_1: float = 4.0,
    rsi_delta_2: float = 7.0,
    hist_delta_1: float = 0.35,
    hist_delta_2: float = 0.65,
) -> IndicatorSnapshot:
    return IndicatorSnapshot(
        symbol="AMD",
        timeframe="1h",
        candle_time=datetime(2026, 6, 2, 20, 0, tzinfo=timezone.utc),
        close=close,
        volume=volume,
        rsi_14=rsi,
        rsi_delta_1=rsi_delta_1,
        rsi_delta_2=rsi_delta_2,
        rsi_state="rising",
        macd=-0.8,
        macd_signal=-0.2,
        macd_histogram=histogram,
        macd_histogram_delta_1=hist_delta_1,
        macd_histogram_delta_2=hist_delta_2,
        macd_state="bearish_but_improving",
        sma_20=99.0,
        sma_50=101.0,
        sma_200=96.0,
        ema_12=98.0,
        ema_26=99.0,
        volume_sma_20=1000.0,
        volume_ratio=volume_ratio,
        volume_state="above_average",
        price_vs_sma_20=1.0,
        price_vs_sma_50=-1.0,
        price_vs_sma_200=4.2,
        distance_from_20_period_low=2.0,
        distance_from_60_period_low=4.5,
        distance_from_120_period_low=6.5,
        trend_state="above_long_trend",
    )


def test_calculate_signal_stores_component_scores_and_buy_review_action() -> None:
    current = snapshot(rsi=46.0, histogram=-0.45, volume=1300.0, volume_ratio=1.3)
    previous = snapshot(rsi=42.0, histogram=-0.8, volume=1100.0, volume_ratio=1.1)
    two_periods_ago = snapshot(rsi=39.0, histogram=-1.1, volume=1000.0, volume_ratio=1.0)

    score, signal = calculate_signal(Ticker("AMD", "AMD", "Advanced Micro Devices"), current, previous, two_periods_ago, settings())

    assert score.final_score >= 75
    assert score.rsi_score == 25
    assert score.macd_score == 30
    assert signal.signal_status == "strong_setup"
    assert signal.action_state == "buy_review"
    assert "triggered_because" in signal.explanation


def test_calculate_signal_assigns_lifecycle_upgrade_from_previous_watchlist() -> None:
    current = snapshot(rsi=46.0, histogram=-0.45, volume=1300.0, volume_ratio=1.3)
    previous = snapshot(rsi=42.0, histogram=-0.8, volume=1100.0, volume_ratio=1.1)
    two_periods_ago = snapshot(rsi=39.0, histogram=-1.1, volume=1000.0, volume_ratio=1.0)

    _, signal = calculate_signal(
        Ticker("AMD", "AMD", "Advanced Micro Devices"),
        current,
        previous,
        two_periods_ago,
        settings(),
        previous_signal={"signal_status": "watchlist_setup", "signal_score": 66},
    )

    assert signal.lifecycle_state == "upgraded"
    assert signal.previous_signal_score == 66
    assert signal.signal_score_delta is not None
