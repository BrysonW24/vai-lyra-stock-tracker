"""Nightly outcome-labeling job: fills `signal_outcomes` with forward returns for every
setup the scanner published, then sends the coaching follow-up ("your NVDA setup from
Jul 9 is +8.2% after 5 days; cohort median +3.2%") once a signal's 5-day horizon resolves.

Everything here is deterministic and engine-owned: returns come from the SAME stored
candles the score used (`stock_candles`), horizons/medians from `outcome_engine`. Signals
inside the window are re-labeled every night (upsert) so horizons fill in as bars accrue;
once all horizons resolve the numbers stop changing forever.

Run: python -m workers.stock_scanner.outcome_job (scheduled by nightly-maintenance.yml).
Demo-safe: no Supabase configured = clean no-op.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from workers.stock_scanner.config import Settings, load_settings
from workers.stock_scanner.logger import get_logger
from workers.stock_scanner.notification_dispatch import dispatch_notification
from workers.stock_scanner.outcome_engine import (
    OutcomeDistribution,
    OutcomeResult,
    aggregate_outcomes,
    compute_outcome,
)
from workers.stock_scanner.supabase_repo import SupabaseRepository

LOGGER = get_logger("stock_scanner.outcome_job")

LOOKBACK_DAYS = 90
LABELED_STATUSES: tuple[str, ...] = ("strong_setup", "watchlist_setup")
# Hourly-bar horizons, matching outcome_engine defaults (7 bars ~ 1 US trading day).
HORIZONS_BARS = {"1d": 7, "5d": 35, "20d": 140, "60d": 420}
MIN_BARS_TO_LABEL = HORIZONS_BARS["1d"]
FOLLOWUP_MIN_BARS = HORIZONS_BARS["5d"]
# Only follow up on recent signals so a first-ever backfill can't spam months of history.
FOLLOWUP_MAX_AGE_DAYS = 14


def parse_ts(value: Any) -> datetime:
    """Parse a Supabase timestamptz (handles trailing Z) into an aware UTC datetime."""
    text = str(value).replace("Z", "+00:00")
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def label_outcomes(
    repo: SupabaseRepository,
    settings: Settings,
    now: datetime | None = None,
) -> tuple[list[OutcomeResult], list[dict[str, Any]]]:
    """Compute forward returns for every labelable setup in the window.

    Returns (outcomes, followup_candidates) where followup_candidates carry the raw
    signal rows whose 5d horizon has resolved recently enough to message about.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    since = now - timedelta(days=LOOKBACK_DAYS)
    timeframe = settings.default_timeframe

    signals = repo.load_signals_for_outcomes(since, LABELED_STATUSES, timeframe)
    if not signals:
        return [], []

    # One candle load per symbol, from that symbol's earliest signal onward.
    earliest_by_symbol: dict[str, datetime] = {}
    for row in signals:
        symbol = str(row["symbol"])
        candle_time = parse_ts(row["candle_time"])
        if symbol not in earliest_by_symbol or candle_time < earliest_by_symbol[symbol]:
            earliest_by_symbol[symbol] = candle_time

    candles_by_symbol = {
        symbol: repo.load_candles_from(symbol, timeframe, start)
        for symbol, start in earliest_by_symbol.items()
    }

    outcomes: list[OutcomeResult] = []
    followup_candidates: list[dict[str, Any]] = []
    followup_age_floor = now - timedelta(days=FOLLOWUP_MAX_AGE_DAYS)

    for row in signals:
        symbol = str(row["symbol"])
        candle_time = parse_ts(row["candle_time"])
        candles = candles_by_symbol.get(symbol) or []
        entry = next(
            (c for c in candles if c.candle_time == candle_time and c.close is not None),
            None,
        )
        if entry is None or entry.close is None:
            continue
        candles_after = [c for c in candles if c.candle_time > candle_time]
        if len(candles_after) < MIN_BARS_TO_LABEL:
            continue  # too young - horizons would be filled from a partial window

        outcome = compute_outcome(
            symbol=symbol,
            signal_candle_time=candle_time,
            signal_type=str(row["signal_type"]),
            signal_status=str(row["signal_status"]),
            signal_score=float(row["signal_score"]),
            entry_price=float(entry.close),
            candles_after=candles_after,
            horizons_bars=HORIZONS_BARS,
        )
        outcomes.append(outcome)

        if len(candles_after) >= FOLLOWUP_MIN_BARS and candle_time >= followup_age_floor:
            followup_candidates.append({**row, "outcome": outcome})

    return outcomes, followup_candidates


