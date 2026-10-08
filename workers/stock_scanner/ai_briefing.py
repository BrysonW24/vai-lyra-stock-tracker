"""The AI briefing - a once-a-day, source-checked sweep of what moved in AI for investors.

Four sweeps (AI releases, AI-related investment events, infrastructure, emerging companies),
researched by Claude with web search and web fetch, then checked by Lyra (briefing_guard.py)
before anyone sees it: every source must be one the research actually returned or opened, every
figure must appear in the item's own source, no advice, listed names carry a ticker and private
ones do not, nothing repeated from recent briefings. What passes goes to the operator's Telegram as
one HTML message (split at item boundaries when long) and to every user through the notification
router as an `ai_briefing` event (push / chat where connected; the /briefing page in the app
reads the same ledger row, so a user with no channel still sees it).

One briefing per reader-local day, at or after BRIEFING_SEND_AT (20:00 Sydney by default), paced
against BRIEFING_MONTHLY_BUDGET_USD from the run ledger exactly like the daily read. The research
is the expensive part, so it is stored on the ledger row before the sends: a send that fails is
retried from the stored items on the next firing without paying for the research again.

Run: python -m workers.stock_scanner.ai_briefing   (scheduled by .github/workflows/ai-briefing.yml)
Logs carry counts, tokens and cost only - never an item, a URL or a user - because the repository
and its Actions logs are public.
"""

from __future__ import annotations

import html
import os
import sys
import time
from dataclasses import dataclass, field, replace
from datetime import date, datetime, time as clock_time, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from workers.stock_scanner.briefing_guard import (
    MAX_ITEMS,
    BriefingItem,
    GuardOutcome,
    canonical_url,
    guard_briefing,
    parse_items,
)
from workers.stock_scanner.config import load_settings
from workers.stock_scanner.daily_read import (
    DEFAULT_QUIET_HOURS,
    DEFAULT_TIMEZONE,
    EFFORT_LEVELS,
    MODEL_NAMES,
    NEW_YORK,
    PRICES_PER_MTOK,
    PRICING_AS_OF,
    SESSION_CLOSE,
    _env_float,
    _number,
    _parse_time,
    _record as record_run,
    api_failure,
    choose_effort,
    due,
    fmt_day,
    month_spend,
    parse_clock,
    quiet_now,
)
from workers.stock_scanner.logger import get_logger
from workers.stock_scanner.notification_dispatch import dispatch_notification
from workers.stock_scanner.supabase_repo import SupabaseRepository
from workers.stock_scanner.telegram import send_telegram_message

LOGGER = get_logger("stock_scanner.ai_briefing")

JOB_NAME = "ai_briefing"
NOTIFICATION_TYPE = "ai_briefing"
DEFAULT_MODEL = "claude-opus-5-5"
DEFAULT_EFFORT = "high"
DEFAULT_MONTHLY_BUDGET_USD = 40.0
DEFAULT_SEND_AT = "20:00"
DEFAULT_MAX_SEARCHES = 20
DEFAULT_MAX_FETCHES = 12
FETCH_CONTENT_TOKENS = 6_000  # per opened page: an announcement fits; an index page is cut, and is re-read on every iteration
MAX_CONTINUATIONS = 6  # pause_turn resumes and one "publish now" nudge
MAX_OUTPUT_TOKENS = 32_000  # thinking is billed as output and this is a long turn
RESEARCH_ATTEMPTS = 2  # a research turn that dies mid-stream (overload, a dropped connection) is tried once more
RETRY_PAUSE_SECONDS = 30
SEARCH_PRICE_USD = 0.01  # US$10 per 1,000 searches (list, read 2026-10-07); fetches cost tokens only
COVERED_DAYS = 7
TELEGRAM_LIMIT = 3_800  # Telegram's hard limit is 4,096; split at item boundaries well before it
ROUTER_BODY_LIMIT = 1_500

CATEGORY_STYLE = {
    "investment": ("💰", "investment"),
    "infrastructure": ("⚡", "infrastructure"),
    "ai_release": ("🧠", "AI release"),
    "emerging": ("🌱", "emerging"),
    "developer": ("🛠️", "developer"),
}

