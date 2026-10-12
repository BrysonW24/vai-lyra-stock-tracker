"""Generation records (ai_runs rows for everything the workers send) and the feedback keyboard."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

import workers.stock_scanner.feedback as fb
import workers.stock_scanner.generation_record as gr

CONTRACT = json.loads((Path(__file__).resolve().parents[1] / "contracts" / "feedback" / "telegram-feedback.json").read_text())


class _Table:
    def __init__(self, client, name):
        self.client, self.name = client, name

    def insert(self, row, **kwargs):
        self.client.calls.append((self.name, row, kwargs))
        return self

    def execute(self):
        if self.client.failures:
            self.client.failures -= 1
            raise RuntimeError("database unavailable")
        return SimpleNamespace(data=[])


class _Client:
    def __init__(self, failures=0):
        self.calls, self.failures = [], failures

    def table(self, name):
        return _Table(self, name)


def _generation(**overrides):
    base = dict(agent_name="daily_read", prompt_version="daily_read@abc", input_text="facts", text_parts=["<b>one</b>", "two"])
    base.update(overrides)
    return gr.Generation(**base)


def test_prompt_version_is_stable_and_moves_with_any_part():
    one = gr.prompt_version("job", "system", {"b": 1, "a": [1, 2]})
    assert one == gr.prompt_version("job", "system", {"a": [1, 2], "b": 1}), "key order does not change a tool schema"
    assert one.startswith("job@") and len(one) == len("job@") + 12
    assert one != gr.prompt_version("job", "system.", {"b": 1, "a": [1, 2]})
    assert gr.prompt_version("job", "ab", "c") != gr.prompt_version("job", "a", "bc"), "parts are separated, not concatenated"


def test_a_generation_row_carries_the_text_the_input_and_who_may_read_it():
    generation = _generation(user_id="user-1", model="claude-opus-5-5", effort="high", cost_usd=0.0391234, extra={"reason": "ok"}, input_payload={"session": "2026-10-06"})
    row = generation.row()
    assert row["id"] == generation.id and len(row["id"]) == 36
    assert row["user_id"] == "user-1" and (row["model_provider"], row["model_name"]) == ("anthropic", "claude-opus-5-5")
    assert row["input_hash"] == hashlib.sha256(b"facts").hexdigest()
    assert row["input_payload"] == {"input": "facts", "session": "2026-10-06"}
    assert row["output_payload"]["text"] == "<b>one</b>\n\ntwo" and row["output_payload"]["parts"] == 2
    assert row["output_payload"]["mode"] == "production" and row["output_payload"]["cost_usd"] == 0.039123 and row["output_payload"]["reason"] == "ok"
    engine_only = _generation(user_id="").row()
    assert engine_only["model_provider"] is None and engine_only["model_name"] is None and engine_only["user_id"] is None
    assert _generation().id != _generation().id


def test_record_generation_inserts_without_echo_retries_and_never_raises(monkeypatch):
    monkeypatch.setattr(gr.time, "sleep", lambda *_: None)
    client = _Client()
    assert gr.record_generation(client, _generation()) is True
    (table, row, kwargs) = client.calls[0]
    assert table == "ai_runs" and row["agent_name"] == "daily_read" and kwargs == {"returning": gr._NO_ECHO}

    flaky = _Client(failures=2)
    assert gr.record_generation(flaky, _generation()) is True and len(flaky.calls) == 3
    down = _Client(failures=5)
    assert gr.record_generation(down, _generation()) is False and len(down.calls) == 3
    assert gr.record_generation(None, _generation()) is False
    assert gr.record_generation(_Client(), _generation(status="unknown")) is False, "a bad status is refused, not written"


def test_the_vote_keyboard_matches_the_contract_and_fits_telegram():
    generation_id = "0b8f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4"
    keyboard = fb.vote_keyboard(generation_id)
    assert keyboard == {"inline_keyboard": [[{"text": button["text"], "callback_data": f"fb:{generation_id}:{button['step']}"} for button in CONTRACT["vote"]]]}
    longest = f"fb:{generation_id}:d:" + max(CONTRACT["pillars"], key=len)
    assert len(longest.encode()) <= 64, "the longest callback the webhook builds still fits Telegram's 64 bytes"
    assert fb.vote_keyboard(None) is None and fb.vote_keyboard("") is None and fb.vote_keyboard("not-a-uuid") is None
    assert [fb.last_part_markup(i, 3, generation_id) for i in range(3)] == [None, None, keyboard]


def test_the_contract_names_the_six_pillars_and_asks_telegram_for_button_taps():
    assert CONTRACT["prefix"] == "fb" and "callback_query" in CONTRACT["allowed_updates"] and "message" in CONTRACT["allowed_updates"]
    assert sorted(CONTRACT["pillars"].values()) == sorted(["correctness", "relevance", "breadth", "insight", "clarity", "freshness"])
    for rating in ("u", "d"):
        chips = CONTRACT["reasons"][rating]["chips"]
        assert sorted(code for code, _label in chips) == sorted(CONTRACT["pillars"]), f"every pillar has a {rating} reason"
        assert all(len(label) <= 24 for _code, label in chips)


@pytest.mark.parametrize("text", [button["text"] for button in CONTRACT["vote"]] + [CONTRACT["skip"], CONTRACT["noted"]])
def test_button_labels_use_no_em_dash(text):
    assert "—" not in text and "–" not in text
