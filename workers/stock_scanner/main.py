from __future__ import annotations

from dataclasses import replace

from workers.stock_scanner.alert_engine import (
    portfolio_alert_decisions,
    should_send_alert_to_user,
    signal_alert_decision,
    watchlist_alert_decisions,
)
from workers.stock_scanner.config import load_settings
from workers.stock_scanner.indicators import calculate_indicators
from workers.stock_scanner.logger import get_logger
from workers.stock_scanner.market_context import build_market_context
from workers.stock_scanner.market_data import create_provider
from workers.stock_scanner.models import IndicatorSnapshot, SignalResult, Ticker
from workers.stock_scanner.notification_dispatch import dispatch_notification
from workers.stock_scanner.portfolio_engine import calculate_portfolio_overlays
from workers.stock_scanner.scheduler_guard import should_run_now
from workers.stock_scanner.signal_engine import calculate_signal
from workers.stock_scanner.supabase_repo import SupabaseRepository
from workers.stock_scanner.telegram import build_invalidation_message, build_telegram_message, send_telegram_message
from workers.stock_scanner.watchlist_engine import calculate_watchlist_overlays


LOGGER = get_logger()


def _send_and_log_alert(
    repository: SupabaseRepository,
    signal_id: str | None,
    ticker: Ticker | None,
    signal: SignalResult | None,
    decision_symbol: str,
    alert_type: str,
    message: str,
    payload: dict,
    cooldown_hours: int,
    settings,
    user_id: str | None = None,
    chat_id: str | None = None,
) -> int:
    if repository.recently_alerted(decision_symbol, alert_type, cooldown_hours, user_id=user_id):
        repository.save_alert(
            signal_id=signal_id,
            symbol=decision_symbol,
            alert_type=alert_type,
            channel="telegram",
            message=message,
            sent_status="skipped",
            error_message="Skipped by duplicate cooldown",
            payload={**payload, "skip_reason": "duplicate_cooldown"},
            user_id=user_id,
        )
        return 0

    result = send_telegram_message(message, settings, chat_id=chat_id)
    repository.save_alert(
        signal_id=signal_id,
        symbol=decision_symbol,
        alert_type=alert_type,
        channel="telegram",
        message=message,
        sent_status=result.sent_status,
        error_message=result.error_message,
        payload=payload,
        user_id=user_id,
    )
    return 1 if result.sent_status == "sent" else 0


def _message_for_signal(signal: SignalResult, ticker: Ticker, previous_score: float | None, alert_type: str) -> str:
    if alert_type == "signal_invalidated":
        return build_invalidation_message(signal, ticker, previous_score)
    return build_telegram_message(signal, ticker, previous_score)


def _signal_dispatch_body(signal: SignalResult) -> str:
    """Concise stat line for the multi-channel dispatch body. The JS notification layer adds the
    'Why' line and the 'Research, not advice.' suffix, so this stays a clean data line - unlike the
    verbose legacy Telegram message (which carries its own multi-section framing + disclaimer)."""
    metrics = signal.raw_payload or {}
    head = f"Score {signal.signal_score:.0f}/100"
    if signal.signal_score_delta is not None:
        head += f" ({signal.signal_score_delta:+.0f})"
    parts = [head]
    rsi = metrics.get("rsi_14")
    if rsi is not None:
        parts.append(f"RSI {float(rsi):.0f}")
    macd_hist = metrics.get("macd_histogram")
    if macd_hist is not None:
        parts.append(f"MACD hist {float(macd_hist):+.2f}")
    vol = metrics.get("volume_ratio")
    if vol is not None:
        parts.append(f"vol {float(vol):.1f}x")
    action = (signal.action_state or "").replace("_", " ")
    if action:
        parts.append(action)
    return ", ".join(parts)


