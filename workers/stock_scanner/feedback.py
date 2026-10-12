"""The feedback buttons under every message the workers send.

Each message Lyra sends to a chat - the daily read, the AI briefing (the operator's copy and every
Telegram subscriber's), the morning guide - ends with two buttons, 👍 Useful and 👎 Not for me.
A tap reaches the web app's Telegram webhook (src/app/api/webhooks/telegram/route.ts), which
records it against the generation the message came from (content_feedback, migration 060), swaps
the buttons for six reasons that are the nightly review's six pillars, and records the reason too.
A reader's reply to the message is kept as a note on the same generation.

The workers only build the first keyboard; everything after the first tap is the webhook's. Both
read one contract, contracts/feedback/telegram-feedback.json, so the button text and the
callback_data grammar (`fb:<generation id>:<step>[:<pillar>]`) cannot drift between them.

A keyboard is attached only to a message whose generation row was written (generation_record.py):
a button that pointed at a row that does not exist would collect feedback about nothing.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

CONTRACT: dict[str, Any] = json.loads((Path(__file__).resolve().parents[2] / "contracts" / "feedback" / "telegram-feedback.json").read_text())
PREFIX: str = CONTRACT["prefix"]
_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
CALLBACK_DATA_LIMIT = 64  # Telegram's limit on callback_data, in bytes


def vote_keyboard(generation_id: str | None) -> dict[str, Any] | None:
    """The 👍 / 👎 row for a message, or None when there is no recorded generation to point at."""
    if not generation_id or not _UUID_RE.match(generation_id):
        return None
    row = []
    for button in CONTRACT["vote"]:
        data = f"{PREFIX}:{generation_id}:{button['step']}"
        if len(data.encode()) > CALLBACK_DATA_LIMIT:  # cannot happen with a uuid; never send a keyboard Telegram rejects
            return None
        row.append({"text": button["text"], "callback_data": data})
    return {"inline_keyboard": [row]}


def last_part_markup(index: int, total: int, generation_id: str | None) -> dict[str, Any] | None:
    """Buttons go under the last part of a split message only, where the reader finishes."""
    return vote_keyboard(generation_id) if index == total - 1 else None
