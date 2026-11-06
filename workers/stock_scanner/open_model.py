"""One client for open-weight models - the free hosted tiers and Lyra's own copy on the runner.

The founder asked on 2026-11-06 for Lyra's updates and chat to be free on open-source models. Every
place that can serve one speaks the same OpenAI chat-completions dialect: Groq and Cloudflare
Workers AI (free hosted tiers), OpenRouter's free models, and llama.cpp's `llama-server` running a
GGUF file on the GitHub runner itself. So there is one client, and which model writes a message is
configuration: an ordered CHAIN of `provider:model` targets, tried in turn.

    OPEN_MODEL_CHAIN="groq:openai/gpt-oss-120b,cloudflare:@cf/google/gemma-4-26b-a4b-it,local:gemma-4-12b"

What this module owes the rest of the worker:

  * IT NEVER RAISES. A target that fails - or answers with something that is not a completion at
    all - returns a Completion with no text and a coarse reason
    (`no_key`, `auth`, `rate_limit`, `billing`, `connection`, `api_<status>`, `refusal`,
    `max_tokens`, `empty`, `unparsable`) - the same vocabulary the Anthropic callers use - and the
    chain moves to the next target. The caller's last resort is always the engine's own figures.
  * IT NEVER LOGS CONTENT. This repository is public and so are its Actions logs: prompts, model
    output and provider error bodies (which can echo the prompt) are never logged - only the
    provider's name, the reason, token counts and seconds.
  * IT COSTS NOTHING, AND SAYS SO. Free tiers bill nothing, so a Completion carries no price; the
    Anthropic price table is not consulted (an unknown model there is priced at the dearest row).
  * A SCHEMA IS A REQUEST, NOT A GUARANTEE. Where the endpoint enforces `response_format`
    (Groq's strict mode, llama-server's grammar) it is sent; either way the caller validates what
    comes back with the same parsers it uses for every other model.
"""
from __future__ import annotations

import json
import math
import os
import re
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Mapping

import requests

from workers.stock_scanner.logger import get_logger

LOGGER = get_logger("stock_scanner.open_model")

CHAIN_ENV = "OPEN_MODEL_CHAIN"
LOCAL_URL_ENV = "LOCAL_MODEL_URL"
DEFAULT_LOCAL_URL = "http://127.0.0.1:8080/v1"
CLOUDFLARE_ACCOUNT_ENV = "CLOUDFLARE_ACCOUNT_ID"
HOSTED_TIMEOUT = 120.0
# A CPU-only runner reads a prompt and writes an answer at a few tokens a second: minutes, not seconds.
LOCAL_TIMEOUT = 1800.0
MAX_RATE_LIMIT_WAIT = 65.0  # a per-minute limit clears within the minute; a longer wait is a day limit

_THINK_BLOCK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)
_THINK_OPEN_RE = re.compile(r"^.*?</think>", re.DOTALL | re.IGNORECASE)
_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)


@dataclass(frozen=True)
class Provider:
    name: str
    base_url: str  # "{account}" is filled from CLOUDFLARE_ACCOUNT_ID
    key_env: str  # "" = no key (the server on this machine)
    token_field: str  # what the endpoint calls the output ceiling
    strict_schema: bool  # the endpoint enforces response_format json_schema
    timeout: float
    display: str


PROVIDERS: dict[str, Provider] = {
    "groq": Provider("groq", "https://api.groq.com/openai/v1", "GROQ_API_KEY", "max_completion_tokens", True, HOSTED_TIMEOUT, "Groq"),
    "cloudflare": Provider(
        "cloudflare", "https://api.cloudflare.com/client/v4/accounts/{account}/ai/v1", "CLOUDFLARE_AI_TOKEN", "max_tokens", False, HOSTED_TIMEOUT, "Cloudflare"
    ),
    "openrouter": Provider("openrouter", "https://openrouter.ai/api/v1", "OPENROUTER_API_KEY", "max_tokens", False, HOSTED_TIMEOUT, "OpenRouter"),
    "local": Provider("local", DEFAULT_LOCAL_URL, "", "max_tokens", True, LOCAL_TIMEOUT, "Lyra's own copy"),
}


