"""The free market read: facts from the app, prose from an open model, published back to the app.

    LYRA_APP_URL=https://solo.lyra.vivacityai.com.au UPDATES_PUBLISH_SECRET=... \\
    OPEN_MODEL_CHAIN="local:gemma-4-e4b-qat" python -m workers.stock_scanner.free_daily_read

Runs from `.github/workflows/free-daily-read.yml` after each US close. It needs no database and no
paid key - the founder asked on 2026-11-06 for Lyra's updates to be free, and this is how:

  1. The APP decides what is true. `GET /api/updates/facts` returns every scanned name's last
     completed session, scored by the same engine as the screen (src/lib/updates/facts.ts).
  2. CODE composes the figures. `build_facts` -> `build_sheet` -> `figure_sections`: the same
     functions the paid daily read used, unchanged.
  3. A MODEL writes two paragraphs from the fact sheet - the first in OPEN_MODEL_CHAIN whose read
     passes `guard_ai_read` (free_read.narrate_open). With no model, or none that passes, the
     update is the figures alone, and says so.
  4. The APP checks it again. `POST /api/updates/publish` is signed, must quote the hash of the
     facts the app served, and runs the app's own guard on the prose before anything is stored.

The log carries counts, labels and reasons only - never the read, a figure or a URL: this
repository's Actions logs are public.

Env: LYRA_APP_URL (the app; the no-account deployment until the main site is one), UPDATES_PUBLISH_SECRET,
OPEN_MODEL_CHAIN (default: Lyra's own model), FREE_READ_REHEARSAL=1 (check everything, store where
no reader looks), FREE_READ_REPLACE=1 (publish again for a session that has its read),
FREE_READ_CHECK=1 (only ask the app whether a read is needed and say so in $GITHUB_OUTPUT, so the
workflow starts a model only when there is something to write).
"""
from __future__ import annotations

import html
import os
import re
import sys
import time
from types import SimpleNamespace
from typing import Any

from workers.stock_scanner.app_client import AppError, fetch_facts, publish
from workers.stock_scanner.daily_read import build_facts, build_sheet, figure_sections
from workers.stock_scanner.free_read import narrate_open
from workers.stock_scanner.logger import get_logger
from workers.stock_scanner.open_model import chain_from_env, parse_chain

LOGGER = get_logger("stock_scanner.free_daily_read")

DEFAULT_APP_URL = "https://solo.lyra.vivacityai.com.au"
# Lyra's own copy, served on the runner (.github/actions/local-model) - the floor that depends on
# nobody's free allowance. Chosen by the bake-offs of 2026-11-06/07: the one small model that wrote
# no factual slip in 24 reads, allowed to think.
DEFAULT_CHAIN = "local:gemma-4-e4b-qat"
# The engine's thresholds, as the no-account app applies them (src/lib/live-signals.ts).
THRESHOLDS = SimpleNamespace(alert_score_threshold=75, watchlist_score_threshold=60)

NO_MODEL_NOTE = "No model could write the read for this session, so only the figures are shown."
GUARD_NOTE = "The written read did not pass Lyra's checks, so only the figures are shown."

_TAG_RE = re.compile(r"<[^>]+>")


def figure_blocks(sections: list[str]) -> list[dict[str, Any]]:
    """The figures as the Updates page shows them: `figure_sections` writes Telegram HTML (a bold
    heading line, then lines); here the tags come off and the heading becomes the title."""
    blocks: list[dict[str, Any]] = []
    for section in sections:
        lines = [html.unescape(_TAG_RE.sub("", line)).strip() for line in section.split("\n")]
        lines = [line for line in lines if line]
        if not lines:
            continue
        blocks.append({"title": lines[0], "lines": lines[1:]})
    return blocks


