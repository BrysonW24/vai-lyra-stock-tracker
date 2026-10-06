from types import SimpleNamespace

from workers.stock_scanner.main import _route_signal_alert, _send_and_log_alert
from workers.stock_scanner.notification_dispatch import DispatchResult


class Repo:
    def __init__(self, recent: bool = False) -> None:
        self.recent = recent
        self.saved: list[dict] = []

    def recently_alerted(self, *args, **kwargs) -> bool:
        return self.recent

    def save_alert(self, **kwargs) -> None:
        self.saved.append(kwargs)

    def load_user_alert_preferences(self, user_id: str) -> dict:
        return {}


def decision():
    return SimpleNamespace(
        symbol="NVDA",
        alert_type="score_jump",
        cooldown_hours=6,
        reason="Score changed materially.",
        payload={"signal_score": 72},
    )


def settings():
    return SimpleNamespace(
        default_user_id="123e4567-e89b-42d3-a456-426614174000",
        notification_dispatch_enabled=True,
    )


def signal():
    return SimpleNamespace(
        signal_score=72,
        signal_score_delta=None,
        action_state=None,
        raw_payload={},
    )


def test_legacy_cooldown_duplicate_does_not_write_a_sliding_skip_row(monkeypatch) -> None:
    repo = Repo(recent=True)
    send = SimpleNamespace(calls=0)

    def fake_send(*args, **kwargs):
        send.calls += 1
        return SimpleNamespace(sent_status="sent", error_message=None)

    monkeypatch.setattr("workers.stock_scanner.main.send_telegram_message", fake_send)
    count = _send_and_log_alert(
        repo,
        None,
        None,
        None,
        "NVDA",
        "score_jump",
        "message",
        {},
        6,
        settings(),
    )

    assert count == 0
    assert send.calls == 0
    assert repo.saved == []


def test_multi_channel_cooldown_stops_before_dispatch(monkeypatch) -> None:
    repo = Repo(recent=True)

    def unexpected_dispatch(*args, **kwargs):
        raise AssertionError("dispatch must not run inside the cooldown")

    monkeypatch.setattr("workers.stock_scanner.main.dispatch_notification", unexpected_dispatch)
    assert _route_signal_alert(repo, settings(), None, None, signal(), decision(), "message") == 0
    assert repo.saved == []


def test_router_dedupe_is_not_duplicated_in_stock_alerts(monkeypatch) -> None:
    repo = Repo(recent=False)
    monkeypatch.setattr(
        "workers.stock_scanner.main.dispatch_notification",
        lambda *args, **kwargs: DispatchResult(attempted=True, ok=True, deduped=True),
    )

    assert _route_signal_alert(repo, settings(), None, None, signal(), decision(), "message") == 0
    assert repo.saved == []


def test_fresh_router_delivery_is_recorded_once(monkeypatch) -> None:
    repo = Repo(recent=False)
    monkeypatch.setattr(
        "workers.stock_scanner.main.dispatch_notification",
        lambda *args, **kwargs: DispatchResult(attempted=True, ok=True, deduped=False),
    )

    assert _route_signal_alert(repo, settings(), None, None, signal(), decision(), "message") == 1
    assert len(repo.saved) == 1
    assert repo.saved[0]["sent_status"] == "sent"
    assert repo.saved[0]["payload"]["deduped"] is False


# --- an accepted dispatch is not a delivered alert -------------------------------------------------
#
# The router answers ok=True when it ACCEPTS an event and then suppresses it (account muted, under
# the relevance floor, no channel connected). Every caller counted that as "sent". From 2026-07-17
# to 2026-10-05 the operator's account sat on "mute all": not one alert was delivered, the alert
# log recorded 19,736 as sent, and the dashboard reported hundreds of alerts sent a week.


def test_an_accepted_but_suppressed_alert_is_not_counted_or_logged_as_sent(monkeypatch) -> None:
    repo = Repo(recent=False)
    monkeypatch.setattr(
        "workers.stock_scanner.main.dispatch_notification",
        lambda *args, **kwargs: DispatchResult(attempted=True, ok=True, deduped=False, delivered=False),
    )

    assert _route_signal_alert(repo, settings(), None, None, signal(), decision(), "message") == 0
    assert len(repo.saved) == 1
    assert repo.saved[0]["sent_status"] == "suppressed"


def test_a_delivered_alert_is_counted_and_logged_as_sent(monkeypatch) -> None:
    repo = Repo(recent=False)
    monkeypatch.setattr(
        "workers.stock_scanner.main.dispatch_notification",
        lambda *args, **kwargs: DispatchResult(attempted=True, ok=True, deduped=False, delivered=True),
    )

    assert _route_signal_alert(repo, settings(), None, None, signal(), decision(), "message") == 1
    assert repo.saved[0]["sent_status"] == "sent"


def test_dispatch_result_reads_delivery_from_the_router_response(monkeypatch) -> None:
    import io
    import json

    from workers.stock_scanner import notification_dispatch

    def router_answering(body: dict):
        class _Response(io.BytesIO):
            status = 200

            def __enter__(self):
                return self

            def __exit__(self, *_exc):
                return False

        return lambda _request, timeout=None: _Response(json.dumps(body).encode("utf-8"))

    cfg = SimpleNamespace(notification_dispatch_url="https://app.test/api/notifications/dispatch", notification_dispatch_secret="s")
    kwargs = dict(user_id="u1", symbol="NVDA", alert_type="score_jump", title="t", body="b", reason="r", payload={})

    # What the router really returns for a muted account: accepted, nothing delivered.
    monkeypatch.setattr(notification_dispatch, "urlopen", router_answering(
        {"ok": True, "deliveredChannels": [], "suppressedChannels": ["router"], "errors": []}
    ))
    muted = notification_dispatch.dispatch_notification(cfg, **kwargs)
    assert muted.ok is True and muted.reached_someone is False and muted.log_status == "suppressed"

    monkeypatch.setattr(notification_dispatch, "urlopen", router_answering(
        {"ok": True, "deliveredChannels": ["push", "telegram"], "suppressedChannels": [], "errors": []}
    ))
    delivered = notification_dispatch.dispatch_notification(cfg, **kwargs)
    assert delivered.reached_someone is True and delivered.log_status == "sent"

    # A duplicate the router already handled today is neither a new send nor a failure.
    monkeypatch.setattr(notification_dispatch, "urlopen", router_answering(
        {"ok": True, "deduped": True, "deliveredChannels": [], "suppressedChannels": [], "errors": []}
    ))
    assert notification_dispatch.dispatch_notification(cfg, **kwargs).reached_someone is False