def _format_pct(value: float | None) -> str:
    return "n/a" if value is None else f"{value:+.1f}%"


def build_followup_body(
    outcome: OutcomeResult,
    distribution: OutcomeDistribution | None,
) -> str:
    """Engine-owned follow-up copy: realised returns plus the cohort baseline."""
    signal_day = outcome.signal_candle_time.date().isoformat()
    status_label = outcome.signal_status.replace("_", " ")
    parts = [
        f"{outcome.symbol} {status_label} from {signal_day} (score {outcome.signal_score:.0f}):"
        f" {_format_pct(outcome.return_5d)} after 5 trading days"
        f" (1d {_format_pct(outcome.return_1d)},"
        f" max upside {_format_pct(outcome.max_upside_pct)},"
        f" max drawdown {_format_pct(outcome.max_drawdown_pct)})."
    ]
    if distribution and distribution.sample_size >= 5:
        parts.append(
            f"Cohort baseline for {status_label} (n={distribution.sample_size}):"
            f" median 5d {_format_pct(distribution.return_5d_median)},"
            f" win rate {distribution.return_5d_win_rate:.0f}%."
        )
    parts.append("Research, not advice.")
    return " ".join(parts)


def send_followups(
    repo: SupabaseRepository,
    settings: Settings,
    followup_candidates: list[dict[str, Any]],
    distributions: dict[str, OutcomeDistribution],
) -> int:
    """Dispatch one signal_followup per resolved setup, deduped via stock_alerts."""
    user_id = settings.default_user_id or None
    if not user_id or not settings.notification_dispatch_enabled:
        return 0

    sent = 0
    for candidate in followup_candidates:
        outcome: OutcomeResult = candidate["outcome"]
        signal_time_iso = outcome.signal_candle_time.isoformat()
        if repo.followup_already_sent(outcome.symbol, signal_time_iso):
            continue

        distribution = distributions.get(f"{outcome.signal_type}|{outcome.signal_status}")
        body = build_followup_body(outcome, distribution)
        result = dispatch_notification(
            settings,
            user_id=user_id,
            symbol=outcome.symbol,
            alert_type="signal_followup",
            title=f"{outcome.symbol} follow-up: {_format_pct(outcome.return_5d)} in 5 days",
            body=body,
            reason=f"5-day horizon resolved for the {outcome.signal_status} signal from {signal_time_iso}",
            payload={
                "signal_candle_time": signal_time_iso,
                "signal_status": outcome.signal_status,
                "return_1d": outcome.return_1d,
                "return_5d": outcome.return_5d,
                "max_upside_pct": outcome.max_upside_pct,
                "max_drawdown_pct": outcome.max_drawdown_pct,
                "dedupe_key": f"signal_followup:{outcome.symbol}:{signal_time_iso}",
            },
            relevance_score=float(outcome.signal_score),
            notification_type="signal_followup",
        )
        repo.save_alert(
            signal_id=None,
            symbol=outcome.symbol,
            alert_type="signal_followup",
            channel="multi_channel",
            message=body,
            sent_status="sent" if result.ok else "failed",
            error_message=result.error_message,
            payload={"signal_candle_time": signal_time_iso, "deduped": result.deduped},
            user_id=user_id,
        )
        if result.ok and not result.deduped:
            sent += 1
    return sent


def main() -> None:
    settings = load_settings()
    repo = SupabaseRepository(settings)
    run_id = repo.create_run("nightly_outcomes", settings.default_timeframe)
    try:
        if not repo.enabled:
            LOGGER.info("Supabase not configured - outcome job is a no-op (demo mode)")
            repo.finish_run(run_id, status="skipped")
            return

        outcomes, followup_candidates = label_outcomes(repo, settings)
        saved = repo.save_signal_outcomes([outcome.to_record() for outcome in outcomes])
        distributions = aggregate_outcomes(outcomes)
        followups_sent = send_followups(repo, settings, followup_candidates, distributions)

        LOGGER.info(
            "Outcome job finished: labeled=%s saved=%s cohorts=%s followups_sent=%s",
            len(outcomes), saved, len(distributions), followups_sent,
        )
        repo.finish_run(
            run_id,
            status="success",
            signals_created=saved,
            alerts_sent=followups_sent,
            payload={
                "outcomes_labeled": len(outcomes),
                "cohorts": sorted(distributions.keys()),
                "followup_candidates": len(followup_candidates),
            },
        )
    except Exception as exc:
        LOGGER.exception("Outcome job failed")
        repo.finish_run(run_id, status="failed", error_message=str(exc))
        raise


if __name__ == "__main__":
    main()
