"""
Unmapped-signal clustering - how a missing vertical announces itself.

Deterministic, no AI: from the items that attached to NO existing vertical, extract
candidate entities (capitalized multi-word phrases), count recurrence across items and
across distinct sources, and promote clusters that clear the bar into evidence-linked
idea candidates. Confidence is a plain function of breadth (items + sources), never a
model's opinion - the AI's only later role is explaining a card, not scoring it.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from workers.scout.providers import ScoutItem

# A candidate entity is 2+ capitalized words in sequence ("Commonwealth Fusion Systems").
# Single capitalized words are NEVER candidates - a live 400-item run promoted "General",
# "Global" and "Energy" as emerging signals, which is exactly the noise a cork board must
# not carry. A real emerging theme always has a multi-word name somewhere in its coverage.
_PHRASE = re.compile(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b")

# Generic leading/trailing words that make a phrase junk ("The Company", "Last Week").
_JUNK_WORDS = {
    "the", "a", "an", "this", "that", "last", "next", "new", "big", "top",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "january", "february", "march", "april", "may", "june", "july", "august",
    "september", "october", "november", "december",
    "reuters", "bloomberg", "cnbc", "techcrunch", "press", "release", "update",
    "united", "states", "america", "american", "president", "congress", "senate",
    "company", "companies", "market", "markets", "stock", "stocks", "shares",
    "report", "reports", "news", "week", "year", "quarter", "billion", "million",
}

MIN_ITEMS = 3
MIN_SOURCES = 2


@dataclass(frozen=True)
class IdeaCandidate:
    """An emerging cluster strong enough to file on the ideas board."""

    dedupe_key: str          # stable slug so re-runs update, never duplicate
    title: str
    description: str
    confidence: int          # breadth-derived, 0-100
    evidence: tuple[dict, ...]  # [{itemId, title, url, sourceId}]


def _entities(text: str) -> set[str]:
    """Candidate entities in one item's text: junk-filtered multi-word phrases."""
    out: set[str] = set()
    for m in _PHRASE.finditer(text):
        phrase = m.group(1)
        words = phrase.lower().split()
        if words[0] in _JUNK_WORDS or words[-1] in _JUNK_WORDS:
            continue
        out.add(phrase)
    return out


def slugify(entity: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", entity.lower()).strip("-")


def cluster_unmapped(items: list[ScoutItem]) -> list[IdeaCandidate]:
    """Promote recurring unmapped entities into idea candidates.

    Bar: an entity must appear in >= MIN_ITEMS items from >= MIN_SOURCES distinct
    sources. One outlet drumbeating a term is marketing; several independently is signal.
    """
    by_entity: dict[str, list[ScoutItem]] = {}
    for item in items:
        for entity in _entities(f"{item.title} {item.summary}"):
            by_entity.setdefault(entity, []).append(item)

    candidates: list[IdeaCandidate] = []
    claimed: set[str] = set()  # an item backs at most one candidate (strongest first)

    # Equal-count ties go to the LONGER entity: "Commonwealth Fusion Systems" must beat
    # its own fragment "Commonwealth" for the same items.
    ranked = sorted(by_entity.items(), key=lambda kv: (-len(kv[1]), -len(kv[0]), kv[0]))
    for entity, hits in ranked:
        hits = [h for h in hits if h.id not in claimed]
        sources = {h.source_id for h in hits}
        if len(hits) < MIN_ITEMS or len(sources) < MIN_SOURCES:
            continue
        claimed.update(h.id for h in hits)
        confidence = min(90, 20 + 10 * len(hits) + 5 * len(sources))
        evidence = tuple(
            {"itemId": h.id, "title": h.title, "url": h.url, "sourceId": h.source_id}
            for h in hits[:8]
        )
        candidates.append(
            IdeaCandidate(
                dedupe_key=f"scout-vertical-{slugify(entity)}",
                title=f"Emerging signal: {entity}",
                description=(
                    f"The scout saw '{entity}' recur across {len(hits)} items from "
                    f"{len(sources)} independent sources, and none of it attaches to any "
                    f"existing vertical. It may be a missing vertical, a missing node on "
                    f"an existing chain, or noise - the evidence links are attached for a "
                    f"human read. Filed automatically; nothing changes unless accepted."
                ),
                confidence=confidence,
                evidence=evidence,
            )
        )
    return candidates
