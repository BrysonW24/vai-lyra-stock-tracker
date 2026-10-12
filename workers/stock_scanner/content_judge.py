"""The nightly review of what Lyra sent: six pillars, scored the same way every night.

Every message the workers send is on the record (generation_record.py: one ai_runs row with the
text, its input and the prompt version). This job reads the last few days of those rows that have
no review yet - the daily read, the AI briefing, the morning guide - and asks Claude to score each
against a fixed, anchored rubric:

    correctness  relevance  breadth  insight  clarity  freshness      (0 to 5 each)

with a short reason per pillar that quotes the content, a flag if any sentence gives advice, and
one sentence on the most useful change for next time. The 2026-10-13 review scored the first
generations this way by hand; this keeps doing it, so when a reader leaves or complains there is a
radar for the message they got and the prompt version that wrote it.

What the judge sees: the content as the reader saw it (HTML stripped), who the reader is and what
they asked for, deterministic measures (words, figures per hundred words, items, themes and desks
covered, holdings named) and the correctness evidence Lyra already has - the read's fact sheet, the
briefing guard's removals. It cannot open the briefing's sources, and the rubric tells it so.

Each review is itself an ai_runs row (agent_name content_judge) with its own tokens and cost,
linked by input_payload.generation_id. Every review row is the operator's (user_id): its input
carries the operator's holdings, and ai_runs rows with no owner are readable by every signed-in
account (migration 019).

This is Claude scoring Claude. The readers' own ratings - the 👍 / 👎 buttons and the reasons under
every message (content_feedback, migration 060) - outrank it, and RUBRIC_VERSION is stored with
every score so a change in the rubric is never read as a change in the content.

Budget: JUDGE_MONTHLY_BUDGET_USD (default US$5), paced from this job's own ledger rows. Low effort,
one call per generation, at most JUDGE_MAX_PER_RUN a night; a billing or key failure ends the night
and the next night picks up what is left (anything inside JUDGE_LOOKBACK_DAYS, four days so a missed
Saturday is still reviewed on Tuesday). A review that fails for any reason other than an empty
credit balance or a spent budget turns the run red, so the failure pager says so.

Run: python -m workers.stock_scanner.content_judge   (scheduled by .github/workflows/content-review.yml)
Logs carry counts and cost only - never content - because the Actions logs are public.
"""

from __future__ import annotations

import html
import json
import os
import re
import sys
from dataclasses import dataclass, field, replace
from datetime import datetime, timedelta, timezone
from typing import Any

from workers.stock_scanner.config import load_settings
from workers.stock_scanner.daily_read import (
    _env_float,
    _parse_time,
    _record as record_run,
    api_failure,
    billable_tokens,
    cost_usd,
    month_spend,
)
from workers.stock_scanner.generation_record import Generation, prompt_version, record_generation
from workers.stock_scanner.logger import get_logger
from workers.stock_scanner.supabase_repo import SupabaseRepository

LOGGER = get_logger("stock_scanner.content_judge")

JOB_NAME = "content_judge"
REVIEWED_AGENTS = ("daily_read", "ai_briefing", "morning_guide")
REVIEWED_STATUSES = ("ok", "fallback")  # a one-line "nothing tonight" note is recorded, never reviewed
PILLARS = ("correctness", "relevance", "breadth", "insight", "clarity", "freshness")
RUBRIC_VERSION = "2026-10-13"
DEFAULT_MODEL = "claude-opus-5-5"
DEFAULT_EFFORT = "low"
DEFAULT_MONTHLY_BUDGET_USD = 5.0
DEFAULT_LOOKBACK_DAYS = 4  # Saturday's sends must still be inside the window on Tuesday night
DEFAULT_MAX_PER_RUN = 12
MAX_OUTPUT_TOKENS = 8_000  # thinking is billed as output and cannot be turned off on this model
MAX_CONTENT_CHARS = 16_000
MAX_REASON_CHARS = 240
STOP_REASONS = ("billing", "auth", "no_library", "no_key")  # nothing later tonight could succeed either

