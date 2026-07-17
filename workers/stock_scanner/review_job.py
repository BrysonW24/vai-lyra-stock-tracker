"""Periodic review emitter: monthly / quarterly / yearly reviews with REAL portfolio
performance, measured from stored candles - the scheduler the review notification types
and renderers (v0.38.0) promised but never had. The Friday weekly report stays in
digest_job; this module owns the longer cadences and the shared performance math.

Scheduling is self-healing: a period becomes due on its LAST WEEKDAY (the nightly job
only runs Mon-Fri) and stays due for GRACE_DAYS after the period ends, so a skipped
Actions run delivers the review a night late instead of never. The server-side dedupe
key (`monthly_review:{user}:{period}`) makes every attempt after the first collapse,
so the grace window can never double-send.

Performance doctrine: every number is measured, never inferred. A position held at the
window open is measured from the first stored close at/after the window start; a position
BOUGHT during the window is measured from its actual cost base (quantity * avg price +
fee) - measuring it from the window open would credit or blame price action the user
never held. Positions with no stored candles are skipped and the skip is counted, not
hidden. No currency symbols: positions may be in mixed currencies, so the review speaks
in percentages and counts only.

Run via digest_job (nightly-maintenance.yml). Demo-safe: no Supabase / no dispatch
secret = clean no-op.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable

from workers.stock_scanner.config import Settings
from workers.stock_scanner.logger import get_logger
from workers.stock_scanner.models import PortfolioPosition
from workers.stock_scanner.notification_dispatch import dispatch_notification
from workers.stock_scanner.supabase_repo import SupabaseRepository

LOGGER = get_logger("stock_scanner.review_job")

# How many days after a period ends a missed review may still fire. Wide enough to
# survive a long weekend plus a couple of failed runs; the dedupe key prevents doubles.
GRACE_DAYS = 5

MOVERS_IN_REVIEW = 2  # best + toughest


@dataclass(frozen=True)
class ReviewTarget:
    """One review that is due tonight: which cadence, for which period."""

    notification_type: str  # monthly_review | quarterly_review | yearly_review
    period_key: str  # dedupe-stable: "2026-07" | "2026-q3" | "2026"
    period_label: str  # human: "July 2026" | "Q3 2026" | "2026"
    window_start: datetime  # UTC instant the measurement window opens


@dataclass(frozen=True)
class PortfolioPerformance:
    """Engine-measured portfolio return over a window, from stored candles."""

    performance_pct: float
    positions_measured: int
    positions_skipped: int
    positions_from_entry: int  # measured from cost base (bought inside the window)
    movers: tuple[tuple[str, float], ...]  # (symbol, pct) sorted best -> worst


def _next_weekday(day: date) -> date:
    candidate = day + timedelta(days=1)
    while candidate.weekday() >= 5:
        candidate += timedelta(days=1)
    return candidate


def _quarter_of(day: date) -> int:
    return (day.month - 1) // 3 + 1


def _month_period(day: date) -> tuple[str, str, date]:
    return f"{day.year:04d}-{day.month:02d}", day.strftime("%B %Y"), day.replace(day=1)


def _quarter_period(day: date) -> tuple[str, str, date]:
    quarter = _quarter_of(day)
    start = date(day.year, (quarter - 1) * 3 + 1, 1)
    return f"{day.year:04d}-q{quarter}", f"Q{quarter} {day.year}", start


def _year_period(day: date) -> tuple[str, str, date]:
    return f"{day.year:04d}", str(day.year), date(day.year, 1, 1)


def _target_for_cadence(
    today: date,
    notification_type: str,
    period_of: Callable[[date], tuple[str, str, date]],
    same_period: Callable[[date, date], bool],
) -> ReviewTarget | None:
    """Due when today is the period's last weekday, or within GRACE_DAYS of its end."""

    def build(period_day: date) -> ReviewTarget:
        key, label, start = period_of(period_day)
        return ReviewTarget(
            notification_type=notification_type,
            period_key=key,
            period_label=label,
            window_start=datetime(start.year, start.month, start.day, tzinfo=timezone.utc),
        )

    # Last weekday of the current period: the next weekday falls in a different period.
    if not same_period(today, _next_weekday(today)):
        return build(today)

    # Grace: the previous period ended within GRACE_DAYS (dedupe suppresses doubles).
    _, _, current_start = period_of(today)
    previous_last_day = current_start - timedelta(days=1)
    if (today - previous_last_day).days <= GRACE_DAYS:
        return build(previous_last_day)
    return None


