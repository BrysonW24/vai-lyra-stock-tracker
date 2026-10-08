"""The briefing's subscribe-by-link audience: who is served, in what order, through which channel, once a day."""
from __future__ import annotations

from datetime import date
from types import SimpleNamespace

import workers.stock_scanner.briefing_guard as bg
import workers.stock_scanner.briefing_subscribers as bs
from tests.test_ai_briefing import _item
from tests.test_daily_read import _settings
from workers.stock_scanner.telegram import TelegramResult

TODAY = date(2026, 10, 7)
DAY = "Wed 7 Oct"
UNSUB = "https://lyra.example/api/subscribe/unsubscribe?id=sub-1&sig=abc"


def _sub(**overrides) -> dict:
    base = {"id": "sub-1", "token": "tok1", "channel": "telegram", "email": None, "telegram_chat_id": "777", "topics": [], "holdings": ["NVDA"], "status": "active", "last_sent_date": None, "sent_count": 0}
    base.update(overrides)
    return base


def _items() -> list[bg.BriefingItem]:
    return bg.parse_items(
        [
            _item(),  # infrastructure, tagged CEG + NVDA
            _item(
                headline="OpenAI releases o5 (private)",
                category="ai_release",
                listed=False,
                ticker="",
                exchange="",
                lyra_symbols=[],
                what_happened="OpenAI released o5 to API customers.",
                why_it_matters="A new frontier model changes the cost of reasoning for every builder.",
                risks="Pricing and availability were not detailed.",
                not_disclosed="",
                sources=[{"label": "OpenAI", "url": "https://openai.com/o5"}],
            ),
            _item(
                headline="CrowdStrike (Nasdaq: CRWD)",
                category="investment",
                ticker="CRWD",
                lyra_symbols=["CRWD"],
                what_happened="CrowdStrike reported record net new ARR for the quarter.",
                why_it_matters="Security spend is holding up as AI workloads grow.",
                risks="Valuation leaves little room for a miss.",
                not_disclosed="",
                sources=[{"label": "CrowdStrike", "url": "https://ir.crowdstrike.com/q"}],
            ),
        ]
    )


class _Client:
    """Records every update; answers every select with the rows it was given."""

    def __init__(self, rows=None, *, raise_on_select: Exception | None = None):
        self.rows, self.updates, self.raise_on_select = rows or [], [], raise_on_select

    def table(self, name):
        client = self

        class Query:
            def __init__(self):
                self.row, self.id = None, None

            def select(self, *_a, **_k):
                if client.raise_on_select:
                    raise client.raise_on_select
                return self

            def eq(self, column, value):
                if column == "id":
                    self.id = value
                return self

            def order(self, *_a, **_k):
                return self

            def limit(self, *_a, **_k):
                return self

            def update(self, row, **_k):
                self.row = row
                return self

            def execute(self):
                if self.row is not None:
                    client.updates.append((name, self.id, self.row))
                    return SimpleNamespace(data=[])
                return SimpleNamespace(data=client.rows)

        return Query()


# --------------------------------------------------------------------------------------------
# Who.


def test_a_subscriber_needs_a_destination_for_its_channel():
    assert bs.parse_subscriber(_sub(telegram_chat_id="")) is None
    assert bs.parse_subscriber(_sub(channel="email", email="")) is None
    assert bs.parse_subscriber(_sub(channel="pigeon")) is None
    assert bs.parse_subscriber(_sub(id=None)) is None
    parsed = bs.parse_subscriber(_sub(topics=["ai_release", "gossip", "holdings"], holdings=["nvda", " qqq ", "NVDA"], last_sent_date="2026-10-06", sent_count="4"))
    assert parsed == bs.Subscriber(id="sub-1", token="tok1", channel="telegram", email="", chat_id="777", topics=("ai_release", "holdings"), holdings=("NVDA", "QQQ"), last_sent_date=date(2026, 10, 6), sent_count=4)
    assert parsed.destination == "777"
    assert bs.parse_subscriber(_sub(channel="email", email=" Friend@Example.com ", telegram_chat_id=None)).destination == "friend@example.com"


def test_load_subscribers_survives_a_missing_table():
    assert bs.load_subscribers(_Client(raise_on_select=RuntimeError("relation briefing_subscribers does not exist"))) == []
    rows = [_sub(), _sub(id="sub-2", telegram_chat_id=""), {"id": "sub-3", "channel": "email", "email": "a@b.co"}]
    assert [s.id for s in bs.load_subscribers(_Client(rows))] == ["sub-1", "sub-3"], "a row without a destination is skipped, not a crash"


# --------------------------------------------------------------------------------------------
# What each person's copy says.