RUBRIC = """Score each pillar 0 to 5 against these anchors. Score strictly; never reward length.

correctness - every fact and figure traces to its source.
  5 every checkable claim is supported by the evidence given; 3 some claims cannot be checked against the evidence; 1 a claim contradicts the evidence; 0 an error a reader would act on.
relevance - the thread from the content to what this reader holds and asked for.
  5 most items say why they matter to this reader; 3 relevant topics, the thread left implicit; 1 generic market news.
breadth - covers the themes and desks this reader asked for.
  5 every asked-for area is covered or explicitly reported quiet; 3 several missing without a word; 1 one narrow topic.
insight - explains drivers and the so-what.
  5 says what the headline hides and why it matters; 3 some explanation, mostly description; 1 a list; 0 numbers with no meaning attached.
clarity - readable on a phone in under a minute.
  5 plain words, short bites, every number explained; 3 readable but dense in places; 1 a wall of figures or unexplained scores.
freshness - new to the reader when it lands.
  5 same-day news or the latest session; 3 a day or two old, and labelled so; 1 stale or repeated."""

SYSTEM_PROMPT = f"""You review content that Lyra, a research app for Australian private investors, sent to its readers. You did not write it and you are not anyone's adviser. Score it against the rubric using only the content and the evidence you are given.

{RUBRIC}

In each reason, quote a few words of the content that justify the score, so a person can check it; keep each reason to one sentence. advice_detected is true when any sentence tells the reader to buy, sell, hold, add, trim or otherwise act with money, or predicts a price; put that sentence in advice_quote, otherwise leave advice_quote empty. summary is one sentence: the single most useful change for the next one. Use a plain hyphen, never an em dash."""

SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "scores": {
            "type": "object",
            "properties": {pillar: {"type": "integer", "description": "0 to 5"} for pillar in PILLARS},
            "required": list(PILLARS),
            "additionalProperties": False,
        },
        "reasons": {
            "type": "object",
            "properties": {pillar: {"type": "string"} for pillar in PILLARS},
            "required": list(PILLARS),
            "additionalProperties": False,
        },
        "advice_detected": {"type": "boolean"},
        "advice_quote": {"type": "string"},
        "summary": {"type": "string"},
    },
    "required": ["scores", "reasons", "advice_detected", "advice_quote", "summary"],
    "additionalProperties": False,
}

PROMPT_VERSION = prompt_version(JOB_NAME, SYSTEM_PROMPT, SCHEMA)

READERS = {
    "daily_read": (
        "The operator: an Australian private investor who built Lyra, reading at about 8pm Sydney after the US session closed that morning. "
        "He asked for: the session's groups and themes with the names that drove them, a thread from the market to his own holdings, setups explained in words "
        "rather than score changes, and no lists of worst performers that are not his."
    ),
    "ai_briefing": (
        "Every Lyra account and the readers who subscribed by link: Australian private investors following AI and technology shares. "
        "They asked for: the app's ten themes (AI labs and infrastructure, semiconductors, power grid, nuclear and uranium, critical minerals, robotics, "
        "quantum computing, space, defence and drones, cybersecurity) with which companies they are, the four standing desks every night (IPOs and filings, "
        "venture, government money, small caps) even if a desk is one line, the biggest headline first, and short bites with a source each."
    ),
    "morning_guide": (
        "The operator, at about 8:30am Sydney, after the US close and before the ASX opens. He asked for a trader's daily guide: his priorities "
        "for the day from his own book, what is on in the market today, loose ends, and closing quotes for his holdings with whether each is final."
    ),
}

_TAG_RE = re.compile(r"<[^>]+>")
_WORD_RE = re.compile(r"[A-Za-z][A-Za-z'\-]*")
_FIGURE_RE = re.compile(r"(?<![\w.])\d[\d,]*(?:\.\d+)?%?")
_TICKER_RE = re.compile(r"\b[A-Z]{1,5}\b")


@dataclass(frozen=True)
class Reviewable:
    """An ai_runs row to review (what load_generations returns)."""

    id: str
    agent_name: str
    status: str
    user_id: str | None
    prompt_version: str
    created_at: str
    input_payload: dict[str, Any]
    output_payload: dict[str, Any]


@dataclass(frozen=True)
class Verdict:
    scores: dict[str, int] | None
    reasons: dict[str, str] = field(default_factory=dict)
    advice_detected: bool = False
    advice_quote: str = ""
    summary: str = ""
    model: str = DEFAULT_MODEL
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    reason: str = "ok"

    @property
    def mean(self) -> float:
        return round(sum(self.scores.values()) / len(self.scores), 2) if self.scores else 0.0


