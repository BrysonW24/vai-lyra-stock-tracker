"""
Chat gap-miner - the ideas board's second AI writer.

chat_turns stores what consenting users actually ASK the copilot (opt-in via the same
twin-capture switch, owner-only rows). Recurring question topics that attach to NO
existing vertical are the content backlog writing itself: things people want from Lyra
that the vertical map does not cover.

Privacy is the design constraint, not an afterthought:
  - only aggregate TOPICS ever leave this module - a filed card carries the topic entity
    and counts, never a quote and never any user identity
  - the bar requires >= GAP_MIN_TURNS mentions from >= GAP_MIN_USERS DISTINCT users, so
    one person's pet topic can never become a public card
  - rows only exist for users who opted into capture; mining stays within that consent

Same deterministic machinery as the news scout: entity extraction from cluster.py, a
recurrence bar, dedupe-keyed upserts (origin='scout', kind='content-gap'). Humans gate
everything on the board as usual.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from workers.scout.attach import attach
from workers.scout.cluster import _entities, slugify
from workers.stock_scanner.supabase_repo import SupabaseRepository

logger = logging.getLogger(__name__)

GAP_WINDOW_DAYS = 30
GAP_MIN_TURNS = 3
GAP_MIN_USERS = 2
GAP_MAX_CARDS = 5
TURNS_LIMIT = 4000


def mine_content_gaps(repo: SupabaseRepository, stoplist: set[str] | None = None) -> int:
    """File content-gap cards from recurring unmapped chat topics. Returns cards filed."""
    stoplist = stoplist or set()
    try:
        since = (datetime.now(tz=timezone.utc) - timedelta(days=GAP_WINDOW_DAYS)).isoformat()
        result = (
            repo.client.table("chat_turns")
            .select("user_id, content")
            .eq("role", "user")
            .gte("created_at", since)
            .limit(TURNS_LIMIT)
            .execute()
        )
        turns = result.data or []
    except Exception as exc:  # noqa: BLE001 - mining must never take down the scout run
        logger.error("gap-miner: load chat turns failed: %s", exc)
        return 0
    if len(turns) >= TURNS_LIMIT:
        logger.error("gap-miner: turn window SATURATED at %d - raise TURNS_LIMIT", TURNS_LIMIT)

    # topic -> (mention count, distinct users). Content never leaves this dict.
    counts: dict[str, int] = {}
    users: dict[str, set[str]] = {}
    for turn in turns:
        text = str(turn.get("content") or "")
        for entity in _entities(text):
            slug = slugify(entity)
            if slug in stoplist:
                continue
            # A topic the vertical map already covers is not a gap.
            if not attach(entity, "").unmapped:
                continue
            counts[entity] = counts.get(entity, 0) + 1
            users.setdefault(entity, set()).add(str(turn.get("user_id")))

    ranked = sorted(
        (
            (entity, n, len(users[entity]))
            for entity, n in counts.items()
            if n >= GAP_MIN_TURNS and len(users[entity]) >= GAP_MIN_USERS
        ),
        key=lambda t: (-t[1], -t[2], t[0]),
    )[:GAP_MAX_CARDS]

    filed = 0
    for entity, n, distinct_users in ranked:
        try:
            repo.client.table("community_ideas").upsert(
                {
                    "dedupe_key": f"scout-gap-{slugify(entity)}",
                    "title": f"Content gap: {entity}",
                    "description": (
                        f"Users asked the copilot about '{entity}' {n} times across "
                        f"{distinct_users} different accounts in the last {GAP_WINDOW_DAYS} days, "
                        f"and it attaches to nothing in the vertical map. Counts only - no chat "
                        f"content is ever quoted. It may deserve coverage, a vertical, or a "
                        f"knowledge doc; nothing changes unless accepted."
                    ),
                    "origin": "scout",
                    "kind": "content-gap",
                    "evidence": [
                        {
                            "title": f"Asked {n} times by {distinct_users} users in the last {GAP_WINDOW_DAYS} days",
                            "url": None,
                            "sourceId": "chat-gap-miner",
                            "sourceName": "Copilot questions (aggregate)",
                        }
                    ],
                    "confidence": min(80, 20 + 10 * n + 5 * distinct_users),
                    "status": "open",
                },
                on_conflict="dedupe_key",
            ).execute()
            filed += 1
        except Exception as exc:  # noqa: BLE001
            logger.error("gap-miner: file card for %s failed: %s", entity, exc)
    if filed:
        logger.info("gap-miner: filed %d content-gap cards", filed)
    return filed
