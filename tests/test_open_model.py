"""The open-model client: one OpenAI-compatible call, an ordered chain, public-safe failures, no content in logs."""
from __future__ import annotations

import logging

import pytest
import requests

import workers.stock_scanner.open_model as om

ENV = {"GROQ_API_KEY": "groq-key", "CLOUDFLARE_AI_TOKEN": "cf-token", "CLOUDFLARE_ACCOUNT_ID": "acct123", "OPENROUTER_API_KEY": "or-key"}
SECRET_PROMPT = "PROMPT-WITH-NVDA-AND-A-BOOK"
SECRET_ANSWER = "ANSWER-ABOUT-NVDA"
SECRET_ERROR = "PROVIDER-ECHOED-THE-PROMPT"


class FakeResponse:
    def __init__(self, status=200, payload=None, headers=None, text=""):
        self.status_code, self._payload, self.headers, self.text = status, payload, headers or {}, text

    def json(self):
        if self._payload is None:
            raise ValueError("not json")
        return self._payload


def chat(content, *, finish="stop", usage=(120, 30), **extra):
    """An OpenAI-style chat-completions body."""
    return {
        "model": "served-model",
        "choices": [{"message": {"content": content}, "finish_reason": finish}],
        "usage": {"prompt_tokens": usage[0], "completion_tokens": usage[1]},
        **extra,
    }


class Recorder:
    """A stand-in for requests.post that plays back queued responses and keeps what it was sent."""

    def __init__(self, *responses):
        self.responses, self.calls = list(responses), []

    def __call__(self, url, headers=None, json=None, timeout=None):
        self.calls.append({"url": url, "headers": headers or {}, "json": json or {}, "timeout": timeout})
        response = self.responses.pop(0) if len(self.responses) > 1 else self.responses[0]
        if isinstance(response, Exception):
            raise response
        return response


def _target(spec):
    (target,) = om.parse_chain(spec)
    return target


def _call(spec, post, **overrides):
    options = dict(system="system text", user=SECRET_PROMPT, env=ENV, post=post, sleep=lambda _seconds: None)
    options.update(overrides)
    return om.complete(_target(spec), **options)


def test_a_chain_is_read_in_order_and_a_typo_is_skipped_not_fatal():
    targets = om.parse_chain(" groq:openai/gpt-oss-120b , cloudflare:@cf/google/gemma-4-26b-a4b-it,local:gemma-4-12b, nowhere:model, groq: ,")
    assert [target.spec for target in targets] == ["groq:openai/gpt-oss-120b", "cloudflare:@cf/google/gemma-4-26b-a4b-it", "local:gemma-4-12b"]
    assert targets[0].label == "gpt-oss-120b (Groq)" and targets[2].label == "gemma-4-12b (Lyra's own copy)"
    # A model id may itself contain a colon (OpenRouter's free variants): only the first one splits.
    assert om.parse_chain("openrouter:meta-llama/llama-3.2-3b-instruct:free")[0].model == "meta-llama/llama-3.2-3b-instruct:free"
    assert om.parse_chain(None) == [] and om.parse_chain("") == []
    assert [t.spec for t in om.chain_from_env({"OPEN_MODEL_CHAIN": "local:x"})] == ["local:x"]