def test_personalise_puts_holdings_first_then_the_readers_topics():
    personal = bs.personalise(_items(), bs.parse_subscriber(_sub(holdings=["CRWD"], topics=["ai_release"])))
    assert [i.headline for i in personal.holdings_items] == ["CrowdStrike (Nasdaq: CRWD)"]
    assert [i.headline for i in personal.topic_items] == ["OpenAI releases o5", "Constellation (Nasdaq: CEG)"], "the reader's topic first, the rest in the briefing's order"
    assert personal.matched == ("CRWD",)
    assert personal.note == "1 item touches your holdings (CRWD); 1 in your topics (AI releases) first."


def test_personalise_holdings_only_says_what_was_left_out():
    personal = bs.personalise(_items(), bs.parse_subscriber(_sub(holdings=["QQQ"], topics=["holdings"])))
    assert personal.items == () and personal.note == "Nothing tonight touches your holdings (QQQ); 3 other items left out as you asked."
    everything = bs.personalise(_items(), bs.parse_subscriber(_sub(holdings=[], topics=[])))
    assert [i.headline for i in everything.items] == [i.headline for i in _items()] and everything.note == "Tonight's items, checked against their original sources."
    tagged = bs.personalise(_items(), bs.parse_subscriber(_sub(holdings=["NVDA"], topics=["investment", "developer"])))
    assert [i.headline for i in tagged.holdings_items] == ["Constellation (Nasdaq: CEG)"], "an item tagged with a Lyra symbol counts as touching that holding"
    assert tagged.note == "1 item touches your holdings (NVDA); 1 in your topics (deals and listings, developer tools) first."


def test_subscriber_messages_carry_the_holdings_section_and_the_stop_line():
    personal = bs.personalise(_items(), bs.parse_subscriber(_sub(holdings=["CRWD"])))
    messages = bs.compose_subscriber_messages(personal, day_label=DAY, ipo_note="Figma lodged its S-1.")
    assert len(messages) == 1
    text = messages[0]
    assert text.startswith("🗞️ <b>Lyra AI briefing</b> · Wed 7 Oct\n<i>1 item touches your holdings (CRWD).</i>")
    assert "📌 <b>Your holdings</b>\n\n💰 <b>CrowdStrike (Nasdaq: CRWD)</b>" in text and "🚀 <b>IPOs:</b> Figma lodged its S-1." in text
    assert text.endswith("Reply STOP to unsubscribe · Research, not advice.")
    assert text.index("CrowdStrike") < text.index("Constellation") < text.index("OpenAI"), "holdings first, then the briefing's own order when no topic was chosen"
    split = bs.compose_subscriber_messages(personal, day_label=DAY, ipo_note="", limit=700)
    assert len(split) > 1 and split[0].startswith("🗞️") and split[-1].endswith("Research, not advice.")


def test_subscriber_email_carries_the_signed_unsubscribe_link():
    personal = bs.personalise(_items(), bs.parse_subscriber(_sub(holdings=["CRWD"], topics=["ai_release"])))
    subject, html_body, text = bs.compose_subscriber_email(personal, day_label=DAY, ipo_note="Figma lodged its S-1.", unsubscribe_url=UNSUB)
    assert subject == "Lyra AI briefing · Wed 7 Oct: CrowdStrike, OpenAI releases o5, Constellation"
    assert "📌 Your holdings" in html_body and html_body.index("CrowdStrike") < html_body.index("OpenAI") < html_body.index("Constellation")
    assert 'href="https://lyra.example/api/subscribe/unsubscribe?id=sub-1&amp;sig=abc"' in html_body and "Research, not advice." in html_body
    assert 'href="https://ir.crowdstrike.com/q"' in html_body and "🚀 <strong>IPOs:</strong> Figma lodged its S-1." in html_body
    assert text.startswith("Lyra AI briefing - Wed 7 Oct\n1 item touches your holdings (CRWD)") and text.endswith(f"Unsubscribe: {UNSUB}")


def test_link_signature_is_the_one_the_api_routes_verify():
    assert bs.link_signature("secret", "unsubscribe", "abc") == "3b344de38afdc6e558b5eaf733bd1798"
    assert bs.unsubscribe_url("https://lyra.example/", "secret", "abc") == "https://lyra.example/api/subscribe/unsubscribe?id=abc&sig=3b344de38afdc6e558b5eaf733bd1798"


# --------------------------------------------------------------------------------------------
# The sends.


