"""The briefing's subscribe-by-link audience: who gets it, what each person's copy looks like, and the sends.

A subscriber is a row in `briefing_subscribers` (migration 059) made at /subscribe with no account:
what they hold, which topics, and a channel - Telegram (the chat id learnt from the bot's own
/start) or email (active once the confirmation link is opened). The research is shared; what is
personal is a deterministic re-cut of the same checked items - the ones that touch the reader's
holdings first, then their chosen themes ahead of the rest, then the standing desks they asked for
(all four when they chose none) - plus a one-line "for you" summary. No number and no sentence is
written per person, so personalising costs nothing and can never invent a fact.

Topics are the briefing's own spine: the theme slugs (src/lib/generated/themes.json, mirrored in
briefing_text.THEME_STYLE), the four standing desks, and "holdings" (= only items that touch what
I hold). The /subscribe page offers the same list (src/lib/subscribe.ts).

Telegram sends use the app's bot (TELEGRAM_BOT_TOKEN - the bot /subscribe deep-links to), email
goes through Resend (RESEND_API_KEY) with a signed one-click unsubscribe. Each row carries its own
delivery ledger (last_sent_date, sent_count, last_error), so a resend firing never sends twice and
a person who blocked the bot is unsubscribed instead of retried for ever.

Logs carry counts and reasons only - never an address, a chat id or an item."""

from __future__ import annotations

import hashlib
import hmac
from dataclasses import dataclass
from datetime import date
from typing import Any

import requests

from workers.stock_scanner.briefing_guard import STANDING_DESKS, THEMES, BriefingItem
from workers.stock_scanner.briefing_text import (
    DEFAULT_DESK_NOTE,
    DESK_STYLE,
    TELEGRAM_LIMIT,
    THEME_STYLE,
    grouped_parts,
    h,
    item_html,
    short_name,
    split_messages,
)
from workers.stock_scanner.config import Settings
from workers.stock_scanner.logger import get_logger
from workers.stock_scanner.telegram import send_telegram_message

LOGGER = get_logger("stock_scanner.briefing_subscribers")

TABLE = "briefing_subscribers"
SUBSCRIBER_SELECT = "id,token,channel,email,telegram_chat_id,topics,holdings,status,last_sent_date,sent_count"
HOLDINGS_TOPIC = "holdings"
# What a subscriber may pick: every theme but "other", the standing desks, and holdings.
TOPICS = tuple(theme for theme in THEMES if theme != "other") + STANDING_DESKS + (HOLDINGS_TOPIC,)
TOPIC_LABELS: dict[str, str] = {**{theme: style[1] for theme, style in THEME_STYLE.items()}, **{desk: style[1] for desk, style in DESK_STYLE.items()}}
RESEND_ENDPOINT = "https://api.resend.com/emails"
DEFAULT_FROM_EMAIL = "Lyra <briefing@send.vivacityai.com.au>"
MAX_ERROR_CHARS = 160


# --------------------------------------------------------------------------------------------
# Who.


@dataclass(frozen=True)
class Subscriber:
    id: str
    token: str
    channel: str  # "telegram" | "email"
    email: str
    chat_id: str
    topics: tuple[str, ...]
    holdings: tuple[str, ...]
    last_sent_date: date | None = None
    sent_count: int = 0

    @property
    def destination(self) -> str:
        return self.chat_id if self.channel == "telegram" else self.email


def _symbols(raw: Any) -> tuple[str, ...]:
    if not isinstance(raw, (list, tuple)):
        return ()
    out: list[str] = []
    for value in raw:
        symbol = str(value or "").strip().upper()
        if symbol and symbol not in out:
            out.append(symbol)
    return tuple(out)


def parse_subscriber(raw: Any) -> Subscriber | None:
    """One row as the worker reads it; anything without an id, a channel and a destination is skipped."""
    if not isinstance(raw, dict) or not raw.get("id"):
        return None
    channel = str(raw.get("channel") or "")
    email = str(raw.get("email") or "").strip().lower()
    chat_id = str(raw.get("telegram_chat_id") or "").strip()
    destination = chat_id if channel == "telegram" else email if channel == "email" else ""
    if not destination:
        return None
    sent_raw = raw.get("last_sent_date")
    try:
        last_sent = date.fromisoformat(sent_raw) if isinstance(sent_raw, str) and sent_raw else None
    except ValueError:
        last_sent = None
    raw_topics = raw.get("topics") if isinstance(raw.get("topics"), (list, tuple)) else []
    topics = tuple(dict.fromkeys(str(topic) for topic in raw_topics if str(topic) in TOPICS))
    return Subscriber(
        id=str(raw["id"]),
        token=str(raw.get("token") or ""),
        channel=channel,
        email=email,
        chat_id=chat_id,
        topics=topics,
        holdings=_symbols(raw.get("holdings")),
        last_sent_date=last_sent,
        sent_count=int(raw.get("sent_count") or 0),
    )