def _route_signal_alert(repository, settings, signal_id, ticker, signal, decision, message) -> int:
    """Deliver a signal alert. Prefers multi-channel dispatch (web push + WhatsApp + Telegram)
    stamped with the operator user_id, and falls back to legacy single-operator Telegram ONLY when
    dispatch is unconfigured. Previously signal alerts hit legacy Telegram exclusively and never
    reached web push - the core alert type the user actually watches."""
    user_id = settings.default_user_id or None
    rich_payload = {"reason": decision.reason, **decision.payload, "signal_score": getattr(signal, "signal_score", None)}

    if user_id and settings.notification_dispatch_enabled:
        # Respect the user's prefs (tz-aware quiet hours + per-type toggles) before dispatching.
        user_prefs = repository.load_user_alert_preferences(user_id)
        can_send, gate_reason = should_send_alert_to_user(user_prefs, {}, decision.alert_type)
        if not can_send:
            LOGGER.info("Signal alert gated for %s on %s: %s", user_id, decision.symbol, gate_reason)
            repository.save_alert(
                signal_id=signal_id, symbol=decision.symbol, alert_type=decision.alert_type,
                channel="multi_channel", message=message, sent_status="gated",
                error_message=gate_reason, payload=rich_payload, user_id=user_id,
            )
            return 0
        dispatch_result = dispatch_notification(
            settings,
            user_id=user_id,
            symbol=decision.symbol,
            alert_type=decision.alert_type,
            title=f"{decision.symbol} {decision.alert_type.replace('_', ' ')}",
            body=_signal_dispatch_body(signal),
            reason=decision.reason,
            payload=rich_payload,
            relevance_score=float(getattr(signal, "signal_score", 0) or 0),
        )
        repository.save_alert(
            signal_id=signal_id, symbol=decision.symbol, alert_type=decision.alert_type,
            channel="multi_channel", message=message,
            sent_status="sent" if dispatch_result.ok else "failed",
            error_message=dispatch_result.error_message,
            payload={**rich_payload, "dispatch_response": dispatch_result.response, "deduped": dispatch_result.deduped},
            user_id=user_id,
        )
        if dispatch_result.ok:
            return 0 if dispatch_result.deduped else 1
        return 0

    # Legacy fallback: single-operator Telegram (dispatch unconfigured).
    return _send_and_log_alert(
        repository, signal_id, ticker, signal, decision.symbol, decision.alert_type,
        message, {"reason": decision.reason, **decision.payload}, decision.cooldown_hours, settings,
    )


def _capture_market_context(repository: SupabaseRepository) -> None:
    """Best-effort market-context snapshot. Fully self-contained: any failure here
    (network, schema, parsing) is logged and swallowed so it can NEVER break the
    deterministic signal scan, which remains the source of truth."""
    try:
        snapshot = build_market_context()
        LOGGER.info("Market regime: %s (VIX=%s, Fear&Greed=%s)", snapshot.regime, snapshot.vix_price, snapshot.fear_greed_index)
        repository.save_market_context_snapshot(
            payload=snapshot.to_dict(),
            regime=snapshot.regime,
            fear_greed=snapshot.fear_greed_index,
            vix=snapshot.vix_price,
        )
    except Exception:  # noqa: BLE001 - market context is non-critical context, never fatal
        LOGGER.warning("Market-context capture skipped (non-fatal)", exc_info=True)


