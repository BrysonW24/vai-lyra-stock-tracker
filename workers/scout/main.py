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
from workers.scout.cluster import IdeaCandidate, cluster_unmapped, drumbeats
from workers.scout.providers import ScoutItem, demo_items, fetch_source
from workers.scout.sources import active_sources, gated_sources, load_sources
from workers.stock_scanner.config import Settings
from workers.stock_scanner.supabase_repo import SupabaseRepository

logger = logging.getLogger(__name__)

MAX_ITEMS_PER_RUN = 400
# Clustering reads a trailing window of unmapped items - the accumulating drumbeat.
WINDOW_DAYS = 14
# Sized ~3x current volume (~110 unmapped/night x 14 days). If a read ever fills it,
# the run says so loudly (window_saturated) instead of silently weakening clustering.
WINDOW_LIMIT = 5000
# scout_items is the drumbeat accumulator, not an archive: rows far beyond the clustering
# window are dead weight (~2k rows/week unbounded), so the nightly run prunes them.
RETENTION_DAYS = 90


def run_scout_worker(settings: Settings, repo: SupabaseRepository) -> dict[str, Any]:
    summary: dict[str, Any] = {
        "status": "running",
        "sources_active": 0,
        "sources_gated": 0,
        "items_fetched": 0,
        "items_persisted": 0,
        "items_pruned": 0,
        "items_unmapped": 0,
        "idea_candidates": 0,
        "ideas_filed": 0,
        "window_saturated": False,
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

        # ONE pipeline for live and demo - mode only changes the window and the sinks.
        # This function once held two cluster paths, and a refactor of the live one left
        # the demo branch referencing a variable it never computed (UnboundLocalError on
        # every keyless run). Demo mode doubles every code path it forks; so don't fork.
        window: list[ScoutItem] = []
        if repo.client:
            summary["items_persisted"] = _persist_items(repo, items, attachments)
            summary["items_pruned"] = _prune_old_items(repo)
            # Cluster over the trailing WINDOW, not just tonight's pull: an emerging
            # vertical announces itself as a drumbeat across days, and a single night
            # rarely carries three independent hits on its own.
            window = _load_recent_unmapped(repo, days=WINDOW_DAYS)
            if len(window) >= WINDOW_LIMIT:
                # A silently truncated window weakens clustering with no error anywhere -
                # a green that cannot go red. Say so where the nightly log is read.
                summary["window_saturated"] = True
                logger.error(
                    "drumbeat window SATURATED at %d rows - oldest unmapped items are being "
                    "dropped; raise WINDOW_LIMIT or shorten WINDOW_DAYS",
                    WINDOW_LIMIT,
                )
        pool = {i.id: i for i in window}
        for i in unmapped:
            pool.setdefault(i.id, i)
        candidates = cluster_unmapped(list(pool.values()))
        summary["idea_candidates"] = len(candidates)

        # The visible patience: below-bar clusters still building toward promotion, and
        # tonight's per-theme attach counts - both feed the "what the scout saw" surface.
        beats = drumbeats(list(pool.values()), promoted=candidates)
        summary["drumbeats"] = len(beats)
        theme_counts: dict[str, int] = {}
        for item in items:
            for theme in attachments[item.id].matched_themes:
                theme_counts[theme] = theme_counts.get(theme, 0) + 1

        if repo.client:
            summary["ideas_filed"] = _file_ideas(repo, candidates)
            _record_run(repo, summary, theme_counts, beats)
        else:
            logger.info("demo mode: %d items, %d idea candidates (not persisted)", len(items), len(candidates))
            for c in candidates:
                logger.info("candidate: %s (confidence %d, %d evidence)", c.title, c.confidence, len(c.evidence))

        # A run that saw work and stored NONE of it has failed, however cleanly each
        # helper "handled" its own error. Without these guards the 42P10 partial-index
        # bug on community_ideas.dedupe_key (043, fixed in 046) rejected every filed
        # idea while this function reported ok and the nightly stayed green.
        if repo.client and summary["items_fetched"] > 0 and summary["items_persisted"] == 0:
            raise RuntimeError(
                f"fetched {summary['items_fetched']} items but persisted 0 - "
                "every scout_items write was rejected (see the errors above)"
            )
        if repo.client and summary["idea_candidates"] > 0 and summary["ideas_filed"] == 0:
            raise RuntimeError(
                f"clustered {summary['idea_candidates']} idea candidates but filed 0 - "
                "every community_ideas upsert was rejected (see the errors above)"
            )

        summary["status"] = "ok"
        return summary
    except Exception as exc:  # noqa: BLE001
        logger.exception("scout worker failed")
        summary["status"] = "failed"
        summary["error"] = str(exc)
        return summary


def _load_recent_unmapped(repo: SupabaseRepository, days: int = WINDOW_DAYS) -> list[ScoutItem]:
    """Trailing unmapped items from the store - the accumulating drumbeat window.

    Ordered newest-first so that IF the read ever fills WINDOW_LIMIT, what falls off is the
    oldest signal (the caller flags saturation loudly) - unordered, Postgres would drop
    arbitrary rows and the degradation would be both silent and random."""
    try:
        since = (datetime.now(tz=timezone.utc) - timedelta(days=days)).isoformat()
        result = (
            repo.client.table("scout_items")
            .select("id, source_id, source_kind, url, title, summary, published_at")
            .eq("unmapped", True)
            .gte("created_at", since)
            .order("created_at", desc=True)
            .limit(WINDOW_LIMIT)
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


def _prune_old_items(repo: SupabaseRepository, days: int = RETENTION_DAYS) -> int:
    """Retention: drop scout_items far beyond the clustering window. Without this the table
    grows unbounded (~2k rows/week) and every window read scans ever more dead history.
    A failed prune degrades to growth for one night - it never blocks the run."""
    try:
        cutoff = (datetime.now(tz=timezone.utc) - timedelta(days=days)).isoformat()
        result = repo.client.table("scout_items").delete().lt("created_at", cutoff).execute()
        pruned = len(result.data or [])
        if pruned:
            logger.info("pruned %d scout_items older than %d days", pruned, days)
        return pruned
    except Exception as exc:  # noqa: BLE001
        logger.error("prune scout_items failed: %s", exc)
        return 0


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


def _source_names() -> dict[str, str]:
    """Registry id -> human source name, so evidence links can say who reported it."""
    try:
        return {s.id: s.name for s in load_sources()}
    except Exception as exc:  # noqa: BLE001
        logger.error("load source names failed: %s", exc)
        return {}


def _file_ideas(repo: SupabaseRepository, candidates: list[IdeaCandidate]) -> int:
    """Upsert scout ideas by dedupe_key - a recurring cluster refreshes its card
    (evidence + confidence) instead of stacking duplicates. Human rows are untouched.
    Evidence is enriched with the source's display name at filing time (the card must be
    self-verifying: '2 independent sources' means naming them, not trusting registry ids)."""
    names = _source_names()
    filed = 0
    for c in candidates:
        try:
            evidence = [
                {**e, "sourceName": names.get(str(e.get("sourceId")), str(e.get("sourceId") or ""))}
                for e in c.evidence
            ]
            repo.client.table("community_ideas").upsert(
                {
                    "dedupe_key": c.dedupe_key,
                    "title": c.title,
                    "description": c.description,
                    "origin": "scout",
                    "kind": "vertical",
                    "evidence": evidence,
                    "confidence": c.confidence,
                    "status": "open",
                },
                on_conflict="dedupe_key",
            ).execute()
            filed += 1
        except Exception as exc:  # noqa: BLE001
            logger.error("file idea %s failed: %s", c.dedupe_key, exc)
    return filed


def _record_run(repo: SupabaseRepository, summary: dict[str, Any], theme_counts: dict[str, int], beats: list[dict]) -> None:
    """One ledger row per run so the product can show what the scout saw. Best-effort:
    a failed insert loses one night of feed history, never the run."""
    try:
        repo.client.table("scout_runs").insert(
            {
                "items_fetched": summary["items_fetched"],
                "items_persisted": summary["items_persisted"],
                "items_unmapped": summary["items_unmapped"],
                "ideas_filed": summary["ideas_filed"],
                "sources_active": summary["sources_active"],
                "sources_gated": summary["sources_gated"],
                "window_saturated": summary["window_saturated"],
                "theme_counts": theme_counts,
                "drumbeats": beats,
            }
        ).execute()
    except Exception as exc:  # noqa: BLE001
        logger.error("record scout run failed: %s", exc)


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
