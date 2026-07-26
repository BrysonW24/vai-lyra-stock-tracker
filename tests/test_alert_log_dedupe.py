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