def plain_text(markup: str) -> str:
    """Telegram HTML to what a reader sees: tags out, entities decoded, whitespace kept."""
    return html.unescape(_TAG_RE.sub("", markup or "")).strip()


def measures(generation: Reviewable, holdings: list[str]) -> dict[str, Any]:
    """Deterministic evidence for the judge (and for anyone reading the review later)."""
    output = generation.output_payload
    text = plain_text(str(output.get("text") or ""))
    words = len(_WORD_RE.findall(text))
    figures = len(_FIGURE_RE.findall(text))
    named = sorted({symbol for symbol in _TICKER_RE.findall(text) if symbol in set(holdings)})
    result: dict[str, Any] = {
        "words": words,
        "figures": figures,
        "figures_per_100_words": round(100 * figures / words, 1) if words else 0.0,
        "parts": output.get("parts"),
        "holdings_named": named,
    }
    if generation.agent_name == "ai_briefing":
        items = [item for item in (output.get("items") or []) if isinstance(item, dict)]
        notes = output.get("desk_notes") if isinstance(output.get("desk_notes"), dict) else {}
        result.update(
            items=len(items),
            themes=sorted({str(item.get("theme") or "other") for item in items}),
            desks_with_items=sorted({str(item.get("desk")) for item in items if item.get("desk") not in (None, "", "news")}),
            desk_notes=sorted(desk for desk, note in notes.items() if note),
            listed=sum(1 for item in items if item.get("listed")),
            removed_by_guard=output.get("removed", 0),
        )
    elif generation.agent_name == "daily_read":
        result.update(ai=bool(output.get("ai")), guard_removed=output.get("guard_removed", 0), session=output.get("session"))
    return result


def evidence(generation: Reviewable) -> str:
    """What Lyra already knows about the content's correctness, in words the rubric can use."""
    output, inputs = generation.output_payload, generation.input_payload
    if generation.agent_name == "daily_read":
        if generation.status == "fallback":
            return "There is no AI prose in this read: the message is the engine's own figures, correct by construction. Judge the other pillars on the figures-only layout the reader received."
        facts = str(inputs.get("input") or "")
        return (
            f"Every figure in the prose was matched against the engine's fact sheet below by Lyra's guard before sending; the guard removed {output.get('guard_removed', 0)} sentence(s). "
            "Judge claims that are not figures - causes, characterisations, comparisons - against the fact sheet.\n<facts>\n" + facts + "\n</facts>"
        )
    if generation.agent_name == "ai_briefing":
        removed = [entry for entry in (inputs.get("removed_items") or []) if isinstance(entry, dict)]
        reasons = sorted({str(reason).split(":")[0] for entry in removed for reason in (entry.get("reasons") or [])})
        return (
            "Every figure in each item was matched by Lyra's guard against the text of a source page the research opened, and every source was one the research "
            f"actually searched or opened. The guard removed {len(removed)} item(s)" + (f" ({', '.join(reasons)})" if reasons else "") + ". "
            "You cannot open the sources: judge correctness on attribution and hedging - a vendor's claim labelled as a claim, nothing stated more firmly than a source could support."
        )
    return "Engine output: quotes from Yahoo Finance, signals from Lyra's scanner, events from Lyra's calendar. Judge whether each statement follows from the figures shown."


def build_prompt(generation: Reviewable, holdings: list[str], watchlist: list[str]) -> tuple[str, dict[str, Any]]:
    facts = measures(generation, holdings)
    reader = READERS.get(generation.agent_name, "A Lyra reader.")
    book = f" The operator holds {', '.join(holdings)}" + (f" and watches {', '.join(watchlist)}." if watchlist else ".") if holdings else ""
    sent = str(generation.created_at or "")[:16].replace("T", " ")
    content = plain_text(str(generation.output_payload.get("text") or ""))[:MAX_CONTENT_CHARS]
    prompt = (
        f"<reader>{reader}{book}</reader>\n"
        f"<measures>{json.dumps(facts, sort_keys=True)}</measures>\n"
        f"<evidence>{evidence(generation)}</evidence>\n"
        f'<content kind="{generation.agent_name}" sent_utc="{sent}">\n{content}\n</content>\n\n'
        "Score this content."
    )
    return prompt, facts


