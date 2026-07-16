"""Quiet-hours timezone regression: the window is stored as wall-clock in the user's zone,
so it must be evaluated there, not in server UTC (which inverted it for the AU founder)."""
from datetime import datetime, timezone

from workers.stock_scanner.alert_engine import should_send_alert_to_user


def test_quiet_hours_evaluated_in_user_timezone_not_utc():
    # 02:00 UTC == 12:00 noon in Sydney (AEST, UTC+10, no June DST). Window 22:00-07:00.
    instant = datetime(2026, 6, 18, 2, 0, tzinfo=timezone.utc)

    sydney = {"alerts_enabled": True, "quiet_start": "22:00", "quiet_end": "07:00", "timezone": "Australia/Sydney"}
    can_send, _ = should_send_alert_to_user(sydney, {}, "strong_setup", current_time=instant)
    assert can_send is True  # midday in Sydney -> NOT quiet

    utc = {"alerts_enabled": True, "quiet_start": "22:00", "quiet_end": "07:00", "timezone": "UTC"}
    can_send_utc, reason = should_send_alert_to_user(utc, {}, "strong_setup", current_time=instant)
    assert can_send_utc is False  # 02:00 UTC -> inside the overnight window
    assert "quiet" in reason.lower()


def test_quiet_hours_overnight_window_in_sydney_evening():
    # 13:00 UTC == 23:00 in Sydney -> inside the 22:00-07:00 window there.
    evening = datetime(2026, 6, 18, 13, 0, tzinfo=timezone.utc)
    sydney = {"alerts_enabled": True, "quiet_start": "22:00", "quiet_end": "07:00", "timezone": "Australia/Sydney"}
    can_send, _ = should_send_alert_to_user(sydney, {}, "strong_setup", current_time=evening)
    assert can_send is False


def test_signal_type_toggle_gates_strong_setup():
    # The toggle maps to the strong_setup_enabled column (not a non-existent enable_* key).
    prefs = {"alerts_enabled": True, "strong_setup_enabled": False}
    can_send, reason = should_send_alert_to_user(prefs, {}, "strong_setup")
    assert can_send is False
    assert "strong-setup" in reason.lower()


def test_ignore_quiet_hours_defers_to_the_js_router():
    # Delivery through the JS notification router must NOT be gated on quiet hours here:
    # the router holds the event and releases it when the window ends. Gating in the
    # worker would drop the alert forever (signal alerts fire on state transitions).
    inside_quiet = datetime(2026, 6, 18, 2, 0, tzinfo=timezone.utc)
    prefs = {"alerts_enabled": True, "quiet_start": "22:00", "quiet_end": "07:00", "timezone": "UTC"}

    gated, reason = should_send_alert_to_user(prefs, {}, "strong_setup", current_time=inside_quiet)
    assert gated is False
    assert "quiet" in reason.lower()

    can_send, _ = should_send_alert_to_user(
        prefs, {}, "strong_setup", current_time=inside_quiet, ignore_quiet_hours=True
    )
    assert can_send is True


def test_ignore_quiet_hours_still_respects_type_toggles():
    prefs = {"alerts_enabled": True, "strong_setup_enabled": False, "quiet_start": "22:00", "quiet_end": "07:00"}
    can_send, reason = should_send_alert_to_user(prefs, {}, "strong_setup", ignore_quiet_hours=True)
    assert can_send is False
    assert "strong-setup" in reason.lower()
