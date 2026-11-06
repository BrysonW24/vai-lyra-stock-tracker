"""The evening briefing's items, written by an open model from pages the job opened itself.

The AI briefing (ai_briefing.py) leans on Anthropic's server-side web search and web fetch: the
model searches, opens pages and publishes, and briefing_guard.py checks every item against what
those tools returned. An open model has no such tools - and the founder asked on 2026-11-06 for the
briefing to cost nothing - so the research moves into code and the model's job shrinks to the part
it is good at:

  * CODE finds the candidates (the news feeds Lyra already reads), opens each page and trims it.
  * THE MODEL writes ONE item from ONE page, as JSON, or says the page is not an item.
  * CODE attaches the source. The model never supplies a URL, so it cannot cite a page nobody opened.
  * THE SAME GUARD decides. `seen` is the feed's URL and the page's final URL; `fetched` maps the
    page to exactly what the model was shown (the title and the window of text) - stricter than
    the whole page, and honest: a figure the model could not have read is a figure it must not
    print. A paywalled or script-only page yields no text, fails as "source not opened" and is
    dropped. It is never replaced by the feed's own summary.
  * A TICKER MUST BE ON THE PAGE. A listed company keeps its ticker only when the page prints it;
    a ticker the model supplied from memory is a guess, however plausible.

This module holds the writing step and its check. The run - read the feeds, rank, fetch, publish -
joins it when the app's publish route ships.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from workers.stock_scanner.briefing_guard import (
    DESKS,
    THEMES,
    BriefingItem,
    canonical_url,
    check_item,
    parse_item,
)
from workers.stock_scanner.generation_record import prompt_version
from workers.stock_scanner.open_model import Completion, Target, complete, parse_json_object

JOB_NAME = "free_briefing"
# What the model is shown of a page. News puts what happened first; 6,000 characters is about
# 1,500 tokens, which a small model on a CPU can read in a couple of minutes and which keeps a
# night's dozen articles far inside a free tier's daily allowance.
ARTICLE_WINDOW_CHARS = 6_000
MAX_OUTPUT_TOKENS = 1200
SOURCE_LABEL_CHARS = 60

ITEM_PROMPT = """You write one item for Lyra's evening briefing from ONE source page. Lyra is a research tool for private investors who follow AI and technology shares. It informs; it never recommends.

You are given the page: its title, then its text. Decide first whether it is an item at all. It IS an item when the page reports one concrete development: an announcement, a contract, a result, a filing, a funding round, a product release, a policy decision. It is NOT an item when the page is an index, a roundup of several stories, an opinion piece, an advertisement, or too thin to say what happened - then answer with "skip" set to true and leave every other field empty.

Rules that code checks after you write - an item that breaks one is thrown away:
1. Facts only, and only from the page text you were given. Copy every figure exactly as the page writes it - the same number, unit and currency - and convert nothing. If the page gives no figure, say so in words; never estimate. Do not add a date, a year or a number that is not in the text.
2. A listed company: set "listed" to true and give its "exchange" and "ticker" exactly as the page states them. If the page does not state a ticker, or the subject is private, a government body or a product, set "listed" to false and leave "exchange" and "ticker" empty. Never attach a ticker to a private company and never guess one.
3. Never recommend, rate or suggest buying, selling, holding or avoiding anything, and do not repeat such advice if the page contains it. Describe; do not advise.
4. Tag "theme" with exactly one of: agi-infrastructure, semiconductors, power-grid, nuclear-uranium, critical-minerals, robotics-automation, quantum-computing, space-economy, defence-drones, cybersecurity, other. Tag "desk" with ipo, venture, government or small_cap when the item IS that kind of event, otherwise news.
5. "lyra_symbols": tickers from the list in the brief that this item directly concerns. Empty when none.

Write the item as a bite a reader takes in at a glance on a phone. "headline": the company or subject. "lead": the takeaway in one plain sentence of at most fourteen words that names the subject and says what matters. "what_happened": at most two sentences. "why_it_matters": one sentence - what the announcement changes. "risks": one sentence. "not_disclosed": a few words, only when something material is missing. The fields are printed as one paragraph, so each must read on from the one before it. No markdown, no emoji, no filler.