def test_each_provider_gets_its_own_address_key_and_request_shape():
    post = Recorder(FakeResponse(payload=chat("ok")))
    _call("groq:openai/gpt-oss-120b", post, max_tokens=900, temperature=0.2)
    sent = post.calls[0]
    assert sent["url"] == "https://api.groq.com/openai/v1/chat/completions"
    assert sent["headers"]["authorization"] == "Bearer groq-key"
    assert sent["json"]["max_completion_tokens"] == 900 and "max_tokens" not in sent["json"]
    assert sent["json"]["messages"] == [{"role": "system", "content": "system text"}, {"role": "user", "content": SECRET_PROMPT}]
    # A reasoning model's thinking must neither reach the reader nor eat the answer's budget.
    assert sent["json"]["reasoning_effort"] == "low" and sent["json"]["include_reasoning"] is False

    post = Recorder(FakeResponse(payload=chat("ok")))
    _call("groq:qwen/qwen3.8-27b", post)
    assert post.calls[0]["json"]["reasoning_format"] == "hidden" and "include_reasoning" not in post.calls[0]["json"]

    post = Recorder(FakeResponse(payload=chat("ok")))
    _call("cloudflare:@cf/google/gemma-4-26b-a4b-it", post)
    sent = post.calls[0]
    assert sent["url"] == "https://api.cloudflare.com/client/v4/accounts/acct123/ai/v1/chat/completions"
    assert sent["headers"]["authorization"] == "Bearer cf-token" and sent["json"]["max_tokens"] == 1500
    assert "reasoning_effort" not in sent["json"]

    post = Recorder(FakeResponse(payload=chat("ok")))
    _call("local:gemma-4-12b", post, env={"LOCAL_MODEL_URL": "http://127.0.0.1:9000/v1/"})
    sent = post.calls[0]
    assert sent["url"] == "http://127.0.0.1:9000/v1/chat/completions" and "authorization" not in sent["headers"]
    assert sent["timeout"] == om.LOCAL_TIMEOUT, "a CPU-only runner needs minutes, not seconds"


def test_a_missing_key_or_account_never_makes_a_request():
    post = Recorder(FakeResponse(payload=chat("ok")))
    assert _call("groq:openai/gpt-oss-120b", post, env={}).reason == "no_key"
    assert _call("cloudflare:@cf/x", post, env={"CLOUDFLARE_AI_TOKEN": "t"}).reason == "no_key", "a token without the account id cannot form the address"
    assert post.calls == []
    assert _call("local:any", post, env={}).ok, "the server on this machine needs no key"


def test_a_schema_is_enforced_where_the_endpoint_can_and_requested_as_json_where_it_cannot():
    schema = {"type": "object", "properties": {"a": {"type": "string"}}, "required": ["a"], "additionalProperties": False}
    post = Recorder(FakeResponse(payload=chat('{"a": "b"}')))
    _call("groq:openai/gpt-oss-120b", post, schema=schema, schema_name="thing")
    assert post.calls[0]["json"]["response_format"] == {"type": "json_schema", "json_schema": {"name": "thing", "strict": True, "schema": schema}}
    post = Recorder(FakeResponse(payload=chat('{"a": "b"}')))
    _call("local:gemma", post, schema=schema)
    assert post.calls[0]["json"]["response_format"]["type"] == "json_schema"
    post = Recorder(FakeResponse(payload=chat('{"a": "b"}')))
    _call("cloudflare:@cf/google/gemma-4-26b-a4b-it", post, schema=schema)
    assert post.calls[0]["json"]["response_format"] == {"type": "json_object"}


@pytest.mark.parametrize(
    "status, reason",
    [(401, "auth"), (403, "auth"), (402, "billing"), (429, "rate_limit"), (500, "api_500"), (503, "api_503")],
)
def test_a_failed_request_becomes_a_public_safe_reason(status, reason):
    outcome = _call("cloudflare:@cf/google/gemma-4-26b-a4b-it", Recorder(FakeResponse(status=status, text=SECRET_ERROR)))
    assert not outcome.ok and outcome.reason == reason and outcome.text is None
    assert SECRET_ERROR not in (outcome.note or "")


def test_an_unreachable_provider_is_a_connection_failure_not_an_exception():
    for failure in (requests.ConnectionError("refused"), requests.Timeout("slow")):
        outcome = _call("groq:openai/gpt-oss-120b", Recorder(failure))
        assert outcome.reason == "connection" and not outcome.ok