def load_subscribers(client: Any) -> list[Subscriber]:
    """Every active subscriber. A missing table (migration 059 not applied yet) or any read error
    means no subscribers tonight - logged once, never a crash: the rest of the briefing still goes out."""
    try:
        result = client.table(TABLE).select(SUBSCRIBER_SELECT).eq("status", "active").order("created_at").limit(5000).execute()
    except Exception as exc:  # noqa: BLE001 - the audience is an extra on top of the briefing
        LOGGER.warning("could not read briefing subscribers (%s) - none tonight", type(exc).__name__)
        return []
    return [subscriber for subscriber in (parse_subscriber(row) for row in (result.data or [])) if subscriber]


# --------------------------------------------------------------------------------------------
# What each person's copy says.


@dataclass(frozen=True)
class PersonalBriefing:
    """The same checked items, cut for one reader: holdings hits first, then the rest under their
    themes (the reader's themes first), then the desks they asked for."""

    holdings_items: tuple[BriefingItem, ...]
    topic_items: tuple[BriefingItem, ...]
    matched: tuple[str, ...]
    note: str
    themes_first: tuple[str, ...] = ()
    desks: tuple[str, ...] = STANDING_DESKS

    @property
    def items(self) -> tuple[BriefingItem, ...]:
        return self.holdings_items + self.topic_items


def item_symbols(item: BriefingItem) -> set[str]:
    symbols = {symbol.upper() for symbol in item.lyra_symbols if symbol}
    if item.ticker:
        symbols.add(item.ticker.upper())
    return symbols


def personalise(items: list[BriefingItem], subscriber: Subscriber) -> PersonalBriefing:
    holdings = set(subscriber.holdings)
    hits = [item for item in items if item_symbols(item) & holdings]
    rest = [item for item in items if item not in hits]
    themes = tuple(topic for topic in subscriber.topics if topic in THEMES)
    desks = tuple(topic for topic in subscriber.topics if topic in STANDING_DESKS)
    holdings_only = HOLDINGS_TOPIC in subscriber.topics and not themes and not desks and bool(holdings)
    matched = tuple(sorted({symbol for item in hits for symbol in item_symbols(item) & holdings}))

    parts: list[str] = []
    if holdings and hits:
        parts.append(f"{len(hits)} item{'s' if len(hits) != 1 else ''} touch{'es' if len(hits) == 1 else ''} your holdings ({', '.join(matched)})")
    elif holdings:
        parts.append(f"nothing tonight touches your holdings ({', '.join(subscriber.holdings)})")
    if holdings_only:
        if rest:
            parts.append(f"{len(rest)} other item{'s' if len(rest) != 1 else ''} left out as you asked")
    elif themes or desks:
        in_topics = sum(1 for item in rest if item.theme in themes or item.desk in desks)
        labels = ", ".join(TOPIC_LABELS[topic] for topic in themes + desks)
        parts.append(f"{in_topics} in your topics ({labels})" if in_topics else f"nothing in your topics ({labels}) tonight; the rest follows")
    note = ("; ".join(parts) + ".") if parts else "Tonight's items, checked against their original sources."
    return PersonalBriefing(
        holdings_items=tuple(hits),
        topic_items=() if holdings_only else tuple(rest),
        matched=matched,
        note=note[0].upper() + note[1:],
        themes_first=themes,
        desks=() if holdings_only else (desks or STANDING_DESKS),
    )


def compose_subscriber_messages(personal: PersonalBriefing, *, day_label: str, desk_notes: dict[str, str], limit: int = TELEGRAM_LIMIT) -> list[str]:
    """One reader's Telegram briefing in HTML, split at item boundaries under the limit."""
    parts = [f"🗞️ <b>Lyra AI briefing</b> · {h(day_label)}\n<i>{h(personal.note)}</i>"]
    if personal.holdings_items:
        parts.append("📌 <b>Your holdings</b>\n\n" + "\n\n".join(item_html(item) for item in personal.holdings_items))
    parts.extend(grouped_parts(list(personal.topic_items), desk_notes, themes_first=personal.themes_first, desks=personal.desks))
    parts.append("Reply STOP to unsubscribe · Research, not advice.")
    return split_messages(parts, limit)


