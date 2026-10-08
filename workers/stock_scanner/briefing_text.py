"""How a briefing item is written for a phone: the HTML pieces the operator's briefing and every
subscriber's copy share, and the split that keeps each Telegram message under the limit.

Pure text - no network, no clock. Every string a reader sees passes through `h()` so the markup
Telegram parses can never be broken by a quote in a headline (Telegram rejects the whole message
on malformed markup)."""

from __future__ import annotations

import html

from workers.stock_scanner.briefing_guard import BriefingItem

CATEGORY_STYLE = {
    "investment": ("💰", "investment"),
    "infrastructure": ("⚡", "infrastructure"),
    "ai_release": ("🧠", "AI release"),
    "emerging": ("🌱", "emerging"),
    "developer": ("🛠️", "developer"),
}
TELEGRAM_LIMIT = 3_800  # Telegram's hard limit is 4,096; split at item boundaries well before it


def h(text: str) -> str:
    return html.escape(text, quote=True)


def short_name(item: BriefingItem) -> str:
    return item.headline.split(" (")[0].strip()


def first_sentence(text: str) -> str:
    for end in (". ", "; "):
        cut = text.find(end)
        if 0 < cut < 220:
            return text[:cut].rstrip(" ;,.") + "."
    return text if len(text) <= 220 else text[:219].rstrip() + "…"


def item_html(item: BriefingItem) -> str:
    emoji, _label = CATEGORY_STYLE[item.category]
    tags = [tag for tag, on in (("private", not item.listed), ("catch-up", item.catch_up)) if on]
    head = f"{emoji} <b>{h(item.headline)}</b>" + (f" <i>({', '.join(tags)})</i>" if tags else "")
    lines = [head, h(item.what_happened), f"<i>Why it matters:</i> {h(item.why_it_matters)}", f"<i>Risks:</i> {h(item.risks)}"]
    if item.not_disclosed:
        lines.append(f"<i>Not disclosed:</i> {h(item.not_disclosed)}")
    lines.append(" · ".join(f'<a href="{h(source.url)}">{h(source.label)}</a>' for source in item.sources))
    return "\n".join(lines)


def split_messages(parts: list[str], limit: int = TELEGRAM_LIMIT) -> list[str]:
    """Join parts with blank lines into as few messages as fit under `limit`, never cutting a part.
    The first part (the header) stays with the first message and the last (the footer) with the last."""
    messages: list[str] = []
    current = ""
    for part in parts:
        candidate = part if not current else f"{current}\n\n{part}"
        if current and len(candidate) > limit:
            messages.append(current)
            current = part
        else:
            current = candidate
    if current:
        messages.append(current)
    return messages