def main() -> None:
    settings = load_settings()
    if settings.default_user_id and not settings.notification_dispatch_enabled:
        LOGGER.warning(
            "DEFAULT_USER_ID is set but notification dispatch is unconfigured "
            "(APP_BASE_URL / NOTIFICATION_DISPATCH_SECRET) - web push + WhatsApp will NOT fire; "
            "only legacy single-operator Telegram. Set them in the GitHub Actions Production env."
        )
    repository = SupabaseRepository(settings)
    provider = create_provider(settings.market_data_provider)

    run_id = repository.create_run("hourly_stock_scanner", settings.default_timeframe)
    tickers_scanned = 0
    candles_saved = 0
    indicators_saved = 0
    signals_created = 0
    portfolio_overlays_created = 0
    watchlist_overlays_created = 0
    alerts_sent = 0

    latest_by_symbol: dict[str, IndicatorSnapshot] = {}
    signal_by_symbol: dict[str, SignalResult] = {}
    signal_id_by_symbol: dict[str, str | None] = {}
    ticker_by_symbol: dict[str, Ticker] = {}

    try:
        if not should_run_now(settings):
            LOGGER.info("Scanner skipped by market-hours guard")
            repository.finish_run(run_id, status="skipped")
            return

        _capture_market_context(repository)

        tickers = repository.load_active_tickers()
        LOGGER.info("Scanning %s tickers with %s", len(tickers), settings.market_data_provider)

        for ticker in tickers:
            timeframe = ticker.scan_timeframe or settings.default_timeframe
            provider_symbol = ticker.provider_symbol or ticker.symbol
            ticker_by_symbol[ticker.symbol] = ticker
            LOGGER.info("Fetching %s (%s)", ticker.symbol, provider_symbol)

            raw_candles = provider.fetch_ohlcv(provider_symbol, timeframe, settings.lookback_period_days)
            candles = [replace(candle, symbol=ticker.symbol, timeframe=timeframe) for candle in raw_candles]
            if not candles:
                LOGGER.warning("No candles returned for %s", ticker.symbol)
                continue

            candles_saved += repository.save_candles(candles)
            indicators = calculate_indicators(candles)
            if len(indicators) < 3:
                LOGGER.warning("Not enough indicators for %s", ticker.symbol)
                continue

            latest = indicators[-1]
            previous = indicators[-2]
            two_periods_ago = indicators[-3]
            latest_by_symbol[ticker.symbol] = latest

            indicators_saved += repository.save_indicator(latest)
            previous_signal = repository.get_previous_signal(ticker.symbol, timeframe, latest.candle_time)
            score, signal = calculate_signal(ticker, latest, previous, two_periods_ago, settings, previous_signal)
            repository.save_signal_score(score)
            signal_id = repository.save_signal(signal)
            signal_by_symbol[ticker.symbol] = signal
            signal_id_by_symbol[ticker.symbol] = signal_id
            signals_created += 1
            tickers_scanned += 1

            decision = signal_alert_decision(signal, previous_signal, settings)
            if decision.should_send:
                previous_score_raw = previous_signal.get("signal_score") if previous_signal else None
                previous_score = float(previous_score_raw) if previous_score_raw is not None else None
                message = _message_for_signal(signal, ticker, previous_score, decision.alert_type)
                alerts_sent += _route_signal_alert(repository, settings, signal_id, ticker, signal, decision, message)

        # PHASE 3: Per-user overlay loop
        # Load global positions/watchlist (single-operator mode) or active user IDs (multi-user)
        all_portfolio_overlays: list = []
        all_watchlist_overlays: list = []

        active_user_ids = repository.load_active_user_ids()
        if active_user_ids:
            # Multi-user mode: loop over each active user
            LOGGER.info("Multi-user mode: processing %s active users", len(active_user_ids))
            for user_id in active_user_ids:
                user_portfolio_positions = repository.load_portfolio_positions(user_id=user_id)
                user_watchlist_items = repository.load_watchlist_items(user_id=user_id)

                user_portfolio_overlays = calculate_portfolio_overlays(user_portfolio_positions, latest_by_symbol, signal_by_symbol)
                user_watchlist_overlays = calculate_watchlist_overlays(user_watchlist_items, latest_by_symbol, signal_by_symbol)

                # Stamp user_id onto each overlay
                user_portfolio_overlays = [replace(overlay, user_id=user_id) for overlay in user_portfolio_overlays]
                user_watchlist_overlays = [replace(overlay, user_id=user_id) for overlay in user_watchlist_overlays]

                all_portfolio_overlays.extend(user_portfolio_overlays)
                all_watchlist_overlays.extend(user_watchlist_overlays)
        else:
            # Single-operator mode: fall back to legacy behavior
            portfolio_positions = repository.load_portfolio_positions()
            watchlist_items = repository.load_watchlist_items()
            portfolio_overlays = calculate_portfolio_overlays(portfolio_positions, latest_by_symbol, signal_by_symbol)
            watchlist_overlays = calculate_watchlist_overlays(watchlist_items, latest_by_symbol, signal_by_symbol)

            # Stamp the default_user_id if set
            if settings.default_user_id:
                portfolio_overlays = [replace(overlay, user_id=settings.default_user_id) for overlay in portfolio_overlays]
                watchlist_overlays = [replace(overlay, user_id=settings.default_user_id) for overlay in watchlist_overlays]

            all_portfolio_overlays = portfolio_overlays
            all_watchlist_overlays = watchlist_overlays

        portfolio_overlays_created = repository.save_portfolio_overlays(all_portfolio_overlays)
        watchlist_overlays_created = repository.save_watchlist_overlays(all_watchlist_overlays)

        # PHASE 4: Per-user alerts with gating
        all_decisions = portfolio_alert_decisions(all_portfolio_overlays) + watchlist_alert_decisions(all_watchlist_overlays, settings)
        for decision in all_decisions:
            if not decision.should_send:
                continue

            # For multi-user, check per-user alert preferences before sending
            chat_id = None
            if decision.user_id:
                user_prefs = repository.load_user_alert_preferences(decision.user_id)
                ticker_prefs = repository.load_ticker_alert_preferences(decision.user_id, decision.symbol)
                can_send, gate_reason = should_send_alert_to_user(user_prefs, ticker_prefs, decision.alert_type)
                if not can_send:
                    LOGGER.info("Alert gated for user %s on %s: %s", decision.user_id, decision.symbol, gate_reason)
                    repository.save_alert(
                        signal_id=None,
                        symbol=decision.symbol,
                        alert_type=decision.alert_type,
                        channel="telegram",
                        message="",
                        sent_status="gated",
                        error_message=gate_reason,
                        user_id=decision.user_id,
                    )
                    continue

                # Get user's notification channel (Telegram chat_id)
                channel = repository.load_notification_channel(decision.user_id, channel_type="telegram")
                if channel:
                    chat_id = channel.get("destination")

            signal = signal_by_symbol.get(decision.symbol)
            ticker = ticker_by_symbol.get(decision.symbol, Ticker(symbol=decision.symbol, provider_symbol=decision.symbol, company_name=decision.symbol))
            signal_id = signal_id_by_symbol.get(decision.symbol)
            if signal:
                message = _message_for_signal(signal, ticker, signal.previous_signal_score, decision.alert_type)
            else:
                message = f"{decision.alert_type.replace('_', ' ').title()}\n\n{decision.reason}\n\nNot financial advice."

            if decision.user_id and settings.notification_dispatch_enabled:
                dispatch_result = dispatch_notification(
                    settings,
                    user_id=decision.user_id,
                    symbol=decision.symbol,
                    alert_type=decision.alert_type,
                    title=f"{decision.symbol} {decision.alert_type.replace('_', ' ')}",
                    body=decision.reason,
                    reason=decision.reason,
                    payload={"reason": decision.reason, **decision.payload},
                    relevance_score=float(decision.payload.get("signal_score") or 100),
                )
                repository.save_alert(
                    signal_id=signal_id,
                    symbol=decision.symbol,
                    alert_type=decision.alert_type,
                    channel="multi_channel",
                    message=message,
                    sent_status="sent" if dispatch_result.ok else "failed",
                    error_message=dispatch_result.error_message,
                    payload={
                        "reason": decision.reason,
                        **decision.payload,
                        "dispatch_response": dispatch_result.response,
                        "deduped": dispatch_result.deduped,
                    },
                    user_id=decision.user_id,
                )
                if dispatch_result.ok:
                    alerts_sent += 0 if dispatch_result.deduped else 1
                    continue

            alerts_sent += _send_and_log_alert(
                repository,
                signal_id,
                ticker,
                signal,
                decision.symbol,
                decision.alert_type,
                message,
                {"reason": decision.reason, **decision.payload},
                decision.cooldown_hours,
                settings,
                user_id=decision.user_id,
                chat_id=chat_id,
            )

        repository.finish_run(
            run_id,
            status="success",
            tickers_scanned=tickers_scanned,
            candles_saved=candles_saved,
            indicators_saved=indicators_saved,
            signals_created=signals_created,
            portfolio_overlays_created=portfolio_overlays_created,
            watchlist_overlays_created=watchlist_overlays_created,
            alerts_sent=alerts_sent,
            payload={
                "symbols_scanned": sorted(signal_by_symbol.keys()),
                "portfolio_symbols": [overlay.symbol for overlay in all_portfolio_overlays],
                "watchlist_symbols": [overlay.symbol for overlay in all_watchlist_overlays],
            },
        )
        LOGGER.info(
            "Scanner finished: tickers=%s candles=%s indicators=%s signals=%s portfolio_overlays=%s watchlist_overlays=%s alerts=%s",
            tickers_scanned,
            candles_saved,
            indicators_saved,
            signals_created,
            portfolio_overlays_created,
            watchlist_overlays_created,
            alerts_sent,
        )
    except Exception as exc:
        LOGGER.exception("Scanner failed")
        repository.finish_run(
            run_id,
            status="failed",
            tickers_scanned=tickers_scanned,
            candles_saved=candles_saved,
            indicators_saved=indicators_saved,
            signals_created=signals_created,
            portfolio_overlays_created=portfolio_overlays_created,
            watchlist_overlays_created=watchlist_overlays_created,
            alerts_sent=alerts_sent,
            error_message=str(exc),
        )
        raise


if __name__ == "__main__":
    main()