def review_targets(now: datetime) -> list[ReviewTarget]:
    """Every review due at `now` (UTC). Month/quarter/year ends stack by design - on
    Dec 31 all three fire, each measuring its own window."""
    today = now.astimezone(timezone.utc).date()
    targets = [
        _target_for_cadence(
            today,
            "monthly_review",
            _month_period,
            lambda a, b: (a.year, a.month) == (b.year, b.month),
        ),
        _target_for_cadence(
            today,
            "quarterly_review",
            _quarter_period,
            lambda a, b: (a.year, _quarter_of(a)) == (b.year, _quarter_of(b)),
        ),
        _target_for_cadence(
            today,
            "yearly_review",
            _year_period,
            lambda a, b: a.year == b.year,
        ),
    ]
    return [target for target in targets if target is not None]


def _parse_purchase_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def compute_portfolio_performance(
    positions: list[PortfolioPosition],
    start_close_by_symbol: dict[str, float | None],
    latest_close_by_symbol: dict[str, float | None],
    window_start: date,
) -> PortfolioPerformance | None:
    """Pure aggregation. Returns None when nothing is measurable (no positions, or no
    position has both a baseline and a current close)."""
    total_start = 0.0
    total_end = 0.0
    measured = 0
    skipped = 0
    from_entry = 0
    per_position: list[tuple[str, float]] = []

    for position in positions:
        latest = latest_close_by_symbol.get(position.symbol)
        if latest is None or latest <= 0 or position.quantity <= 0:
            skipped += 1
            continue

        cost_base = (position.quantity * position.average_buy_price) + position.brokerage_fee
        purchase = _parse_purchase_date(position.purchase_date)
        bought_in_window = purchase is not None and purchase >= window_start

        if bought_in_window:
            start_value = cost_base
        else:
            start_close = start_close_by_symbol.get(position.symbol)
            if start_close is not None and start_close > 0:
                start_value = position.quantity * start_close
            else:
                # No candle covers the window open (e.g. symbol added recently) - fall
                # back to cost base, which measures honestly from the user's entry.
                start_value = cost_base
                bought_in_window = True

        if start_value <= 0:
            skipped += 1
            continue

        end_value = position.quantity * latest
        total_start += start_value
        total_end += end_value
        measured += 1
        if bought_in_window:
            from_entry += 1
        per_position.append((position.symbol, ((end_value - start_value) / start_value) * 100))

    if measured == 0 or total_start <= 0:
        return None

    per_position.sort(key=lambda item: item[1], reverse=True)
    return PortfolioPerformance(
        performance_pct=((total_end - total_start) / total_start) * 100,
        positions_measured=measured,
        positions_skipped=skipped,
        positions_from_entry=from_entry,
        movers=tuple(per_position),
    )


def portfolio_performance_for_user(
    repo: SupabaseRepository,
    settings: Settings,
    user_id: str,
    window_start: datetime,
) -> PortfolioPerformance | None:
    """Load the user's active positions and the two closes each needs, then aggregate."""
    positions = repo.load_portfolio_positions(user_id)
    if not positions:
        return None
    start_closes: dict[str, float | None] = {}
    latest_closes: dict[str, float | None] = {}
    for symbol in {position.symbol for position in positions}:
        start_closes[symbol] = repo.first_close_at_or_after(symbol, settings.default_timeframe, window_start)
        latest_closes[symbol] = repo.latest_close(symbol, settings.default_timeframe)
    return compute_portfolio_performance(positions, start_closes, latest_closes, window_start.date())


def format_pct(value: float) -> str:
    """Signed one-decimal percent, e.g. +8.2% / -3.1%. Shared with the weekly digest."""
    sign = "+" if value > 0 else ""
    return f"{sign}{value:.1f}%"


def benchmark_line(
    repo: SupabaseRepository,
    window_start: datetime,
    portfolio_pct: float,
) -> str | None:
    """'You vs the S&P 500' from stored market-context snapshots - the index close at
    the window open vs the latest. None until snapshot history covers the window (the
    capture bug fixed in this release means history starts accruing now); the line is
    then omitted, never estimated."""
    start_value = repo.load_snapshot_value_at_or_after("sp500_price", window_start)
    latest_value = repo.load_latest_snapshot_value("sp500_price")
    if not start_value or not latest_value or start_value <= 0:
        return None
    index_pct = ((latest_value - start_value) / start_value) * 100
    delta = portfolio_pct - index_pct
    verdict = "ahead of" if delta > 0 else "behind" if delta < 0 else "level with"
    return (
        f"S&P 500 over the same window: {format_pct(index_pct)}. "
        f"You are {format_pct(abs(delta)) if delta != 0 else '0.0%'} {verdict} the index."
    )