@dataclass(frozen=True)
class Target:
    """One model at one provider."""

    provider: Provider
    model: str

    @property
    def spec(self) -> str:
        return f"{self.provider.name}:{self.model}"

    @property
    def label(self) -> str:
        """What a reader sees in a footer: the model's short name and who served it."""
        short = self.model.rsplit("/", 1)[-1]
        return f"{short} ({self.provider.display})"


@dataclass(frozen=True)
class Completion:
    """One attempt. `text` is None unless the model answered; `reason` is public-safe."""

    text: str | None
    target: Target
    reason: str = "ok"
    note: str | None = None
    input_tokens: int = 0
    output_tokens: int = 0
    seconds: float = 0.0
    served_model: str = ""
    timings: dict[str, float] = field(default_factory=dict)  # llama-server's own measurements, when present

    @property
    def ok(self) -> bool:
        return self.text is not None

    @property
    def tokens_per_second(self) -> float | None:
        """Generation speed: the server's own figure when it gives one, else output tokens over the
        whole call (which includes reading the prompt, so it understates a slow machine fairly)."""
        measured = self.timings.get("predicted_per_second")
        if measured:
            return float(measured)
        return self.output_tokens / self.seconds if self.output_tokens and self.seconds > 0 else None


def parse_chain(spec: str | None) -> list[Target]:
    """`provider:model, provider:model` -> targets in order. An entry naming no known provider, or
    no model, is skipped: a typo must degrade to the next target, never crash the run."""
    targets: list[Target] = []
    for entry in (spec or "").split(","):
        name, _, model = entry.strip().partition(":")
        provider = PROVIDERS.get(name.strip().lower())
        if provider is None or not model.strip():
            if entry.strip():
                LOGGER.warning("open model chain: ignoring an entry with an unknown provider or no model")
            continue
        targets.append(Target(provider, model.strip()))
    return targets


def chain_from_env(env: Mapping[str, str] | None = None, *, variable: str = CHAIN_ENV) -> list[Target]:
    return parse_chain((env if env is not None else os.environ).get(variable))


def request_extras(target: Target) -> dict[str, Any]:
    """The fields a reasoning model needs so its thinking neither reaches the reader nor eats the
    answer's budget. Verified against Groq's docs on 2026-11-06; other endpoints get none and rely
    on the think-block strip below."""
    model = target.model.lower()
    if target.provider.name == "groq":
        if "gpt-oss" in model:
            return {"reasoning_effort": "low", "include_reasoning": False}
        if model.startswith("qwen/"):
            return {"reasoning_effort": "low", "reasoning_format": "hidden"}
    if target.provider.name == "cloudflare" and "gpt-oss" in model:
        return {"reasoning_effort": "low"}
    if target.provider.name == "local" and "gpt-oss" in model:
        # llama-server passes these to the model's own chat template: the same effort the hosted copy runs at.
        return {"chat_template_kwargs": {"reasoning_effort": "low"}}
    return {}


def strip_thinking(text: str) -> str:
    """The answer without any reasoning the model printed inline."""
    cleaned = _THINK_BLOCK_RE.sub("", text)
    if "</think>" in cleaned.lower():  # an opening tag the server swallowed, the closing one left behind
        cleaned = _THINK_OPEN_RE.sub("", cleaned)
    return cleaned.strip()


