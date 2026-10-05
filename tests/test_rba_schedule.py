"""The RBA alert must be gated on Sydney wall-clock time, not just the date.

The job alerts even when it cannot read the statement ("decision is out"). That is only honest after
2:30pm Sydney. Sydney's UTC offset flips on the first Sunday of April and October, so a fixed UTC
cron is an hour out for part of those months - without this gate an early run would announce a
decision an hour before it existed.
"""
from __future__ import annotations

from datetime import datetime, timezone

from workers.stock_scanner import rba_decision_job
from workers.stock_scanner.rba_schedule import RBA_DECISION_DATES, rba_decision_due


def _utc(y: int, mo: int, d: int, h: int, mi: int) -> datetime:
    return datetime(y, mo, d, h, mi, tzinfo=timezone.utc)


def test_due_at_the_announcement_minute_in_standard_and_daylight_time() -> None:
    # 2026-08-11 is AEST (UTC+10): 2:31pm Sydney = 04:31 UTC.
    assert rba_decision_due(_utc(2026, 8, 11, 4, 31)) is True
    # 2026-11-03 is AEDT (UTC+11): 2:31pm Sydney = 03:31 UTC.
    assert rba_decision_due(_utc(2026, 11, 3, 3, 31)) is True


def test_not_due_an_hour_early_on_a_decision_day() -> None:
    # The early cron candidate on an AEST decision day is 1:31pm Sydney - before the announcement.
    assert rba_decision_due(_utc(2026, 8, 11, 3, 31)) is False


def test_not_due_on_an_ordinary_day_even_at_the_right_time() -> None:
    assert "2026-08-12" not in RBA_DECISION_DATES
    assert rba_decision_due(_utc(2026, 8, 12, 4, 31)) is False


def test_the_date_is_judged_in_sydney_not_utc() -> None:
    # 2026-11-03 14:31 Sydney is still 2026-11-03 in UTC, but 23:00 UTC on the 2nd is already the
    # 3rd in Sydney (10:00am) - a decision day, yet hours before the announcement.
    assert rba_decision_due(_utc(2026, 11, 2, 23, 0)) is False


def test_the_job_itself_refuses_to_alert_before_the_announcement(monkeypatch) -> None:
    # Even with dispatch fully configured, an early run must send nothing - no fetch, no fallback.
    def _must_not_be_called(*_args, **_kwargs):
        raise AssertionError("the job reached the network / dispatch before the announcement")

    monkeypatch.setattr(rba_decision_job, "load_settings", _must_not_be_called)
    monkeypatch.setattr(rba_decision_job, "fetch_decision_text", _must_not_be_called)
    monkeypatch.setattr(rba_decision_job, "dispatch_notification", _must_not_be_called)

    assert rba_decision_job.run(now=_utc(2026, 8, 11, 3, 31), sleep=lambda _s: None) == 0