def parse_verdict(raw: str) -> tuple[dict[str, int], dict[str, str], bool, str, str] | None:
    """The judge's JSON, validated: every pillar an integer 0-5 with a reason. None when it is not."""
    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    scores_raw, reasons_raw = data.get("scores"), data.get("reasons")
    if not isinstance(scores_raw, dict) or not isinstance(reasons_raw, dict):
        return None
    scores: dict[str, int] = {}
    reasons: dict[str, str] = {}
    for pillar in PILLARS:
        value = scores_raw.get(pillar)
        if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= 5:
            return None
        scores[pillar] = value
        reasons[pillar] = " ".join(str(reasons_raw.get(pillar) or "").split())[:MAX_REASON_CHARS]
    quote = " ".join(str(data.get("advice_quote") or "").split())[:MAX_REASON_CHARS]
    summary = " ".join(str(data.get("summary") or "").split())[:MAX_REASON_CHARS]
    return scores, reasons, bool(data.get("advice_detected")), quote, summary


def judge(prompt: str, *, model: str, effort: str) -> Verdict:
    """One review. Any failure returns a Verdict with no scores and the reason - never raises."""
    try:
        import anthropic
    except ImportError:
        return Verdict(None, model=model, reason="no_library")

    request: dict[str, Any] = {
        "model": model,
        "max_tokens": MAX_OUTPUT_TOKENS,
        "output_config": {"effort": effort, "format": {"type": "json_schema", "schema": SCHEMA}},
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": prompt}],
    }
    try:
        client = anthropic.Anthropic(timeout=120.0, max_retries=1)
        try:
            # A declined request is re-run on Anthropic's recommended substitute inside the same call.
            response = client.beta.messages.create(betas=["server-side-fallback-2026-07-01"], fallbacks="default", **request)
        except anthropic.BadRequestError as exc:
            if "credit balance" in str(exc).lower():
                raise
            LOGGER.warning("fallback-enabled review was rejected - retrying without the fallback option")
            response = client.messages.create(**request)
    except anthropic.AuthenticationError:
        return Verdict(None, model=model, reason="auth")
    except anthropic.RateLimitError:
        return Verdict(None, model=model, reason="rate_limit")
    except anthropic.APIStatusError as exc:
        reason, _note = api_failure(exc)
        LOGGER.warning("Anthropic API error %s: %s", getattr(exc, "status_code", "?"), str(exc)[:200])
        return Verdict(None, model=model, reason=reason)
    except anthropic.APIConnectionError:
        return Verdict(None, model=model, reason="connection")

    served = str(getattr(response, "model", None) or model)
    input_tokens, output_tokens = billable_tokens(response.usage)
    spent = max(cost_usd(model, input_tokens, output_tokens), cost_usd(served, input_tokens, output_tokens))
    base = Verdict(None, model=served, input_tokens=input_tokens, output_tokens=output_tokens, cost_usd=spent)
    if response.stop_reason in ("refusal", "max_tokens"):
        return replace(base, reason=str(response.stop_reason))
    text = next((block.text for block in response.content if getattr(block, "type", "") == "text"), "")
    parsed = parse_verdict(text)
    if parsed is None:
        return replace(base, reason="unparsable")
    scores, reasons, advice, quote, summary = parsed
    return replace(base, scores=scores, reasons=reasons, advice_detected=advice, advice_quote=quote, summary=summary)


# --------------------------------------------------------------------------------------------
# Reads and the ledger.

_GENERATION_COLUMNS = "id,agent_name,status,user_id,prompt_version,created_at,input_payload,output_payload"