def email_subject(personal: PersonalBriefing, day_label: str) -> str:
    names = [short_name(item) for item in personal.items[:3]]
    more = len(personal.items) - len(names)
    return f"Lyra AI briefing · {day_label}: " + ", ".join(names) + (f" + {more} more" if more > 0 else "")


_HEADING_ROW = '<tr><td style="padding:18px 32px 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:{colour};font-weight:700;">{text}</td></tr>'


def _email_item(item: BriefingItem) -> str:
    emoji, _label = THEME_STYLE.get(item.theme, THEME_STYLE["other"])
    tags = [tag for tag, on in (("private", not item.listed), ("catch-up", item.catch_up)) if on]
    tag_html = f' <span style="font-size:12px;color:#8290a0;">({", ".join(tags)})</span>' if tags else ""
    rows = [
        f'<p style="margin:0 0 6px;font-size:15px;line-height:1.4;color:#0E1E3A;font-weight:600;">{emoji} {h(item.headline)}{tag_html}</p>',
        f'<p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#2b3a52;">{h(item.what_happened)}</p>',
        f'<p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#5A6B82;"><em>Why it matters:</em> {h(item.why_it_matters)}</p>',
        f'<p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#5A6B82;"><em>Risks:</em> {h(item.risks)}</p>',
    ]
    if item.not_disclosed:
        rows.append(f'<p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#5A6B82;"><em>Not disclosed:</em> {h(item.not_disclosed)}</p>')
    links = " &middot; ".join(f'<a href="{h(source.url)}" style="color:#1E63FF;">{h(source.label)}</a>' for source in item.sources)
    rows.append(f'<p style="margin:0;font-size:12px;line-height:1.6;color:#8290a0;">{links}</p>')
    return '<tr><td style="padding:14px 32px;border-top:1px solid #eef0f4;">' + "".join(rows) + "</td></tr>"


def _email_sections(personal: PersonalBriefing, desk_notes: dict[str, str]) -> tuple[list[str], list[str]]:
    """(html rows, text lines) for the body - the same grouping as the Telegram copy."""
    html_rows: list[str] = []
    text_lines: list[str] = []

    def section(emoji: str, label: str, members: list[BriefingItem], note: str = "", colour: str = "#5A6B82") -> None:
        html_rows.append(_HEADING_ROW.format(colour=colour, text=f"{emoji} {h(label)}"))
        text_lines.append(label.upper())
        if members:
            html_rows.extend(_email_item(item) for item in members)
            for item in members:
                text_lines.extend([item.headline, item.what_happened, f"Why it matters: {item.why_it_matters}", f"Risks: {item.risks}"])
                if item.not_disclosed:
                    text_lines.append(f"Not disclosed: {item.not_disclosed}")
                text_lines.append(" | ".join(f"{source.label}: {source.url}" for source in item.sources))
                text_lines.append("")
        else:
            html_rows.append(f'<tr><td style="padding:6px 32px 10px;font-size:14px;line-height:1.6;color:#2b3a52;">{h(note)}</td></tr>')
            text_lines.extend([note, ""])

    if personal.holdings_items:
        section("📌", "Your holdings", list(personal.holdings_items), colour="#1E63FF")
    shown = [desk for desk in personal.desks if desk in DESK_STYLE]
    by_theme = [item for item in personal.topic_items if item.desk not in shown]
    order = [theme for theme in personal.themes_first if theme in THEME_STYLE] + [theme for theme in THEME_STYLE if theme not in personal.themes_first]
    for theme in order:
        members = [item for item in by_theme if item.theme == theme]
        if members:
            emoji, label = THEME_STYLE[theme]
            section(emoji, label, members)
    for desk in shown:
        emoji, label = DESK_STYLE[desk]
        section(emoji, label, [item for item in personal.topic_items if item.desk == desk], note=desk_notes.get(desk) or DEFAULT_DESK_NOTE)
    return html_rows, text_lines


