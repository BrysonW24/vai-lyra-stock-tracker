from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from workers.stock_scanner.config import Settings


@dataclass(frozen=True)
class DispatchResult:
    attempted: bool
    ok: bool
    deduped: bool = False
    error_message: str | None = None
    response: dict | None = None


def alert_type_to_notification_type(alert_type: str) -> str:
    if alert_type.startswith("watchlist_price_move"):
        return "watchlist_price_move"
    if alert_type.startswith("portfolio_price_move"):
        return "portfolio_price_move"
    if alert_type == "portfolio_risk":
        return "portfolio_risk"
    if alert_type == "signal_invalidated":
        return "signal_alert"
    if alert_type in {"strong_setup", "score_jump", "watchlist_upgrade"}:
        return "signal_alert"
    return "signal_alert"


def dispatch_notification(
    settings: Settings,
    *,
    user_id: str | None,
    symbol: str,
    alert_type: str,
    title: str,
    body: str,
    reason: str,
    payload: dict,
    relevance_score: float = 100,
    notification_type: str | None = None,
    url: str | None = None,
    performance_pct: float | None = None,
) -> DispatchResult:
    """POST one event to the JS notification router. `notification_type` overrides the
    alert_type mapping for event families that have no scanner alert_type (daily_digest,
    weekly_report, signal_followup); `url` overrides the deep link the same way.
    `performance_pct` is the engine-measured period return for outcome-reporting types
    (the periodic reviews, closed trades) - it drives the renderer's performance badge,
    so only pass a number actually computed from stored candles/positions."""
    if not user_id or not settings.notification_dispatch_url or not settings.notification_dispatch_secret:
        return DispatchResult(attempted=False, ok=False, error_message="notification dispatch not configured")

    if notification_type is None:
        notification_type = alert_type_to_notification_type(alert_type)
    day = datetime.now(timezone.utc).date().isoformat()
    dedupe_key = payload.get("dedupe_key") or f"{notification_type}:{symbol}:{alert_type}:{day}"
    if url is None:
        url = "/portfolio" if notification_type.startswith("portfolio") else "/watchlist" if notification_type.startswith("watchlist") else f"/tickers/{symbol}"

    request_body = {
        "userId": user_id,
        "type": notification_type,
        "severity": "high" if notification_type in {"portfolio_risk", "portfolio_price_move"} else "medium",
        "title": title,
        "body": body,
        "triggerReason": reason,
        "symbol": symbol,
        "relatedEntityType": "symbol",
        "relatedEntityId": symbol,
        "relevanceScore": relevance_score,
        "url": url,
        "payload": payload,
        "dedupeKey": dedupe_key,
    }
    if performance_pct is not None:
        request_body["performancePct"] = performance_pct

    req = Request(
        settings.notification_dispatch_url,
        data=json.dumps(request_body).encode("utf-8"),
        headers={
            "content-type": "application/json",
            "x-notification-secret": settings.notification_dispatch_secret,
        },
        method="POST",
    )

    try:
        with urlopen(req, timeout=8) as response:
            raw = response.read().decode("utf-8")
            parsed = json.loads(raw) if raw else {}
            return DispatchResult(
                attempted=True,
                ok=bool(parsed.get("ok", response.status < 400)),
                deduped=bool(parsed.get("deduped")),
                error_message="; ".join(parsed.get("errors") or []) or parsed.get("error"),
                response=parsed,
            )
    except HTTPError as exc:
        body_text = exc.read().decode("utf-8", errors="replace")[:300]
        return DispatchResult(attempted=True, ok=False, error_message=f"dispatch http {exc.code}: {body_text}")
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        return DispatchResult(attempted=True, ok=False, error_message=f"dispatch failed: {exc}")
