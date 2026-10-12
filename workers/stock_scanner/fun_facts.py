"""The financial fun fact that closes the evening briefing.

The founder (2026-10-13) asked for the evening update in "little bites ... with a financial fun
fact", after a sample that ended on one line of trivia with its source. Lyra already keeps a facts
library - content/finance-facts.jsonl, compiled for the app's "Good to know" card - so the fact
comes from there rather than from a model: only entries that carry a `source` and an https `url`
are eligible, and those were each checked against the page they cite before they were added. A
fact without a source is never sent, so nothing in the briefing's last line is unverified.

One fact a day, chosen by the reader's date: consecutive days take consecutive facts and none
repeats until every eligible fact has been used. No eligible fact, no line - the briefing is
complete without it.
"""

from __future__ import annotations

import html
import json
from dataclasses import dataclass
from datetime import date
from pathlib import Path

FACTS_PATH = Path(__file__).resolve().parents[2] / "content" / "finance-facts.jsonl"
MAX_FACT_CHARS = 280


@dataclass(frozen=True)
class FunFact:
    id: str
    text: str
    source: str
    url: str


def load_fun_facts(path: Path = FACTS_PATH) -> list[FunFact]:
    """Every sourced fact in the library, in id order. A malformed line is skipped, never fatal."""
    facts: list[FunFact] = []
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return []
    for line in lines:
        try:
            row = json.loads(line)
        except ValueError:
            continue
        if not isinstance(row, dict):
            continue
        text, source, url = (" ".join(str(row.get(key) or "").split()) for key in ("body", "source", "url"))
        if text and source and url.startswith("https://") and len(text) <= MAX_FACT_CHARS:
            facts.append(FunFact(str(row.get("id") or ""), text, source, url))
    return sorted(facts, key=lambda fact: fact.id)


def fact_for(day: date, facts: list[FunFact] | None = None) -> FunFact | None:
    pool = load_fun_facts() if facts is None else facts
    return pool[day.toordinal() % len(pool)] if pool else None


def fact_html(fact: FunFact) -> str:
    return f'💡 <b>Fun fact:</b> {html.escape(fact.text, quote=False)} <a href="{html.escape(fact.url, quote=True)}">{html.escape(fact.source, quote=False)}</a>'


def fact_text(fact: FunFact) -> str:
    return f"Fun fact: {fact.text} ({fact.source}: {fact.url})"
