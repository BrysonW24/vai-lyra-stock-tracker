"""Periodic review job - the scheduler behind monthly/quarterly/yearly reviews.

Pins the three things that make the reviews trustworthy:
1. Targeting: reviews fire on the period's LAST WEEKDAY, self-heal for GRACE_DAYS after
   a missed run, and both paths produce the SAME period key so server dedupe collapses.
2. Performance: every number is measured from stored closes / real cost bases - held
   positions from the window open, in-window buys from entry, missing data skipped and
   counted, never invented.
3. Dispatch: performance_pct rides the wire, the dedupe key is period-stable, and the
   weekly-report enrichment lands before the research suffix.
"""

from datetime import date, datetime, timezone

from workers.stock_scanner.config import Settings
from workers.stock_scanner.digest_job import with_weekly_performance
from workers.stock_scanner.models import PortfolioPosition
from workers.stock_scanner.notification_dispatch import DispatchResult
from workers.stock_scanner.review_job import (
    GRACE_DAYS,
    PortfolioPerformance,
    compose_review,
    compute_portfolio_performance,
    review_targets,
    send_periodic_reviews,
)
from workers.stock_scanner import review_job


def utc(year: int, month: int, day: int, hour: int = 22) -> datetime:
    return datetime(year, month, day, hour, tzinfo=timezone.utc)


def position(
    symbol: str = "NVDA",
    quantity: float = 10,
    avg: float = 100,
    fee: float = 0,
    purchase_date: str | None = "2026-01-05",
) -> PortfolioPosition:
    return PortfolioPosition(
        id=f"pos-{symbol}",
        symbol=symbol,
        quantity=quantity,
        average_buy_price=avg,
        brokerage_fee=fee,
        purchase_date=purchase_date,
        user_id="u1",
    )


class TestReviewTargets:
    def test_mid_month_weekday_has_no_targets(self):
        assert review_targets(utc(2026, 7, 15)) == []

    def test_last_weekday_of_month_fires_monthly(self):
        # 2026-07-31 is a Friday; July is mid-quarter, so only the monthly fires.
        targets = review_targets(utc(2026, 7, 31))
        assert [t.notification_type for t in targets] == ["monthly_review"]
        assert targets[0].period_key == "2026-07"
        assert targets[0].period_label == "July 2026"
        assert targets[0].window_start == datetime(2026, 7, 1, tzinfo=timezone.utc)

    def test_quarter_end_fires_monthly_and_quarterly(self):
        # 2026-09-30 is a Wednesday, the last weekday of both September and Q3.
        targets = review_targets(utc(2026, 9, 30))
        types = {t.notification_type: t for t in targets}
        assert set(types) == {"monthly_review", "quarterly_review"}
        assert types["quarterly_review"].period_key == "2026-q3"
        assert types["quarterly_review"].window_start == datetime(2026, 7, 1, tzinfo=timezone.utc)

    def test_year_end_stacks_all_three(self):
        # 2026-12-31 is a Thursday: month, quarter, and year all close.
        targets = review_targets(utc(2026, 12, 31))
        keys = {t.notification_type: t.period_key for t in targets}
        assert keys == {
            "monthly_review": "2026-12",
            "quarterly_review": "2026-q4",
            "yearly_review": "2026",
        }

    def test_grace_window_self_heals_a_missed_boundary_run(self):
        # Monday 2026-08-03: the Friday 07-31 run was missed; July is still due.
        targets = review_targets(utc(2026, 8, 3))
        assert [t.notification_type for t in targets] == ["monthly_review"]
        assert targets[0].period_key == "2026-07"

    def test_grace_and_boundary_produce_the_same_period_key(self):
        # Server-side dedupe can only collapse the pair if the keys match exactly.
        boundary = review_targets(utc(2026, 7, 31))[0]
        grace = review_targets(utc(2026, 8, 3))[0]
        assert boundary.period_key == grace.period_key == "2026-07"
        assert boundary.window_start == grace.window_start

    def test_grace_window_expires(self):
        # 2026-08-10 is 10 days past July's end - beyond GRACE_DAYS, nothing fires.
        assert GRACE_DAYS < 10
        assert review_targets(utc(2026, 8, 10)) == []

    def test_february_short_month_boundary(self):
        # 2027-02-26 is a Friday; the 27th/28th are the weekend, so it closes February.
        targets = review_targets(utc(2027, 2, 26))
        assert [t.period_key for t in targets] == ["2027-02"]


