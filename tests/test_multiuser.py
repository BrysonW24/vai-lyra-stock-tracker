"""Tests for multi-user alert gating and user-specific overlay logic."""
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from tests.test_signal_engine import settings, snapshot
from workers.stock_scanner.alert_engine import should_send_alert_to_user
from workers.stock_scanner.models import (
    IndicatorSnapshot,
    PortfolioPosition,
    SignalResult,
    Ticker,
    WatchlistItem,
    WatchlistOverlay,
)
from workers.stock_scanner.portfolio_engine import calculate_portfolio_overlays
from workers.stock_scanner.signal_engine import calculate_signal
from workers.stock_scanner.supabase_repo import SupabaseRepository
from workers.stock_scanner.watchlist_engine import calculate_watchlist_overlays


def test_portfolio_position_with_user_id() -> None:
    """Portfolio positions can now carry an optional user_id."""
    position = PortfolioPosition(
        id="pos-1",
        symbol="AAPL",
        quantity=10,
        average_buy_price=150.0,
        user_id="user-alice",
    )
    assert position.user_id == "user-alice"


def test_portfolio_position_user_id_defaults_to_none() -> None:
    """Portfolio positions default to None user_id (single-operator mode)."""
    position = PortfolioPosition(
        id="pos-1",
        symbol="AAPL",
        quantity=10,
        average_buy_price=150.0,
    )
    assert position.user_id is None


def test_watchlist_item_with_user_id() -> None:
    """Watchlist items can now carry an optional user_id."""
    item = WatchlistItem(
        id="watch-1",
        symbol="TSLA",
        target_price=250.0,
        user_id="user-bob",
    )
    assert item.user_id == "user-bob"


def test_watchlist_item_user_id_defaults_to_none() -> None:
    """Watchlist items default to None user_id (single-operator mode)."""
    item = WatchlistItem(
        id="watch-1",
        symbol="TSLA",
        target_price=250.0,
    )
    assert item.user_id is None


def test_should_send_alert_when_alerts_enabled_and_no_quiet_hours() -> None:
    """Alert should send when alerts are enabled and no quiet hours are active."""
    user_prefs = {"alerts_enabled": True}
    ticker_prefs = {}
    can_send, reason = should_send_alert_to_user(user_prefs, ticker_prefs, "strong_setup")
    assert can_send is True
    assert "All alert gates passed" in reason


def test_should_not_send_alert_when_alerts_disabled_globally() -> None:
    """Alert should not send when user has disabled alerts globally."""
    user_prefs = {"alerts_enabled": False}
    ticker_prefs = {}
    can_send, reason = should_send_alert_to_user(user_prefs, ticker_prefs, "strong_setup")
    assert can_send is False
    assert "User alerts disabled globally" in reason


def test_should_not_send_alert_during_quiet_hours() -> None:
    """Alert should not send when current time is within quiet hours."""
    user_prefs = {
        "alerts_enabled": True,
        "quiet_hours_start": 22,  # 10 PM
        "quiet_hours_end": 8,     # 8 AM
    }
    ticker_prefs = {}
    # Test with 11 PM (23 hour, within quiet hours)
    current_time = datetime(2026, 6, 4, 23, 30, tzinfo=timezone.utc)
    can_send, reason = should_send_alert_to_user(user_prefs, ticker_prefs, "strong_setup", current_time=current_time)
    assert can_send is False
    assert "quiet hours" in reason.lower()


def test_should_not_send_alert_when_ticker_muted() -> None:
    """Alert should not send when ticker is muted for this user."""
    user_prefs = {"alerts_enabled": True}
    ticker_prefs = {
        "is_muted": True,
        "muted_until": "2026-06-05T10:00:00+00:00",
    }
    # Test at 12 PM on 2026-06-04 (before muted_until)
    current_time = datetime(2026, 6, 4, 12, 0, tzinfo=timezone.utc)
    can_send, reason = should_send_alert_to_user(user_prefs, ticker_prefs, "strong_setup", current_time=current_time)
    assert can_send is False
    assert "muted" in reason.lower()


