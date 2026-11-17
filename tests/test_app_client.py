"""The writer's two calls to the app, and the contract both sides share.

Two fixtures under contracts/updates/ are read here AND by the app's own tests:
  * signature-vector.json - one signed request; `signature_header` must reproduce it exactly, and
    src/lib/updates/publish-auth.ts must verify it (publish-auth.test.ts, publish/route.test.ts).
  * facts-fixture.json - what GET /api/updates/facts serves for a known set of names (written by
    src/lib/updates/__tests__/facts-contract.test.ts). `build_facts` must read it as the daily rows it
    is, and derive the same figures the app's engine scored.
"""
from __future__ import annotations

import hashlib
import json
from datetime import date
from pathlib import Path
from types import SimpleNamespace

import pytest
import requests

import workers.stock_scanner.app_client as ac
import workers.stock_scanner.daily_read as dr
from tests.test_open_model import FakeResponse

CONTRACTS = Path(__file__).resolve().parents[1] / "contracts" / "updates"
VECTOR = json.loads((CONTRACTS / "signature-vector.json").read_text(encoding="utf-8"))
FACTS_FIXTURE = json.loads((CONTRACTS / "facts-fixture.json").read_text(encoding="utf-8"))
THRESHOLDS = SimpleNamespace(alert_score_threshold=75, watchlist_score_threshold=60)

FACTS_OK = {"ok": True, "published": False, **FACTS_FIXTURE}


class Clock:
    def __init__(self, start=1000.0):
        self.now, self.slept = start, []

    def __call__(self):
        return self.now

    def sleep(self, seconds):
        self.slept.append(seconds)
        self.now += seconds


class Getter:
    """A stand-in for requests.get that plays back queued responses and keeps the URLs asked."""

    def __init__(self, *responses):
        self.responses, self.calls = list(responses), []

    def __call__(self, url, timeout=None, **kwargs):
        self.calls.append({"url": url, "timeout": timeout, **kwargs})
        response = self.responses.pop(0) if len(self.responses) > 1 else self.responses[0]
        if isinstance(response, Exception):
            raise response
        return response


class Poster:
    def __init__(self, response):
        self.response, self.calls = response, []

    def __call__(self, url, data=None, headers=None, timeout=None):
        self.calls.append({"url": url, "data": data, "headers": headers or {}, "timeout": timeout})
        if isinstance(self.response, Exception):
            raise self.response
        return self.response


# --- the signature -------------------------------------------------------------------------------


def test_the_signature_is_the_one_the_app_verifies():
    assert ac.signature_header(VECTOR["secret"], VECTOR["timestamp"], VECTOR["body"]) == VECTOR["header"]
    assert ac.sign(VECTOR["secret"], VECTOR["timestamp"] + 1, VECTOR["body"]) != ac.sign(VECTOR["secret"], VECTOR["timestamp"], VECTOR["body"])
    assert ac.sign("another-secret-that-is-long-enough-to-count-00", VECTOR["timestamp"], VECTOR["body"]) != ac.sign(VECTOR["secret"], VECTOR["timestamp"], VECTOR["body"])


# --- fetch_facts ---------------------------------------------------------------------------------


def test_fetch_facts_returns_the_sessions_rows_and_whether_it_has_its_read():
    get = Getter(FakeResponse(payload=FACTS_OK))
    facts = ac.fetch_facts("https://solo.example/", get=get)
    assert get.calls[0]["url"] == "https://solo.example/api/updates/facts" and get.calls[0]["timeout"] == ac.TIMEOUT_SECONDS
    assert facts.session == "2026-11-05" and facts.hash == FACTS_FIXTURE["hash"] and facts.listed == 10
    assert len(facts.rows) == 8 and facts.published is False
    assert ac.fetch_facts("https://solo.example", get=Getter(FakeResponse(payload={**FACTS_OK, "published": True}))).published is True


def test_fetch_facts_waits_while_the_app_computes_then_takes_the_answer():
    clock = Clock()
    computing = FakeResponse(status=202, payload={"ok": False, "reason": "computing"})
    get = Getter(computing, computing, FakeResponse(payload=FACTS_OK))
    facts = ac.fetch_facts("https://solo.example", get=get, sleep=clock.sleep, clock=clock)
    assert facts.session == "2026-11-05" and len(get.calls) == 3
    assert clock.slept == [ac.FACTS_POLL_SECONDS, ac.FACTS_POLL_SECONDS]


def test_fetch_facts_gives_up_waiting_at_the_deadline():
    clock = Clock()
    computing = FakeResponse(status=202, payload={"ok": False, "reason": "computing"})
    with pytest.raises(ac.AppError) as caught:
        ac.fetch_facts("https://solo.example", get=Getter(computing), sleep=clock.sleep, clock=clock)
    assert (caught.value.reason, caught.value.status) == ("computing", 202)
    assert sum(clock.slept) >= ac.FACTS_WAIT_SECONDS


@pytest.mark.parametrize(
    "response, reason, status",
    [
        (FakeResponse(status=503, payload={"ok": False, "reason": "not_configured"}), "not_configured", 503),
        (FakeResponse(status=503, payload={"ok": False, "reason": "thin", "covered": 20, "listed": 61}), "thin", 503),
        (FakeResponse(status=429, payload={"ok": False, "reason": "rate_limited"}), "rate_limited", 429),
        (FakeResponse(status=500, payload=None), "unparsable", 500),
        (FakeResponse(status=502, payload={"error": "bad gateway"}), "status_502", 502),
        (FakeResponse(payload={"ok": True, "session": "2026-11-05", "rows": [], "hash": "x", "listed": 61}), "no_rows", 200),
        (requests.ConnectionError("refused"), "connection", None),
    ],
)
def test_fetch_facts_turns_every_refusal_into_a_short_safe_to_log_reason(response, reason, status):
    with pytest.raises(ac.AppError) as caught:
        ac.fetch_facts("https://solo.example", get=Getter(response))
    assert (caught.value.reason, caught.value.status) == (reason, status)


