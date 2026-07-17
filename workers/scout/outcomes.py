"""
Outcome stamping - the scout's learning half (v3). Verdicts stop evaporating.

A nightly pass reads scout cards a human has DECIDED (accepted into the build ladder or
declined as noise) and turns each verdict into deterministic feedback, exactly once:

  - accepted cards CREDIT every source whose evidence backed them; declined cards DEBIT
    them (scout_source_scores - the earned leaderboard that drives registry curation)
  - declined vertical entities join scout_stoplist, so the same noise can never re-file
  - the card is marked stamped_at, so a verdict is only ever counted once

All counts - no model opinion. The scout notices, humans decide, the bookkeeping learns.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from workers.stock_scanner.supabase_repo import SupabaseRepository

logger = logging.getLogger(__name__)

# A card moved onto the build ladder counts as accepted; only an explicit decline debits.
# 'open' is undecided and never stamped. A later planned->shipped move does not restamp
# (stamped_at gates the pass), so each verdict is credited exactly once - a post-stamp
# reversal (planned -> declined) is rare enough that we accept the first verdict standing.
ACCEPT_STATUSES = ("planned", "in_progress", "shipped")
DECLINE_STATUSES = ("declined",)

STOPLIST_PREFIXES = ("scout-vertical-", "scout-gap-")


def stamp_outcomes(repo: SupabaseRepository) -> dict[str, int]:
    """Process every decided-but-unstamped scout card. Returns counts for the summary.
    Best-effort per card: one bad row must not lose the night's other verdicts."""
    out = {"stamped": 0, "credited": 0, "debited": 0, "stoplisted": 0}
    try:
        result = (
            repo.client.table("community_ideas")
            .select("id, title, status, kind, dedupe_key, evidence")
            .eq("origin", "scout")
            .is_("stamped_at", "null")
            .in_("status", list(ACCEPT_STATUSES + DECLINE_STATUSES))
            .limit(200)
            .execute()
        )
        cards = result.data or []
    except Exception as exc:  # noqa: BLE001 - stamping must never take down the run
        logger.error("load decided scout cards failed: %s", exc)
        return out

    for card in cards:
        try:
            accepted = card["status"] in ACCEPT_STATUSES
            _score_sources(repo, card, accepted=accepted, out=out)
            if not accepted and card.get("kind") in ("vertical", "content-gap"):
                _stoplist_entity(repo, card, out)
            repo.client.table("community_ideas").update(
                {"stamped_at": datetime.now(tz=timezone.utc).isoformat()}
            ).eq("id", card["id"]).execute()
            out["stamped"] += 1
        except Exception as exc:  # noqa: BLE001
            logger.error("stamp card %s failed: %s", card.get("id"), exc)
    if out["stamped"]:
        logger.info("outcomes stamped: %s", out)
    return out


def _score_sources(repo: SupabaseRepository, card: dict, accepted: bool, out: dict) -> None:
    """Credit/debit each source once per evidence appearance on this card."""
    counts: dict[str, int] = {}
    for ev in card.get("evidence") or []:
        source_id = str(ev.get("sourceId") or "").strip()
        if source_id:
            counts[source_id] = counts.get(source_id, 0) + 1
    for source_id, n in counts.items():
        existing = (
            repo.client.table("scout_source_scores")
            .select("accepted, declined")
            .eq("source_id", source_id)
            .maybe_single()
            .execute()
        )
        row = getattr(existing, "data", None) or {"accepted": 0, "declined": 0}
        repo.client.table("scout_source_scores").upsert(
            {
                "source_id": source_id,
                "accepted": int(row.get("accepted") or 0) + (n if accepted else 0),
                "declined": int(row.get("declined") or 0) + (0 if accepted else n),
                "updated_at": datetime.now(tz=timezone.utc).isoformat(),
            },
            on_conflict="source_id",
        ).execute()
        out["credited" if accepted else "debited"] += n


def _stoplist_entity(repo: SupabaseRepository, card: dict, out: dict) -> None:
    """A declined vertical's or content-gap's entity can never re-file: slug joins the stoplist."""
    dedupe_key = str(card.get("dedupe_key") or "")
    prefix = next((p for p in STOPLIST_PREFIXES if dedupe_key.startswith(p)), None)
    if prefix is None:
        return
    slug = dedupe_key[len(prefix):]
    entity = (
        str(card.get("title") or "")
        .removeprefix("Emerging signal: ")
        .removeprefix("Content gap: ")
        .strip()
        or slug
    )
    repo.client.table("scout_stoplist").upsert(
        {"slug": slug, "entity": entity, "dedupe_key": dedupe_key},
        on_conflict="slug",
    ).execute()
    out["stoplisted"] += 1


def load_attach_exceptions(repo: SupabaseRepository) -> frozenset[tuple[str, str]]:
    """(theme, term) pairs a maintainer ruled must never attach - enforced by attach().
    Empty on any failure: a missed exception degrades to one more night of a known
    mis-attach, never a crash."""
    try:
        result = repo.client.table("scout_attach_exceptions").select("theme, term").limit(2000).execute()
        return frozenset((str(r["theme"]), str(r["term"]).lower()) for r in (result.data or []))
    except Exception as exc:  # noqa: BLE001
        logger.error("load attach exceptions failed: %s", exc)
        return frozenset()


def load_stoplist(repo: SupabaseRepository) -> set[str]:
    """Slugs the clusterer must never promote or drumbeat again. Empty on any failure -
    a missed stoplist degrades to a re-filed card a human declines again, never a crash."""
    try:
        result = repo.client.table("scout_stoplist").select("slug").limit(5000).execute()
        return {row["slug"] for row in (result.data or [])}
    except Exception as exc:  # noqa: BLE001
        logger.error("load stoplist failed: %s", exc)
        return set()
