"""How a briefing is written for a phone: the HTML pieces the operator's briefing and every
subscriber's copy share - one item, the theme sections, the standing desks - and the split that
keeps each Telegram message under the limit.

Pure text - no network, no clock. Every string a reader sees passes through `h()` so the markup
Telegram parses can never be broken by a quote in a headline (Telegram rejects the whole message
on malformed markup)."""

from __future__ import annotations

import html

from workers.stock_scanner.briefing_guard import STANDING_DESKS, BriefingItem

# Theme slug -> (emoji, heading). The slugs are the app's own (src/lib/generated/themes.json), so a
# heading here is a /themes page there; the emojis are the ones those pages use.
THEME_STYLE: dict[str, tuple[str, str]] = {
    "agi-infrastructure": ("🤖", "AI labs and infrastructure"),
    "semiconductors": ("💾", "Semiconductors"),
    "power-grid": ("⚡", "Power grid"),
    "nuclear-uranium": ("☢️", "Nuclear and uranium"),
    "critical-minerals": ("⛏️", "Critical minerals"),
    "robotics-automation": ("🦾", "Robotics and automation"),
    "quantum-computing": ("⚛️", "Quantum computing"),
    "space-economy": ("🚀", "Space economy"),
    "defence-drones": ("🛡️", "Defence and drones"),
    "cybersecurity": ("🔐", "Cybersecurity"),
    "other": ("🧭", "Elsewhere in tech"),
}
# Desk -> (emoji, heading). Every standing desk prints every night: its items, or its one-line note.
DESK_STYLE: dict[str, tuple[str, str]] = {
    "ipo": ("📜", "IPOs and filings"),
    "venture": ("💸", "Venture"),
    "government": ("🏛️", "Government money"),
    "small_cap": ("🔬", "Small caps"),
}
DEFAULT_DESK_NOTE = "Nothing new found tonight."
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


def theme_label(theme: str) -> str:
    return THEME_STYLE.get(theme, THEME_STYLE["other"])[1]


def desk_label(desk: str) -> str:
    return DESK_STYLE[desk][1]


def item_html(item: BriefingItem) -> str:
    emoji, _label = THEME_STYLE.get(item.theme, THEME_STYLE["other"])
    tags = [tag for tag, on in (("private", not item.listed), ("catch-up", item.catch_up)) if on]
    head = f"{emoji} <b>{h(item.headline)}</b>" + (f" <i>({', '.join(tags)})</i>" if tags else "")
    lines = [head, h(item.what_happened), f"<i>Why it matters:</i> {h(item.why_it_matters)}", f"<i>Risks:</i> {h(item.risks)}"]
    if item.not_disclosed:
        lines.append(f"<i>Not disclosed:</i> {h(item.not_disclosed)}")
    lines.append(" · ".join(f'<a href="{h(source.url)}">{h(source.label)}</a>' for source in item.sources))
    return "\n".join(lines)


def grouped_parts(
    items: list[BriefingItem],
    desk_notes: dict[str, str],
    *,
    themes_first: tuple[str, ...] = (),
    desks: tuple[str, ...] = STANDING_DESKS,
) -> list[str]:
    """The briefing's body as message parts: a section per theme that has items (the reader's own
    themes first, then the spine's order), each heading welded to its first item so the split never
    strands a heading; then every desk in `desks`, with its items or its one-line note. An item
    whose desk is not shown still appears under its theme - a checked item is never hidden."""
    shown = [desk for desk in desks if desk in DESK_STYLE]
    by_theme = [item for item in items if item.desk not in shown]
    order = [theme for theme in themes_first if theme in THEME_STYLE] + [theme for theme in THEME_STYLE if theme not in themes_first]
    parts: list[str] = []
    for theme in order:
        members = [item for item in by_theme if item.theme == theme]
        if not members:
            continue
        emoji, label = THEME_STYLE[theme]
        parts.append(f"{emoji} <b>{h(label)}</b>\n\n" + item_html(members[0]))
        parts.extend(item_html(item) for item in members[1:])
    for desk in shown:
        emoji, label = DESK_STYLE[desk]
        members = [item for item in items if item.desk == desk]
        if members:
            parts.append(f"{emoji} <b>{h(label)}</b>\n\n" + item_html(members[0]))
            parts.extend(item_html(item) for item in members[1:])
        else:
            parts.append(f"{emoji} <b>{h(label)}:</b> {h(desk_notes.get(desk) or DEFAULT_DESK_NOTE)}")
    return parts


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