class TestComputePortfolioPerformance:
    WINDOW = date(2026, 7, 1)

    def test_held_position_measures_from_window_open(self):
        perf = compute_portfolio_performance(
            [position(purchase_date="2026-01-05")], {"NVDA": 100.0}, {"NVDA": 110.0}, self.WINDOW
        )
        assert perf is not None
        assert perf.performance_pct == 10.0
        assert perf.positions_measured == 1
        assert perf.positions_from_entry == 0

    def test_in_window_buy_measures_from_cost_base(self):
        # Bought July 10 at 95 with a 5 fee: baseline 955, not the window-open close.
        perf = compute_portfolio_performance(
            [position(avg=95, fee=5, purchase_date="2026-07-10")],
            {"NVDA": 80.0},  # window-open close must be IGNORED for this lot
            {"NVDA": 110.0},
            self.WINDOW,
        )
        assert perf is not None
        assert perf.positions_from_entry == 1
        assert abs(perf.performance_pct - ((1100 - 955) / 955) * 100) < 1e-9

    def test_missing_window_open_close_falls_back_to_cost_base(self):
        perf = compute_portfolio_performance(
            [position(purchase_date="2026-01-05")], {"NVDA": None}, {"NVDA": 110.0}, self.WINDOW
        )
        assert perf is not None
        assert perf.positions_from_entry == 1  # honest: measured since entry
        assert perf.performance_pct == 10.0  # cost base 1000 -> 1100

    def test_missing_latest_close_is_skipped_and_counted(self):
        perf = compute_portfolio_performance(
            [position(), position(symbol="PLTR")],
            {"NVDA": 100.0, "PLTR": 50.0},
            {"NVDA": 110.0, "PLTR": None},
            self.WINDOW,
        )
        assert perf is not None
        assert perf.positions_measured == 1
        assert perf.positions_skipped == 1

    def test_nothing_measurable_returns_none(self):
        assert compute_portfolio_performance([], {}, {}, self.WINDOW) is None
        assert (
            compute_portfolio_performance([position()], {"NVDA": 100.0}, {"NVDA": None}, self.WINDOW)
            is None
        )

    def test_movers_sorted_best_first_and_losses_stay_negative(self):
        perf = compute_portfolio_performance(
            [position(), position(symbol="PLTR", quantity=20, avg=50)],
            {"NVDA": 100.0, "PLTR": 50.0},
            {"NVDA": 110.0, "PLTR": 45.0},
            self.WINDOW,
        )
        assert perf is not None
        assert perf.movers[0] == ("NVDA", 10.0)
        assert perf.movers[-1][0] == "PLTR"
        assert perf.movers[-1][1] < 0


class TestComposeReview:
    def _target(self) -> review_job.ReviewTarget:
        return review_targets(utc(2026, 7, 31))[0]

    def test_with_performance(self):
        perf = PortfolioPerformance(
            performance_pct=8.2,
            positions_measured=3,
            positions_skipped=1,
            positions_from_entry=1,
            movers=(("NVDA", 14.1), ("AMD", 6.0), ("PLTR", -6.3)),
        )
        title, body, payload = compose_review(self._target(), perf)
        assert title == "July 2026 review: portfolio +8.2%"
        assert "Portfolio return: +8.2% across 3 measured positions." in body
        assert "Best: NVDA +14.1%." in body
        assert "Toughest: PLTR -6.3%." in body
        assert "1 position skipped - no stored price data." in body
        assert body.strip().endswith("Research, not advice.")
        assert payload["performance_pct"] == 8.2
        assert payload["period"] == "2026-07"

    def test_without_positions(self):
        title, body, payload = compose_review(self._target(), None)
        assert title == "July 2026 review: no positions tracked"
        assert "Add your holdings" in body
        assert "performance_pct" not in payload


