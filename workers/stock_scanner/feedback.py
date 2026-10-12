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

import functools
import json
import re
from pathlib import Path
from typing import Any

import requests

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


def taps_reach_the_webhook(sending_token: str, app_bot_token: str) -> bool:
    """A tap is delivered to the bot that sent the message, and only the app's bot (TELEGRAM_BOT_TOKEN)
    has its webhook pointed at Lyra. The operator's messages go out through SUMMARY_TELEGRAM_* (in
    production a copy of the app bot's token, so the two match); if they were ever a different bot,
    its buttons would collect taps nobody receives - so they are left off instead."""
    return bool(sending_token) and sending_token == app_bot_token


@functools.lru_cache(maxsize=4)
def webhook_takes_taps(app_bot_token: str) -> bool:
    """Whether Telegram is delivering button taps to the app bot's webhook right now. Buttons on a
    message sent before `npm run telegram:webhook` added "callback_query" would spin and do nothing,
    so a worker asks first (once per run) and sends without buttons until the answer is yes. Any
    failure answers no; nothing about the call is logged, because its URL carries the token."""
    if not app_bot_token:
        return False
    try:
        info = requests.get(f"https://api.telegram.org/bot{app_bot_token}/getWebhookInfo", timeout=10).json().get("result") or {}
    except Exception:  # noqa: BLE001 - no answer means no buttons, never a failed send
        return False
    if not info.get("url"):
        return False
    allowed = info.get("allowed_updates")
    return not allowed or "callback_query" in allowed


def buttons_live(sending_token: str, app_bot_token: str) -> bool:
    """Buttons go on a message only when a tap on them will reach Lyra: sent through the app bot,
    and the app bot's webhook takes taps."""
    return taps_reach_the_webhook(sending_token, app_bot_token) and webhook_takes_taps(app_bot_token)


def last_part_markup(index: int, total: int, generation_id: str | None) -> dict[str, Any] | None:
    """Buttons go under the last part of a split message only, where the reader finishes."""
    return vote_keyboard(generation_id) if index == total - 1 else None