def load_generations(client: Any, since: datetime) -> list[Reviewable]:
    result = (
        client.table("ai_runs")
        .select(_GENERATION_COLUMNS)
        .in_("agent_name", list(REVIEWED_AGENTS))
        .gte("created_at", since.isoformat())
        .order("created_at", desc=False)
        .limit(200)
        .execute()
    )
    rows = []
    for row in result.data or []:
        inputs, outputs = row.get("input_payload"), row.get("output_payload")
        rows.append(
            Reviewable(
                id=str(row.get("id")),
                agent_name=str(row.get("agent_name")),
                status=str(row.get("status") or ""),
                user_id=row.get("user_id"),
                prompt_version=str(row.get("prompt_version") or ""),
                created_at=str(row.get("created_at") or ""),
                input_payload=inputs if isinstance(inputs, dict) else {},
                output_payload=outputs if isinstance(outputs, dict) else {},
            )
        )
    return rows


def reviewed_ids(client: Any, since: datetime, owner: str | None) -> set[str]:
    """Generations this job has already reviewed. Only reviews owned like this job's own count: a
    signed-in account can insert ai_runs rows under its own id (migration 019), and a forged
    "review" must not be able to suppress a real one."""
    result = client.table("ai_runs").select("user_id,input_payload").eq("agent_name", JOB_NAME).gte("created_at", since.isoformat()).limit(1000).execute()
    ids = set()
    for row in result.data or []:
        payload = row.get("input_payload")
        if row.get("user_id") == owner and isinstance(payload, dict) and payload.get("generation_id"):
            ids.add(str(payload["generation_id"]))
    return ids


def lyras_own(generation: Reviewable, owner: str | None) -> bool:
    """A row the workers wrote: no owner (only the service role can write one - the briefing) or
    the operator's (the read, the guide). Any other owner is a signed-in account's own insert,
    which RLS allows and this job must never review or quote."""
    return generation.user_id is None or (owner is not None and generation.user_id == owner)


def load_judge_runs(client: Any, since: datetime) -> list[dict[str, Any]]:
    result = client.table("stock_scanner_runs").select("job_name,status,started_at,payload").eq("job_name", JOB_NAME).gte("started_at", since.isoformat()).limit(200).execute()
    return list(result.data or [])


def load_book(client: Any, user_id: str) -> tuple[list[str], list[str]]:
    """The operator's holdings and watchlist symbols - the reader the relevance pillar measures against."""
    holdings = client.table("portfolio_positions").select("symbol").eq("user_id", user_id).eq("is_active", True).execute()
    watch = client.table("watchlist_items").select("symbol").eq("user_id", user_id).eq("is_active", True).execute()
    return (
        sorted({str(row.get("symbol") or "").upper() for row in holdings.data or [] if row.get("symbol")}),
        sorted({str(row.get("symbol") or "").upper() for row in watch.data or [] if row.get("symbol")}),
    )