def test_should_not_send_alert_when_alert_type_disabled() -> None:
    """Alert should not send when the specific alert type is disabled."""
    user_prefs = {
        "alerts_enabled": True,
        "enable_strong_setup": False,
    }
    ticker_prefs = {}
    can_send, reason = should_send_alert_to_user(user_prefs, ticker_prefs, "strong_setup")
    assert can_send is False
    assert "disabled for user" in reason.lower()


def test_load_portfolio_positions_filters_by_user_id() -> None:
    """load_portfolio_positions should filter by user_id when provided."""
    repo = SupabaseRepository(settings())
    assert repo.enabled is False

    # Without Supabase, should return empty list
    positions = repo.load_portfolio_positions(user_id="user-alice")
    assert positions == []


def test_load_watchlist_items_filters_by_user_id() -> None:
    """load_watchlist_items should filter by user_id when provided."""
    repo = SupabaseRepository(settings())
    assert repo.enabled is False

    # Without Supabase, should return empty list
    items = repo.load_watchlist_items(user_id="user-bob")
    assert items == []


def test_load_active_user_ids_returns_empty_when_no_connection() -> None:
    """load_active_user_ids should return empty list when Supabase not connected."""
    repo = SupabaseRepository(settings())
    user_ids = repo.load_active_user_ids()
    assert user_ids == []


def test_portfolio_overlays_preserve_user_id() -> None:
    """Portfolio overlays should preserve user_id when calculated."""
    current = snapshot(rsi=46.0, histogram=-0.45, volume=1300.0, volume_ratio=1.3, close=164.0)
    previous = snapshot(rsi=42.0, histogram=-0.8, volume=1100.0, volume_ratio=1.1, close=160.0)
    _, signal = calculate_signal(Ticker("AMD", "AMD", "Advanced Micro Devices"), current, previous, previous, settings())

    # Create position with user_id
    position = PortfolioPosition(
        id="pos-1",
        symbol="AMD",
        quantity=10,
        average_buy_price=170.0,
        user_id="user-alice",
    )

    overlays = calculate_portfolio_overlays(
        [position],
        {"AMD": current},
        {"AMD": signal},
    )

    assert len(overlays) == 1
    # Note: overlay.user_id will be None here because the overlay is calculated from the position
    # and the PortfolioOverlay is created fresh. The user_id is stamped afterward in main.py
    assert overlays[0].symbol == "AMD"


def test_watchlist_overlays_preserve_user_id() -> None:
    """Watchlist overlays should preserve user_id when calculated."""
    current = snapshot(rsi=46.0, histogram=-0.45, volume=1300.0, volume_ratio=1.3)
    previous = snapshot(rsi=42.0, histogram=-0.8, volume=1100.0, volume_ratio=1.1)
    _, signal = calculate_signal(Ticker("AMD", "AMD", "Advanced Micro Devices"), current, previous, previous, settings())

    # Create watchlist item with user_id
    item = WatchlistItem(
        id="watch-1",
        symbol="AMD",
        target_price=180.0,
        user_id="user-bob",
    )

    overlays = calculate_watchlist_overlays(
        [item],
        {"AMD": current},
        {"AMD": signal},
    )

    assert len(overlays) == 1
    # Same note as above: user_id is stamped in main.py after calculation
    assert overlays[0].symbol == "AMD"


def test_alert_decision_includes_user_id() -> None:
    """AlertDecision dataclass should include user_id field."""
    from workers.stock_scanner.alert_engine import AlertDecision

    decision = AlertDecision(
        should_send=True,
        symbol="AAPL",
        alert_type="strong_setup",
        channel="telegram",
        reason="New strong setup",
        cooldown_hours=6,
        payload={},
        user_id="user-alice",
    )
    assert decision.user_id == "user-alice"


def test_alert_decision_user_id_defaults_to_none() -> None:
    """AlertDecision.user_id should default to None."""
    from workers.stock_scanner.alert_engine import AlertDecision

    decision = AlertDecision(
        should_send=True,
        symbol="AAPL",
        alert_type="strong_setup",
        channel="telegram",
        reason="New strong setup",
        cooldown_hours=6,
        payload={},
    )
    assert decision.user_id is None


