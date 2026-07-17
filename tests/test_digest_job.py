"""send_digests loop tests - the seam that crashed production every night for months.

Only the pure helpers (compose_digest, with_weekly_performance) were tested; the loop that
gates per-user prefs, branches on Friday, builds the dedupe key, and writes stock_alerts had
ZERO coverage. Its documented regression: it once wrote save_alert(symbol="MARKET"), a value
that violates the stock_tickers foreign key, and that crashed the whole digest job nightly.
These pin the loop so that class of bug goes red instead of silently killing the digest.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from workers.stock_scanner import digest_job
from workers.stock_scanner.config import Settings
from workers.stock_scanner.notification_dispatch import DispatchResult


def utc(y: int, m: int, d: int) -> datetime:
    return datetime(y, m, d, 12, 0, tzinfo=timezone.utc)


# 2026-07-31 is a Friday (weekly report fires); 2026-07-30 is a Thursday (daily only).
FRIDAY = utc(2026, 7, 31)
THURSDAY = utc(2026, 7, 30)


class FakeRepo:
    """Exactly the repo surface send_digests touches. No network, no DB."""

    def __init__(self, prefs: dict | None = None) -> None:
        self.prefs = prefs or {}
        self.saved_alerts: list[dict] = []

    def load_active_user_ids(self):
        return ["u1"]

    def load_user_alert_preferences(self, user_id):
        return self.prefs

    def load_latest_signals_snapshot(self, timeframe, since):
        return [{"symbol": "NVDA", "signal_status": "strong_setup", "signal_score": 82, "signal_score_delta": 3}]

    def load_alerts_since(self, since, user_id=None):
        return []

    # Weekly performance path: no positions, so performance is None and the plain digest sends.
    def load_portfolio_positions(self, user_id):
        return []

    def load_snapshot_value_at_or_after(self, key, start):
        return None

    def load_latest_snapshot_value(self, key):
        return None

    def save_alert(self, **kwargs):
        self.saved_alerts.append(kwargs)


def dispatch_settings() -> Settings:
    return Settings(
        supabase_url="",
        supabase_service_role_key="",
        telegram_bot_token="",
        telegram_chat_id="",
        market_data_provider="yfinance",
        ticker_symbols=(),
        default_timeframe="1h",
        lookback_period_days=180,
        alert_score_threshold=75,
        watchlist_score_threshold=60,
        signal_change_threshold=8,
        enable_telegram_alerts=False,
        enable_watchlist_alerts=False,
        enable_hourly_digest=False,
        enable_market_hours_guard=False,
        force_scan=True,
        notification_dispatch_url="https://example.test/api/notifications/dispatch",
        notification_dispatch_secret="secret",
    )


def _capture(monkeypatch, *, ok: bool = True, deduped: bool = False) -> list[dict]:
    calls: list[dict] = []

    def fake_dispatch(settings, **kwargs):
        calls.append(kwargs)
        return DispatchResult(attempted=True, ok=ok, deduped=deduped)

    monkeypatch.setattr(digest_job, "dispatch_notification", fake_dispatch)
    return calls


class TestSendDigests:
    def test_daily_digest_writes_alert_with_null_symbol_not_market(self, monkeypatch):
        """THE regression: the market-wide digest must save_alert(symbol=None). A non-null
        'MARKET' sentinel violates the stock_alerts -> stock_tickers FK and crashed the job."""
        calls = _capture(monkeypatch)
        repo = FakeRepo()
        sent = digest_job.send_digests(repo, dispatch_settings(), now=THURSDAY)

        assert sent == 1
        assert len(repo.saved_alerts) == 1
        assert repo.saved_alerts[0]["symbol"] is None  # never "MARKET"
        assert calls[0]["notification_type"] == "daily_digest"
        assert calls[0]["payload"]["dedupe_key"] == "daily_digest:u1:2026-07-30"
        assert repo.saved_alerts[0]["sent_status"] == "sent"

    def test_friday_adds_weekly_report_on_top_of_daily(self, monkeypatch):
        calls = _capture(monkeypatch)
        repo = FakeRepo()
        sent = digest_job.send_digests(repo, dispatch_settings(), now=FRIDAY)

        types = sorted(c["notification_type"] for c in calls)
        assert types == ["daily_digest", "weekly_report"]
        assert sent == 2
        # Every saved alert - daily and weekly - carries the null symbol.
        assert all(a["symbol"] is None for a in repo.saved_alerts)

    def test_thursday_sends_daily_only(self, monkeypatch):
        calls = _capture(monkeypatch)
        sent = digest_job.send_digests(FakeRepo(), dispatch_settings(), now=THURSDAY)
        assert [c["notification_type"] for c in calls] == ["daily_digest"]
        assert sent == 1

    def test_digest_disabled_pref_suppresses_the_daily(self, monkeypatch):
        calls = _capture(monkeypatch)
        repo = FakeRepo(prefs={"digest_enabled": False})
        sent = digest_job.send_digests(repo, dispatch_settings(), now=THURSDAY)
        assert sent == 0
        assert calls == []

    def test_weekly_report_disabled_pref_keeps_daily_on_friday(self, monkeypatch):
        # weekly_digest_enabled is the REAL schema column (migration 024) - the one the settings
        # PATCH writes and the JS router reads. The old fixture injected the phantom key
        # "weekly_report_enabled" (exists in no schema), so this test passed for the wrong reason
        # while the actual opt-out was ignored and the weekly report fired for everyone.
        calls = _capture(monkeypatch)
        repo = FakeRepo(prefs={"weekly_digest_enabled": False})
        sent = digest_job.send_digests(repo, dispatch_settings(), now=FRIDAY)
        assert [c["notification_type"] for c in calls] == ["daily_digest"]
        assert sent == 1

    def test_deduped_result_is_not_counted_but_still_recorded(self, monkeypatch):
        _capture(monkeypatch, deduped=True)
        repo = FakeRepo()
        sent = digest_job.send_digests(repo, dispatch_settings(), now=THURSDAY)
        assert sent == 0  # deduped is not fresh
        assert len(repo.saved_alerts) == 1  # but the attempt is recorded honestly

    def test_failed_dispatch_is_recorded_as_failed(self, monkeypatch):
        _capture(monkeypatch, ok=False)
        repo = FakeRepo()
        sent = digest_job.send_digests(repo, dispatch_settings(), now=THURSDAY)
        assert sent == 0
        assert repo.saved_alerts[0]["sent_status"] == "failed"

    def test_unconfigured_dispatch_is_a_clean_noop(self, monkeypatch):
        calls = _capture(monkeypatch)
        settings = Settings(**{**dispatch_settings().__dict__, "notification_dispatch_secret": ""})
        sent = digest_job.send_digests(FakeRepo(), settings, now=THURSDAY)
        assert sent == 0
        assert calls == []