SYSTEM_PROMPT = """You research and write Lyra's AI briefing: one evening message for Australian private investors who follow AI and technology shares. Lyra is a research tool, not an adviser - the briefing informs, it never recommends.

Sweep four areas, changing your queries to what is new rather than running a fixed list of names:
1. AI releases - the major labs' announcements, model releases, APIs, developer tools and research.
2. Investment events - AI-related IPO filings and new listings, funding rounds, acquisitions, earnings and major contracts.
3. Infrastructure - chips, memory, networking, data centres, electricity and cooling, where listed companies offer exposure beyond the labs themselves.
4. Emerging companies - businesses getting significant backing or customer traction, keeping private companies clearly apart from listed shares.

You have a fixed number of searches and page opens (stated in the brief). Plan them: three or four searches per sweep, each phrased for a specific announcement of the last two days (the kind of wording a press release, an 8-K, an S-1 or a lab's own post uses, with the date), then one search by company name and announcement title to find the original of each candidate worth an item.

For each candidate, open the original with web_fetch: the press release itself, the investor-relations announcement, the exchange filing (SEC, ASX or another exchange), or the lab's own post for that announcement. Open ONLY that specific page. Never open a newsroom index, a homepage, a live blog, a newsletter, a daily roundup or a market wrap - they are not sources, they are long, and each one wastes a page open that a real original needed. A news article alone is not a source either. From the original establish what actually happened, whether a reader can invest in it on a public market, the pricing or valuation if it was disclosed, the next catalyst, the material risks, and what was NOT disclosed.

Rules:
- Facts only, and only from pages you opened. Quote every figure exactly as the source gives it - the same number, unit and currency - and convert nothing; if the source gives no figure, say so rather than estimate.
- Name a listed company as "Company (Exchange: TICKER)". Never attach a ticker to a private company; say it is private and not a listed investment. Do not write "(private)" or "(catch-up)" in the headline - set the listed and catch_up fields and Lyra labels the item.
- Never recommend, rate or suggest buying, selling, holding or avoiding anything. Describe; do not advise.
- Do not repeat anything in the already-covered list unless there is a genuinely new development since.
- Aim for five to eight items across the four sweeps, and publish every item whose original you opened and checked - never drop a verified item. Lead with what matters most to an investor.
- Write for a phone: one or two plain sentences per field, no markdown, no emoji, no filler.

Finish by calling publish_briefing once, with every item that passed, each citing the URL of the original you opened exactly as it appeared in your search or fetch results."""

NUDGE = "You stopped without publishing. Call publish_briefing now with every item you verified against its original source - or with an empty items list and an ipo_note saying nothing passed."

PUBLISH_TOOL: dict[str, Any] = {
    "name": "publish_briefing",
    "description": "Publish the finished briefing. Call it exactly once, at the end, with every item you verified against the original source you opened.",
    "input_schema": {
        "type": "object",
        "properties": {
            "items": {
                "type": "array",
                "maxItems": MAX_ITEMS,
                "description": "Most important first.",
                "items": {
                    "type": "object",
                    "properties": {
                        "headline": {"type": "string", "description": "The company or subject; for a listed company include the exchange and ticker, e.g. 'Constellation (Nasdaq: CEG)'."},
                        "category": {"type": "string", "enum": ["investment", "infrastructure", "ai_release", "emerging", "developer"]},
                        "listed": {"type": "boolean", "description": "True only when the subject itself is a listed company a reader can buy shares in."},
                        "exchange": {"type": "string", "description": "Exchange of the listed company, e.g. Nasdaq, NYSE, ASX. Empty for a private company."},
                        "ticker": {"type": "string", "description": "Ticker of the listed company. Empty for a private company."},
                        "what_happened": {"type": "string", "description": "What was announced, with the figures exactly as the source gives them."},
                        "why_it_matters": {"type": "string", "description": "The investment angle, described, not advised."},
                        "risks": {"type": "string", "description": "The material risks and what to watch."},
                        "not_disclosed": {"type": "string", "description": "What the source did not say (pricing, terms, earnings impact). Empty if everything material was disclosed."},
                        "sources": {
                            "type": "array",
                            "minItems": 1,
                            "maxItems": 4,
                            "items": {
                                "type": "object",
                                "properties": {
                                    "label": {"type": "string", "description": "Short link text, e.g. 'Constellation release', 'SEC 8-K', 'Results'."},
                                    "url": {"type": "string", "description": "The URL exactly as it appeared in your search or fetch results."},
                                },
                                "required": ["label", "url"],
                            },
                        },
                        "lyra_symbols": {"type": "array", "items": {"type": "string"}, "description": "Symbols from Lyra's scanned universe that this item directly concerns. Empty when none."},
                        "catch_up": {"type": "boolean", "description": "True when the development is older than the window but newly found."},
                    },
                    "required": ["headline", "category", "listed", "what_happened", "why_it_matters", "risks", "sources"],
                },
            },
            "ipo_note": {"type": "string", "description": "One sentence on IPO filings and listings checked this evening, e.g. 'No additional primary-confirmed IPO made the cut this evening.'"},
            "searched": {"type": "string", "description": "One sentence on what you searched, for the audit trail."},
        },
        "required": ["items", "ipo_note"],
    },
}


# --------------------------------------------------------------------------------------------
# The brief the model researches from.


def last_us_business_day(now: datetime) -> date:
    """The most recent US business day whose close has passed."""
    local = now.astimezone(NEW_YORK)
    day = local.date()
    if local.time() < SESSION_CLOSE:
        day -= timedelta(days=1)
    while day.weekday() >= 5:
        day -= timedelta(days=1)
    return day


def previous_business_day(day: date) -> date:
    day -= timedelta(days=1)
    while day.weekday() >= 5:
        day -= timedelta(days=1)
    return day


