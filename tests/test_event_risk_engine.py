"""
Unit tests for event_risk_engine.py — deterministic event-risk scoring.

No network; synthetic fixtures only.
"""

import pytest
from workers.events_worker.event_risk_engine import days_until, event_risk_for_ticker


class TestDaysUntil:
    """Test days_until helper function."""

    def test_same_day(self):
        """Same day should return 0."""
        assert days_until("2026-06-03", "2026-06-03") == 0

    def test_future_date(self):
        """Future date should return positive days."""
        assert days_until("2026-06-05", "2026-06-03") == 2
        assert days_until("2026-06-10", "2026-06-03") == 7
        assert days_until("2026-07-03", "2026-06-03") == 30

    def test_past_date(self):
        """Past date should return negative days."""
        assert days_until("2026-06-02", "2026-06-03") == -1
        assert days_until("2026-05-03", "2026-06-03") == -31

    def test_boundary_7_days(self):
        """7 days exactly."""
        assert days_until("2026-06-10", "2026-06-03") == 7


class TestEventRiskForTicker:
    """Test event_risk_for_ticker deterministic scoring."""

    def test_elevated_risk_strong_setup_with_high_importance_event_within_7d(self):
        """
        Elevated when signal is strong_setup AND high-importance event within 7 days.
        """
        events = [
            {
                "id": "earnings-nvda-20260605",
                "date": "2026-06-05",
                "type": "earnings",
                "ticker": "NVDA",
                "title": "NVDA Earnings",
                "importance": "high",
            }
        ]

        # strong_setup + high-importance event 2 days out = elevated
        risk = event_risk_for_ticker("NVDA", "strong_setup", events, today="2026-06-03")
        assert risk == "elevated"

    def test_elevated_risk_watchlist_setup_with_high_importance_event_within_7d(self):
        """
        Elevated when signal is watchlist_setup AND high-importance event within 7 days.
        """
        events = [
            {
                "id": "earnings-nvda-20260605",
                "date": "2026-06-05",
                "type": "earnings",
                "ticker": "NVDA",
                "title": "NVDA Earnings",
                "importance": "high",
            }
        ]

        # watchlist_setup + high-importance event 2 days out = elevated
        risk = event_risk_for_ticker("NVDA", "watchlist_setup", events, today="2026-06-03")
        assert risk == "elevated"

    def test_not_elevated_strong_setup_with_medium_importance_event_only(self):
        """
        NOT elevated when signal is strong_setup but only medium-importance event.
        (Should be 'moderate' instead.)
        """
        events = [
            {
                "id": "conference-20260610",
                "date": "2026-06-10",
                "type": "conference",
                "ticker": "NVDA",
                "title": "Tech Conference",
                "importance": "medium",
            }
        ]

        risk = event_risk_for_ticker("NVDA", "strong_setup", events, today="2026-06-03")
        assert risk == "moderate"

    def test_not_elevated_strong_setup_with_high_importance_event_beyond_7d(self):
        """
        NOT elevated when signal is strong_setup but high-importance event is > 7 days away.
        """
        events = [
            {
                "id": "earnings-nvda-20260711",
                "date": "2026-07-11",
                "type": "earnings",
                "ticker": "NVDA",
                "title": "NVDA Earnings",
                "importance": "high",
            }
        ]

        # Event is 38 days away (beyond 7-day window) = low
        risk = event_risk_for_ticker("NVDA", "strong_setup", events, today="2026-06-03")
        assert risk == "low"

    def test_moderate_risk_medium_importance_event_within_7d(self):
        """
        Moderate when any medium-importance event within 7 days, regardless of signal.
        """
        events = [
            {
                "id": "investor-day-msft-20260610",
                "date": "2026-06-10",
                "type": "investor_day",
                "ticker": "MSFT",
                "title": "Microsoft Investor Day",
                "importance": "medium",
            }
        ]

        # inactive signal + medium-importance event within 7d (7 days away) = moderate
        risk = event_risk_for_ticker("MSFT", "inactive", events, today="2026-06-03")
        assert risk == "moderate"

        # strong_setup signal + medium-importance event within 7d = moderate (not elevated, no high event)
        risk = event_risk_for_ticker("MSFT", "strong_setup", events, today="2026-06-03")
        assert risk == "moderate"

    def test_low_risk_no_events_within_7d(self):
        """
        Low when no events within 7 days.
        """
        events = [
            {
                "id": "earnings-amd-20260725",
                "date": "2026-07-25",
                "type": "earnings",
                "ticker": "AMD",
                "title": "AMD Earnings",
                "importance": "high",
            }
        ]

        # Event 52 days away = low
        risk = event_risk_for_ticker("AMD", "strong_setup", events, today="2026-06-03")
        assert risk == "low"

    def test_low_risk_no_signal_with_high_importance_event(self):
        """
        Low when signal is not strong_setup/watchlist_setup, even with high-importance event.
        """
        events = [
            {
                "id": "earnings-nvda-20260605",
                "date": "2026-06-05",
                "type": "earnings",
                "ticker": "NVDA",
                "title": "NVDA Earnings",
                "importance": "high",
            }
        ]

        # inactive signal + high-importance event = low (needs strong/watchlist signal)
        risk = event_risk_for_ticker("NVDA", "inactive", events, today="2026-06-03")
        assert risk == "low"

    def test_case_insensitive_ticker_matching(self):
        """
        Ticker matching should be case-insensitive.
        """
        events = [
            {
                "id": "earnings-nvda-20260605",
                "date": "2026-06-05",
                "type": "earnings",
                "ticker": "NVDA",  # uppercase
                "title": "NVDA Earnings",
                "importance": "high",
            }
        ]

        # Lowercase ticker should still match
        risk = event_risk_for_ticker("nvda", "strong_setup", events, today="2026-06-03")
        assert risk == "elevated"

    def test_ignores_events_for_other_tickers(self):
        """
        Events for other tickers should be ignored.
        """
        events = [
            {
                "id": "earnings-amd-20260605",
                "date": "2026-06-05",
                "type": "earnings",
                "ticker": "AMD",
                "title": "AMD Earnings",
                "importance": "high",
            }
        ]

        # NVDA should not see AMD's events
        risk = event_risk_for_ticker("NVDA", "strong_setup", events, today="2026-06-03")
        assert risk == "low"

    def test_macro_events_ticker_null(self):
        """
        Macro events have ticker=None and should not apply to any specific ticker.
        """
        events = [
            {
                "id": "macro-fomc-20260604",
                "date": "2026-06-04",
                "type": "macro",
                "ticker": None,
                "title": "FOMC Interest Rate Decision",
                "importance": "high",
            }
        ]

        # NVDA should not be affected by macro events
        risk = event_risk_for_ticker("NVDA", "strong_setup", events, today="2026-06-03")
        assert risk == "low"

    def test_empty_events_list(self):
        """
        Empty events list should always return 'low'.
        """
        events = []

        risk = event_risk_for_ticker("NVDA", "strong_setup", events, today="2026-06-03")
        assert risk == "low"

        risk = event_risk_for_ticker("NVDA", "inactive", events, today="2026-06-03")
        assert risk == "low"

    def test_multiple_events_highest_importance_wins(self):
        """
        Multiple events: highest importance within 7d determines risk.
        """
        events = [
            {
                "id": "earnings-nvda-20260605",
                "date": "2026-06-05",
                "type": "earnings",
                "ticker": "NVDA",
                "title": "NVDA Earnings",
                "importance": "high",
            },
            {
                "id": "conference-nvda-20260610",
                "date": "2026-06-10",
                "type": "conference",
                "ticker": "NVDA",
                "title": "Tech Conference",
                "importance": "medium",
            },
        ]

        # strong_setup + high-importance event = elevated
        risk = event_risk_for_ticker("NVDA", "strong_setup", events, today="2026-06-03")
        assert risk == "elevated"

    def test_boundary_7_days_inclusive(self):
        """
        Events exactly 7 days away should be included.
        """
        events = [
            {
                "id": "earnings-nvda-20260610",
                "date": "2026-06-10",
                "type": "earnings",
                "ticker": "NVDA",
                "title": "NVDA Earnings",
                "importance": "high",
            }
        ]

        # Event exactly 7 days away (within window)
        risk = event_risk_for_ticker("NVDA", "strong_setup", events, today="2026-06-03")
        assert risk == "elevated"

    def test_boundary_8_days_excluded(self):
        """
        Events 8+ days away should not be considered.
        """
        events = [
            {
                "id": "earnings-nvda-20260611",
                "date": "2026-06-11",
                "type": "earnings",
                "ticker": "NVDA",
                "title": "NVDA Earnings",
                "importance": "high",
            }
        ]

        # Event 8 days away (outside window)
        risk = event_risk_for_ticker("NVDA", "strong_setup", events, today="2026-06-03")
        assert risk == "low"

    def test_today_event_included(self):
        """
        Events on today's date (0 days away) should be included.
        """
        events = [
            {
                "id": "earnings-nvda-20260603",
                "date": "2026-06-03",
                "type": "earnings",
                "ticker": "NVDA",
                "title": "NVDA Earnings",
                "importance": "high",
            }
        ]

        # Event today (0 days)
        risk = event_risk_for_ticker("NVDA", "strong_setup", events, today="2026-06-03")
        assert risk == "elevated"

    def test_comprehensive_demo_scenario(self):
        """
        Test a realistic scenario with mixed events and signals.
        """
        today = "2026-06-03"
        events = [
            # NVDA: high-importance earnings in 2 days
            {
                "id": "earnings-nvda-20260605",
                "date": "2026-06-05",
                "type": "earnings",
                "ticker": "NVDA",
                "title": "NVDA Earnings",
                "importance": "high",
            },
            # AMD: medium-importance earnings in 3 days
            {
                "id": "earnings-amd-20260606",
                "date": "2026-06-06",
                "type": "earnings",
                "ticker": "AMD",
                "title": "AMD Earnings",
                "importance": "high",
            },
            # MSFT: investor day in 18 days (beyond 7-day window)
            {
                "id": "investor-day-msft-20260621",
                "date": "2026-06-21",
                "type": "investor_day",
                "ticker": "MSFT",
                "title": "MSFT Investor Day",
                "importance": "medium",
            },
            # MACRO: FOMC in 1 day
            {
                "id": "macro-fomc-20260604",
                "date": "2026-06-04",
                "type": "macro",
                "ticker": None,
                "title": "FOMC",
                "importance": "high",
            },
        ]

        # NVDA with strong_setup + high-importance event in 2d = elevated
        assert event_risk_for_ticker("NVDA", "strong_setup", events, today) == "elevated"

        # AMD with inactive signal + high-importance event in 3d = low (needs signal)
        assert event_risk_for_ticker("AMD", "inactive", events, today) == "low"

        # AMD with watchlist_setup + high-importance event in 3d = elevated
        assert event_risk_for_ticker("AMD", "watchlist_setup", events, today) == "elevated"

        # MSFT with any signal + no event in 7d window = low
        assert event_risk_for_ticker("MSFT", "strong_setup", events, today) == "low"

        # TSLA with no events = low
        assert event_risk_for_ticker("TSLA", "strong_setup", events, today) == "low"
