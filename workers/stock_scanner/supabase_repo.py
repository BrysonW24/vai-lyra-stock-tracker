from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from supabase import Client, create_client

from workers.stock_scanner.config import Settings
from workers.stock_scanner.models import (
    Candle,
    IndicatorSnapshot,
    PortfolioOverlay,
    PortfolioPosition,
    SignalResult,
    SignalScoreResult,
    Ticker,
    WatchlistItem,
    WatchlistOverlay,
)
from workers.stock_scanner.universe import NASDAQ_TECH_UNIVERSE, universe_by_symbol

logger = logging.getLogger("stock_scanner.supabase_repo")


class SupabaseRepository:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.client: Client | None = None
        if settings.supabase_enabled:
            self.client = create_client(settings.supabase_url, settings.supabase_service_role_key)

    @property
    def enabled(self) -> bool:
        return self.client is not None

    def seed_ticker_universe_if_empty(self) -> None:
        if not self.client:
            return

        result = self.client.table("stock_tickers").select("id").limit(1).execute()
        if result.data:
            return

        records = [
            {
                "symbol": ticker.symbol,
                "provider_symbol": ticker.provider_symbol or ticker.symbol,
                "company_name": ticker.company_name,
                "sector": ticker.sector,
                "industry": ticker.industry,
                "category": ticker.category,
                "exchange": ticker.exchange,
                "country": ticker.country,
                "currency": ticker.currency,
                "scan_timeframe": ticker.scan_timeframe,
                "is_active": True,
                "scan_enabled": True,
            }
            for ticker in NASDAQ_TECH_UNIVERSE
        ]
        self.client.table("stock_tickers").upsert(records, on_conflict="symbol").execute()

    def create_run(self, job_name: str, timeframe: str) -> str | None:
        if not self.client:
            return None

        result = (
            self.client.table("stock_scanner_runs")
            .insert({"job_name": job_name, "timeframe": timeframe, "status": "running"})
            .execute()
        )
        if result.data:
            return str(result.data[0]["id"])
        return None

    def finish_run(
        self,
        run_id: str | None,
        status: str,
        tickers_scanned: int = 0,
        candles_saved: int = 0,
        indicators_saved: int = 0,
        signals_created: int = 0,
        portfolio_overlays_created: int = 0,
        watchlist_overlays_created: int = 0,
        alerts_sent: int = 0,
        error_message: str | None = None,
        payload: dict[str, Any] | None = None,
    ) -> None:
        if not self.client or not run_id:
            return

        self.client.table("stock_scanner_runs").update(
            {
                "status": status,
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "tickers_scanned": tickers_scanned,
                "candles_saved": candles_saved,
                "indicators_saved": indicators_saved,
                "signals_created": signals_created,
                "portfolio_overlays_created": portfolio_overlays_created,
                "watchlist_overlays_created": watchlist_overlays_created,
                "alerts_sent": alerts_sent,
                "error_message": error_message,
                "payload": payload,
            }
        ).eq("id", run_id).execute()

    def load_active_tickers(self) -> list[Ticker]:
        universe = universe_by_symbol()
        if self.settings.ticker_symbols:
            return [
                universe.get(symbol, Ticker(symbol=symbol, provider_symbol=symbol, company_name=symbol))
                for symbol in self.settings.ticker_symbols
            ]

        if not self.client:
            return NASDAQ_TECH_UNIVERSE

        self.seed_ticker_universe_if_empty()
        result = (
            self.client.table("stock_tickers")
            .select("symbol, provider_symbol, company_name, sector, industry, category, exchange, country, currency, scan_timeframe")
            .eq("is_active", True)
            .eq("scan_enabled", True)
            .order("symbol")
            .execute()
        )

        if not result.data:
            return NASDAQ_TECH_UNIVERSE

        return [
            Ticker(
                symbol=row["symbol"],
                provider_symbol=row.get("provider_symbol") or row["symbol"],
                company_name=row.get("company_name") or row["symbol"],
                sector=row.get("sector") or "Technology",
                industry=row.get("industry") or "",
                category=row.get("category") or "",
                exchange=row.get("exchange") or "",
                country=row.get("country") or "US",
                currency=row.get("currency") or "USD",
                scan_timeframe=row.get("scan_timeframe") or self.settings.default_timeframe,
            )
            for row in result.data
        ]

    def save_candles(self, candles: list[Candle]) -> int:
        if not self.client or not candles:
            return 0
        records = [candle.to_record() for candle in candles]
        self.client.table("stock_candles").upsert(records, on_conflict="symbol,timeframe,candle_time").execute()
        return len(records)

    def save_indicator(self, indicator: IndicatorSnapshot) -> int:
        if not self.client:
            return 0
        self.client.table("stock_indicators").upsert(
            indicator.to_record(),
            on_conflict="symbol,timeframe,candle_time",
        ).execute()
        return 1

    def save_signal_score(self, score: SignalScoreResult) -> str | None:
        if not self.client:
            return None
        result = self.client.table("stock_signal_scores").upsert(
            score.to_record(),
            on_conflict="symbol,timeframe,candle_time",
        ).execute()
        if result.data:
            return str(result.data[0].get("id"))
        return None

    def save_signal(self, signal: SignalResult) -> str | None:
        if not self.client:
            return None
        result = self.client.table("stock_signals").upsert(
            signal.to_record(),
            on_conflict="symbol,timeframe,candle_time,signal_type",
        ).execute()
        if result.data:
            return str(result.data[0].get("id"))
        return None

    def get_previous_signal(self, symbol: str, timeframe: str, candle_time: datetime) -> dict[str, Any] | None:
        if not self.client:
            return None

        result = (
            self.client.table("stock_signals")
            .select("signal_score, signal_status, action_state, lifecycle_state, candle_time")
            .eq("symbol", symbol)
            .eq("timeframe", timeframe)
            .lt("candle_time", candle_time.isoformat())
            .order("candle_time", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            return dict(result.data[0])
        return None

    def load_active_user_ids(self) -> list[str]:
        """Load distinct active user_ids from portfolio_positions and watchlist_items.
        Returns empty list if not connected or no multi-user rows exist."""
        if not self.client:
            return []

        try:
            portfolio_result = (
                self.client.table("portfolio_positions")
                .select("user_id")
                .eq("is_active", True)
                .not_.is_("user_id", "null")
                .execute()
            )
            portfolio_user_ids = {row["user_id"] for row in (portfolio_result.data or []) if row.get("user_id")}

            watchlist_result = (
                self.client.table("watchlist_items")
                .select("user_id")
                .eq("is_active", True)
                .not_.is_("user_id", "null")
                .execute()
            )
            watchlist_user_ids = {row["user_id"] for row in (watchlist_result.data or []) if row.get("user_id")}

            return sorted(list(portfolio_user_ids | watchlist_user_ids))
        except Exception:
            # If the column doesn't exist yet (legacy schema), return empty
            return []

    def load_portfolio_positions(self, user_id: str | None = None) -> list[PortfolioPosition]:
        if not self.client:
            return []
        query = (
            self.client.table("portfolio_positions")
            .select("*")
            .eq("is_active", True)
        )
        if user_id is not None:
            query = query.eq("user_id", user_id)
        result = query.execute()
        return [
            PortfolioPosition(
                id=row.get("id"),
                symbol=row["symbol"],
                quantity=float(row.get("quantity") or 0),
                average_buy_price=float(row.get("average_buy_price") or 0),
                brokerage_fee=float(row.get("brokerage_fee") or 0),
                purchase_date=row.get("purchase_date"),
                target_allocation_pct=float(row["target_allocation_pct"]) if row.get("target_allocation_pct") is not None else None,
                stop_loss_price=float(row["stop_loss_price"]) if row.get("stop_loss_price") is not None else None,
                take_profit_price=float(row["take_profit_price"]) if row.get("take_profit_price") is not None else None,
                notes=row.get("notes"),
                user_id=row.get("user_id"),
            )
            for row in result.data or []
        ]

    def load_watchlist_items(self, user_id: str | None = None) -> list[WatchlistItem]:
        if not self.client:
            return []
        query = (
            self.client.table("watchlist_items")
            .select("*")
            .eq("is_active", True)
        )
        if user_id is not None:
            query = query.eq("user_id", user_id)
        result = query.execute()
        return [
            WatchlistItem(
                id=row.get("id"),
                symbol=row["symbol"],
                target_price=float(row["target_price"]) if row.get("target_price") is not None else None,
                target_signal_score=float(row.get("target_signal_score") if row.get("target_signal_score") is not None else 0.0),
                rsi_min=float(row.get("rsi_min") if row.get("rsi_min") is not None else 0.0),
                rsi_max=float(row.get("rsi_max") if row.get("rsi_max") is not None else 100.0),
                require_macd_histogram_rising=bool(row.get("require_macd_histogram_rising") if row.get("require_macd_histogram_rising") is not None else False),
                require_volume_ratio=float(row.get("require_volume_ratio") if row.get("require_volume_ratio") is not None else 0.0),
                reference_price=float(row["reference_price"]) if row.get("reference_price") is not None else None,
                movement_alert_pcts=tuple(int(value) for value in (row.get("movement_alert_pcts") if row.get("movement_alert_pcts") is not None else [-10, -5, 5, 10])),
                notes=row.get("notes"),
                user_id=row.get("user_id"),
            )
            for row in result.data or []
        ]

    def save_portfolio_overlays(self, overlays: list[PortfolioOverlay]) -> int:
        if not self.client or not overlays:
            return 0
        self.client.table("portfolio_signal_overlay").upsert(
            [overlay.to_record() for overlay in overlays],
            on_conflict="position_id,candle_time",
        ).execute()
        return len(overlays)

    def save_watchlist_overlays(self, overlays: list[WatchlistOverlay]) -> int:
        if not self.client or not overlays:
            return 0
        self.client.table("watchlist_signal_overlay").upsert(
            [overlay.to_record() for overlay in overlays],
            on_conflict="watchlist_item_id,candle_time",
        ).execute()
        return len(overlays)

    def recently_alerted(self, symbol: str, alert_type: str, cooldown_hours: int, user_id: str | None = None) -> bool:
        if not self.client:
            return False

        since = datetime.now(timezone.utc) - timedelta(hours=cooldown_hours)
        query = (
            self.client.table("stock_alerts")
            .select("id")
            .eq("symbol", symbol)
            .eq("alert_type", alert_type)
            # Only a delivery that actually reached the notification router should start the
            # cooldown. Counting failed/gated/skipped attempts made one failure suppress retries;
            # logging a skipped duplicate also slid the window forward forever.
            .eq("sent_status", "sent")
            .gte("created_at", since.isoformat())
        )
        if user_id is not None:
            query = query.eq("user_id", user_id)
        result = query.limit(1).execute()
        return bool(result.data)

    def save_alert(
        self,
        signal_id: str | None,
        # None for market-wide alerts (digests, weekly reports) that are not about one ticker.
        # stock_alerts.symbol is nullable WITH a foreign key to stock_tickers (migration 009), so a
        # sentinel string like "MARKET" is rejected by the FK - NULL is the correct value.
        symbol: str | None,
        alert_type: str,
        channel: str,
        message: str,
        sent_status: str,
        error_message: str | None = None,
        payload: dict[str, Any] | None = None,
        user_id: str | None = None,
    ) -> None:
        if not self.client:
            return

        self.client.table("stock_alerts").insert(
            {
                "signal_id": signal_id,
                "symbol": symbol,
                "channel": channel,
                "alert_type": alert_type,
                "message": message,
                "sent_status": sent_status,
                "sent_at": datetime.now(timezone.utc).isoformat() if sent_status == "sent" else None,
                "error_message": error_message,
                "payload": payload,
                "user_id": user_id,
            }
        ).execute()

    def load_user_alert_preferences(self, user_id: str) -> dict[str, Any]:
        """Load user-level alert preferences (alerts_enabled, alert_mode, quiet_hours, per-type toggles).
        Returns a dict; missing keys indicate defaults should be used."""
        if not self.client:
            return {}

        try:
            result = (
                self.client.table("user_alert_preferences")
                .select("*")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if result.data:
                return dict(result.data[0])
        except Exception as exc:
            # Log, don't swallow silently: a transient DB/auth error here would otherwise make a
            # real user look like they have no preferences, dropping their alerts.
            logger.warning("load_user_alert_preferences(%s) failed: %s", user_id, exc)
        return {}

    def load_ticker_alert_preferences(self, user_id: str, symbol: str) -> dict[str, Any]:
        """Load ticker-level alert preferences for a given user+symbol.
        Returns a dict; missing keys indicate defaults should be used."""
        if not self.client:
            return {}

        try:
            result = (
                self.client.table("ticker_alert_preferences")
                .select("*")
                .eq("user_id", user_id)
                .eq("symbol", symbol)
                .limit(1)
                .execute()
            )
            if result.data:
                return dict(result.data[0])
        except Exception as exc:
            logger.warning("load_ticker_alert_preferences(%s, %s) failed: %s", user_id, symbol, exc)
        return {}

    def load_notification_channel(self, user_id: str, channel_type: str = "telegram") -> dict[str, Any] | None:
        """Load the active notification channel for a user (e.g., Telegram chat_id).
        Returns None if not found."""
        if not self.client:
            return None

        try:
            result = (
                self.client.table("notification_channels")
                .select("*")
                .eq("user_id", user_id)
                .eq("channel_type", channel_type)
                .eq("is_active", True)
                .limit(1)
                .execute()
            )
            if result.data:
                return dict(result.data[0])
        except Exception as exc:
            # A swallowed error here silently drops the user's Telegram/WhatsApp channel -> no alert.
            logger.warning("load_notification_channel(%s, %s) failed: %s", user_id, channel_type, exc)
        return None

    def load_company_events_window(self, start: date, end: date) -> list[dict[str, Any]]:
        """company_events rows (earnings etc.) with event_date inside [start, end]."""
        if not self.client:
            return []
        result = (
            self.client.table("company_events")
            .select("event_id, event_date, event_type, ticker, title, importance")
            .gte("event_date", start.isoformat())
            .lte("event_date", end.isoformat())
            .order("event_date", desc=False)
            .limit(500)
            .execute()
        )
        return list(result.data or [])

    def load_upcoming_ipos(self, start: date, end: date) -> list[dict[str, Any]]:
        """ipos rows listing inside [start, end]."""
        if not self.client:
            return []
        result = (
            self.client.table("ipos")
            .select("symbol, company_name, ipo_date, exchange, status, valuation_usd_m")
            .gte("ipo_date", start.isoformat())
            .lte("ipo_date", end.isoformat())
            .limit(100)
            .execute()
        )
        return list(result.data or [])

    def upsert_market_calendar_events(self, rows: list[dict[str, Any]]) -> int:
        """Idempotent upsert of macro calendar rows on the event_id unique key (a full
        unique constraint - migration 044 doctrine: never target a partial index)."""
        if not self.client or not rows:
            return 0
        self.client.table("market_calendar_events").upsert(rows, on_conflict="event_id").execute()
        return len(rows)

    def load_snapshot_value_at_or_after(self, key: str, start: datetime) -> float | None:
        """A numeric payload field from the EARLIEST market-context snapshot at/after
        `start` - the window-open baseline for benchmark and AUD-terms lines. None when
        no snapshot covers the window (history only accrues once captures land) - callers
        omit the line, never guess."""
        if not self.client:
            return None
        result = (
            self.client.table("market_context_snapshots")
            .select("payload")
            .gte("captured_at", start.isoformat())
            .order("captured_at", desc=False)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        payload = rows[0].get("payload") if rows else None
        value = payload.get(key) if isinstance(payload, dict) else None
        return float(value) if value is not None else None

    def load_latest_snapshot_value(self, key: str) -> float | None:
        """Same field from the most recent snapshot."""
        if not self.client:
            return None
        result = (
            self.client.table("market_context_snapshots")
            .select("payload")
            .order("captured_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        payload = rows[0].get("payload") if rows else None
        value = payload.get(key) if isinstance(payload, dict) else None
        return float(value) if value is not None else None

    def load_latest_audusd(self) -> float | None:
        """AUD/USD from the most recent snapshot. None until the capture ships."""
        return self.load_latest_snapshot_value("audusd_price")

    def save_market_context_snapshot(
        self,
        payload: dict[str, Any],
        regime: str,
        fear_greed: int | None = None,
        vix: float | None = None,
    ) -> int:
        """Persist one market-context snapshot. Requires the market_context_snapshots
        table (sql/002_market_context.sql). No-op if Supabase is not configured."""
        if not self.client:
            return 0

        self.client.table("market_context_snapshots").insert(
            {
                # captured_at is NOT NULL with no column default - omitting it made every
                # insert violate the constraint, and the caller's broad exception guard
                # swallowed the failure, so the hourly macro archive stayed EMPTY while
                # the log said "skipped (non-fatal)". Same failure family as v0.41/v0.42.
                "captured_at": payload.get("captured_at") or datetime.now(timezone.utc).isoformat(),
                "payload": payload,
                "regime": regime,
                "fear_greed": fear_greed,
                "vix": vix,
            }
        ).execute()
        return 1

    # ------------------------------------------------------------------
    # Outcome labeling + digest support (nightly maintenance job)

    def load_signals_for_outcomes(
        self,
        since: datetime,
        statuses: tuple[str, ...],
        timeframe: str,
    ) -> list[dict[str, Any]]:
        """Signals worth labeling with forward returns: setups within the lookback window."""
        if not self.client:
            return []
        result = (
            self.client.table("stock_signals")
            .select("symbol, candle_time, signal_type, signal_status, signal_score")
            .in_("signal_status", list(statuses))
            .eq("timeframe", timeframe)
            .gte("candle_time", since.isoformat())
            .order("candle_time", desc=False)
            .execute()
        )
        return [dict(row) for row in (result.data or [])]

    def load_existing_outcome_keys(self, since: datetime) -> set[tuple[str, str, str, str]]:
        """Keys already labeled, so the nightly job stays idempotent and cheap."""
        if not self.client:
            return set()
        result = (
            self.client.table("signal_outcomes")
            .select("symbol, signal_candle_time, signal_type, signal_status")
            .gte("signal_candle_time", since.isoformat())
            .execute()
        )
        return {
            (
                str(row["symbol"]),
                str(row["signal_candle_time"]),
                str(row["signal_type"]),
                str(row["signal_status"]),
            )
            for row in (result.data or [])
        }

    def first_close_at_or_after(self, symbol: str, timeframe: str, start: datetime) -> float | None:
        """Close of the earliest stored candle at/after `start` - the period-start baseline
        the review job measures from. Same stored-candle source the scores used, so every
        published performance number is reproducible. None when no candle covers the window."""
        if not self.client:
            return None
        result = (
            self.client.table("stock_candles")
            .select("close")
            .eq("symbol", symbol)
            .eq("timeframe", timeframe)
            .gte("candle_time", start.isoformat())
            .order("candle_time", desc=False)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        value = rows[0].get("close") if rows else None
        return float(value) if value is not None else None

    def latest_close(self, symbol: str, timeframe: str) -> float | None:
        """Close of the most recent stored candle for the symbol. None when never scanned."""
        if not self.client:
            return None
        result = (
            self.client.table("stock_candles")
            .select("close")
            .eq("symbol", symbol)
            .eq("timeframe", timeframe)
            .order("candle_time", desc=True)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        value = rows[0].get("close") if rows else None
        return float(value) if value is not None else None

    def load_candles_from(self, symbol: str, timeframe: str, start: datetime) -> list[Candle]:
        """Stored candles from `start` onward (ascending). Outcomes are computed from the
        SAME stored candles the score used, so every published number is reproducible."""
        if not self.client:
            return []
        result = (
            self.client.table("stock_candles")
            .select("symbol, timeframe, candle_time, open, high, low, close, adjusted_close, volume, source")
            .eq("symbol", symbol)
            .eq("timeframe", timeframe)
            .gte("candle_time", start.isoformat())
            .order("candle_time", desc=False)
            .execute()
        )
        candles: list[Candle] = []
        for row in result.data or []:
            candles.append(
                Candle(
                    symbol=str(row["symbol"]),
                    timeframe=str(row["timeframe"]),
                    candle_time=datetime.fromisoformat(str(row["candle_time"])),
                    open=float(row["open"]) if row.get("open") is not None else None,
                    high=float(row["high"]) if row.get("high") is not None else None,
                    low=float(row["low"]) if row.get("low") is not None else None,
                    close=float(row["close"]) if row.get("close") is not None else None,
                    adjusted_close=float(row["adjusted_close"]) if row.get("adjusted_close") is not None else None,
                    volume=float(row["volume"]) if row.get("volume") is not None else None,
                    source=str(row.get("source") or "supabase"),
                )
            )
        return candles

    def save_signal_outcomes(self, records: list[dict[str, Any]]) -> int:
        if not self.client or not records:
            return 0
        self.client.table("signal_outcomes").upsert(
            records,
            on_conflict="symbol,signal_candle_time,signal_type,signal_status",
        ).execute()
        return len(records)

    def followup_already_sent(self, symbol: str, signal_candle_time_iso: str) -> bool:
        """One follow-up per signal, forever - deduped against the alert log by the
        exact signal candle time carried in the alert payload."""
        if not self.client:
            return False
        result = (
            self.client.table("stock_alerts")
            .select("id")
            .eq("symbol", symbol)
            .eq("alert_type", "signal_followup")
            .eq("payload->>signal_candle_time", signal_candle_time_iso)
            .limit(1)
            .execute()
        )
        return bool(result.data)

    def load_alerts_since(self, since: datetime, user_id: str | None = None) -> list[dict[str, Any]]:
        """Alerts recorded since `since` - the digest's raw material."""
        if not self.client:
            return []
        query = (
            self.client.table("stock_alerts")
            .select("symbol, alert_type, sent_status, created_at, user_id")
            .gte("created_at", since.isoformat())
        )
        if user_id is not None:
            query = query.eq("user_id", user_id)
        result = query.order("created_at", desc=False).limit(500).execute()
        return [dict(row) for row in (result.data or [])]

    def load_latest_signals_snapshot(self, timeframe: str, since: datetime) -> list[dict[str, Any]]:
        """Most recent signal row per symbol within the window (client-side dedupe)."""
        if not self.client:
            return []
        result = (
            self.client.table("stock_signals")
            .select("symbol, candle_time, signal_status, signal_score, signal_score_delta")
            .eq("timeframe", timeframe)
            .gte("candle_time", since.isoformat())
            .order("candle_time", desc=True)
            .limit(2000)
            .execute()
        )
        latest_by_symbol: dict[str, dict[str, Any]] = {}
        for row in result.data or []:
            symbol = str(row["symbol"])
            if symbol not in latest_by_symbol:
                latest_by_symbol[symbol] = dict(row)
        return list(latest_by_symbol.values())