def research_brief(
    now: datetime, reader_zone: ZoneInfo, covered: list[str], universe: list[str], *, max_searches: int = DEFAULT_MAX_SEARCHES, max_fetches: int = DEFAULT_MAX_FETCHES
) -> str:
    local_now = now.astimezone(reader_zone)
    business_day = last_us_business_day(now)
    window_start = previous_business_day(business_day)
    lines = [
        f"Today is {local_now.strftime('%A %d %B %Y')} in Sydney ({local_now.strftime('%H:%M')} local).",
        f"Cover announcements made after the US close on {window_start.strftime('%A %d %B %Y')} through to now. "
        f"The core of tonight's briefing is {business_day.strftime('%A %d %B %Y')} - the US business day that has just finished - "
        f"plus anything that landed overnight since.",
        f"Budget: {max_searches} searches and {max_fetches} page opens. Spend the opens only on the originals of items you will publish.",
    ]
    if covered:
        lines.append("")
        lines.append(f"Already covered in the last {COVERED_DAYS} days - do not repeat these unless something new has happened since:")
        lines.extend(f"- {entry}" for entry in covered)
    if universe:
        lines.append("")
        lines.append("Lyra's scanned universe (tag an item's lyra_symbols only from this list): " + ", ".join(universe))
    lines.append("")
    lines.append("Run the four sweeps now, open the originals, and publish.")
    return "\n".join(lines)


# --------------------------------------------------------------------------------------------
# The research call: one server-side tool loop, resumed across pause_turn, ending in publish.


@dataclass(frozen=True)
class Research:
    items: list[BriefingItem]
    ipo_note: str = ""
    searched: str = ""
    seen: set[str] = field(default_factory=set)
    fetched: dict[str, str] = field(default_factory=dict)
    model: str = DEFAULT_MODEL
    effort: str = DEFAULT_EFFORT
    searches: int = 0
    fetches: int = 0
    input_tokens: int = 0  # everything read, cache reads included
    cache_read_tokens: int = 0  # the part of input_tokens served from the prompt cache
    output_tokens: int = 0
    cost_usd: float = 0.0
    continuations: int = 0
    reason: str = "ok"
    note: str | None = None

    @property
    def ok(self) -> bool:
        return self.reason == "ok"


def _harvest(content: list[Any], seen: set[str], fetched: dict[str, str]) -> dict[str, Any] | None:
    """Collect what the research returned (search result URLs, fetched page texts) and the publish
    call, from one response's content blocks."""
    publish: dict[str, Any] | None = None
    for block in content:
        kind = getattr(block, "type", None)
        if kind == "web_search_tool_result":
            results = getattr(block, "content", None)
            for result in results if isinstance(results, list) else []:
                if getattr(result, "type", None) == "web_search_result":
                    url = canonical_url(str(getattr(result, "url", "") or ""))
                    if url:
                        seen.add(url)
        elif kind == "web_fetch_tool_result":
            result = getattr(block, "content", None)
            if getattr(result, "type", None) == "web_fetch_result":
                url = canonical_url(str(getattr(result, "url", "") or ""))
                if url:
                    seen.add(url)
                    source = getattr(getattr(result, "content", None), "source", None)
                    if getattr(source, "type", None) == "text":
                        fetched[url] = str(getattr(source, "data", "") or "")
        elif kind == "tool_use" and getattr(block, "name", None) == PUBLISH_TOOL["name"]:
            raw = getattr(block, "input", None)
            publish = raw if isinstance(raw, dict) else {}
    return publish


def _tool_uses(usage: Any) -> tuple[int, int]:
    server = getattr(usage, "server_tool_use", None)
    return int(getattr(server, "web_search_requests", 0) or 0), int(getattr(server, "web_fetch_requests", 0) or 0)


@dataclass(frozen=True)
class Tokens:
    """One turn's tokens by price class. A research turn re-reads its growing context on every
    search iteration, and the API serves most of those re-reads from the prompt cache at a tenth
    of the input price - so unlike the read (two thousand tokens, priced flat) the split matters."""

    input: int = 0
    cache_write: int = 0
    cache_read: int = 0
    output: int = 0

    def __add__(self, other: "Tokens") -> "Tokens":
        return Tokens(self.input + other.input, self.cache_write + other.cache_write, self.cache_read + other.cache_read, self.output + other.output)

    @property
    def billed_input(self) -> int:
        return self.input + self.cache_write + self.cache_read


def _tokens(usage: Any) -> Tokens:
    """The turn's tokens, summed over `usage.iterations` when the response carries them (a
    server-side fallback ran) - the top-level usage covers only the attempt that answered."""

    def one(block: Any) -> Tokens:
        return Tokens(
            int(getattr(block, "input_tokens", 0) or 0),
            int(getattr(block, "cache_creation_input_tokens", 0) or 0),
            int(getattr(block, "cache_read_input_tokens", 0) or 0),
            int(getattr(block, "output_tokens", 0) or 0),
        )

    top = one(usage)
    iterations = getattr(usage, "iterations", None) or []
    if not iterations:
        return top
    total = Tokens()
    for entry in iterations:
        total = total + one(entry)
    return total if total.billed_input + total.output >= top.billed_input + top.output else top