def compose_read(facts: Any, session: str, facts_hash: str, chain: list[Any], *, rehearsal: bool, replace: bool) -> tuple[dict[str, Any], list[tuple[str, str]]]:
    """Everything the app is sent for one session, and what each model in the chain did."""
    sheet = build_sheet(facts)
    narration, tried = narrate_open(sheet, chain) if chain else (None, [])
    prose = narration.text if narration and narration.text else None
    if prose:
        note = None
        writer = {"provider": narration.provider, "model": narration.model}
    else:
        blocked = narration is not None and narration.reason == "guard_blocked"
        note = GUARD_NOTE if blocked else NO_MODEL_NOTE
        writer = None
    read = {
        "kind": "market_read",
        "session": session,
        "factsHash": facts_hash,
        "sheet": sheet.text,
        "figures": figure_blocks(figure_sections(facts)),
        "prose": prose,
        "proseNote": note,
        "writer": writer,
        "rehearsal": rehearsal,
        "replace": replace,
    }
    return read, tried


def needs_read(published: bool, *, rehearsal: bool, replace: bool) -> bool:
    """A session with its read gets nothing more - unless this is a rehearsal or a replacement."""
    return not published or rehearsal or replace


def write_outputs(values: dict[str, str], path: str | None) -> None:
    """Tell the workflow what the check found ($GITHUB_OUTPUT). Dates, counts and flags only."""
    if not path:
        return
    with open(path, "a", encoding="utf-8") as handle:
        for key, value in values.items():
            handle.write(f"{key}={value}\n")


def main() -> int:
    started = time.monotonic()
    base_url = os.environ.get("LYRA_APP_URL", "").strip() or DEFAULT_APP_URL
    secret = os.environ.get("UPDATES_PUBLISH_SECRET", "").strip()
    rehearsal = os.environ.get("FREE_READ_REHEARSAL") == "1"
    replace = os.environ.get("FREE_READ_REPLACE") == "1"
    check_only = os.environ.get("FREE_READ_CHECK") == "1"
    if not secret:
        LOGGER.error("UPDATES_PUBLISH_SECRET is not set - nothing can be published")
        return 2

    try:
        facts_payload = fetch_facts(base_url)
    except AppError as exc:
        LOGGER.error("the app did not serve the facts: %s (status %s)", exc.reason, exc.status)
        return 1
    LOGGER.info("facts for session %s: %d rows of %d listed, published already=%s", facts_payload.session, len(facts_payload.rows), facts_payload.listed, facts_payload.published)
    needed = needs_read(facts_payload.published, rehearsal=rehearsal, replace=replace)
    if check_only:
        write_outputs({"needed": "true" if needed else "false", "session": facts_payload.session}, os.environ.get("GITHUB_OUTPUT"))
        LOGGER.info("check only: a read is %s for session %s", "needed" if needed else "not needed", facts_payload.session)
        return 0
    if not needed:
        LOGGER.info("this session already has its read - nothing to do")
        return 0

    facts = build_facts(facts_payload.rows, THRESHOLDS, daily=True)
    if facts is None:
        LOGGER.error("the rows did not make a session (too few names agree on one) - no read")
        return 1

    chain = chain_from_env() or parse_chain(DEFAULT_CHAIN)
    read, tried = compose_read(facts, facts_payload.session, facts_payload.hash, chain, rehearsal=rehearsal, replace=replace)
    for spec, reason in tried:
        LOGGER.info("writer %s: %s", spec, reason)
    LOGGER.info("read composed: prose=%s, figure blocks=%d, %.0fs so far", read["prose"] is not None, len(read["figures"]), time.monotonic() - started)

    try:
        answer = publish(base_url, secret, read)
    except AppError as exc:
        LOGGER.error("the app refused the read: %s (status %s)", exc.reason, exc.status)
        return 1
    LOGGER.info(
        "%s for session %s: prose kept by the app=%s, %.0fs in all",
        "rehearsed" if rehearsal else "published",
        answer.get("session"),
        answer.get("prose"),
        time.monotonic() - started,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