def parse_json_object(text: str | None) -> dict[str, Any] | None:
    """The first JSON object in a model's answer, or None. Tolerates a code fence and stray prose
    around it - the caller still validates the fields."""
    if not text:
        return None
    candidate = _FENCE_RE.sub("", text.strip()).strip()
    start, end = candidate.find("{"), candidate.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        parsed = json.loads(candidate[start : end + 1])
    except ValueError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _endpoint(target: Target, env: Mapping[str, str]) -> str | None:
    base = target.provider.base_url
    if target.provider.name == "local":
        base = env.get(LOCAL_URL_ENV) or base
    if "{account}" in base:
        account = (env.get(CLOUDFLARE_ACCOUNT_ENV) or "").strip()
        if not account:
            return None
        base = base.replace("{account}", account)
    return base.rstrip("/") + "/chat/completions"


def _status_reason(status: int) -> tuple[str, str]:
    if status in (401, 403):
        return "auth", "the model provider rejected the key"
    if status == 402:
        return "billing", "the model provider's free allowance is used up"
    if status == 429:
        return "rate_limit", "the model provider's free allowance is used up for now"
    return f"api_{status}", f"the model provider returned an error ({status})"


def _retry_after(response: Any) -> float | None:
    try:
        return float(response.headers.get("retry-after", ""))
    except (TypeError, ValueError, AttributeError):
        return None


def _rejected_the_answer(response: Any) -> bool:
    """True when a 400 is the endpoint refusing what the MODEL wrote (strict JSON that did not
    validate), not a field in the request. Asking again without the reasoning fields would spend
    the allowance twice for the same failure. The body is read here and never logged."""
    try:
        body = str(getattr(response, "text", "") or "").lower()
    except Exception:  # noqa: BLE001 - a body that cannot be read tells us nothing
        return False
    return any(marker in body for marker in ("json_validate", "failed to generate json", "failed_generation"))


def _count(value: Any) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return 0