# --- publish -------------------------------------------------------------------------------------


def _read():
    return {"kind": "market_read", "session": "2026-11-05", "factsHash": "a" * 64, "sheet": "Names scanned: 61.", "figures": [{"title": "Session", "lines": ["1 up"]}], "prose": None, "proseNote": "x", "writer": None}


def test_publish_sends_the_compact_body_signed_over_the_timestamp_and_exactly_that_body():
    post = Poster(FakeResponse(payload={"ok": True, "session": "2026-11-05", "prose": False, "rehearsal": False}))
    answer = ac.publish("https://solo.example/", VECTOR["secret"], _read(), post=post, now=lambda: VECTOR["timestamp"] + 0.7)
    assert answer == {"ok": True, "session": "2026-11-05", "prose": False, "rehearsal": False}
    (call,) = post.calls
    assert call["url"] == "https://solo.example/api/updates/publish" and call["timeout"] == ac.TIMEOUT_SECONDS
    assert call["headers"]["content-type"] == "application/json"
    # The body is the vector's body byte for byte, so the header is the vector's header.
    assert call["data"] == VECTOR["body"].encode("utf-8")
    assert call["headers"][ac.SIGNATURE_HEADER] == VECTOR["header"]


def test_publish_keeps_non_ascii_in_the_body_rather_than_escaping_it():
    post = Poster(FakeResponse(payload={"ok": True}))
    read = {**_read(), "prose": "Semiconductors led - NVDA up 3.4% - with CRM 2.4% lower."}
    ac.publish("https://solo.example", VECTOR["secret"], read, post=post, now=lambda: 1762500000)
    body = post.calls[0]["data"].decode("utf-8")
    assert json.loads(body)["prose"] == read["prose"] and "\\u" not in body


@pytest.mark.parametrize(
    "response, reason, status",
    [
        (FakeResponse(status=401, payload={"ok": False, "reason": "signature_stale"}), "signature_stale", 401),
        (FakeResponse(status=409, payload={"ok": False, "reason": "facts_mismatch"}), "facts_mismatch", 409),
        (FakeResponse(status=503, payload={"ok": False, "reason": "not_configured"}), "not_configured", 503),
        (FakeResponse(status=413, payload={"ok": False, "reason": "payload_too_large"}), "payload_too_large", 413),
        (FakeResponse(status=502, payload=None), "unparsable", 502),
        (requests.Timeout("slow"), "connection", None),
    ],
)
def test_publish_turns_every_refusal_into_a_short_safe_to_log_reason(response, reason, status):
    with pytest.raises(ac.AppError) as caught:
        ac.publish("https://solo.example", VECTOR["secret"], _read(), post=Poster(response), now=lambda: 1762500000)
    assert (caught.value.reason, caught.value.status) == (reason, status)


# --- the facts contract --------------------------------------------------------------------------


def test_the_apps_facts_are_read_by_build_facts_as_the_daily_rows_they_are():
    facts = dr.build_facts(FACTS_FIXTURE["rows"], THRESHOLDS, daily=True)
    assert facts is not None and facts.daily and facts.complete
    assert facts.session == date(2026, 11, 5)
    assert facts.symbols == {"ADBE", "AMD", "AVGO", "CRM", "CRWD", "NOW", "NVDA", "PANW"}
    by_symbol = {ticker.symbol: ticker for ticker in facts.tickers}
    # Scores, statuses and the close-to-close move come straight from the app's rows.
    assert (by_symbol["NVDA"].score, by_symbol["NVDA"].status, by_symbol["NVDA"].prior_score) == (71.5, "watchlist_setup", 58.0)
    assert by_symbol["NVDA"].day_pct == pytest.approx((186.4 - 180.0) / 180.0 * 100)
    assert by_symbol["NVDA"].volume_ratio == 1.8 and by_symbol["PANW"].volume_ratio is None
    # No first hour exists in daily rows.
    assert all(ticker.open_pct is None for ticker in facts.tickers)
    # The transitions the read can name.
    assert [t.symbol for t in facts.newly_strong] == ["AMD"]
    assert [t.symbol for t in facts.newly_watch] == ["NVDA"]
    assert [t.symbol for t in facts.invalidated] == ["CRM"]
    assert {t.symbol for t in facts.tickers if t.status == "strong_setup"} == {"AMD", "PANW"}
    assert {t.symbol for t in facts.tickers if t.status == "watchlist_setup"} == {"ADBE", "NVDA"}


def test_the_fixtures_hash_is_sha256_of_the_rows_as_compact_json():
    compact = json.dumps(FACTS_FIXTURE["rows"], ensure_ascii=False, separators=(",", ":"))
    assert hashlib.sha256(compact.encode("utf-8")).hexdigest() == FACTS_FIXTURE["hash"]


def test_the_sheet_and_the_figures_from_the_apps_facts_carry_no_first_hour_and_name_the_right_things():
    facts = dr.build_facts(FACTS_FIXTURE["rows"], THRESHOLDS, daily=True)
    sheet = dr.build_sheet(facts)
    assert "first hour" not in sheet.text and "hourly" not in sheet.text
    assert "Names scanned: 8." in sheet.text
    sections = dr.figure_sections(facts)
    joined = "\n".join(sections)
    assert "AMD" in joined and "CRM" in joined