def test_a_reasoning_field_the_endpoint_refuses_is_dropped_and_the_request_asked_again():
    post = Recorder(FakeResponse(status=400, text=SECRET_ERROR), FakeResponse(payload=chat(SECRET_ANSWER)))
    outcome = _call("groq:openai/gpt-oss-120b", post)
    assert outcome.ok and len(post.calls) == 2
    assert "reasoning_effort" in post.calls[0]["json"] and "reasoning_effort" not in post.calls[1]["json"]
    # A 400 that is not about the extras is not retried forever.
    post = Recorder(FakeResponse(status=400), FakeResponse(status=400))
    assert _call("groq:openai/gpt-oss-120b", post).reason == "api_400" and len(post.calls) == 2
    post = Recorder(FakeResponse(status=400))
    assert _call("cloudflare:@cf/google/gemma-4-26b-a4b-it", post).reason == "api_400" and len(post.calls) == 1


def test_a_refused_answer_is_not_asked_for_twice():
    """A strict-schema endpoint answers 400 when the MODEL's JSON did not validate. That is not a
    reasoning field it refused: asking again would spend the free allowance twice for one failure."""
    post = Recorder(FakeResponse(status=400, text='{"error":{"code":"json_validate_failed","message":"..."}}'))
    assert _call("groq:openai/gpt-oss-120b", post).reason == "api_400" and len(post.calls) == 1
    # A body that cannot even be read is not evidence of anything: the plain retry still happens.
    class Unreadable(FakeResponse):
        @property
        def text(self):
            raise RuntimeError("decode failed")

        @text.setter
        def text(self, _value):
            pass

    post = Recorder(Unreadable(status=400), FakeResponse(payload=chat("ok")))
    assert _call("groq:openai/gpt-oss-120b", post).ok and len(post.calls) == 2
    # A request refused for its extras and then rate limited is still one clean failure.
    post = Recorder(FakeResponse(status=400), FakeResponse(status=429))
    assert _call("groq:openai/gpt-oss-120b", post).reason == "rate_limit" and len(post.calls) == 2


def test_the_copy_on_the_runner_is_asked_for_the_same_low_effort_as_the_hosted_one():
    post = Recorder(FakeResponse(payload=chat("ok")))
    _call("local:gpt-oss-20b", post)
    assert post.calls[0]["json"]["chat_template_kwargs"] == {"reasoning_effort": "low"}
    post = Recorder(FakeResponse(payload=chat("ok")))
    _call("local:gemma-4-12b-qat", post)
    assert "chat_template_kwargs" not in post.calls[0]["json"]


@pytest.mark.parametrize(
    "payload",
    [
        {"choices": [{"message": "hi"}]},
        {"choices": {"a": 1}},
        {"choices": [{"message": {"content": "ok"}}], "usage": [1]},
        {"choices": [{"message": {"content": "ok"}}], "usage": {"prompt_tokens": "abc", "completion_tokens": None}},
        {"choices": ["not a choice"]},
        ["a", "list"],
        "a string",
        {"choices": [{"message": {"content": 7}}]},
        {"choices": [{"message": {"content": "ok"}}], "timings": {"predicted_per_second": float("nan"), "prompt_per_second": True}},
    ],
)
def test_nothing_a_server_can_send_with_a_200_raises(payload):
    outcome = _call("local:gemma", Recorder(FakeResponse(payload=payload)))
    assert outcome.reason in ("ok", "empty", "unparsable")
    assert outcome.timings == {} and outcome.input_tokens >= 0 and outcome.output_tokens >= 0
    if outcome.ok:
        assert outcome.text == "ok"


