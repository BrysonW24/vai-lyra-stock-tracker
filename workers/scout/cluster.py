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
from datetime import datetime, timezone

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
    evidence: tuple[dict, ...]  # [{itemId, title, url, sourceId, publishedAt}]


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


def cluster_unmapped(items: list[ScoutItem], stoplist: set[str] | None = None) -> list[IdeaCandidate]:
    """Promote recurring unmapped entities into idea candidates.

    Bar: an entity must appear in >= MIN_ITEMS items from >= MIN_SOURCES distinct
    sources. One outlet drumbeating a term is marketing; several independently is signal.
    `stoplist` holds slugs from human-DECLINED cards (v3): a rejected entity never
    re-files, so the junk filter is accumulated verdicts, not just the hand-curated list.
    """
    stoplist = stoplist or set()
    by_entity: dict[str, list[ScoutItem]] = {}
    for item in items:
        for entity in _entities(f"{item.title} {item.summary}"):
            if slugify(entity) in stoplist:
                continue
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
            {
                "itemId": h.id,
                "title": h.title,
                "url": h.url,
                "sourceId": h.source_id,
                "publishedAt": h.published_at.isoformat() if h.published_at else None,
            }
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


def drumbeats(
    items: list[ScoutItem],
    promoted: list[IdeaCandidate] | None = None,
    limit: int = 10,
    stoplist: set[str] | None = None,
) -> list[dict]:
    """Below-bar clusters that are BUILDING toward promotion - the visible patience.

    The promotion bar (>= MIN_ITEMS items, >= MIN_SOURCES sources) is deliberately hard, so
    for days the board can look empty while signal accumulates invisibly. This surfaces the
    accumulation itself: entities with >= 2 hits that have NOT yet cleared the bar, with how
    far they have to go. Same extraction, same junk filter, same tie-break as promotion -
    computed here in Python so the frontend can never drift from the real clusterer.
    """
    promoted_keys = {c.dedupe_key for c in (promoted or [])}
    stoplist = stoplist or set()
    by_entity: dict[str, list[ScoutItem]] = {}
    for item in items:
        for entity in _entities(f"{item.title} {item.summary}"):
            if slugify(entity) in stoplist:
                continue
            by_entity.setdefault(entity, []).append(item)

    out: list[dict] = []
    ranked = sorted(by_entity.items(), key=lambda kv: (-len(kv[1]), -len(kv[0]), kv[0]))
    for entity, hits in ranked:
        if f"scout-vertical-{slugify(entity)}" in promoted_keys:
            continue
        sources = {h.source_id for h in hits}
        if len(hits) < 2:
            continue  # a single mention is not a drumbeat
        if len(hits) >= MIN_ITEMS and len(sources) >= MIN_SOURCES:
            continue  # clears the bar - it is a candidate, not a drumbeat
        latest = max(hits, key=lambda h: h.published_at or datetime.min.replace(tzinfo=timezone.utc))
        out.append(
            {
                "entity": entity,
                "items": len(hits),
                "sources": len(sources),
                "needItems": max(0, MIN_ITEMS - len(hits)),
                "needSources": max(0, MIN_SOURCES - len(sources)),
                "latest": {"title": latest.title, "url": latest.url},
            }
        )
        if len(out) >= limit:
            break
    return out
