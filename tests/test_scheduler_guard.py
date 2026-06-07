from datetime import datetime, timezone

from workers.stock_scanner.config import Settings
from workers.stock_scanner.scheduler_guard import should_run_now


def settings(force_scan: bool = False, guard: bool = True) -> Settings:
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
        enable_market_hours_guard=guard,
        force_scan=force_scan,
    )


def test_market_hours_guard_allows_weekday_scan_window() -> None:
    monday_inside_window = datetime(2026, 6, 1, 14, 0, tzinfo=timezone.utc)

    assert should_run_now(settings(), monday_inside_window) is True


def test_market_hours_guard_blocks_weekend() -> None:
    saturday_inside_window = datetime(2026, 6, 6, 14, 0, tzinfo=timezone.utc)

    assert should_run_now(settings(), saturday_inside_window) is False


def test_force_scan_bypasses_guard() -> None:
    saturday_inside_window = datetime(2026, 6, 6, 14, 0, tzinfo=timezone.utc)

    assert should_run_now(settings(force_scan=True), saturday_inside_window) is True