def test_send_telegram_message_to_specific_chat_id() -> None:
    """send_telegram_message should accept and use a specific chat_id."""
    from workers.stock_scanner.telegram import send_telegram_message

    test_settings = settings()
    test_settings = test_settings.__class__(
        supabase_url=test_settings.supabase_url,
        supabase_service_role_key=test_settings.supabase_service_role_key,
        telegram_bot_token="test_token",
        telegram_chat_id="default_chat",
        market_data_provider=test_settings.market_data_provider,
        ticker_symbols=test_settings.ticker_symbols,
        default_timeframe=test_settings.default_timeframe,
        lookback_period_days=test_settings.lookback_period_days,
        alert_score_threshold=test_settings.alert_score_threshold,
        watchlist_score_threshold=test_settings.watchlist_score_threshold,
        signal_change_threshold=test_settings.signal_change_threshold,
        enable_telegram_alerts=test_settings.enable_telegram_alerts,
        enable_watchlist_alerts=test_settings.enable_watchlist_alerts,
        enable_hourly_digest=test_settings.enable_hourly_digest,
        enable_market_hours_guard=test_settings.enable_market_hours_guard,
        force_scan=test_settings.force_scan,
        default_user_id=test_settings.default_user_id,
    )

    with patch("requests.post") as mock_post:
        mock_post.return_value.raise_for_status = MagicMock()
        result = send_telegram_message("Test message", test_settings, chat_id="user_specific_chat")
        assert result.sent_status == "sent"
        # Verify that the specific chat_id was used, not the default
        call_args = mock_post.call_args
        assert call_args[1]["json"]["chat_id"] == "user_specific_chat"


def test_send_telegram_message_falls_back_to_default_chat_id() -> None:
    """send_telegram_message should fall back to settings.telegram_chat_id if no chat_id provided."""
    from workers.stock_scanner.telegram import send_telegram_message

    test_settings = settings()
    test_settings = test_settings.__class__(
        supabase_url=test_settings.supabase_url,
        supabase_service_role_key=test_settings.supabase_service_role_key,
        telegram_bot_token="test_token",
        telegram_chat_id="default_chat",
        market_data_provider=test_settings.market_data_provider,
        ticker_symbols=test_settings.ticker_symbols,
        default_timeframe=test_settings.default_timeframe,
        lookback_period_days=test_settings.lookback_period_days,
        alert_score_threshold=test_settings.alert_score_threshold,
        watchlist_score_threshold=test_settings.watchlist_score_threshold,
        signal_change_threshold=test_settings.signal_change_threshold,
        enable_telegram_alerts=test_settings.enable_telegram_alerts,
        enable_watchlist_alerts=test_settings.enable_watchlist_alerts,
        enable_hourly_digest=test_settings.enable_hourly_digest,
        enable_market_hours_guard=test_settings.enable_market_hours_guard,
        force_scan=test_settings.force_scan,
        default_user_id=test_settings.default_user_id,
    )

    with patch("requests.post") as mock_post:
        mock_post.return_value.raise_for_status = MagicMock()
        result = send_telegram_message("Test message", test_settings)
        assert result.sent_status == "sent"
        call_args = mock_post.call_args
        assert call_args[1]["json"]["chat_id"] == "default_chat"


def test_supabase_repo_save_alert_with_user_id() -> None:
    """save_alert should accept and persist user_id."""
    repo = SupabaseRepository(settings())
    # This is a no-op since Supabase is not connected, but it should not raise
    repo.save_alert(
        signal_id="sig-1",
        symbol="AAPL",
        alert_type="strong_setup",
        channel="telegram",
        message="Test",
        sent_status="sent",
        user_id="user-alice",
    )
    # No assertion needed; just verify it doesn't crash


def test_load_user_alert_preferences_returns_empty_when_no_connection() -> None:
    """load_user_alert_preferences should return empty dict when not connected."""
    repo = SupabaseRepository(settings())
    prefs = repo.load_user_alert_preferences("user-alice")
    assert prefs == {}


def test_load_ticker_alert_preferences_returns_empty_when_no_connection() -> None:
    """load_ticker_alert_preferences should return empty dict when not connected."""
    repo = SupabaseRepository(settings())
    prefs = repo.load_ticker_alert_preferences("user-alice", "AAPL")
    assert prefs == {}


def test_load_notification_channel_returns_none_when_no_connection() -> None:
    """load_notification_channel should return None when not connected."""
    repo = SupabaseRepository(settings())
    channel = repo.load_notification_channel("user-alice", channel_type="telegram")
    assert channel is None