def tokens_cost_usd(model: str, tokens: Tokens) -> float:
    """List price: input at the model's input rate, cache writes at 1.25x, cache reads at 0.1x,
    output at the output rate; an unknown model at the dearest row."""
    dearest = max(PRICES_PER_MTOK.values())
    input_rate, output_rate = PRICES_PER_MTOK.get(model, dearest)
    return (tokens.input * input_rate + tokens.cache_write * input_rate * 1.25 + tokens.cache_read * input_rate * 0.1 + tokens.output * output_rate) / 1_000_000


RETRYABLE_REASONS = ("connection", "rate_limit", "api_200", "api_500", "api_502", "api_503", "api_504", "api_529")


def research(brief: str, *, model: str, effort: str, max_searches: int, max_fetches: int) -> Research:
    """The research, tried again once when the turn died for a reason that a pause can fix: a
    dropped connection, an overloaded API, or an error event inside the stream (the SDK reports
    that with the stream's own HTTP status, 200). A refusal or a bad request is not retried."""
    result = _research_once(brief, model=model, effort=effort, max_searches=max_searches, max_fetches=max_fetches)
    for _attempt in range(RESEARCH_ATTEMPTS - 1):
        if result.reason not in RETRYABLE_REASONS:
            break
        LOGGER.warning("research turn failed (%s) - trying once more after %ds", result.reason, RETRY_PAUSE_SECONDS)
        time.sleep(RETRY_PAUSE_SECONDS)
        result = _research_once(brief, model=model, effort=effort, max_searches=max_searches, max_fetches=max_fetches)
    return result


def _research_once(brief: str, *, model: str, effort: str, max_searches: int, max_fetches: int) -> Research:
    """One research turn. Any failure returns a Research with no items and the reason - never raises."""
    try:
        import anthropic
    except ImportError:
        return Research([], model=model, effort=effort, reason="no_library", note="the AI library is not installed on this runner")

    tools: list[dict[str, Any]] = [
        {
            "type": "web_search_20260209",
            "name": "web_search",
            "max_uses": max_searches,
            "user_location": {"type": "approximate", "city": "Sydney", "region": "New South Wales", "country": "AU", "timezone": "Australia/Sydney"},
        },
        {"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": max_fetches, "max_content_tokens": FETCH_CONTENT_TOKENS},
        PUBLISH_TOOL,
    ]
    messages: list[dict[str, Any]] = [{"role": "user", "content": brief}]
    seen: set[str] = set()
    fetched: dict[str, str] = {}
    tokens = Tokens()
    searches = fetches = continuations = 0
    served = model
    publish: dict[str, Any] | None = None
    reason = "no_publish"
    nudged = False

    client = anthropic.Anthropic(timeout=900.0, max_retries=1)
    try:
        while True:
            # Streamed because a research turn runs for minutes; the final message is what we read.
            with client.beta.messages.stream(
                model=model,
                max_tokens=MAX_OUTPUT_TOKENS,
                output_config={"effort": effort},
                system=SYSTEM_PROMPT,
                tools=tools,
                messages=messages,
            ) as stream:
                response = stream.get_final_message()
            served = str(getattr(response, "model", None) or model)
            tokens = tokens + _tokens(response.usage)
            step_searches, step_fetches = _tool_uses(response.usage)
            searches, fetches = searches + step_searches, fetches + step_fetches
            found = _harvest(list(response.content), seen, fetched)
            if found is not None:
                publish, reason = found, "ok"
                break
            stop = response.stop_reason
            if stop in ("refusal", "max_tokens"):
                reason = stop
                break
            if continuations >= MAX_CONTINUATIONS:
                reason = "too_long"
                break
            continuations += 1
            # pause_turn: the paused message goes back unchanged. end_turn without a publish call:
            # once, ask for the call - the model sometimes writes the briefing as prose instead.
            messages.append({"role": "assistant", "content": response.content})
            if stop == "pause_turn":
                continue
            if nudged:
                reason = "no_publish"
                break
            messages.append({"role": "user", "content": NUDGE})
            nudged = True
    except anthropic.AuthenticationError:
        return Research([], model=model, effort=effort, reason="auth", note="the Anthropic API key was rejected")
    except anthropic.RateLimitError:
        return Research([], model=model, effort=effort, reason="rate_limit", note="the Anthropic API was rate limited")
    except anthropic.APIStatusError as exc:
        # The API's own description of the failure (e.g. "Overloaded") carries no secret and is the
        # one line that explains an empty evening in the public log.
        LOGGER.warning("Anthropic API error %s: %s", exc.status_code, str(exc)[:200])
        reason, note = api_failure(exc)
        return Research([], model=model, effort=effort, reason=reason, note=note)
    except anthropic.APIConnectionError:
        return Research([], model=model, effort=effort, reason="connection", note="the Anthropic API could not be reached")

    # Priced at whichever of the requested and serving model is dearer, plus the searches.
    tokens_cost = max(tokens_cost_usd(model, tokens), tokens_cost_usd(served, tokens))
    base = Research(
        [],
        seen=seen,
        fetched=fetched,
        model=served,
        effort=effort,
        searches=searches,
        fetches=fetches,
        input_tokens=tokens.billed_input,
        cache_read_tokens=tokens.cache_read,
        output_tokens=tokens.output,
        cost_usd=tokens_cost + searches * SEARCH_PRICE_USD,
        continuations=continuations,
        reason=reason,
    )
    if reason != "ok" or publish is None:
        notes = {
            "refusal": "the model declined to write this briefing",
            "max_tokens": "the research ran out of room before it published",
            "too_long": "the research did not finish within the allowed continuations",
            "no_publish": "the model finished without publishing a briefing",
        }
        return replace(base, note=notes.get(reason, "the research did not produce a briefing"))
    return replace(
        base,
        items=parse_items(publish.get("items")),
        ipo_note=" ".join(str(publish.get("ipo_note") or "").split())[:300],
        searched=" ".join(str(publish.get("searched") or "").split())[:300],
    )


