"""The nightly content review: measures, prompt, verdict parsing, the model call and the run loop."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

import workers.stock_scanner.content_judge as cj
from tests.test_daily_read import _settings

UTC = timezone.utc
NOW = datetime(2026, 10, 14, 11, 40, tzinfo=UTC)

GOOD = {
    "scores": {"correctness": 5, "relevance": 3, "breadth": 2, "insight": 4, "clarity": 3, "freshness": 4},
    "reasons": {pillar: f"'quoted words' {pillar}" for pillar in cj.PILLARS},
    "advice_detected": False,
    "advice_quote": "",
    "summary": "Connect the groups that moved to the reader's holdings.",
}


def _row(id_, agent, status="ok", *, days_ago=0.5, user_id="user-1", **output):
    return {
        "id": id_,
        "agent_name": agent,
        "status": status,
        "user_id": user_id,
        "prompt_version": f"{agent}@abc",
        "created_at": (NOW - timedelta(days=days_ago)).isoformat(),
        "input_payload": {"input": "Session facts: NVDA up 4.0%."},
        "output_payload": {"text": "<b>Read</b> NVDA rose 4.0%.", "parts": 1, "mode": "production", **output},
    }


class _Query:
    def __init__(self, db, table):
        self.db, self.table, self.eqs, self.ins, self._insert = db, table, {}, {}, None

    def select(self, *_a, **_k):
        return self

    def eq(self, column, value):
        self.eqs[column] = value
        return self

    def in_(self, column, values):
        self.ins[column] = set(values)
        return self

    def is_(self, column, value):
        assert value == "null"
        self.ors = getattr(self, "ors", []) + [[(column, None)]]
        return self

    def or_(self, expression):
        # PostgREST's "user_id.is.null,user_id.eq.<id>": a row passes when any condition holds.
        options = []
        for condition in expression.split(","):
            column, op, value = condition.split(".", 2)
            options.append((column, None if op == "is" else value))
        self.ors = getattr(self, "ors", []) + [options]
        return self

    def gte(self, column, value):
        self.eqs.setdefault("__gte__", []).append((column, value))
        return self

    def order(self, column, desc=False):
        self._order = (column, desc)
        return self

    def limit(self, count):
        self._limit = count
        return self

    def insert(self, row, **_k):
        self._insert = row
        return self

    def update(self, row, **_k):
        self._update = row
        return self

    def execute(self):
        if self._insert is not None:
            # The database stamps created_at with now(); the fake stamps the test's clock.
            row = {"id": f"{self.table}-{len(self.db.setdefault(self.table, [])) + 1}", "created_at": NOW.isoformat(), **self._insert}
            self.db[self.table].append(row)
            return SimpleNamespace(data=[row])
        if getattr(self, "_update", None) is not None:
            for row in self.db.get(self.table, []):
                if row.get("id") == self.eqs.get("id"):
                    row.update(self._update)
            return SimpleNamespace(data=[])
        rows = []
        for row in self.db.get(self.table, []):
            if any(row.get(c) != v for c, v in self.eqs.items() if c != "__gte__"):
                continue
            if any(row.get(c) not in vs for c, vs in self.ins.items()):
                continue
            if any(str(row.get(c) or "") < v for c, v in self.eqs.get("__gte__", [])):
                continue
            if any(not any(row.get(c) == v for c, v in options) for options in getattr(self, "ors", [])):
                continue
            rows.append(row)
        # Like PostgREST: filter, then order, then cut to the limit.
        if getattr(self, "_order", None):
            column, desc = self._order
            rows.sort(key=lambda r: str(r.get(column) or ""), reverse=desc)
        if getattr(self, "_limit", None) is not None:
            rows = rows[: self._limit]
        return SimpleNamespace(data=rows)


class _Client:
    def __init__(self, db):
        self.db = db

    def table(self, name):
        return _Query(self.db, name)


@pytest.fixture
def harness(monkeypatch):
    db = {
        "ai_runs": [],
        "stock_scanner_runs": [],
        "portfolio_positions": [{"user_id": "user-1", "symbol": "NVDA", "is_active": True}, {"user_id": "user-1", "symbol": "GOOG", "is_active": True}],
        "watchlist_items": [{"user_id": "user-1", "symbol": "META", "is_active": True}],
    }
    state = SimpleNamespace(db=db, prompts=[], verdicts=[])
    monkeypatch.setattr(cj, "load_settings", lambda: _settings())
    monkeypatch.setattr(
        cj,
        "SupabaseRepository",
        lambda settings: SimpleNamespace(client=_Client(db), create_run=lambda job, tf: _Query(db, "stock_scanner_runs").insert({"job_name": job, "status": "running", "started_at": NOW.isoformat()}).execute().data[0]["id"]),
    )
    monkeypatch.setattr(cj.time if hasattr(cj, "time") else cj, "sleep", lambda *_: None, raising=False)

    def fake_judge(prompt, *, model, effort):
        state.prompts.append({"prompt": prompt, "model": model, "effort": effort})
        if state.verdicts:
            return state.verdicts.pop(0)
        return cj.Verdict(dict(GOOD["scores"]), dict(GOOD["reasons"]), False, "", GOOD["summary"], model=model, input_tokens=3_000, output_tokens=800, cost_usd=0.028)

    monkeypatch.setattr(cj, "judge", fake_judge)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    for name in ("JUDGE_MODEL", "JUDGE_EFFORT", "JUDGE_MONTHLY_BUDGET_USD", "JUDGE_LOOKBACK_DAYS", "JUDGE_MAX_PER_RUN", "ENABLE_CONTENT_JUDGE"):
        monkeypatch.delenv(name, raising=False)
    return state


def test_measures_are_deterministic_evidence_from_the_text_and_the_items():
    briefing = cj.Reviewable(
        "g2", "ai_briefing", "ok", None, "ai_briefing@abc", NOW.isoformat(), {},
        {
            "text": "🗞️ <b>Lyra AI briefing</b>\n☢️ <b>Constellation (Nasdaq: CEG)</b> signed a 20-year deal for 890 MW &amp; more. NVDA rose.",
            "parts": 1,
            "items": [{"theme": "nuclear-uranium", "desk": "news", "listed": True}, {"theme": "semiconductors", "desk": "ipo", "listed": False}],
            "desk_notes": {"ipo": "", "venture": "Nothing new found tonight.", "government": "", "small_cap": "Quiet."},
            "removed": 1,
        },
    )
    facts = cj.measures(briefing, ["NVDA", "GOOG"])
    assert cj.plain_text(briefing.output_payload["text"]).endswith("890 MW & more. NVDA rose.")
    assert facts["items"] == 2 and facts["themes"] == ["nuclear-uranium", "semiconductors"] and facts["desks_with_items"] == ["ipo"]
    assert facts["desk_notes"] == ["small_cap", "venture"] and facts["listed"] == 1 and facts["removed_by_guard"] == 1
    assert facts["holdings_named"] == ["NVDA"] and facts["figures"] == 2 and facts["figures_per_100_words"] > 0


def test_the_prompt_gives_the_reader_the_book_the_measures_and_the_correctness_evidence():
    read = cj.Reviewable("g1", "daily_read", "ok", "user-1", "daily_read@abc", NOW.isoformat(), {"input": "FACT SHEET LINE"}, {"text": "<b>The read</b>\nNVDA rose.", "guard_removed": 1, "ai": True})
    prompt, facts = cj.build_prompt(read, ["GOOG", "NVDA"], ["META"])
    assert "<reader>The operator: an Australian private investor" in prompt and "The operator holds GOOG, NVDA and watches META." in prompt
    assert "the guard removed 1 sentence(s)" in prompt and "<facts>\nFACT SHEET LINE\n</facts>" in prompt
    assert '<content kind="daily_read"' in prompt and "The read\nNVDA rose." in prompt and "<b>" not in prompt.split("<content")[1]
    assert json.loads(prompt.split("<measures>")[1].split("</measures>")[0]) == facts
    fallback = cj.Reviewable("g1", "daily_read", "fallback", "user-1", "v", NOW.isoformat(), {"input": "FACT SHEET LINE"}, {"text": "figures"})
    assert "no AI prose" in cj.build_prompt(fallback, [], [])[0] and "FACT SHEET LINE" not in cj.build_prompt(fallback, [], [])[0]
    assert "holds" not in cj.build_prompt(fallback, [], [])[0], "no book without an operator to own the review"


def test_a_verdict_must_score_every_pillar_zero_to_five():
    scores, reasons, advice, quote, summary = cj.parse_verdict(json.dumps(GOOD))
    assert scores == GOOD["scores"] and set(reasons) == set(cj.PILLARS) and advice is False and summary.startswith("Connect")
    for broken in (
        {**GOOD, "scores": {**GOOD["scores"], "clarity": 6}},
        {**GOOD, "scores": {**GOOD["scores"], "clarity": True}},
        {**GOOD, "scores": {k: v for k, v in GOOD["scores"].items() if k != "breadth"}},
        {**GOOD, "reasons": "none"},
    ):
        assert cj.parse_verdict(json.dumps(broken)) is None
    assert cj.parse_verdict("not json") is None and cj.parse_verdict("[1]") is None
    long = cj.parse_verdict(json.dumps({**GOOD, "reasons": {p: "x " * 400 for p in cj.PILLARS}}))
    assert all(len(r) <= cj.MAX_REASON_CHARS for r in long[1].values())


class _Status(Exception):
    def __init__(self, status_code, message):
        super().__init__(message)
        self.status_code = status_code


class _BadRequest(_Status):
    pass


@pytest.fixture
def sdk(monkeypatch):
    state = SimpleNamespace(calls=[], plain_calls=[], response=None, raise_on_beta=None)

    def response(text, stop="end_turn"):
        usage = SimpleNamespace(input_tokens=3_000, output_tokens=900, cache_read_input_tokens=0, cache_creation_input_tokens=0)
        return SimpleNamespace(content=[SimpleNamespace(type="thinking", thinking=""), SimpleNamespace(type="text", text=text)], stop_reason=stop, usage=usage, model="claude-opus-5-5")

    class _Beta:
        def create(self, **kwargs):
            state.calls.append(kwargs)
            if state.raise_on_beta:
                raise state.raise_on_beta
            return state.response

    class _Plain:
        def create(self, **kwargs):
            state.plain_calls.append(kwargs)
            return state.response

    class _Anthropic:
        def __init__(self, **_k):
            self.beta = SimpleNamespace(messages=_Beta())
            self.messages = _Plain()

    fake = SimpleNamespace(
        Anthropic=_Anthropic,
        AuthenticationError=type("AuthenticationError", (Exception,), {}),
        RateLimitError=type("RateLimitError", (Exception,), {}),
        APIStatusError=_Status,
        BadRequestError=_BadRequest,
        APIConnectionError=type("APIConnectionError", (Exception,), {}),
    )
    monkeypatch.setitem(sys.modules, "anthropic", fake)
    state.make = response
    return state


def test_judge_asks_for_the_schema_at_low_effort_and_prices_the_call(sdk):
    sdk.response = sdk.make(json.dumps(GOOD))
    verdict = cj.judge("PROMPT", model="claude-opus-5-5", effort="low")
    assert verdict.scores == GOOD["scores"] and verdict.mean == pytest.approx(3.5) and verdict.reason == "ok"
    (call,) = sdk.calls
    assert call["output_config"] == {"effort": "low", "format": {"type": "json_schema", "schema": cj.SCHEMA}}
    assert call["system"] == cj.SYSTEM_PROMPT and call["messages"] == [{"role": "user", "content": "PROMPT"}]
    assert call["betas"] == ["server-side-fallback-2026-07-01"] and call["fallbacks"] == "default"
    assert verdict.cost_usd == pytest.approx((3_000 * 4 + 900 * 20) / 1e6)

    sdk.response = sdk.make("{}")
    assert cj.judge("P", model="claude-opus-5-5", effort="low").reason == "unparsable"
    sdk.response = sdk.make("", stop="refusal")
    assert cj.judge("P", model="claude-opus-5-5", effort="low").reason == "refusal"


def test_judge_names_an_empty_credit_balance_and_does_not_retry_it(sdk):
    sdk.raise_on_beta = _BadRequest(400, "Error code: 400 - Your credit balance is too low to access the Anthropic API.")
    verdict = cj.judge("P", model="claude-opus-5-5", effort="low")
    assert verdict.scores is None and verdict.reason == "billing" and sdk.plain_calls == []
    sdk.raise_on_beta = _BadRequest(400, "fallbacks is not supported with output_config.format")
    sdk.response = sdk.make(json.dumps(GOOD))
    assert cj.judge("P", model="claude-opus-5-5", effort="low").scores == GOOD["scores"] and len(sdk.plain_calls) == 1, "any other 400 retries once without the fallback"


def test_run_reviews_each_new_generation_once_and_owns_every_review(harness):
    harness.db["ai_runs"] = [
        _row("g1", "daily_read", ai=True, guard_removed=0),
        _row("g2", "ai_briefing", user_id=None, items=[{"theme": "semiconductors", "desk": "news"}]),
        _row("g3", "ai_briefing", "note", user_id=None),
        _row("g4", "morning_guide"),
        _row("g5", "daily_read", days_ago=5),
        {"id": "j0", "agent_name": "content_judge", "status": "ok", "user_id": "user-1", "created_at": NOW.isoformat(), "input_payload": {"generation_id": "g4"}, "output_payload": {}},
    ]
    assert cj.run(now=NOW) == 0
    assert len(harness.prompts) == 2 and harness.prompts[0]["effort"] == "low" and harness.prompts[0]["model"] == "claude-opus-5-5"
    reviews = [row for row in harness.db["ai_runs"] if row["agent_name"] == "content_judge" and row["id"] != "j0"]
    assert [r["input_payload"]["generation_id"] for r in reviews] == ["g1", "g2"], "a note, a reviewed row and an old row are skipped"
    first = reviews[0]
    assert first["user_id"] == "user-1" and reviews[1]["user_id"] == "user-1", "the review carries the operator's book, so the operator owns it"
    assert first["output_payload"]["scores"] == GOOD["scores"] and first["output_payload"]["mean"] == 3.5 and first["confidence_score"] == 0.7
    assert first["input_payload"]["rubric_version"] == cj.RUBRIC_VERSION and first["prompt_version"] == cj.PROMPT_VERSION
    assert first["input_payload"]["measures"]["holdings_named"] == ["NVDA"] and first["output_payload"]["text"] == GOOD["summary"]
    assert "The operator holds GOOG, NVDA and watches META." in harness.prompts[0]["prompt"]
    ledger = harness.db["stock_scanner_runs"][0]
    assert ledger["status"] == "success" and ledger["payload"]["reviewed"] == 2 and ledger["payload"]["cost_usd"] == pytest.approx(0.056)
    assert ledger["payload"]["by_agent"] == {"daily_read": 1, "ai_briefing": 1}

    assert cj.run(now=NOW + timedelta(hours=1)) == 0
    assert len(harness.prompts) == 2, "reviewed rows are not reviewed again"


def test_run_stops_on_billing_and_respects_the_budget(harness, monkeypatch):
    harness.db["ai_runs"] = [_row("g1", "daily_read"), _row("g2", "daily_read")]
    harness.verdicts = [cj.Verdict(None, reason="billing")]
    assert cj.run(now=NOW) == 0
    assert len(harness.prompts) == 1, "an empty credit balance ends the night"
    ledger = harness.db["stock_scanner_runs"][0]
    assert ledger["status"] == "failed" and ledger["payload"]["reason"] == "billing" and ledger["payload"]["left"] == 2

    harness.db["stock_scanner_runs"] = [{"id": "x", "job_name": "content_judge", "status": "success", "started_at": NOW.isoformat(), "payload": {"cost_usd": 5.0}}]
    assert cj.run(now=NOW) == 0 and len(harness.prompts) == 1, "the month's budget is spent: no call"

    monkeypatch.setenv("ENABLE_CONTENT_JUDGE", "false")
    harness.db["stock_scanner_runs"] = []
    assert cj.run(now=NOW) == 0 and len(harness.prompts) == 1


def test_run_reviews_only_lyras_own_rows_and_a_forged_review_suppresses_nothing(harness):
    """Any signed-in account may insert ai_runs rows under its own id (migration 019's policy). Such a
    row is never reviewed, and a forged "review" of a real generation does not stop the real one."""
    harness.db["ai_runs"] = [
        _row("g1", "daily_read"),
        _row("evil", "daily_read", user_id="someone-else"),
        {"id": "fake-review", "agent_name": "content_judge", "status": "ok", "user_id": "someone-else", "created_at": NOW.isoformat(), "input_payload": {"generation_id": "g1"}, "output_payload": {}},
    ]
    assert cj.run(now=NOW) == 0
    reviewed = [row["input_payload"]["generation_id"] for row in harness.db["ai_runs"] if row["agent_name"] == "content_judge" and row["id"] != "fake-review"]
    assert reviewed == ["g1"], "the forged row is skipped and the forged review does not count"


def test_without_an_operator_only_the_ownerless_briefing_is_reviewed_and_no_book_is_quoted(harness, monkeypatch):
    monkeypatch.setattr(cj, "load_settings", lambda: _settings(default_user_id=""))
    harness.db["ai_runs"] = [_row("g1", "daily_read"), _row("g2", "ai_briefing", user_id=None, items=[])]
    assert cj.run(now=NOW) == 0
    (review,) = [row for row in harness.db["ai_runs"] if row["agent_name"] == "content_judge"]
    assert review["input_payload"]["generation_id"] == "g2" and review["user_id"] is None
    assert "holds" not in harness.prompts[0]["prompt"] and "Session facts" not in review["input_payload"]["input"]


def test_a_review_that_fails_for_any_other_reason_turns_the_run_red(harness):
    harness.db["ai_runs"] = [_row("g1", "daily_read"), _row("g2", "daily_read")]
    harness.verdicts = [cj.Verdict(None, reason="unparsable")]
    assert cj.run(now=NOW) == 1, "the pager should say a review failed"
    assert len(harness.prompts) == 2, "one bad answer does not stop the others"
    assert cj.DEFAULT_LOOKBACK_DAYS == 4


def test_the_fact_sheet_in_the_evidence_is_capped():
    read = cj.Reviewable("g1", "daily_read", "ok", "user-1", "v", NOW.isoformat(), {"input": "x" * 50_000}, {"text": "The read."})
    prompt, _facts = cj.build_prompt(read, [], [])
    assert len(prompt) < cj.MAX_FACTS_CHARS + 3_000, "no input can set the bill"


def test_forged_rows_cannot_crowd_the_real_ones_out_of_the_row_limit(harness):
    """The ownership filter runs in the query, before the 200-row limit: 250 forged rows dated ahead
    of the real read cannot push it out of the window."""
    forged = [_row(f"evil-{n}", "daily_read", days_ago=3.5 - n / 1000, user_id="someone-else") for n in range(250)]
    harness.db["ai_runs"] = forged + [_row("g1", "daily_read", days_ago=0.5)]
    assert cj.run(now=NOW) == 0
    reviewed = [row["input_payload"]["generation_id"] for row in harness.db["ai_runs"] if row["agent_name"] == "content_judge"]
    assert reviewed == ["g1"]


def test_a_spent_budget_is_on_the_ledger_for_the_morning_guide(harness):
    harness.db["ai_runs"] = [_row("g1", "daily_read")]
    harness.db["stock_scanner_runs"] = [{"id": "x", "job_name": "content_judge", "status": "success", "started_at": NOW.isoformat(), "payload": {"cost_usd": 5.0}}]
    assert cj.run(now=NOW) == 0 and harness.prompts == []
    skipped = harness.db["stock_scanner_runs"][-1]
    assert skipped["status"] == "skipped" and skipped["payload"]["reason"] == "budget" and skipped["payload"]["ai"] is False


def test_an_earlier_failed_review_still_pages_when_billing_ends_the_night(harness):
    harness.db["ai_runs"] = [_row("g1", "daily_read"), _row("g2", "daily_read")]
    harness.verdicts = [cj.Verdict(None, reason="unparsable"), cj.Verdict(None, reason="billing")]
    assert cj.run(now=NOW) == 1