class FakeRepo:
    """Exactly the repo surface send_periodic_reviews touches."""

    def __init__(self, positions: list[PortfolioPosition], prefs: dict | None = None) -> None:
        self.positions = positions
        self.prefs = prefs or {}
        self.saved_alerts: list[dict] = []

    def load_active_user_ids(self):
        return ["u1"]

    def load_user_alert_preferences(self, user_id):
        return self.prefs

    def load_portfolio_positions(self, user_id):
        return self.positions

    def first_close_at_or_after(self, symbol, timeframe, start):
        return 100.0

    def latest_close(self, symbol, timeframe):
        return 110.0

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


class TestSendPeriodicReviews:
    def _capture(self, monkeypatch, deduped: bool = False) -> list[dict]:
        calls: list[dict] = []

        def fake_dispatch(settings, **kwargs):
            calls.append(kwargs)
            return DispatchResult(attempted=True, ok=True, deduped=deduped)

        monkeypatch.setattr(review_job, "dispatch_notification", fake_dispatch)
        return calls

    def test_sends_monthly_review_with_measured_performance(self, monkeypatch):
        calls = self._capture(monkeypatch)
        repo = FakeRepo([position()])
        sent = send_periodic_reviews(repo, dispatch_settings(), now=utc(2026, 7, 31))
        assert sent == 1
        assert len(calls) == 1
        call = calls[0]
        assert call["notification_type"] == "monthly_review"
        assert call["performance_pct"] == 10.0
        assert call["payload"]["dedupe_key"] == "monthly_review:u1:2026-07"
        assert call["url"] == "/portfolio"
        assert repo.saved_alerts[0]["sent_status"] == "sent"

    def test_no_targets_means_no_dispatch(self, monkeypatch):
        calls = self._capture(monkeypatch)
        sent = send_periodic_reviews(FakeRepo([position()]), dispatch_settings(), now=utc(2026, 7, 15))
        assert sent == 0
        assert calls == []

    def test_periodic_reports_preference_gates_worker_side(self, monkeypatch):
        calls = self._capture(monkeypatch)
        repo = FakeRepo([position()], prefs={"weekly_digest_enabled": False})
        sent = send_periodic_reviews(repo, dispatch_settings(), now=utc(2026, 7, 31))
        assert sent == 0
        assert calls == []

    def test_deduped_result_is_not_counted_as_fresh(self, monkeypatch):
        self._capture(monkeypatch, deduped=True)
        repo = FakeRepo([position()])
        sent = send_periodic_reviews(repo, dispatch_settings(), now=utc(2026, 7, 31))
        assert sent == 0
        # The attempt is still recorded honestly in stock_alerts.
        assert len(repo.saved_alerts) == 1

    def test_unconfigured_dispatch_is_a_clean_noop(self, monkeypatch):
        calls = self._capture(monkeypatch)
        settings = dispatch_settings()
        settings = Settings(**{**settings.__dict__, "notification_dispatch_secret": ""})
        sent = send_periodic_reviews(FakeRepo([position()]), settings, now=utc(2026, 7, 31))
        assert sent == 0
        assert calls == []


class TestWeeklyPerformanceEnrichment:
    def test_line_lands_before_research_suffix_and_payload_carries_pct(self):
        perf = PortfolioPerformance(
            performance_pct=-2.4,
            positions_measured=2,
            positions_skipped=0,
            positions_from_entry=0,
            movers=(("NVDA", 1.0), ("PLTR", -5.0)),
        )
        title, body, payload = with_weekly_performance(
            "This week digest", "Scanner this week: 12 symbols scored.\nResearch, not advice.", {}, perf
        )
        lines = body.split("\n")
        assert lines[-1] == "Research, not advice."
        assert lines[-2] == "Portfolio this week: -2.4% across 2 measured positions."
        assert payload["performance_pct"] == -2.4