def test_send_email_posts_to_resend_with_one_click_unsubscribe_headers():
    calls: list[dict] = []

    def post(url, *, json, headers, timeout):
        calls.append({"url": url, "json": json, "headers": headers, "timeout": timeout})
        return SimpleNamespace(status_code=200, json=lambda: {"id": "em_1"})

    result = bs.send_email(api_key="re_test", from_email="", to="a@b.co", subject="S", html_body="<p>h</p>", text="t", unsubscribe=UNSUB, post_fn=post)
    assert result == bs.EmailResult("sent")
    assert calls[0]["url"] == bs.RESEND_ENDPOINT and calls[0]["headers"]["Authorization"] == "Bearer re_test"
    assert calls[0]["json"] == {"from": bs.DEFAULT_FROM_EMAIL, "to": ["a@b.co"], "subject": "S", "html": "<p>h</p>", "text": "t", "headers": {"List-Unsubscribe": f"<{UNSUB}>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"}}

    rejected = bs.send_email(api_key="re_test", from_email="", to="a@b.co", subject="S", html_body="h", text="t", unsubscribe=UNSUB, post_fn=lambda *a, **k: SimpleNamespace(status_code=422, json=lambda: {"message": "Invalid `to` field"}))
    assert rejected == bs.EmailResult("failed", "resend HTTP 422: Invalid `to` field")

    def boom(*_a, **_k):
        raise ConnectionError("dns")

    assert bs.send_email(api_key="re_test", from_email="", to="a@b.co", subject="S", html_body="h", text="t", unsubscribe=UNSUB, post_fn=boom) == bs.EmailResult("failed", "resend ConnectionError")
    assert bs.send_email(api_key="", from_email="", to="a@b.co", subject="S", html_body="h", text="t", unsubscribe=UNSUB, post_fn=boom) == bs.EmailResult("skipped", "RESEND_API_KEY missing")


def test_deliver_serves_each_person_once_a_day_and_lets_a_blocked_chat_go(monkeypatch):
    sent: list[dict] = []
    emails: list[dict] = []

    def fake_send(message, settings, chat_id=None, *, silent=False, parse_mode=None):
        sent.append({"chat_id": chat_id, "token": settings.telegram_bot_token, "silent": silent, "parse_mode": parse_mode, "message": message})
        return TelegramResult(sent_status="failed", error_message="Telegram API HTTP 403") if chat_id == "999" else TelegramResult(sent_status="sent")

    monkeypatch.setattr(bs, "send_telegram_message", fake_send)
    monkeypatch.setattr(bs, "send_email", lambda **kwargs: emails.append(kwargs) or bs.EmailResult("sent"))
    settings = _settings(telegram_bot_token="app-bot", app_base_url="https://lyra.example", notification_dispatch_secret="secret", resend_api_key="re_test")
    client = _Client()
    subscribers = bs.load_subscribers(
        _Client(
            [
                _sub(id="served", last_sent_date="2026-10-07"),
                _sub(id="sub-1", sent_count=2),
                _sub(id="blocked", telegram_chat_id="999"),
                _sub(id="mail", channel="email", email="friend@example.com", telegram_chat_id=None, holdings=[], topics=["ai_release"], sent_count=0),
            ]
        )
    )
    outcome = bs.deliver_to_subscribers(client, subscribers, items=_items(), day_label=DAY, ipo_note="", today=TODAY, settings=settings, silent=True)
    assert outcome == bs.SubscriberOutcome(attempted=3, reached=2, already=1, failed=0, unsubscribed=1)
    assert [s["chat_id"] for s in sent] == ["777", "999"] and sent[0]["token"] == "app-bot" and sent[0]["silent"] is True and sent[0]["parse_mode"] == "HTML"
    assert "📌 <b>Your holdings</b>" in sent[0]["message"]
    assert len(emails) == 1 and emails[0]["to"] == "friend@example.com" and emails[0]["api_key"] == "re_test"
    assert emails[0]["unsubscribe"] == "https://lyra.example/api/subscribe/unsubscribe?id=mail&sig=" + bs.link_signature("secret", "unsubscribe", "mail")
    stamps = {(table, row_id): row for table, row_id, row in client.updates}
    assert stamps[("briefing_subscribers", "sub-1")] == {"last_sent_date": "2026-10-07", "sent_count": 3, "last_error": None, "updated_at": "now()"}
    assert stamps[("briefing_subscribers", "mail")]["sent_count"] == 1
    assert stamps[("briefing_subscribers", "blocked")] == {"status": "unsubscribed", "unsubscribe_reason": "blocked", "unsubscribed_at": "now()", "last_error": None, "updated_at": "now()"}
    assert ("briefing_subscribers", "served") not in stamps, "already served today: not sent, not touched"


def test_an_email_subscriber_is_not_sent_without_an_unsubscribe_link(monkeypatch):
    monkeypatch.setattr(bs, "send_email", lambda **_k: (_ for _ in ()).throw(AssertionError("must not be called")))
    client = _Client()
    subscriber = bs.parse_subscriber(_sub(channel="email", email="friend@example.com", telegram_chat_id=None))
    outcome = bs.deliver_to_subscribers(client, [subscriber], items=_items(), day_label=DAY, ipo_note="", today=TODAY, settings=_settings(resend_api_key="re_test"), silent=False)
    assert outcome == bs.SubscriberOutcome(attempted=1, reached=0, already=0, failed=1, unsubscribed=0)
    assert client.updates[0][2]["last_error"].startswith("APP_BASE_URL or the link secret missing")
