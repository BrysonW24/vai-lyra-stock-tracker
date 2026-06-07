from __future__ import annotations

from dataclasses import dataclass

import requests

from workers.stock_scanner.config import Settings
from workers.stock_scanner.models import SignalResult, Ticker


@dataclass(frozen=True)
class TelegramResult:
    sent_status: str
    error_message: str | None = None


def build_telegram_message(signal: SignalResult, ticker: Ticker, previous_score: float | None = None) -> str:
    title = "Tech Momentum Signal"
    if signal.signal_status == "watchlist_setup":
        title = "Watchlist Setup"

    previous_line = f"Previous score: {previous_score:.0f}/100\n" if previous_score is not None else ""
    metrics = signal.raw_payload
    triggered = signal.explanation.get("triggered_because", [])
    triggered_lines = "\n".join(f"- {reason}" for reason in triggered[:5]) or "- No trigger reasons recorded"

    return (
        f"{title}\n\n"
        f"{signal.symbol} - {ticker.company_name or signal.symbol}\n"
        f"Score: {signal.signal_score:.0f}/100\n"
        f"Status: {signal.signal_status.replace('_', ' ')}\n"
        f"Action: {signal.action_state.replace('_', ' ')}\n"
        f"Timeframe: {signal.timeframe}\n"
        f"{previous_line}\n"
        "Metrics:\n"
        f"RSI: {float(metrics.get('rsi_14') or 0):.2f}\n"
        f"MACD Hist: {float(metrics.get('macd_histogram') or 0):.2f}\n"
        f"Volume: {float(metrics.get('volume_ratio') or 0):.2f}x\n"
        f"Distance from 60-period low: {float(metrics.get('distance_from_60_period_low') or 0):.2f}%\n\n"
        "Triggered because:\n"
        f"{triggered_lines}\n\n"
        "Suggested action:\n"
        "Review chart, earnings date, broader market trend, and position risk before acting.\n\n"
        "Not financial advice."
    )


def build_invalidation_message(signal: SignalResult, ticker: Ticker, previous_score: float | None = None) -> str:
    previous = f"{previous_score:.0f}/100" if previous_score is not None else "unknown"
    return (
        "Signal Invalidated\n\n"
        f"{signal.symbol} - {ticker.company_name or signal.symbol}\n"
        f"Previous score: {previous}\n"
        f"Current score: {signal.signal_score:.0f}/100\n\n"
        "Reason:\n"
        "Momentum recovery failed or the score fell below the watchlist threshold.\n\n"
        "Action:\n"
        f"{signal.action_state.replace('_', ' ')}.\n\n"
        "Not financial advice."
    )


def send_telegram_message(message: str, settings: Settings, chat_id: str | None = None) -> TelegramResult:
    """Send a Telegram message to a specific chat_id.

    If chat_id is not provided, falls back to settings.telegram_chat_id (single-operator mode).
    """
    if not settings.telegram_bot_token:
        return TelegramResult(sent_status="skipped", error_message="Telegram bot token missing")

    # Use provided chat_id or fall back to default
    target_chat_id = chat_id or settings.telegram_chat_id
    if not target_chat_id:
        return TelegramResult(sent_status="skipped", error_message="No chat_id provided and no default configured")

    endpoint = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"

    try:
        response = requests.post(
            endpoint,
            json={
                "chat_id": target_chat_id,
                "text": message[:4000],
                "disable_web_page_preview": True,
            },
            timeout=10,
        )
        response.raise_for_status()
    except Exception as exc:
        return TelegramResult(sent_status="failed", error_message=str(exc))

    return TelegramResult(sent_status="sent")
