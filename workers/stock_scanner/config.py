from __future__ import annotations

import os
from dataclasses import dataclass


def _bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "y", "on"}


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if not raw:
        return default
    return int(raw)


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    telegram_bot_token: str
    telegram_chat_id: str
    market_data_provider: str
    ticker_symbols: tuple[str, ...]
    default_timeframe: str
    lookback_period_days: int
    alert_score_threshold: int
    watchlist_score_threshold: int
    signal_change_threshold: int
    enable_telegram_alerts: bool
    enable_watchlist_alerts: bool
    enable_hourly_digest: bool
    enable_market_hours_guard: bool
    force_scan: bool
    # Multi-user: in single-operator mode this stamps every overlay with one operator
    # id so the data fits the multi-user schema. The full per-user overlay loop (one set
    # of overlays per active user) is the next worker iteration. Empty = legacy mode.
    default_user_id: str = ""

    @property
    def supabase_enabled(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)

    @property
    def telegram_enabled(self) -> bool:
        return bool(self.enable_telegram_alerts and self.telegram_bot_token and self.telegram_chat_id)


def load_settings() -> Settings:
    return Settings(
        supabase_url=os.getenv("SUPABASE_URL", ""),
        supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
        telegram_bot_token=os.getenv("TELEGRAM_BOT_TOKEN", ""),
        telegram_chat_id=os.getenv("TELEGRAM_CHAT_ID", ""),
        market_data_provider=os.getenv("MARKET_DATA_PROVIDER", "yfinance"),
        ticker_symbols=tuple(
            symbol.strip().upper()
            for symbol in os.getenv("TICKER_SYMBOLS", "").split(",")
            if symbol.strip()
        ),
        default_timeframe=os.getenv("DEFAULT_TIMEFRAME", "1h"),
        lookback_period_days=_int_env("LOOKBACK_PERIOD_DAYS", 180),
        alert_score_threshold=_int_env("ALERT_SCORE_THRESHOLD", 75),
        watchlist_score_threshold=_int_env("WATCHLIST_SCORE_THRESHOLD", 60),
        signal_change_threshold=_int_env("SIGNAL_CHANGE_THRESHOLD", 8),
        enable_telegram_alerts=_bool_env("ENABLE_TELEGRAM_ALERTS", True),
        enable_watchlist_alerts=_bool_env("ENABLE_WATCHLIST_ALERTS", False),
        enable_hourly_digest=_bool_env("ENABLE_HOURLY_DIGEST", False),
        enable_market_hours_guard=_bool_env("ENABLE_MARKET_HOURS_GUARD", True),
        force_scan=_bool_env("FORCE_SCAN", False),
        default_user_id=os.getenv("DEFAULT_USER_ID", ""),
    )