def compose_review(
    target: ReviewTarget,
    performance: PortfolioPerformance | None,
) -> tuple[str, str, dict[str, Any]]:
    """Pure composer: (title, body, payload). Percentages and counts only - positions may
    be in mixed currencies, so a currency symbol here would be an invented number."""
    cadence_word = {
        "monthly_review": "month",
        "quarterly_review": "quarter",
        "yearly_review": "year",
    }.get(target.notification_type, "period")

    lines: list[str] = []
    payload: dict[str, Any] = {"period": target.period_key, "period_label": target.period_label}

    if performance is None:
        lines.append(
            f"No portfolio positions were measurable this {cadence_word}. "
            "Add your holdings in Lyra to see your return here."
        )
        title = f"{target.period_label} review: no positions tracked"
    else:
        lines.append(
            f"Portfolio return: {format_pct(performance.performance_pct)} across "
            f"{performance.positions_measured} measured position"
            f"{'s' if performance.positions_measured != 1 else ''}."
        )
        if performance.movers:
            best_symbol, best_pct = performance.movers[0]
            mover_bits = [f"Best: {best_symbol} {format_pct(best_pct)}."]
            if len(performance.movers) > 1:
                worst_symbol, worst_pct = performance.movers[-1]
                mover_bits.append(f"Toughest: {worst_symbol} {format_pct(worst_pct)}.")
            lines.append(" ".join(mover_bits))
        if performance.positions_from_entry:
            lines.append(
                f"{performance.positions_from_entry} position"
                f"{'s' if performance.positions_from_entry != 1 else ''} measured from entry "
                f"(bought during the {cadence_word})."
            )
        if performance.positions_skipped:
            lines.append(
                f"{performance.positions_skipped} position"
                f"{'s' if performance.positions_skipped != 1 else ''} skipped - no stored price data."
            )
        title = f"{target.period_label} review: portfolio {format_pct(performance.performance_pct)}"
        payload.update(
            {
                "performance_pct": performance.performance_pct,
                "positions_measured": performance.positions_measured,
                "positions_skipped": performance.positions_skipped,
                "positions_from_entry": performance.positions_from_entry,
                "movers": [
                    {"symbol": symbol, "pct": round(pct, 2)}
                    for symbol, pct in performance.movers[:MOVERS_IN_REVIEW]
                ],
            }
        )
    lines.append("Research, not advice.")
    return title, "\n".join(lines), payload


def _reviews_enabled(prefs: dict[str, Any]) -> bool:
    """Worker-side mirror of the router's periodic-reports gate (prefs.weeklyDigest,
    column weekly_digest_enabled). Defaults open; the JS router is the true gate."""
    value = prefs.get("weekly_digest_enabled")
    return True if value is None else bool(value)


def send_periodic_reviews(
    repo: SupabaseRepository,
    settings: Settings,
    now: datetime | None = None,
) -> int:
    """Dispatch every due review to every opted-in user. Returns fresh (non-deduped) sends."""
    if now is None:
        now = datetime.now(timezone.utc)
    targets = review_targets(now)
    if not targets:
        return 0
    if not settings.notification_dispatch_enabled:
        LOGGER.info("Notification dispatch unconfigured - review job is a no-op")
        return 0

    user_ids = repo.load_active_user_ids()
    if not user_ids and settings.default_user_id:
        user_ids = [settings.default_user_id]
    if not user_ids:
        LOGGER.info("No target users for periodic reviews")
        return 0

    sent = 0
    for user_id in user_ids:
        prefs = repo.load_user_alert_preferences(user_id)
        if not _reviews_enabled(prefs):
            continue
        for target in targets:
            performance = portfolio_performance_for_user(repo, settings, user_id, target.window_start)
            title, body, payload = compose_review(target, performance)
            if performance is not None:
                versus = benchmark_line(repo, target.window_start, performance.performance_pct)
                if versus is not None:
                    # Land before the closing research suffix, like the weekly fold.
                    lines = body.split("\n")
                    lines.insert(max(len(lines) - 1, 0), versus)
                    body = "\n".join(lines)
            dedupe_key = f"{target.notification_type}:{user_id}:{target.period_key}"
            result = dispatch_notification(
                settings,
                user_id=user_id,
                symbol="PORTFOLIO",
                alert_type=target.notification_type,
                title=title,
                body=body,
                reason=f"Scheduled {target.period_label} review",
                payload={**payload, "dedupe_key": dedupe_key},
                relevance_score=100,
                notification_type=target.notification_type,
                url="/portfolio",
                performance_pct=performance.performance_pct if performance else None,
            )
            repo.save_alert(
                signal_id=None,
                # Market-wide like the digest: stock_alerts.symbol is a ticker FK, so NULL.
                symbol=None,
                alert_type=target.notification_type,
                channel="multi_channel",
                message=title,
                sent_status="sent" if result.ok else "failed",
                error_message=result.error_message,
                payload={"deduped": result.deduped, **payload},
                user_id=user_id,
            )
            if result.ok and not result.deduped:
                sent += 1
                LOGGER.info(
                    "Review sent: type=%s period=%s user=%s", target.notification_type, target.period_key, user_id
                )
    return sent
