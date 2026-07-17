"""Daily digest + weekly report emitter: the loop-closer the notification types,
router rules, and default-ON preferences have promised since migration 024.

Composes an end-of-session summary from data the deterministic engine already
persisted (latest signals, alerts sent, labeled outcomes) and dispatches it through
the JS notification router as `daily_digest` (and `weekly_report` on Fridays UTC).
No number in the digest is invented here - everything is read back from the tables
the scanner and outcome job wrote.

Run: python -m workers.stock_scanner.digest_job (scheduled by nightly-maintenance.yml).
Demo-safe: no Supabase / no dispatch secret = clean no-op.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from workers.stock_scanner.cgt_radar import send_cgt_notices
from workers.stock_scanner.config import Settings, load_settings
from workers.stock_scanner.event_radar import send_event_notices
from workers.stock_scanner.logger import get_logger
from workers.stock_scanner.macro_calendar import seed_macro_calendar, send_macro_companions
from workers.stock_scanner.notification_dispatch import dispatch_notification
from workers.stock_scanner.review_job import (
    PortfolioPerformance,
    format_pct,
    portfolio_performance_for_user,
    send_periodic_reviews,
)
from workers.stock_scanner.supabase_repo import SupabaseRepository

LOGGER = get_logger("stock_scanner.digest_job")

TOP_SETUPS_IN_DIGEST = 3


def compose_digest(
    latest_signals: list[dict[str, Any]],
    alerts: list[dict[str, Any]],
    window_label: str,
) -> tuple[str, str, dict[str, Any]]:
    """Pure composer: (title, body, payload) from engine-persisted rows.

    latest_signals: one most-recent signal row per symbol (symbol, signal_status,
    signal_score, signal_score_delta). alerts: stock_alerts rows in the window.
    """
    setups = [
        row
        for row in latest_signals
        if str(row.get("signal_status")) in {"strong_setup", "watchlist_setup"}
    ]
    setups.sort(key=lambda row: float(row.get("signal_score") or 0), reverse=True)
    top = setups[:TOP_SETUPS_IN_DIGEST]

    sent_alerts = [a for a in alerts if str(a.get("sent_status")) == "sent"]
    strong_count = sum(1 for row in setups if str(row.get("signal_status")) == "strong_setup")
    watch_count = len(setups) - strong_count

    lines: list[str] = []
    lines.append(
        f"Scanner {window_label}: {len(latest_signals)} symbols scored, "
        f"{strong_count} strong setups, {watch_count} watchlist setups, "
        f"{len(sent_alerts)} alerts sent."
    )
    if top:
        top_bits = []
        for row in top:
            score = float(row.get("signal_score") or 0)
            delta = row.get("signal_score_delta")
            delta_text = f" ({float(delta):+.0f})" if delta is not None else ""
            top_bits.append(f"{row.get('symbol')} {score:.0f}/100{delta_text}")
        lines.append("Top setups: " + ", ".join(top_bits) + ".")
    else:
        lines.append("No active setups right now - the scan found nothing in the reset band.")
    lines.append("Research, not advice.")

    title = (
        f"{window_label.capitalize()} digest: {strong_count} strong / {watch_count} watch setups"
        if setups
        else f"{window_label.capitalize()} digest: no active setups"
    )
    payload = {
        "symbols_scored": len(latest_signals),
        "strong_setups": strong_count,
        "watchlist_setups": watch_count,
        "alerts_sent": len(sent_alerts),
        "top_setups": [
            {"symbol": row.get("symbol"), "signal_score": row.get("signal_score")} for row in top
        ],
    }
    return title, "\n".join(lines), payload


def _digest_enabled(prefs: dict[str, Any], key: str) -> bool:
    value = prefs.get(key)
    return True if value is None else bool(value)


def with_weekly_performance(
    title: str,
    body: str,
    payload: dict[str, Any],
    performance: PortfolioPerformance,
) -> tuple[str, str, dict[str, Any]]:
    """Fold the engine-measured weekly portfolio return into a composed weekly report.
    The line lands before the closing 'Research, not advice.' suffix; the pct also goes
    into the payload so the stored event carries the measured number."""
    line = (
        f"Portfolio this week: {format_pct(performance.performance_pct)} across "
        f"{performance.positions_measured} measured position"
        f"{'s' if performance.positions_measured != 1 else ''}."
    )
    lines = body.split("\n")
    lines.insert(max(len(lines) - 1, 0), line)
    return title, "\n".join(lines), {**payload, "performance_pct": performance.performance_pct}


def aud_terms_line(
    repo: SupabaseRepository,
    window_start: datetime,
    usd_pct: float,
) -> str | None:
    """The week's return in the user's own currency: combine the measured USD return with
    the stored AUD/USD move ((1+usd)*(1+fx_gain)-1, where a falling AUD lifts the AUD
    value of USD holdings). 'About' wording is deliberate - positions are marked at
    stored closes, not an executable FX rate. None until snapshot history covers the
    window; the line is then omitted, never guessed."""
    start_rate = repo.load_snapshot_value_at_or_after("audusd_price", window_start)
    latest_rate = repo.load_latest_snapshot_value("audusd_price")
    if not start_rate or not latest_rate or start_rate <= 0:
        return None
    fx_move_pct = ((latest_rate - start_rate) / start_rate) * 100
    aud_pct = ((1 + usd_pct / 100) * (1 + (-fx_move_pct) / 100) - 1) * 100
    direction = "fell" if fx_move_pct < 0 else "rose"
    return (
        f"In AUD terms: about {format_pct(aud_pct)} "
        f"(AUD {direction} {abs(fx_move_pct):.1f}% against the USD this week)."
    )


def send_digests(
    repo: SupabaseRepository,
    settings: Settings,
    now: datetime | None = None,
) -> int:
    """Dispatch the daily digest (and Friday weekly report) to every opted-in user."""
    if now is None:
        now = datetime.now(timezone.utc)
    if not settings.notification_dispatch_enabled:
        LOGGER.info("Notification dispatch unconfigured - digest job is a no-op")
        return 0

    user_ids = repo.load_active_user_ids()
    if not user_ids and settings.default_user_id:
        user_ids = [settings.default_user_id]
    if not user_ids:
        LOGGER.info("No target users for digest")
        return 0

    day = now.date().isoformat()
    is_friday = now.weekday() == 4
    sent = 0

    daily_since = now - timedelta(hours=24)
    daily_signals = repo.load_latest_signals_snapshot(settings.default_timeframe, daily_since)

    weekly_signals: list[dict[str, Any]] = []
    if is_friday:
        weekly_since = now - timedelta(days=7)
        weekly_signals = repo.load_latest_signals_snapshot(settings.default_timeframe, weekly_since)

    for user_id in user_ids:
        prefs = repo.load_user_alert_preferences(user_id)
        jobs: list[tuple[str, str, list[dict[str, Any]], datetime]] = []
        if _digest_enabled(prefs, "digest_enabled"):
            jobs.append(("daily_digest", "today", daily_signals, daily_since))
        # weekly_digest_enabled is the REAL column (migration 024) and the same gate the JS
        # router reads (prefs.weeklyDigest) and review_job._reviews_enabled mirrors. This used
        # to read the phantom key "weekly_report_enabled" - a column that exists in no schema -
        # so the missing key defaulted open and a user's weekly opt-out was silently ignored.
        if is_friday and _digest_enabled(prefs, "weekly_digest_enabled"):
            jobs.append(("weekly_report", "this week", weekly_signals, now - timedelta(days=7)))

        for notification_type, window_label, signals, since in jobs:
            alerts = repo.load_alerts_since(since, user_id=user_id)
            title, body, payload = compose_digest(signals, alerts, window_label)
            # The weekly report is an outcome type: attach the REAL portfolio return
            # over the week, measured from stored candles. None (no positions / no
            # data) degrades to the plain digest - never an invented number.
            performance = None
            if notification_type == "weekly_report":
                performance = portfolio_performance_for_user(repo, settings, user_id, since)
                if performance is not None:
                    title, body, payload = with_weekly_performance(title, body, payload, performance)
                    aud_line = aud_terms_line(repo, since, performance.performance_pct)
                    if aud_line is not None:
                        lines = body.split("\n")
                        lines.insert(max(len(lines) - 1, 0), aud_line)
                        body = "\n".join(lines)
            result = dispatch_notification(
                settings,
                user_id=user_id,
                symbol="MARKET",
                alert_type=notification_type,
                title=title,
                body=body,
                reason=f"Scheduled {notification_type.replace('_', ' ')} for {day}",
                payload={**payload, "dedupe_key": f"{notification_type}:{user_id}:{day}"},
                relevance_score=100,
                notification_type=notification_type,
                url="/radar",
                performance_pct=performance.performance_pct if performance else None,
            )
            repo.save_alert(
                signal_id=None,
                # A digest is market-wide, not about one ticker. stock_alerts.symbol carries a foreign
                # key to stock_tickers, so the old "MARKET" sentinel violated it and crashed the whole
                # digest job every night. The column is nullable - NULL is the honest value.
                symbol=None,
                alert_type=notification_type,
                channel="multi_channel",
                message=title,
                sent_status="sent" if result.ok else "failed",
                error_message=result.error_message,
                payload={"deduped": result.deduped, **payload},
                user_id=user_id,
            )
            if result.ok and not result.deduped:
                sent += 1
    return sent


def main() -> None:
    settings = load_settings()
    repo = SupabaseRepository(settings)
    run_id = repo.create_run("daily_digest", settings.default_timeframe)
    try:
        if not repo.enabled:
            LOGGER.info("Supabase not configured - digest job is a no-op (demo mode)")
            repo.finish_run(run_id, status="skipped")
            return
        # Seed the macro calendar first so tonight's companions (and the frontend
        # calendar) see the rows. Idempotent upsert on event_id - safe every night.
        seeded = seed_macro_calendar(repo)
        sent = send_digests(repo, settings)
        reviews_sent = send_periodic_reviews(repo, settings)
        macro_sent = send_macro_companions(repo, settings)
        cgt_sent = send_cgt_notices(repo, settings)
        events_sent = send_event_notices(repo, settings)
        LOGGER.info(
            "Digest job finished: digests=%s reviews=%s macro=%s cgt=%s events=%s calendar_rows=%s",
            sent, reviews_sent, macro_sent, cgt_sent, events_sent, seeded,
        )
        repo.finish_run(
            run_id,
            status="success",
            alerts_sent=sent + reviews_sent + macro_sent + cgt_sent + events_sent,
            payload={
                "digests_sent": sent,
                "reviews_sent": reviews_sent,
                "macro_companions_sent": macro_sent,
                "cgt_notices_sent": cgt_sent,
                "event_notices_sent": events_sent,
                "macro_calendar_rows": seeded,
            },
        )
    except Exception as exc:
        LOGGER.exception("Digest job failed")
        repo.finish_run(run_id, status="failed", error_message=str(exc))
        raise


if __name__ == "__main__":
    main()