def _content_text(content: Any) -> str:
    """A chat message's text: a string, or a list of typed parts whose text parts are joined."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(str(part.get("text") or "") for part in content if isinstance(part, dict) and part.get("type") in (None, "text", "output_text"))
    return ""


def complete(
    target: Target,
    *,
    system: str,
    user: str,
    max_tokens: int = 1500,
    temperature: float = 0.3,
    schema: dict[str, Any] | None = None,
    schema_name: str = "output",
    rate_limit_wait: float = 0.0,
    env: Mapping[str, str] | None = None,
    post: Callable[..., Any] | None = None,
    sleep: Callable[[float], None] = time.sleep,
) -> Completion:
    """One call to one target. Never raises; never logs what was sent or received.

    `rate_limit_wait` is how long a batch job is willing to sit out a per-minute limit (seconds):
    a 429 whose `retry-after` fits inside it is waited for and tried once more.
    `post` is `requests.post` unless a test passes its own."""
    env = env if env is not None else os.environ
    send = post or requests.post
    provider = target.provider
    key = (env.get(provider.key_env) or "").strip() if provider.key_env else ""
    if provider.key_env and not key:
        return Completion(None, target, reason="no_key", note=f"no {provider.display} key is configured")
    url = _endpoint(target, env)
    if url is None:
        return Completion(None, target, reason="no_key", note=f"no {provider.display} account is configured")

    body: dict[str, Any] = {
        "model": target.model,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        provider.token_field: max_tokens,
        "temperature": temperature,
    }
    if schema is not None:
        body["response_format"] = (
            {"type": "json_schema", "json_schema": {"name": schema_name, "strict": True, "schema": schema}} if provider.strict_schema else {"type": "json_object"}
        )
    headers = {"content-type": "application/json"}
    if key:
        headers["authorization"] = f"Bearer {key}"

    extras = request_extras(target)
    waited = False
    while True:
        # Timed per attempt: `seconds` is how long the model took to answer, not how long a
        # refused first attempt or a rate-limit wait added on top.
        started = time.monotonic()
        try:
            response = send(url, headers=headers, json={**body, **extras}, timeout=provider.timeout)
            status = int(getattr(response, "status_code", 0) or 0)
        except Exception as exc:  # noqa: BLE001 - "never raises": a network failure, or a key that cannot be put in a header
            LOGGER.warning("open model %s: could not be reached (%s)", provider.name, type(exc).__name__)
            return Completion(None, target, reason="connection", note=f"{provider.display} could not be reached", seconds=time.monotonic() - started)
        if status == 400 and extras and not _rejected_the_answer(response):
            # An endpoint that does not know a reasoning field refuses the whole request: ask again plainly.
            extras = {}
            continue
        if status == 429 and not waited:
            pause = _retry_after(response)
            if pause is not None and 0 < pause <= min(rate_limit_wait, MAX_RATE_LIMIT_WAIT):
                waited = True
                sleep(pause + 1.0)
                continue
        break

    seconds = time.monotonic() - started
    if status != 200:
        reason, note = _status_reason(status)
        LOGGER.warning("open model %s: %s after %.1fs", provider.name, reason, seconds)
        return Completion(None, target, reason=reason, note=note, seconds=seconds)
    try:
        # Anything a server can send with a 200 is read here; a shape that is not a completion is
        # an unreadable response, never an exception in the caller.
        payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError("not an object")
        choices = payload.get("choices")
        choice = choices[0] if isinstance(choices, list) and choices and isinstance(choices[0], dict) else {}
        message = choice.get("message") if isinstance(choice.get("message"), dict) else {}
        usage = payload.get("usage") if isinstance(payload.get("usage"), dict) else {}
        raw_timings = payload.get("timings") if isinstance(payload.get("timings"), dict) else {}
        timings = {
            str(name): float(value)
            for name, value in raw_timings.items()
            if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)
        }
        base = Completion(
            None,
            target,
            input_tokens=_count(usage.get("prompt_tokens")),
            output_tokens=_count(usage.get("completion_tokens")),
            seconds=seconds,
            served_model=str(payload.get("model") or target.model),
            timings=timings,
        )
        text = strip_thinking(_content_text(message.get("content")))
        finish = str(choice.get("finish_reason") or "")
        refused = bool(message.get("refusal"))
    except Exception:  # noqa: BLE001 - see above
        LOGGER.warning("open model %s: unreadable response after %.1fs", provider.name, seconds)
        return Completion(None, target, reason="unparsable", note=f"{provider.display} sent a response that could not be read", seconds=seconds)

    if finish == "content_filter" or refused:
        outcome = _with(base, reason="refusal", note="the model declined to write this")
    elif not text:
        # A reasoning model that spends its whole budget thinking returns nothing to read.
        outcome = _with(base, reason="max_tokens" if finish == "length" else "empty", note="the model returned nothing to read")
    elif finish == "length":
        outcome = _with(base, reason="max_tokens", note="the model's answer was cut off before it finished")
    else:
        outcome = _with(base, text=text)
    LOGGER.info(
        "open model %s: %s in %.1fs (%d in / %d out tokens)", provider.name, outcome.reason, seconds, outcome.input_tokens, outcome.output_tokens
    )
    return outcome


def _with(base: Completion, **changes: Any) -> Completion:
    return Completion(**{**base.__dict__, **changes})


def complete_chain(
    targets: list[Target],
    *,
    accept: Callable[[Completion], bool] | None = None,
    **call: Any,
) -> tuple[Completion | None, list[tuple[str, str]]]:
    """The first target whose answer is usable, and what was tried on the way (`provider:model`,
    reason) for the ledger. `accept` lets the caller reject an answer that arrived but is no use -
    JSON that does not parse into the shape it needs - so the next target gets its turn.
    Returns (None, []) for an empty chain."""
    tried: list[tuple[str, str]] = []
    last: Completion | None = None
    for target in targets:
        outcome = complete(target, **call)
        if outcome.ok and accept is not None and not accept(outcome):
            outcome = _with(outcome, text=None, reason="unparsable", note="the model's answer was not in the shape Lyra asked for")
        tried.append((target.spec, outcome.reason))
        last = outcome
        if outcome.ok:
            break
    return last, tried