# --------------------------------------------------------------------------------------------
# The messages.


def _h(text: str) -> str:
    return html.escape(text, quote=True)


def _short_name(item: BriefingItem) -> str:
    return item.headline.split(" (")[0].strip()


def _first_sentence(text: str) -> str:
    for end in (". ", "; "):
        cut = text.find(end)
        if 0 < cut < 220:
            return text[:cut].rstrip(" ;,.") + "."
    return text if len(text) <= 220 else text[:219].rstrip() + "…"


def summary_line(items: list[BriefingItem]) -> str:
    counts: dict[str, int] = {}
    for item in items:
        counts[item.category] = counts.get(item.category, 0) + 1
    parts = [f"{count} {CATEGORY_STYLE[category][1]}" for category, count in counts.items()]
    noun = "item" if len(items) == 1 else "items"
    return f"{len(items)} {noun} checked against their original sources: " + ", ".join(parts) + "."


def item_html(item: BriefingItem) -> str:
    emoji, _label = CATEGORY_STYLE[item.category]
    tags = [tag for tag, on in (("private", not item.listed), ("catch-up", item.catch_up)) if on]
    head = f"{emoji} <b>{_h(item.headline)}</b>" + (f" <i>({', '.join(tags)})</i>" if tags else "")
    lines = [head, _h(item.what_happened), f"<i>Why it matters:</i> {_h(item.why_it_matters)}", f"<i>Risks:</i> {_h(item.risks)}"]
    if item.not_disclosed:
        lines.append(f"<i>Not disclosed:</i> {_h(item.not_disclosed)}")
    lines.append(" · ".join(f'<a href="{_h(source.url)}">{_h(source.label)}</a>' for source in item.sources))
    return "\n".join(lines)


def compose_messages(
    items: list[BriefingItem],
    *,
    day_label: str,
    ipo_note: str,
    research: Research,
    removed: int,
    removed_categories: list[str],
    month_to_date: float,
    budget: float,
    limit: int = TELEGRAM_LIMIT,
) -> list[str]:
    """The operator's HTML briefing, split at item boundaries so no message passes Telegram's limit.
    The header stays with the first part and the footer with the last."""
    parts = [f"🗞️ <b>Lyra AI briefing</b> · {_h(day_label)}\n<i>{_h(summary_line(items))}</i>"]
    parts.extend(item_html(item) for item in items)
    if ipo_note:
        parts.append(f"🚀 <b>IPOs:</b> {_h(ipo_note)}")
    footer = [
        f"🤖 {MODEL_NAMES.get(research.model, research.model)} at {research.effort} effort · {research.searches} searches, {research.fetches} pages opened"
        f" · ${research.cost_usd:.2f} this briefing · ${month_to_date:.2f} of ${budget:.0f} this month"
    ]
    if removed:
        footer.append(f"Lyra's checks removed {removed} item{'s' if removed != 1 else ''} ({', '.join(removed_categories)}).")
    footer.append("Research, not advice.")
    parts.append("\n".join(footer))

    messages: list[str] = []
    current = ""
    for part in parts:
        candidate = part if not current else f"{current}\n\n{part}"
        if current and len(candidate) > limit:
            messages.append(current)
            current = part
        else:
            current = candidate
    if current:
        messages.append(current)
    return messages


def router_title(items: list[BriefingItem], day_label: str) -> str:
    names = [_short_name(item) for item in items[:3]]
    more = len(items) - len(names)
    return f"AI briefing · {day_label}: " + ", ".join(names) + (f" + {more} more" if more > 0 else "")