def test_a_message_sent_as_typed_parts_is_read_and_a_request_that_cannot_be_sent_is_a_failure():
    parts = {"choices": [{"message": {"content": [{"type": "text", "text": "Breadth "}, {"type": "image", "text": "x"}, {"text": "was narrow."}]}, "finish_reason": "stop"}]}
    assert _call("local:gemma", Recorder(FakeResponse(payload=parts))).text == "Breadth was narrow."
    # A key that cannot be written into a header makes requests raise something that is not a RequestException.
    assert _call("groq:openai/gpt-oss-120b", Recorder(UnicodeEncodeError("latin-1", "ключ", 0, 1, "ordinal not in range"))).reason == "connection"


def test_the_time_reported_is_the_models_not_the_waiting(monkeypatch):
    clock = {"now": 1000.0}
    monkeypatch.setattr(om.time, "monotonic", lambda: clock["now"])

    def post(url, headers=None, json=None, timeout=None):
        clock["now"] += 2.0  # every request takes two seconds
        post.calls += 1
        return FakeResponse(status=429, headers={"retry-after": "30"}) if post.calls == 1 else FakeResponse(payload=chat("ok", usage=(100, 80)))

    post.calls = 0
    outcome = _call("groq:openai/gpt-oss-120b", post, rate_limit_wait=65, sleep=lambda seconds: clock.__setitem__("now", clock["now"] + seconds))
    assert outcome.ok and outcome.seconds == 2.0, "the 31 seconds spent waiting out the limit are not the model's speed"
    assert outcome.tokens_per_second == 40.0


def test_a_per_minute_limit_is_waited_out_once_when_the_job_can_afford_to():
    slept = []
    post = Recorder(FakeResponse(status=429, headers={"retry-after": "12"}), FakeResponse(payload=chat("after the wait")))
    outcome = _call("groq:openai/gpt-oss-120b", post, rate_limit_wait=65, sleep=slept.append)
    assert outcome.text == "after the wait" and slept == [13.0]
    # No patience given (the default), a wait longer than the job allows, or a second 429: it is a rate limit.
    assert _call("groq:openai/gpt-oss-120b", Recorder(FakeResponse(status=429, headers={"retry-after": "12"}))).reason == "rate_limit"
    assert _call("groq:openai/gpt-oss-120b", Recorder(FakeResponse(status=429, headers={"retry-after": "3600"})), rate_limit_wait=65).reason == "rate_limit"
    post = Recorder(FakeResponse(status=429, headers={"retry-after": "5"}), FakeResponse(status=429, headers={"retry-after": "5"}))
    assert _call("groq:openai/gpt-oss-120b", post, rate_limit_wait=65).reason == "rate_limit" and len(post.calls) == 2


def test_the_answer_is_what_the_model_wrote_without_its_thinking():
    outcome = _call("local:qwen", Recorder(FakeResponse(payload=chat("<think>the user wants\na read</think>\n\nBreadth was narrow."))))
    assert outcome.text == "Breadth was narrow."
    # A server that swallowed the opening tag leaves the closing one behind.
    outcome = _call("local:qwen", Recorder(FakeResponse(payload=chat("reasoning here</think>Breadth was narrow."))))
    assert outcome.text == "Breadth was narrow."
    assert outcome.input_tokens == 120 and outcome.output_tokens == 30 and outcome.served_model == "served-model"


def test_an_answer_that_is_empty_cut_off_or_declined_is_not_text():
    assert _call("groq:openai/gpt-oss-120b", Recorder(FakeResponse(payload=chat("", finish="length")))).reason == "max_tokens", "thinking ate the whole budget"
    assert _call("groq:openai/gpt-oss-120b", Recorder(FakeResponse(payload=chat("<think>only thoughts</think>")))).reason == "empty"
    assert _call("groq:openai/gpt-oss-120b", Recorder(FakeResponse(payload=chat("Half a sen", finish="length")))).reason == "max_tokens"
    assert _call("groq:openai/gpt-oss-120b", Recorder(FakeResponse(payload=chat("no", finish="content_filter")))).reason == "refusal"
    assert _call("groq:openai/gpt-oss-120b", Recorder(FakeResponse(payload=None))).reason == "unparsable"
    assert _call("groq:openai/gpt-oss-120b", Recorder(FakeResponse(payload={"choices": []}))).reason == "empty"
    for outcome in (_call("groq:openai/gpt-oss-120b", Recorder(FakeResponse(payload=chat("", finish="length")))),):
        assert outcome.text is None and outcome.output_tokens == 30, "the tokens were still spent and are still counted"