def run(now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    settings = load_settings()
    if os.getenv("ENABLE_CONTENT_JUDGE", "true").strip().lower() not in ("1", "true", "yes"):
        LOGGER.info("The content review is off (ENABLE_CONTENT_JUDGE is not true).")
        return 0
    repository = SupabaseRepository(settings)
    if not repository.client:
        LOGGER.info("Supabase is not configured - nothing to review.")
        return 0
    client = repository.client
    if not os.getenv("ANTHROPIC_API_KEY"):
        LOGGER.info("No ANTHROPIC_API_KEY - no review tonight.")
        return 0

    model = os.getenv("JUDGE_MODEL", "").strip() or DEFAULT_MODEL
    effort = os.getenv("JUDGE_EFFORT", "").strip().lower() or DEFAULT_EFFORT
    budget = _env_float("JUDGE_MONTHLY_BUDGET_USD", DEFAULT_MONTHLY_BUDGET_USD)
    lookback = max(1, int(_env_float("JUDGE_LOOKBACK_DAYS", DEFAULT_LOOKBACK_DAYS)))
    max_per_run = max(1, int(_env_float("JUDGE_MAX_PER_RUN", DEFAULT_MAX_PER_RUN)))
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    spent_before = month_spend([row for row in load_judge_runs(client, month_start) if (_parse_time(row.get("started_at")) or now) >= month_start])
    if spent_before >= budget:
        LOGGER.info("This month's $%.0f review budget is used up ($%.2f) - no review tonight.", budget, spent_before)
        return 0

    # Every review is the operator's: its input can carry the operator's book. With no operator
    # configured, only the ownerless briefing is reviewed, and without the book.
    owner = settings.default_user_id or None
    since = now - timedelta(days=lookback)
    done_already = reviewed_ids(client, since - timedelta(days=1), owner)
    candidates = [g for g in load_generations(client, since) if g.status in REVIEWED_STATUSES and g.id not in done_already and lyras_own(g, owner)]
    todo = candidates[:max_per_run]
    if not todo:
        LOGGER.info("Nothing new to review.")
        return 0

    holdings: list[str] = []
    watchlist: list[str] = []
    if owner:
        try:
            holdings, watchlist = load_book(client, owner)
        except Exception as exc:  # noqa: BLE001 - the book sharpens relevance; a review without it still runs
            LOGGER.warning("could not read the operator's book: %s", type(exc).__name__)

    run_id = repository.create_run(JOB_NAME, settings.default_timeframe)
    spent = 0.0
    reviewed = failed = 0
    reason = "ok"
    by_agent: dict[str, int] = {}
    for generation in todo:
        if spent_before + spent >= budget:
            reason = "budget"
            break
        # Without an operator to own the review, the reader's book stays out of a row others could read.
        prompt, facts = build_prompt(generation, holdings if owner else [], watchlist if owner else [])
        verdict = judge(prompt, model=model, effort=effort)
        spent += verdict.cost_usd
        if verdict.scores is None:
            failed += 1
            record_run(client, run_id, "running", {"reviewed": reviewed, "failed": failed, "cost_usd": round(spent, 6), "model": model, "effort": effort, "ai": reviewed > 0}, delivered=False)
            if verdict.reason in STOP_REASONS:
                reason = verdict.reason
                break
            continue
        review = Generation(
            agent_name=JOB_NAME,
            prompt_version=PROMPT_VERSION,
            input_text=prompt,
            text_parts=[verdict.summary],
            user_id=owner,
            model=verdict.model,
            effort=effort,
            input_tokens=verdict.input_tokens,
            output_tokens=verdict.output_tokens,
            cost_usd=verdict.cost_usd,
            input_payload={
                "generation_id": generation.id,
                "generation_agent": generation.agent_name,
                "generation_prompt_version": generation.prompt_version,
                "generation_mode": generation.output_payload.get("mode"),
                "rubric_version": RUBRIC_VERSION,
                "measures": facts,
            },
            extra={
                "generation_id": generation.id,
                "rubric_version": RUBRIC_VERSION,
                "scores": verdict.scores,
                "reasons": verdict.reasons,
                "mean": verdict.mean,
                "advice_detected": verdict.advice_detected,
                "advice_quote": verdict.advice_quote,
            },
            confidence=round(verdict.mean / 5, 3),
        )
        if record_generation(client, review):
            reviewed += 1
            by_agent[generation.agent_name] = by_agent.get(generation.agent_name, 0) + 1
        else:
            failed += 1
        # The spend is on the ledger as it is incurred, so a run killed half way still counts
        # against the month's budget (the pacing reads these rows).
        record_run(client, run_id, "running", {"reviewed": reviewed, "failed": failed, "cost_usd": round(spent, 6), "model": model, "effort": effort, "ai": reviewed > 0}, delivered=False)

    record_run(
        client,
        run_id,
        "success" if reason in ("ok", "budget") and failed == 0 else "failed",
        {
            "reviewed": reviewed,
            "failed": failed,
            "left": len(candidates) - reviewed,  # still without a review after tonight: the next night picks these up
            "by_agent": by_agent,
            "reason": reason,
            "model": model,
            "effort": effort,
            "rubric_version": RUBRIC_VERSION,
            "cost_usd": round(spent, 6),
            "ai": reviewed > 0,
        },
        delivered=False,
        error=None if failed == 0 else f"{failed} review(s) failed ({reason})",
    )
    LOGGER.info(
        "content review: reviewed=%d failed=%d left=%d reason=%s model=%s effort=%s cost=$%.4f month=$%.2f of $%.0f",
        reviewed, failed, len(candidates) - reviewed, reason, model, effort, spent, spent_before + spent, budget,
    )
    # An empty credit balance or a spent budget is a known, quiet state (the morning guide's loose
    # ends say so); anything else that stopped a review should page.
    return 1 if failed and reason not in ("billing", "budget") else 0


def main() -> None:
    sys.exit(run())


if __name__ == "__main__":
    main()