def router_body(items: list[BriefingItem], ipo_note: str, limit: int = ROUTER_BODY_LIMIT) -> str:
    """The plain-text version for push and chat channels: one line per item, the deep link carries
    the rest. The router adds the research suffix itself."""
    item_lines = [f"{CATEGORY_STYLE[item.category][0]} {item.headline}: {_first_sentence(item.what_happened)}" for item in items]
    tail = ([f"🚀 IPOs: {ipo_note}"] if ipo_note else []) + ["Full briefing with sources: open Lyra > AI Briefing."]
    body = "\n".join(item_lines + tail)
    # Too long for a push: drop items from the tail end (the lead stays), never the pointer.
    while len(body) > limit and len(item_lines) > 1:
        item_lines.pop()
        body = "\n".join(item_lines + tail)
    return body


# --------------------------------------------------------------------------------------------
# Reads and the ledger.


def load_briefing_runs(client: Any, since: datetime) -> list[dict[str, Any]]:
    result = (
        client.table("stock_scanner_runs")
        .select("job_name,status,started_at,payload")
        .eq("job_name", JOB_NAME)
        .gte("started_at", since.isoformat())
        .order("started_at", desc=True)
        .limit(80)
        .execute()
    )
    return list(result.data or [])


def _payload(run_row: dict[str, Any]) -> dict[str, Any]:
    payload = run_row.get("payload")
    return payload if isinstance(payload, dict) else {}


def last_date_sent(runs: list[dict[str, Any]]) -> date | None:
    dates = [date.fromisoformat(_payload(run)["date"]) for run in runs if isinstance(_payload(run).get("date"), str)]
    return max(dates) if dates else None


def pending_items(runs: list[dict[str, Any]], today: date) -> dict[str, Any] | None:
    """Today's research with nothing delivered yet (every send failed): the stored items, so the
    next firing resends them instead of paying for the research again."""
    for run in runs:
        payload = _payload(run)
        if payload.get("date") is None and payload.get("date_attempted") == today.isoformat() and payload.get("items"):
            return payload
    return None


def covered_from_runs(runs: list[dict[str, Any]], since_day: date) -> tuple[set[str], list[str]]:
    """Canonical source URLs cited by recent briefings (the guard's repeat check) and one line per
    item for the brief (the model's repeat check)."""
    urls: set[str] = set()
    lines: list[str] = []
    for run in runs:
        payload = _payload(run)
        day = payload.get("date") or payload.get("date_attempted")
        if not isinstance(day, str) or date.fromisoformat(day) < since_day:
            continue
        for raw in payload.get("items") or []:
            if not isinstance(raw, dict):
                continue
            for source in raw.get("sources") or []:
                url = canonical_url(str((source or {}).get("url") or "")) if isinstance(source, dict) else ""
                if url:
                    urls.add(url)
            headline = str(raw.get("headline") or "").strip()
            if headline:
                lines.append(f"{headline} ({fmt_day(date.fromisoformat(day))})")
    return urls, lines


def load_universe_symbols(client: Any) -> list[str]:
    result = client.table("stock_tickers").select("symbol").eq("is_active", True).eq("scan_enabled", True).execute()
    return sorted({str(row.get("symbol") or "").upper() for row in (result.data or []) if row.get("symbol")})


def load_user_ids(client: Any, repository: SupabaseRepository, default_user_id: str) -> list[str]:
    """Everyone with an account - the briefing is for people who have the app, not only those with
    a position on file. Falls back to the digest's active-user list if profiles cannot be read."""
    ids: list[str] = []
    try:
        result = client.table("profiles").select("id").execute()
        ids = [str(row.get("id")) for row in (result.data or []) if row.get("id")]
    except Exception as exc:  # noqa: BLE001 - a profiles read failure must not stop the briefing
        LOGGER.warning("could not list profiles (%s) - using the active-user list", type(exc).__name__)
    if not ids:
        ids = list(repository.load_active_user_ids())
    if default_user_id and default_user_id not in ids:
        ids.append(default_user_id)
    return ids


# --------------------------------------------------------------------------------------------
# The run.