Answer with one JSON object and nothing else."""

# Every field is required and none is open-ended: a strict-schema endpoint needs that, and a small
# model writes better JSON when there is nothing to decide about its shape.
ITEM_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "skip": {"type": "boolean"},
        "headline": {"type": "string"},
        "lead": {"type": "string"},
        "theme": {"type": "string", "enum": list(THEMES)},
        "desk": {"type": "string", "enum": list(DESKS)},
        "listed": {"type": "boolean"},
        "exchange": {"type": "string"},
        "ticker": {"type": "string"},
        "what_happened": {"type": "string"},
        "why_it_matters": {"type": "string"},
        "risks": {"type": "string"},
        "not_disclosed": {"type": "string"},
        "lyra_symbols": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "skip",
        "headline",
        "lead",
        "theme",
        "desk",
        "listed",
        "exchange",
        "ticker",
        "what_happened",
        "why_it_matters",
        "risks",
        "not_disclosed",
        "lyra_symbols",
    ],
}

PROMPT_VERSION = prompt_version(JOB_NAME, ITEM_PROMPT, ITEM_SCHEMA)
_ITEM_FIELDS = tuple(name for name in ITEM_SCHEMA["properties"] if name != "skip")

_SPACE_RE = re.compile(r"[ \t\r\f\v]+")
_BLANK_LINES_RE = re.compile(r"\n{3,}")


@dataclass(frozen=True)
class Article:
    """One page the job opened. `text` is the window the model is shown and the guard checks against."""

    url: str  # as the feed listed it
    final_url: str  # after redirects - the page that was actually read
    title: str
    text: str
    source: str = ""  # the feed's own name, for the link text

    @property
    def link_label(self) -> str:
        label = (self.source or "Source").strip()
        return label if len(label) <= SOURCE_LABEL_CHARS else label[: SOURCE_LABEL_CHARS - 1].rstrip() + "…"

    @property
    def shown(self) -> str:
        """Everything of the page the model reads - and so everything the guard checks against."""
        return f"{self.title.strip()}\n\n{self.text}".strip()


@dataclass(frozen=True)
class ItemOutcome:
    """What one page became. `item` is set only when it may be published; `reasons` are the guard's
    (their first words are coarse labels safe for a ledger); `outcome` is one public-safe word."""

    item: BriefingItem | None
    outcome: str  # kept | skipped | removed | unparsable | <the model's failure reason>
    reasons: tuple[str, ...] = ()
    completion: Completion | None = None

    @property
    def categories(self) -> list[str]:
        return sorted({reason.split(":")[0] for reason in self.reasons})


def article_window(text: str, limit: int = ARTICLE_WINDOW_CHARS) -> str:
    """The start of a page, tidied and cut at a paragraph or sentence where one is near - the exact
    text the model reads and the guard later checks figures against."""
    tidy = _BLANK_LINES_RE.sub("\n\n", "\n".join(_SPACE_RE.sub(" ", line).strip() for line in (text or "").splitlines())).strip()
    if len(tidy) <= limit:
        return tidy
    cut = tidy[:limit]
    for mark in ("\n\n", ". ", "\n"):
        position = cut.rfind(mark)
        if position >= limit * 0.6:
            return cut[: position + (1 if mark == ". " else 0)].rstrip()
    return cut.rstrip()


def ticker_printed(ticker: str, shown: str) -> bool:
    """True when the page prints this ticker. Three letters or more must stand alone as written; a
    one- or two-letter ticker must sit where a ticker sits - after a colon or an opening bracket,
    as in "(NYSE: A)" - because "A" and "IT" are also words."""
    token = rf"{re.escape(ticker)}(?![A-Za-z0-9])"
    if len(ticker) >= 3:
        return re.search(rf"(?<![A-Za-z0-9]){token}", shown) is not None
    return re.search(rf"[:(]\s?{token}", shown) is not None


def item_brief(article: Article, universe: list[str]) -> str:
    lines = ["<page>", article.shown, "</page>"]
    if universe:
        lines += ["", "Lyra's scanned universe (use only these in lyra_symbols): " + ", ".join(universe)]
    lines += ["", "Write the item as one JSON object, or skip."]
    return "\n".join(lines)


def item_from_answer(answer: dict[str, Any] | None, article: Article, *, covered: set[str], universe: set[str]) -> ItemOutcome:
    """A model's JSON as a checked item. The source is attached here, by code, from the page the
    job opened - whatever the model put under "sources" is discarded."""
    if answer is None:
        return ItemOutcome(None, "unparsable")
    if answer.get("skip") is True or str(answer.get("skip")).strip().lower() == "true":
        return ItemOutcome(None, "skipped")
    # Only the fields Lyra asked for are read: anything else a model adds (a source, a flag that
    # relaxes a check) is dropped, not trusted.
    raw = {key: answer[key] for key in _ITEM_FIELDS if key in answer}
    raw["sources"] = [{"label": article.link_label, "url": article.final_url}]
    item = parse_item(raw)
    if item is None:
        return ItemOutcome(None, "unparsable")
    page = canonical_url(article.final_url)
    seen = {url for url in (canonical_url(article.url), page) if url}
    fetched = {page: article.shown} if page and article.text.strip() else {}
    cleaned, reasons = check_item(item, seen=seen, fetched=fetched, covered=covered, universe=universe)
    if item.listed and item.ticker and not ticker_printed(item.ticker, article.shown):
        reasons.append("ticker not in source: the page does not print this ticker")
    if reasons:
        return ItemOutcome(None, "removed", tuple(reasons))
    return ItemOutcome(cleaned, "kept")


def write_item(
    article: Article,
    targets: list[Target],
    *,
    covered: set[str],
    universe: list[str],
    rate_limit_wait: float = 0.0,
) -> tuple[ItemOutcome, list[tuple[str, str]]]:
    """One page through the chain: the first model whose answer parses decides the page - kept,
    skipped or removed by the guard. A model that fails outright (no key, rate limit, unreadable
    JSON) hands the page to the next; a model that wrote a real item the guard removed does not get
    a second opinion, because asking until something passes is how a wrong item gets through."""
    tried: list[tuple[str, str]] = []
    last = ItemOutcome(None, "no_model")
    brief = item_brief(article, universe)
    for target in targets:
        completion = complete(
            target,
            system=ITEM_PROMPT,
            user=brief,
            max_tokens=MAX_OUTPUT_TOKENS,
            temperature=0.2,
            schema=ITEM_SCHEMA,
            schema_name="briefing_item",
            rate_limit_wait=rate_limit_wait,
        )
        if not completion.ok:
            last = ItemOutcome(None, completion.reason, completion=completion)
            tried.append((target.spec, completion.reason))
            continue
        outcome = item_from_answer(parse_json_object(completion.text), article, covered=covered, universe=set(universe))
        last = ItemOutcome(outcome.item, outcome.outcome, outcome.reasons, completion)
        tried.append((target.spec, outcome.outcome))
        if outcome.outcome != "unparsable":
            break
    return last, tried