def compose_subscriber_email(personal: PersonalBriefing, *, day_label: str, desk_notes: dict[str, str], unsubscribe_url: str) -> tuple[str, str, str]:
    """(subject, html, text) for one reader - the same brand shell as the auth emails, every string escaped."""
    subject = email_subject(personal, day_label)
    html_rows, text_lines = _email_sections(personal, desk_notes)
    html_body = (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F6F2;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;">'
        '<tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #e7e9ef;overflow:hidden;">'
        '<tr><td style="height:4px;background-color:#1E63FF;background:linear-gradient(90deg,#3b5bdb,#43d18b,#f3a33a);">&nbsp;</td></tr>'
        '<tr><td style="padding:30px 32px 6px;"><span style="font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#0E1E3A;">Lyra</span><span style="font-size:12px;color:#8290a0;">&nbsp; by Vivacity.ai</span></td></tr>'
        f'<tr><td style="padding:6px 32px 14px;"><h1 style="margin:0;font-size:20px;line-height:1.25;color:#0E1E3A;font-weight:600;">🗞️ AI briefing · {h(day_label)}</h1>'
        f'<p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:#5A6B82;">{h(personal.note)}</p></td></tr>'
        + "".join(html_rows)
        + '<tr><td style="padding:22px 32px 30px;"><div style="border-top:1px solid #eef0f4;padding-top:16px;">'
        f'<p style="margin:0;font-size:11px;line-height:1.6;color:#9aa6b6;">Research, not advice. Every item was checked against the source it links to. '
        f'<a href="{h(unsubscribe_url)}" style="color:#5A6B82;">Unsubscribe</a> &middot; &copy; Vivacity.ai</p></div></td></tr>'
        "</table></td></tr></table>"
    )
    text = "\n".join([f"Lyra AI briefing - {day_label}", personal.note, ""] + text_lines + [f"Research, not advice. Unsubscribe: {unsubscribe_url}"])
    return subject, html_body, text


# --------------------------------------------------------------------------------------------
# Signed links - the same HMAC the API routes verify (src/lib/subscribe-server.ts).


def link_signature(secret: str, purpose: str, subscriber_id: str) -> str:
    return hmac.new(secret.encode("utf-8"), f"{purpose}:{subscriber_id}".encode("utf-8"), hashlib.sha256).hexdigest()[:32]


def unsubscribe_url(app_base_url: str, secret: str, subscriber_id: str) -> str:
    return f"{app_base_url.rstrip('/')}/api/subscribe/unsubscribe?id={subscriber_id}&sig={link_signature(secret, 'unsubscribe', subscriber_id)}"


# --------------------------------------------------------------------------------------------
# The sends.


@dataclass(frozen=True)
class EmailResult:
    sent_status: str  # "sent" | "failed" | "skipped"
    error_message: str | None = None


def send_email(*, api_key: str, from_email: str, to: str, subject: str, html_body: str, text: str, unsubscribe: str, post_fn: Any = requests.post) -> EmailResult:
    """One email through Resend. Never raises; never puts the key or the address in the result."""
    if not api_key:
        return EmailResult("skipped", "RESEND_API_KEY missing")
    body = {
        "from": from_email or DEFAULT_FROM_EMAIL,
        "to": [to],
        "subject": subject,
        "html": html_body,
        "text": text,
        "headers": {"List-Unsubscribe": f"<{unsubscribe}>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"},
    }
    try:
        response = post_fn(RESEND_ENDPOINT, json=body, headers={"Authorization": f"Bearer {api_key}", "content-type": "application/json"}, timeout=15)
    except Exception as exc:  # noqa: BLE001 - a transport failure is a failed send, not a crash
        return EmailResult("failed", f"resend {type(exc).__name__}")
    status = getattr(response, "status_code", 0)
    if 200 <= status < 300:
        return EmailResult("sent")
    detail = ""
    try:
        detail = str((response.json() or {}).get("message") or "")[:80]
    except Exception:  # noqa: BLE001 - a non-JSON error body is fine
        detail = ""
    return EmailResult("failed", f"resend HTTP {status}" + (f": {detail}" if detail else ""))


@dataclass(frozen=True)
class SubscriberDelivery:
    subscriber_id: str
    channel: str
    status: str  # "sent" | "failed" | "already" | "unsubscribed"
    error: str | None = None


@dataclass(frozen=True)
class SubscriberOutcome:
    attempted: int = 0
    reached: int = 0
    already: int = 0
    failed: int = 0
    unsubscribed: int = 0