def run(now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    settings = load_settings()

    if not settings.enable_ai_briefing:
        LOGGER.info("The AI briefing is off (ENABLE_AI_BRIEFING is not true) - nothing sent.")
        return 0
    bot_token = os.getenv("SUMMARY_TELEGRAM_BOT_TOKEN", "")
    chat_id = os.getenv("SUMMARY_TELEGRAM_CHAT_ID", "")
    operator_chat = bool(bot_token and chat_id)
    if not operator_chat and not settings.notification_dispatch_enabled:
        LOGGER.info("No SUMMARY_TELEGRAM_* and no notification dispatch - nowhere to send the briefing.")
        return 0
    repository = SupabaseRepository(settings)
    if not repository.client:
        LOGGER.info("Supabase is not configured - demo mode, no briefing.")
        return 0
    client = repository.client
    force = os.getenv("BRIEFING_FORCE", "").strip().lower() in ("1", "true", "yes")
    reader_zone = ZoneInfo(os.getenv("SUMMARY_TIMEZONE", "").strip() or DEFAULT_TIMEZONE)
    local_now = now.astimezone(reader_zone)
    today = local_now.date()

    if not force and not due(local_now, parse_clock(os.getenv("BRIEFING_SEND_AT", ""), parse_clock(DEFAULT_SEND_AT, clock_time(20, 0)))):
        LOGGER.info("Not yet the reader's send time (%s local) - nothing sent.", local_now.strftime("%H:%M"))
        return 0

    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    runs = load_briefing_runs(client, min(month_start, now - timedelta(days=COVERED_DAYS + 1)))
    sent = last_date_sent(runs)
    if sent is not None and sent >= today and not force:
        LOGGER.info("Today's briefing (%s) has already gone out - nothing sent.", today.isoformat())
        return 0

    month_runs = [run_row for run_row in runs if (_parse_time(run_row.get("started_at")) or now) >= month_start]
    spent_before = month_spend(month_runs)
    budget = _env_float("BRIEFING_MONTHLY_BUDGET_USD", DEFAULT_MONTHLY_BUDGET_USD)
    model = os.getenv("BRIEFING_MODEL", "").strip() or DEFAULT_MODEL
    configured_effort = os.getenv("BRIEFING_EFFORT", "").strip().lower() or DEFAULT_EFFORT
    max_searches = int(_env_float("BRIEFING_MAX_SEARCHES", DEFAULT_MAX_SEARCHES))
    max_fetches = int(_env_float("BRIEFING_MAX_FETCHES", DEFAULT_MAX_FETCHES))
    day_label = fmt_day(today)

    pending = None if force else pending_items(runs, today)
    run_id = repository.create_run(JOB_NAME, settings.default_timeframe)
    removed = 0
    removed_categories: list[str] = []
    if pending is not None:
        # Yesterday-evening's firing researched and could not deliver: resend from the ledger.
        kept = parse_items(pending.get("items"))
        ipo_note = str(pending.get("ipo_note") or "")
        research_result = Research(kept, ipo_note=ipo_note, model=str(pending.get("model") or model), effort=str(pending.get("effort") or configured_effort), searches=int(pending.get("searches") or 0), fetches=int(pending.get("fetches") or 0), reason="resend")
        removed = int(pending.get("removed") or 0)
        removed_categories = [str(c) for c in (pending.get("removed_categories") or [])]
        LOGGER.info("Resending today's stored briefing (%d items) - the research is not repeated.", len(kept))
    else:
        covered_urls, covered_lines = covered_from_runs(runs, today - timedelta(days=COVERED_DAYS))
        try:
            universe = load_universe_symbols(client)
        except Exception as exc:  # noqa: BLE001 - symbol tags are an extra
            LOGGER.warning("could not read the universe: %s", type(exc).__name__)
            universe = []
        if not os.getenv("ANTHROPIC_API_KEY"):
            research_result = Research([], model=model, effort=configured_effort, reason="no_key", note="no Anthropic API key is configured")
        elif spent_before >= budget:
            research_result = Research([], model=model, effort=configured_effort, reason="budget", note=f"this month's ${budget:.0f} briefing budget is used up")
        else:
            effort = choose_effort(configured_effort, month_runs, budget, now)
            if effort not in EFFORT_LEVELS:
                effort = DEFAULT_EFFORT
            brief = research_brief(now, reader_zone, covered_lines, universe, max_searches=max_searches, max_fetches=max_fetches)
            research_result = research(brief, model=model, effort=effort, max_searches=max_searches, max_fetches=max_fetches)
        outcome: GuardOutcome = guard_briefing(research_result.items, seen=research_result.seen, fetched=research_result.fetched, covered=covered_urls, universe=set(universe))
        kept, removed, removed_categories = outcome.kept, len(outcome.removed), outcome.categories
        ipo_note = research_result.ipo_note
        if outcome.removed:
            LOGGER.warning("guard removed %d item(s): %s", removed, ", ".join(removed_categories))

    spent_after = spent_before + research_result.cost_usd
    ledger: dict[str, Any] = {
        "date": None,  # set only once something was delivered; a stored, undelivered briefing is resent
        "date_attempted": today.isoformat(),
        "items": [item.to_dict() for item in kept],
        "ipo_note": ipo_note,
        "searched": research_result.searched,
        "published": len(research_result.items),
        "removed": removed,
        "removed_categories": removed_categories,
        "ai": research_result.reason in ("ok", "resend"),
        "reason": research_result.reason,
        "model": research_result.model,
        "effort": research_result.effort,
        "searches": research_result.searches,
        "fetches": research_result.fetches,
        "input_tokens": research_result.input_tokens,
        "cache_read_tokens": research_result.cache_read_tokens,
        "output_tokens": research_result.output_tokens,
        "cost_usd": round(research_result.cost_usd, 6),
        "continuations": research_result.continuations,
        "pricing_as_of": PRICING_AS_OF,
        "operator_delivered": False,
        "users_attempted": 0,
        "users_reached": 0,
    }
    # The research is paid for and stored before any send, so a crash between the two loses neither.
    record_run(client, run_id, "running", ledger, delivered=False)

    silent = quiet_now(os.getenv("SUMMARY_QUIET_HOURS", DEFAULT_QUIET_HOURS), local_now)
    operator_delivered = False
    operator_error: str | None = None
    if operator_chat:
        send_settings = replace(settings, telegram_bot_token=bot_token, telegram_chat_id=chat_id)
        if kept:
            messages = compose_messages(kept, day_label=day_label, ipo_note=ipo_note, research=research_result, removed=removed, removed_categories=removed_categories, month_to_date=spent_after, budget=budget)
        else:
            why = research_result.note or (f"the model published {len(research_result.items)} item(s) and Lyra's checks removed every one ({', '.join(removed_categories)})" if removed else "the sweep found nothing that passed")
            messages = [f"🗞️ <b>Lyra AI briefing</b> · {_h(day_label)}\nNo briefing tonight: {_h(why)}.\n🤖 ${research_result.cost_usd:.2f} this run · ${spent_after:.2f} of ${budget:.0f} this month"]
        delivered_parts = 0
        for message in messages:
            delivery = send_telegram_message(message, send_settings, chat_id=chat_id, silent=silent, parse_mode="HTML")
            if delivery.sent_status == "sent":
                delivered_parts += 1
            else:
                operator_error = delivery.error_message
                break
        operator_delivered = delivered_parts == len(messages)

    users_attempted = users_reached = 0
    if kept and settings.notification_dispatch_enabled:
        title = router_title(kept, day_label)
        body = router_body(kept, ipo_note)
        event_payload = {"date": today.isoformat(), "items": ledger["items"], "ipo_note": ipo_note}
        for user_id in load_user_ids(client, repository, settings.default_user_id):
            users_attempted += 1
            result = dispatch_notification(
                settings,
                user_id=user_id,
                symbol="",  # market-wide: no symbol chip, no symbol mute can catch it
                alert_type=NOTIFICATION_TYPE,
                title=title,
                body=body,
                reason=f"Daily AI briefing for {today.isoformat()}",
                payload={**event_payload, "dedupe_key": f"{NOTIFICATION_TYPE}:{user_id}:{today.isoformat()}"},
                relevance_score=100,
                notification_type=NOTIFICATION_TYPE,
                url="/briefing",
            )
            if result.reached_someone:
                users_reached += 1

    briefing_exists = bool(kept)
    briefing_delivered = briefing_exists and (operator_delivered or users_reached > 0)
    researched = research_result.reason in ("ok", "resend")
    # The day is done when a briefing went out, when the research ran and genuinely found nothing,
    # when the month's budget is spent, or when the model itself gave up (a refusal is not retried
    # at this price). A night the model could not run at all - no key, no credit, the API down -
    # stays open so the later firing tries again: the first forced run (2026-10-08) claimed the
    # day on a billing failure, which would have silenced that evening's real attempt after the
    # top-up. A briefing that exists but reached nobody also stays open (resent, not re-researched).
    external_failure = research_result.reason in ("billing", "no_key", "no_library", "connection", "rate_limit") or research_result.reason.startswith("api_")
    day_done = not external_failure and (briefing_delivered or not briefing_exists)
    if briefing_delivered or (researched and not briefing_exists):
        status, error = "success", None
    elif research_result.reason == "budget":
        status, error = "skipped", research_result.note
    else:
        status, error = "failed", (operator_error if briefing_exists else research_result.note) or "no channel delivered the briefing"
    record_run(
        client,
        run_id,
        status,
        {
            **ledger,
            "date": today.isoformat() if day_done else None,
            "silent": silent,
            "operator_delivered": operator_delivered,
            "users_attempted": users_attempted,
            "users_reached": users_reached,
        },
        # alerts_sent counts a delivered briefing; a "nothing tonight" note is not one.
        delivered=briefing_delivered,
        error=error,
    )
    LOGGER.info(
        "ai briefing for %s: items=%d removed=%d reasons=%s operator=%s users=%d/%d ai=%s reason=%s model=%s effort=%s searches=%d fetches=%d continuations=%d tokens=%d in (%d cached) / %d out cost=$%.4f month=$%.2f of $%.0f",
        today.isoformat(), len(kept), removed, ",".join(removed_categories) or "-", operator_delivered, users_reached, users_attempted,
        ledger["ai"], research_result.reason, research_result.model, research_result.effort, research_result.searches, research_result.fetches,
        research_result.continuations, research_result.input_tokens, research_result.cache_read_tokens, research_result.output_tokens, research_result.cost_usd, spent_after, budget,
    )
    if briefing_exists and not briefing_delivered:
        LOGGER.error("The briefing was NOT delivered anywhere: %s", operator_error or "no channel reached anyone")
        return 1
    return 0


def main() -> None:
    sys.exit(run())


if __name__ == "__main__":
    main()
