"""Every Finnhub call goes through one doorway that paces itself, tells a refusal from an empty
result, and never lets the API key reach a log line.

None of the Finnhub-backed workers had a test before this file, and none had ever run against the
live API: the key was only ever set on the web host, never where the workers run.
"""
from __future__ import annotations

import pytest

from workers import finnhub_http
from workers.finnhub_http import FinnhubError, finnhub_get

KEY = "sk_live_FAKE_KEY_123"


class _Response:
    def __init__(self, status: int, payload=None):
        self.status_code = status
        self._payload = payload

    def json(self):
        return self._payload


class _Clock:
    """A clock that only moves when the code under test sleeps."""

    def __init__(self) -> None:
        self.now = 1000.0
        self.slept: list[float] = []

    def __call__(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.slept.append(seconds)
        self.now += seconds


@pytest.fixture(autouse=True)
def _fresh_throttle():
    finnhub_http.reset_throttle()
    yield
    finnhub_http.reset_throttle()


def test_calls_are_spaced_to_stay_under_the_free_tier_limit() -> None:
    clock = _Clock()
    calls: list[str] = []

    def http_get(url, params, timeout):
        calls.append(url)
        return _Response(200, [])

    for _ in range(100):
        finnhub_get("company-news", {"symbol": "NVDA"}, KEY, sleep=clock.sleep, clock=clock, http_get=http_get)

    assert len(calls) == 100
    elapsed = clock.now - 1000.0
    # 100 calls must take long enough that no rolling minute ever holds more than 60 of them.
    assert elapsed >= 99 * finnhub_http.MIN_INTERVAL_SECONDS - 1e-6
    assert 60 / finnhub_http.MIN_INTERVAL_SECONDS < 60


def test_a_rate_limit_refusal_waits_out_the_window_and_retries_once() -> None:
    clock = _Clock()
    responses = [_Response(429), _Response(200, {"ok": True})]

    def http_get(url, params, timeout):
        return responses.pop(0)

    assert finnhub_get("news", {}, KEY, sleep=clock.sleep, clock=clock, http_get=http_get) == {"ok": True}
    assert finnhub_http.RATE_LIMIT_WAIT_SECONDS in clock.slept


def test_a_second_refusal_is_an_error_not_an_empty_result() -> None:
    clock = _Clock()

    def http_get(url, params, timeout):
        return _Response(429)

    with pytest.raises(FinnhubError, match="HTTP 429"):
        finnhub_get("news", {}, KEY, sleep=clock.sleep, clock=clock, http_get=http_get)


def test_http_errors_are_raised_so_callers_cannot_mistake_them_for_no_data() -> None:
    clock = _Clock()

    def http_get(url, params, timeout):
        return _Response(404, {"error": "not found"})

    with pytest.raises(FinnhubError, match="HTTP 404"):
        finnhub_get("company-basic-financials", {"symbol": "NVDA"}, KEY, sleep=clock.sleep, clock=clock, http_get=http_get)


def test_the_api_key_never_appears_in_an_error() -> None:
    clock = _Clock()

    def http_get(url, params, timeout):
        # What the HTTP library really does: the failing URL, key and all, in the message.
        raise ConnectionError(f"Max retries exceeded with url: /api/v1/news?category=general&token={params['token']}")

    with pytest.raises(FinnhubError) as caught:
        finnhub_get("news", {"category": "general"}, KEY, sleep=clock.sleep, clock=clock, http_get=http_get)

    assert KEY not in str(caught.value)
    assert "[redacted]" in str(caught.value)
    # And the original exception (which does hold the key) is not chained onto it for a traceback.
    assert caught.value.__cause__ is None
    assert caught.value.__suppress_context__ is True


def test_the_key_is_sent_as_the_token_parameter() -> None:
    clock = _Clock()
    seen: dict = {}

    def http_get(url, params, timeout):
        seen.update(url=url, params=params)
        return _Response(200, [])

    finnhub_get("/company-news", {"symbol": "NVDA"}, KEY, sleep=clock.sleep, clock=clock, http_get=http_get)

    assert seen["url"] == "https://finnhub.io/api/v1/company-news"
    assert seen["params"] == {"symbol": "NVDA", "token": KEY}