def _stamp(client: Any, subscriber_id: str, row: dict[str, Any]) -> None:
    try:
        client.table(TABLE).update({**row, "updated_at": "now()"}).eq("id", subscriber_id).execute()
    except Exception as exc:  # noqa: BLE001 - the ledger stamp must not undo a delivered briefing
        LOGGER.warning("could not stamp a subscriber row (%s)", type(exc).__name__)


def mark_sent(client: Any, subscriber: Subscriber, today: date) -> None:
    _stamp(client, subscriber.id, {"last_sent_date": today.isoformat(), "sent_count": subscriber.sent_count + 1, "last_error": None})


def mark_failed(client: Any, subscriber: Subscriber, error: str) -> None:
    _stamp(client, subscriber.id, {"last_error": error[:MAX_ERROR_CHARS]})


def mark_unsubscribed(client: Any, subscriber: Subscriber, reason: str) -> None:
    _stamp(client, subscriber.id, {"status": "unsubscribed", "unsubscribe_reason": reason, "unsubscribed_at": "now()", "last_error": None})


def deliver_to_subscriber(
    subscriber: Subscriber,
    personal: PersonalBriefing,
    *,
    day_label: str,
    desk_notes: dict[str, str],
    settings: Settings,
    silent: bool,
) -> SubscriberDelivery:
    if subscriber.channel == "telegram":
        if not settings.telegram_bot_token:
            return SubscriberDelivery(subscriber.id, "telegram", "failed", "TELEGRAM_BOT_TOKEN missing")
        for message in compose_subscriber_messages(personal, day_label=day_label, desk_notes=desk_notes):
            delivery = send_telegram_message(message, settings, chat_id=subscriber.chat_id, silent=silent, parse_mode="HTML")
            if delivery.sent_status != "sent":
                error = delivery.error_message or "telegram send failed"
                # 403 = the person blocked the bot or deleted the chat: that is an unsubscribe, not a retry.
                if "HTTP 403" in error:
                    return SubscriberDelivery(subscriber.id, "telegram", "unsubscribed", error)
                return SubscriberDelivery(subscriber.id, "telegram", "failed", error)
        return SubscriberDelivery(subscriber.id, "telegram", "sent")

    secret = settings.subscribe_link_secret or settings.notification_dispatch_secret
    if not settings.app_base_url or not secret:
        return SubscriberDelivery(subscriber.id, "email", "failed", "APP_BASE_URL or the link secret missing - no unsubscribe link, so no email")
    link = unsubscribe_url(settings.app_base_url, secret, subscriber.id)
    subject, html_body, text = compose_subscriber_email(personal, day_label=day_label, desk_notes=desk_notes, unsubscribe_url=link)
    result = send_email(api_key=settings.resend_api_key, from_email=settings.briefing_from_email, to=subscriber.email, subject=subject, html_body=html_body, text=text, unsubscribe=link)
    if result.sent_status == "sent":
        return SubscriberDelivery(subscriber.id, "email", "sent")
    return SubscriberDelivery(subscriber.id, "email", "failed", result.error_message)


def deliver_to_subscribers(
    client: Any,
    subscribers: list[Subscriber],
    *,
    items: list[BriefingItem],
    day_label: str,
    desk_notes: dict[str, str],
    today: date,
    settings: Settings,
    silent: bool = False,
) -> SubscriberOutcome:
    """Send tonight's briefing to everyone who has not had today's yet, stamping each row as it goes.
    Idempotent per day: the resend firing (an undelivered operator/user leg) skips anyone already served."""
    attempted = reached = already = failed = unsubscribed = 0
    for subscriber in subscribers:
        if subscriber.last_sent_date == today:
            already += 1
            continue
        attempted += 1
        delivery = deliver_to_subscriber(subscriber, personalise(items, subscriber), day_label=day_label, desk_notes=desk_notes, settings=settings, silent=silent)
        if delivery.status == "sent":
            reached += 1
            mark_sent(client, subscriber, today)
        elif delivery.status == "unsubscribed":
            unsubscribed += 1
            mark_unsubscribed(client, subscriber, "blocked")
        else:
            failed += 1
            mark_failed(client, subscriber, delivery.error or "send failed")
    if attempted or already:
        LOGGER.info("briefing subscribers: attempted=%d reached=%d already=%d failed=%d unsubscribed=%d", attempted, reached, already, failed, unsubscribed)
    return SubscriberOutcome(attempted, reached, already, failed, unsubscribed)