def test_speed_comes_from_the_servers_own_timings_when_it_gives_them():
    timed = chat("ok", usage=(900, 60), timings={"prompt_per_second": 41.5, "predicted_per_second": 3.2, "predicted_n": 60, "note": "ignored"})
    outcome = _call("local:gemma", Recorder(FakeResponse(payload=timed)))
    assert outcome.tokens_per_second == 3.2 and outcome.timings["prompt_per_second"] == 41.5 and "note" not in outcome.timings
    untimed = om.Completion("ok", _target("groq:openai/gpt-oss-120b"), output_tokens=100, seconds=4.0)
    assert untimed.tokens_per_second == 25.0
    assert om.Completion(None, _target("groq:openai/gpt-oss-120b")).tokens_per_second is None


def test_nothing_sent_or_received_reaches_the_log(caplog):
    caplog.set_level(logging.DEBUG)
    _call("groq:openai/gpt-oss-120b", Recorder(FakeResponse(payload=chat(SECRET_ANSWER))))
    _call("groq:openai/gpt-oss-120b", Recorder(FakeResponse(status=500, text=SECRET_ERROR)))
    _call("groq:openai/gpt-oss-120b", Recorder(requests.ConnectionError(SECRET_ERROR)))
    logged = caplog.text
    assert "groq" in logged, "the provider's name and the reason are logged"
    for secret in (SECRET_PROMPT, SECRET_ANSWER, SECRET_ERROR, "groq-key"):
        assert secret not in logged


def test_the_chain_stops_at_the_first_usable_answer_and_records_what_it_tried(monkeypatch):
    targets = om.parse_chain("groq:openai/gpt-oss-120b,cloudflare:@cf/google/gemma-4-26b-a4b-it,local:gemma")
    post = Recorder(FakeResponse(status=429), FakeResponse(payload=chat("from the second")), FakeResponse(payload=chat("never asked")))
    outcome, tried = om.complete_chain(targets, system="s", user="u", env=ENV, post=post)
    assert outcome.text == "from the second" and outcome.target.provider.name == "cloudflare"
    assert tried == [("groq:openai/gpt-oss-120b", "rate_limit"), ("cloudflare:@cf/google/gemma-4-26b-a4b-it", "ok")]
    assert len(post.calls) == 2

    # An answer that arrived but is no use to the caller hands over to the next target.
    post = Recorder(FakeResponse(payload=chat("not json")), FakeResponse(payload=chat('{"a": 1}')))
    outcome, tried = om.complete_chain(targets[:2], accept=lambda c: om.parse_json_object(c.text) is not None, system="s", user="u", env=ENV, post=post)
    assert outcome.text == '{"a": 1}' and [reason for _spec, reason in tried] == ["unparsable", "ok"]

    post = Recorder(FakeResponse(status=500))
    outcome, tried = om.complete_chain(targets[:2], system="s", user="u", env=ENV, post=post)
    assert not outcome.ok and outcome.reason == "api_500" and len(tried) == 2
    assert om.complete_chain([], system="s", user="u") == (None, [])


def test_json_is_found_inside_a_fence_or_stray_prose_and_nothing_else_is_guessed():
    assert om.parse_json_object('```json\n{"skip": true}\n```') == {"skip": True}
    assert om.parse_json_object('Here is the item: {"a": {"b": 1}} Hope that helps.') == {"a": {"b": 1}}
    for junk in (None, "", "no braces", "{not json}", "[1, 2]", '"just a string"'):
        assert om.parse_json_object(junk) is None
