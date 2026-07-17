"""
Scout orchestrator: pull every active source -> normalize + dedupe -> attach to the
vertical map -> persist what was seen -> cluster the unmapped -> file evidence-linked
idea cards on the community board (origin='scout', status='open').

No auto-creation: the scout only ever WRITES CARDS. The founder gates every 'accepted'
transition, and only the existing author+verify content workflow (run by a human-driven
session) can change the vertical map itself.

Entry point: python -m workers.scout.main  (scheduled by nightly-maintenance.yml).
Demo mode (no Supabase): runs the full loop on sample items and prints the summary -
the loop always has shape with zero keys.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from workers.scout.attach import attach
from workers.scout.cluster import IdeaCandidate, cluster_unmapped
from workers.scout.providers import ScoutItem, demo_items, fetch_source
from workers.scout.sources import active_sources, gated_sources, load_sources
from workers.stock_scanner.config import Settings
from workers.stock_scanner.supabase_repo import SupabaseRepository

logger = logging.getLogger(__name__)

MAX_ITEMS_PER_RUN = 400


def run_scout_worker(settings: Settings, repo: SupabaseRepository) -> dict[str, Any]:
    summary: dict[str, Any] = {
        "status": "running",
        "sources_active": 0,
        "sources_gated": 0,
        "items_fetched": 0,
        "items_persisted": 0,
        "items_unmapped": 0,
        "ideas_filed": 0,
        "error": None,
    }
    try:
        registry = load_sources()
        active = active_sources(registry)
        summary["sources_active"] = len(active)
        summary["sources_gated"] = len(gated_sources(registry))

        items: list[ScoutItem] = []
        if active:
            for source in active:
                fetched = fetch_source(source)
                logger.info("source %s -> %d items", source.id, len(fetched))
                items.extend(fetched)
        if not items:
            logger.info("no live sources produced items - running demo loop for shape")
            items = demo_items()

        # Dedupe by deterministic id (same story from two feeds keeps first-seen).
        seen: dict[str, ScoutItem] = {}
        for item in items:
            seen.setdefault(item.id, item)
        items = list(seen.values())[:MAX_ITEMS_PER_RUN]
        summary["items_fetched"] = len(items)

        # Attach each item to the vertical map (deterministic).
        attachments = {item.id: attach(item.title, item.summary) for item in items}
        unmapped = [i for i in items if attachments[i.id].unmapped]
        summary["items_unmapped"] = len(unmapped)

        if repo.client:
            summary["items_persisted"] = _persist_items(repo, items, attachments)
            # Cluster over the trailing WINDOW, not just tonight's pull: an emerging
            # vertical announces itself as a drumbeat across days, and a single night
            # rarely carries three independent hits on its own.
            window = _load_recent_unmapped(repo, days=14)
            pool = {i.id: i for i in window}
            for i in unmapped:
                pool.setdefault(i.id, i)
            candidates = cluster_unmapped(list(pool.values()))
            summary["ideas_filed"] = _file_ideas(repo, candidates)
        else:
            # Demo: no trailing window exists, so cluster tonight's pull alone.
            candidates = cluster_unmapped(unmapped)
            logger.info("demo mode: %d items, %d idea candidates (not persisted)", len(items), len(candidates))
            for c in candidates:
                logger.info("candidate: %s (confidence %d, %d evidence)", c.title, c.confidence, len(c.evidence))

        summary["status"] = "ok"
        return summary
    except Exception as exc:  # noqa: BLE001
        logger.exception("scout worker failed")
        summary["status"] = "failed"
        summary["error"] = str(exc)
        return summary


def _load_recent_unmapped(repo: SupabaseRepository, days: int = 14) -> list[ScoutItem]:
    """Trailing unmapped items from the store - the accumulating drumbeat window."""
    try:
        since = (datetime.now(tz=timezone.utc) - timedelta(days=days)).isoformat()
        result = (
            repo.client.table("scout_items")
            .select("id, source_id, source_kind, url, title, summary, published_at")
            .eq("unmapped", True)
            .gte("created_at", since)
            .limit(2000)
            .execute()
        )
        items: list[ScoutItem] = []
        for row in result.data or []:
            published = None
            if row.get("published_at"):
                try:
                    published = datetime.fromisoformat(str(row["published_at"]).replace("Z", "+00:00"))
                except ValueError:
                    published = None
            items.append(
                ScoutItem(
                    id=row["id"],
                    source_id=row["source_id"],
                    source_kind=row["source_kind"],
                    url=row.get("url"),
                    title=row["title"],
                    summary=row.get("summary") or "",
                    published_at=published,
                )
            )
        return items
    except Exception as exc:  # noqa: BLE001 - a failed window read degrades to this run only
        logger.error("load recent unmapped failed: %s", exc)
        return []


def _persist_items(repo: SupabaseRepository, items: list[ScoutItem], attachments: dict) -> int:
    try:
        records = []
        for item in items:
            a = attachments[item.id]
            records.append(
                {
                    "id": item.id,
                    "source_id": item.source_id,
                    "source_kind": item.source_kind,
                    "url": item.url,
                    "title": item.title,
                    "summary": item.summary,
                    "published_at": item.published_at.isoformat() if item.published_at else None,
                    "symbols": list(a.symbols),
                    "matched_themes": list(a.matched_themes),
                    "unmapped": a.unmapped,
                }
            )
        if records:
            repo.client.table("scout_items").upsert(records, on_conflict="id").execute()
        return len(records)
    except Exception as exc:  # noqa: BLE001
        logger.error("persist scout_items failed: %s", exc)
        return 0


def _file_ideas(repo: SupabaseRepository, candidates: list[IdeaCandidate]) -> int:
    """Upsert scout ideas by dedupe_key - a recurring cluster refreshes its card
    (evidence + confidence) instead of stacking duplicates. Human rows are untouched."""
    filed = 0
    for c in candidates:
        try:
            repo.client.table("community_ideas").upsert(
                {
                    "dedupe_key": c.dedupe_key,
                    "title": c.title,
                    "description": c.description,
                    "origin": "scout",
                    "kind": "vertical",
                    "evidence": list(c.evidence),
                    "confidence": c.confidence,
                    "status": "open",
                },
                on_conflict="dedupe_key",
            ).execute()
            filed += 1
        except Exception as exc:  # noqa: BLE001
            logger.error("file idea %s failed: %s", c.dedupe_key, exc)
    return filed


def main() -> None:
    from workers.stock_scanner.config import load_settings

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    settings = load_settings()
    repo = SupabaseRepository(settings)
    summary = run_scout_worker(settings, repo)
    logger.info("scout summary: %s", summary)
    if summary.get("status") == "failed":
        raise SystemExit("scout worker failed: " + str(summary.get("error")))


if __name__ == "__main__":
    main()
