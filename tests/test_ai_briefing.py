"""The AI briefing: web-researched items checked against the pages the research opened, one briefing
per reader-local day, stored before it is sent, bounded spend, delivered to the operator and to every
account through the router."""
from __future__ import annotations

import sys
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest

import workers.stock_scanner.ai_briefing as ab
import workers.stock_scanner.briefing_guard as bg
from tests.test_daily_read import SYDNEY, UTC, _FakeClient, _FakeQuery, _settings
from workers.stock_scanner.notification_dispatch import DispatchResult
from workers.stock_scanner.telegram import TelegramResult

CEG = "https://www.constellationenergy.com/newsroom/2026/google-agreement.html"
TER = "https://investors.teradyne.com/news/titan-hp"
SAP = "https://news.sap.com/2026/10/sap-techwolf/"
CEG_TEXT = "Constellation today announced a 20-year agreement with Google for 890 MW of new nuclear capacity and a separate 15-year agreement for 2,700 MW. Constellation plans more than US$4.3bn of investment; first new capacity is expected in 2028."
TER_TEXT = "Teradyne expanded Titan HP with burn-in testing. Second-quarter revenue was $1,329 million, up 104% year-on-year."


def _item(**overrides) -> dict:
    base = {
        "headline": "Constellation (Nasdaq: CEG)",
        "category": "infrastructure",
        "listed": True,
        "exchange": "Nasdaq",
        "ticker": "CEG",
        "what_happened": "Google signed a 20-year agreement enabling 890 MW of new nuclear capacity, plus a 15-year agreement for 2,700 MW of existing supply; Constellation plans over US$4.3bn of investment, with first new capacity expected in 2028.",
        "why_it_matters": "A concrete AI-power development with a listed counterparty.",
        "risks": "Construction, approvals and the return on that spending; contract pricing was not disclosed.",
        "not_disclosed": "Contract pricing and incremental earnings.",
        "sources": [{"label": "Constellation", "url": CEG}],
        "lyra_symbols": ["CEG", "NVDA"],
        "catch_up": False,
    }
    base.update(overrides)
    return base


def _seen(*urls):
    return {bg.canonical_url(url) for url in urls}


# --------------------------------------------------------------------------------------------
# The guard.


def test_numbers_in_spells_every_figure_one_way():
    assert bg.numbers_in("US$4.3bn, 2,700 MW, 104% in Q2 2026, GPT-6, v2.1, A100") == {"4.3", "2700", "104", "2026", "6"}


def test_canonical_url_gives_one_spelling_per_page():
    assert bg.canonical_url("https://WWW.Example.com/a/b/?utm_source=x&id=2#frag") == "example.com/a/b?id=2"
    assert bg.canonical_url("http://example.com/a/b") == "example.com/a/b"
    assert bg.canonical_url("javascript:alert(1)") == ""
    assert bg.canonical_url("not a url") == ""


def test_parse_items_keeps_only_the_right_shape():
    items = bg.parse_items([_item(), _item(category="gossip"), _item(what_happened=""), "text", _item(sources=[{"url": "nope"}])])
    assert [item.headline for item in items] == ["Constellation (Nasdaq: CEG)", "Constellation (Nasdaq: CEG)"]
    assert items[1].sources == (), "a source that is not a web address is dropped, the item keeps its shape"
    assert items[0].lyra_symbols == ("CEG", "NVDA") and items[0].ticker == "CEG"
    labelled = bg.parse_item(_item(headline="Reflection AI previews Beam (private)", listed=False, ticker=""))
    assert labelled.headline == "Reflection AI previews Beam", "Lyra labels private items itself; the model's label would show twice"


def test_an_item_whose_source_the_research_never_saw_is_out():
    item = bg.parse_item(_item())
    _cleaned, reasons = bg.check_item(item, seen=set(), fetched={}, covered=set(), universe=set())
    assert any(r.startswith("unseen source") for r in reasons) and any(r.startswith("source not opened") for r in reasons)


def test_an_item_whose_source_was_only_searched_not_opened_is_out():
    item = bg.parse_item(_item())
    _cleaned, reasons = bg.check_item(item, seen=_seen(CEG), fetched={}, covered=set(), universe=set())
    assert reasons == ["source not opened: none of the item's sources was fetched as text"]


def test_every_figure_must_be_in_the_items_own_source():
    item = bg.parse_item(_item())
    fetched = {bg.canonical_url(CEG): CEG_TEXT}
    cleaned, reasons = bg.check_item(item, seen=_seen(CEG), fetched=fetched, covered=set(), universe={"CEG"})
    assert reasons == [] and cleaned.lyra_symbols == ("CEG",), "symbols outside the universe are dropped, the item stays"

    converted = bg.parse_item(_item(what_happened="Revenue was US$1.329bn, up 104%.", sources=[{"label": "Results", "url": TER}]))
    _cleaned, reasons = bg.check_item(converted, seen=_seen(TER), fetched={bg.canonical_url(TER): TER_TEXT}, covered=set(), universe=set())
    assert reasons == ["figure not in source: 1 figure(s) absent from the item's own sources"], "1,329 million converted to 1.329bn is not the source's figure"

    other_page = bg.parse_item(_item(sources=[{"label": "Teradyne", "url": TER}]))
    _cleaned, reasons = bg.check_item(other_page, seen=_seen(TER), fetched={bg.canonical_url(TER): TER_TEXT, bg.canonical_url(CEG): CEG_TEXT}, covered=set(), universe=set())
    assert reasons and reasons[0].startswith("figure not in source"), "figures are checked against the item's OWN sources, not every page opened"


def test_advice_tickers_and_repeats_are_caught():
    fetched = {bg.canonical_url(CEG): CEG_TEXT}
    advice = bg.parse_item(_item(why_it_matters="You should buy before the 2028 start."))
    assert any(r.startswith("advice") for r in bg.check_item(advice, seen=_seen(CEG), fetched=fetched, covered=set(), universe=set())[1])

    no_ticker = bg.parse_item(_item(ticker=""))
    assert "listed without ticker" in bg.check_item(no_ticker, seen=_seen(CEG), fetched=fetched, covered=set(), universe=set())[1]

    private = bg.parse_item(_item(listed=False, headline="TechWolf (Nasdaq: TWLF)", ticker=""))
    assert "private with ticker" in bg.check_item(private, seen=_seen(CEG), fetched=fetched, covered=set(), universe=set())[1]

    repeat = bg.parse_item(_item())
    assert any(r.startswith("already covered") for r in bg.check_item(repeat, seen=_seen(CEG), fetched=fetched, covered=_seen(CEG), universe=set())[1])


def test_guard_briefing_keeps_the_lead_and_caps_the_tail():
    fetched = {bg.canonical_url(CEG): CEG_TEXT}
    items = [bg.parse_item(_item(headline=f"{name} (Nasdaq: CEG)")) for name in ("Alpha", "Beta", "Gamma", "Delta")]
    items.insert(1, bg.parse_item(_item(headline="Ghost (Nasdaq: CEG)", sources=[{"label": "x", "url": SAP}])))
    outcome = bg.guard_briefing(items, seen=_seen(CEG), fetched=fetched, covered=set(), universe=set(), max_items=3)
    assert [item.headline for item in outcome.kept] == ["Alpha (Nasdaq: CEG)", "Beta (Nasdaq: CEG)", "Gamma (Nasdaq: CEG)"]
    assert [item.headline for item, _reasons in outcome.removed] == ["Ghost (Nasdaq: CEG)"]
    assert outcome.categories == ["source not opened", "unseen source"]


# --------------------------------------------------------------------------------------------
# The research call, against a fake SDK: harvest, pause_turn, the nudge, pricing, failures.


class _Status(Exception):
    def __init__(self, status_code, message=""):
        super().__init__(message or str(status_code))
        self.status_code = status_code


class _Stream:
    def __init__(self, message):
        self.message = message

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def get_final_message(self):
        if isinstance(self.message, Exception):
            raise self.message
        return self.message


def _response(content, stop_reason, *, searches=0, fetches=0, model="claude-opus-5-5", cache_read=0, cache_write=0):
    usage = SimpleNamespace(
        input_tokens=10_000,
        output_tokens=2_000,
        cache_read_input_tokens=cache_read,
        cache_creation_input_tokens=cache_write,
        server_tool_use=SimpleNamespace(web_search_requests=searches, web_fetch_requests=fetches),
    )
    return SimpleNamespace(content=content, stop_reason=stop_reason, usage=usage, model=model)


def _search_block(*urls):
    return SimpleNamespace(type="web_search_tool_result", content=[SimpleNamespace(type="web_search_result", url=url, title="t", encrypted_content="x") for url in urls])


def _fetch_block(url, text):
    document = SimpleNamespace(source=SimpleNamespace(type="text", data=text))
    return SimpleNamespace(type="web_fetch_tool_result", content=SimpleNamespace(type="web_fetch_result", url=url, content=document))


def _publish_block(items, ipo_note="No additional primary-confirmed IPO made the cut this evening."):
    return SimpleNamespace(type="tool_use", name="publish_briefing", input={"items": items, "ipo_note": ipo_note, "searched": "AI releases, filings, power deals."})


@pytest.fixture
def sdk(monkeypatch):
    state = SimpleNamespace(responses=[], calls=[], slept=[])
    monkeypatch.setattr(ab.time, "sleep", lambda seconds: state.slept.append(seconds))

    class _Messages:
        def stream(self, **kwargs):
            state.calls.append(kwargs)
            return _Stream(state.responses.pop(0))

    class _Anthropic:
        def __init__(self, **_kwargs):
            self.beta = SimpleNamespace(messages=_Messages())

    fake = SimpleNamespace(
        Anthropic=_Anthropic,
        AuthenticationError=type("AuthenticationError", (Exception,), {}),
        RateLimitError=type("RateLimitError", (Exception,), {}),
        APIStatusError=_Status,
        APIConnectionError=type("APIConnectionError", (Exception,), {}),
    )
    monkeypatch.setitem(sys.modules, "anthropic", fake)
    return state


def test_research_harvests_sources_resumes_a_paused_turn_and_prices_the_searches(sdk):
    sdk.responses = [
        _response([_search_block(CEG, TER), _fetch_block(CEG, CEG_TEXT)], "pause_turn", searches=3, fetches=1),
        _response([_publish_block([_item()])], "tool_use", searches=1),
    ]
    result = ab.research("brief", model="claude-opus-5-5", effort="high", max_searches=16, max_fetches=10)
    assert result.ok and [item.headline for item in result.items] == ["Constellation (Nasdaq: CEG)"]
    assert result.seen == _seen(CEG, TER) and result.fetched == {bg.canonical_url(CEG): CEG_TEXT}
    assert (result.searches, result.fetches, result.continuations) == (4, 1, 1)
    assert (result.input_tokens, result.output_tokens) == (20_000, 4_000), "every continuation re-reads the context and is paid for"
    assert result.cost_usd == pytest.approx(20_000 * 4 / 1e6 + 4_000 * 20 / 1e6 + 4 * 0.01)
    assert result.ipo_note.startswith("No additional") and result.searched
    first, second = sdk.calls
    assert first["tools"][0]["type"] == "web_search_20260209" and first["tools"][0]["max_uses"] == 16
    assert first["tools"][1]["type"] == "web_fetch_20260209" and first["tools"][1]["max_uses"] == 10
    assert first["tools"][2]["name"] == "publish_briefing" and first["output_config"] == {"effort": "high"}
    assert [m["role"] for m in second["messages"]] == ["user", "assistant"], "the paused message goes back unchanged"


def test_research_nudges_once_when_the_model_stops_without_publishing(sdk):
    sdk.responses = [
        _response([SimpleNamespace(type="text", text="Here is the briefing as prose.")], "end_turn"),
        _response([_publish_block([])], "tool_use"),
    ]
    result = ab.research("brief", model="claude-opus-5-5", effort="high", max_searches=16, max_fetches=10)
    assert result.ok and result.items == [] and result.continuations == 1
    assert sdk.calls[1]["messages"][-1] == {"role": "user", "content": ab.NUDGE}

    sdk.responses = [_response([], "end_turn"), _response([], "end_turn")]
    result = ab.research("brief", model="claude-opus-5-5", effort="high", max_searches=16, max_fetches=10)
    assert result.reason == "no_publish" and result.items == []


def test_research_reports_refusals_and_api_failures_without_raising(sdk):
    sdk.responses = [_response([], "refusal", searches=2)]
    result = ab.research("brief", model="claude-opus-5-5", effort="high", max_searches=16, max_fetches=10)
    assert result.reason == "refusal" and result.items == [] and result.cost_usd > 0, "a refused turn still cost its searches"

    sdk.responses = [_Status(400)]
    result = ab.research("brief", model="claude-opus-5-5", effort="high", max_searches=16, max_fetches=10)
    assert (result.reason, result.items, result.cost_usd) == ("api_400", [], 0.0) and sdk.slept == [], "a bad request is not retried"

    sdk.responses = [_Status(400, "Error code: 400 - {'type': 'error', 'error': {'type': 'invalid_request_error', 'message': 'Your credit balance is too low to access the Anthropic API.'}}")]
    result = ab.research("brief", model="claude-opus-5-5", effort="high", max_searches=16, max_fetches=10)
    assert result.reason == "billing" and result.note == "the Anthropic account's credit balance is too low - top up under Plans & Billing" and sdk.slept == [], "an empty balance is named, not retried (the third real dry run, 2026-10-07)"


def test_a_turn_that_dies_mid_stream_is_tried_once_more(sdk):
    """An error event inside the stream surfaces as a status-200 APIStatusError (seen on the second
    real dry run, 81 s in); an overloaded API as 529. Both deserve one more go after a pause."""
    sdk.responses = [_Status(200), _response([_publish_block([_item()])], "tool_use", searches=5)]
    result = ab.research("brief", model="claude-opus-5-5", effort="high", max_searches=16, max_fetches=10)
    assert result.ok and len(result.items) == 1 and sdk.slept == [ab.RETRY_PAUSE_SECONDS] and len(sdk.calls) == 2
    assert [m["role"] for m in sdk.calls[1]["messages"]] == ["user"], "the retry starts the turn afresh"

    sdk.responses = [_Status(529), _Status(529)]
    result = ab.research("brief", model="claude-opus-5-5", effort="high", max_searches=16, max_fetches=10)
    assert result.reason == "api_529" and len(sdk.slept) == 2, "two attempts, then the evening is reported, not raised"


def test_a_dearer_serving_model_is_what_the_ledger_pays_for(sdk):
    sdk.responses = [_response([_publish_block([])], "tool_use", model="claude-fable-5-1")]
    result = ab.research("brief", model="claude-opus-5-5", effort="high", max_searches=16, max_fetches=10)
    assert result.model == "claude-fable-5-1" and result.cost_usd == pytest.approx(10_000 * 10 / 1e6 + 2_000 * 50 / 1e6)


def test_cache_reads_are_priced_at_the_cache_rate_and_counted():
    """A research turn re-reads its context on every iteration; the API serves most of that from the
    cache at a tenth of the input price, and the ledger must say so rather than charge full price."""
    usage = SimpleNamespace(input_tokens=5_000, cache_creation_input_tokens=10_000, cache_read_input_tokens=100_000, output_tokens=1_000)
    tokens = ab._tokens(usage)
    assert tokens == ab.Tokens(5_000, 10_000, 100_000, 1_000) and tokens.billed_input == 115_000
    assert ab.tokens_cost_usd("claude-opus-5-5", tokens) == pytest.approx((5_000 * 4 + 10_000 * 5 + 100_000 * 0.4 + 1_000 * 20) / 1e6)
    assert ab.tokens_cost_usd("claude-unknown", tokens) == pytest.approx((5_000 * 10 + 10_000 * 12.5 + 100_000 * 1.0 + 1_000 * 50) / 1e6), "an unknown model is priced at the dearest row"

    fallback = SimpleNamespace(input_tokens=1_000, output_tokens=100, iterations=[SimpleNamespace(input_tokens=1_000, output_tokens=100), SimpleNamespace(input_tokens=3_000, output_tokens=200)])
    assert ab._tokens(fallback) == ab.Tokens(4_000, 0, 0, 300), "a server-side fallback's attempts are all paid for"


def test_research_reports_the_cache_split_on_the_result(sdk):
    sdk.responses = [_response([_publish_block([])], "tool_use", cache_read=50_000, cache_write=4_000)]
    result = ab.research("brief", model="claude-opus-5-5", effort="high", max_searches=16, max_fetches=10)
    assert (result.input_tokens, result.cache_read_tokens, result.output_tokens) == (64_000, 50_000, 2_000)
    assert result.cost_usd == pytest.approx((10_000 * 4 + 4_000 * 5 + 50_000 * 0.4 + 2_000 * 20) / 1e6)


# --------------------------------------------------------------------------------------------
# The messages.


def _research(items, **overrides):
    base = dict(ipo_note="No additional primary-confirmed IPO made the cut this evening.", seen=_seen(CEG, TER, SAP), fetched={bg.canonical_url(url): CEG_TEXT + " " + TER_TEXT for url in (CEG, TER, SAP)}, searches=14, fetches=6, input_tokens=180_000, output_tokens=9_000, cost_usd=1.04)
    base.update(overrides)
    return ab.Research(items, **base)


def test_compose_messages_is_html_safe_and_splits_at_item_boundaries():
    items = [bg.parse_item(_item(headline=f"Item {n} & Co (Nasdaq: CEG)")) for n in range(4)]
    research = _research(items)
    one = ab.compose_messages(items, day_label="Wed 7 Oct", ipo_note=research.ipo_note, research=research, removed=1, removed_categories=["unseen source"], month_to_date=1.04, budget=40)
    assert len(one) == 1
    text = one[0]
    assert text.startswith("🗞️ <b>Lyra AI briefing</b> · Wed 7 Oct\n<i>4 items checked against their original sources: 4 infrastructure.</i>\n\n⚡ <b>Item 0 &amp; Co (Nasdaq: CEG)</b>\n")
    assert '<a href="https://www.constellationenergy.com/newsroom/2026/google-agreement.html">Constellation</a>' in text
    assert "<i>Why it matters:</i>" in text and "<i>Risks:</i>" in text and "<i>Not disclosed:</i>" in text
    assert "🚀 <b>IPOs:</b> No additional primary-confirmed IPO" in text
    assert text.endswith("🤖 Claude Opus 5.5 at high effort · 14 searches, 6 pages opened · $1.04 this briefing · $1.04 of $40 this month\nLyra's checks removed 1 item (unseen source).\nResearch, not advice.")

    parts = ab.compose_messages(items, day_label="Wed 7 Oct", ipo_note=research.ipo_note, research=research, removed=0, removed_categories=[], month_to_date=1.04, budget=40, limit=900)
    assert len(parts) > 1 and all(len(part) <= 900 for part in parts)
    assert parts[0].startswith("🗞️ <b>Lyra AI briefing</b>") and parts[-1].endswith("Research, not advice.")
    assert "".join(parts).count("<b>Item ") == 4, "every item survives the split"


def test_router_copy_is_short_and_points_at_the_page():
    items = [bg.parse_item(_item(headline=f"Company {n} (Nasdaq: CEG)")) for n in range(5)]
    assert ab.router_title(items, "Wed 7 Oct") == "AI briefing · Wed 7 Oct: Company 0, Company 1, Company 2 + 2 more"
    body = ab.router_body(items, "No IPO made the cut.", limit=600)
    assert len(body) <= 600 and body.endswith("Full briefing with sources: open Lyra > AI Briefing.") and "🚀 IPOs: No IPO made the cut." in body
    assert body.startswith("⚡ Company 0 (Nasdaq: CEG): Google signed a 20-year agreement enabling 890 MW of new nuclear capacity, plus a 15-year agreement for 2,700 MW of existing supply.\n"), "one clause per item on a push; the page has the rest"


# --------------------------------------------------------------------------------------------
# The run.


@pytest.fixture
def harness(monkeypatch):
    db = {
        "stock_scanner_runs": [],
        "stock_tickers": [{"symbol": "CEG", "is_active": True, "scan_enabled": True}, {"symbol": "NVDA", "is_active": True, "scan_enabled": True}],
        "profiles": [{"id": "user-1"}, {"id": "user-2"}],
        "writes": [],
    }
    state = SimpleNamespace(db=db, sent=[], dispatched=[], research_calls=[], items=[_item()], research_overrides={}, telegram_result=None, dispatch_result=None, settings_overrides={})

    monkeypatch.setattr(ab, "load_settings", lambda: _settings(**{"enable_ai_briefing": True, "notification_dispatch_url": "https://lyra.example/api/notifications/dispatch", "notification_dispatch_secret": "secret", **state.settings_overrides}))
    monkeypatch.setattr(
        ab,
        "SupabaseRepository",
        lambda settings: SimpleNamespace(
            client=_FakeClient(db),
            create_run=lambda job, tf: _FakeQuery(db, "stock_scanner_runs").insert({"job_name": job, "timeframe": tf, "status": "running"}).execute().data[0]["id"],
            load_active_user_ids=lambda: [],
        ),
    )

    def fake_research(brief, *, model, effort, max_searches, max_fetches):
        state.research_calls.append({"brief": brief, "model": model, "effort": effort, "max_searches": max_searches, "max_fetches": max_fetches})
        return _research(bg.parse_items(state.items), model=model, effort=effort, **state.research_overrides)

    monkeypatch.setattr(ab, "research", fake_research)

    def fake_send(message, settings, chat_id=None, *, silent=False, parse_mode=None):
        state.sent.append({"message": message, "chat_id": chat_id, "silent": silent, "parse_mode": parse_mode, "token": settings.telegram_bot_token})
        return state.telegram_result or TelegramResult(sent_status="sent")

    monkeypatch.setattr(ab, "send_telegram_message", fake_send)

    def fake_dispatch(settings, **kwargs):
        state.dispatched.append(kwargs)
        return state.dispatch_result or DispatchResult(attempted=True, ok=True, delivered=True)

    monkeypatch.setattr(ab, "dispatch_notification", fake_dispatch)
    for name, value in {"SUMMARY_TELEGRAM_BOT_TOKEN": "bot-token", "SUMMARY_TELEGRAM_CHAT_ID": "chat-1", "ANTHROPIC_API_KEY": "sk-test", "SUMMARY_TIMEZONE": "Australia/Sydney"}.items():
        monkeypatch.setenv(name, value)
    for name in ("BRIEFING_FORCE", "BRIEFING_MODEL", "BRIEFING_EFFORT", "BRIEFING_MONTHLY_BUDGET_USD", "BRIEFING_SEND_AT", "BRIEFING_MAX_SEARCHES", "BRIEFING_MAX_FETCHES", "SUMMARY_QUIET_HOURS"):
        monkeypatch.delenv(name, raising=False)
    return state


EVENING = datetime(2026, 10, 7, 20, 20, tzinfo=SYDNEY).astimezone(UTC)  # 20:20 AEDT = 09:20 UTC, the first cron
EARLY = datetime(2026, 10, 7, 19, 20, tzinfo=SYDNEY).astimezone(UTC)  # what the 09:20 UTC cron is during AEST


def test_run_researches_once_per_day_stores_before_sending_and_reaches_everyone(harness):
    assert ab.run(now=EARLY) == 0
    assert harness.sent == [] and harness.research_calls == [] and harness.db["stock_scanner_runs"] == [], "19:20 local is before the send time"

    assert ab.run(now=EVENING) == 0
    assert len(harness.research_calls) == 1
    brief = harness.research_calls[0]["brief"]
    assert "Today is Wednesday 07 October 2026 in Sydney (20:20 local)." in brief
    assert "The core of tonight's briefing is Tuesday 06 October 2026" in brief and "after the US close on Monday 05 October 2026" in brief
    assert "Budget: 20 searches and 12 page opens." in brief
    assert "CEG, NVDA" in brief and harness.research_calls[0] == {"brief": brief, "model": "claude-opus-5-5", "effort": "high", "max_searches": 20, "max_fetches": 12}

    assert len(harness.sent) == 1 and harness.sent[0]["message"].startswith("🗞️ <b>Lyra AI briefing</b> · Wed 7 Oct")
    assert harness.sent[0] == {**harness.sent[0], "chat_id": "chat-1", "silent": False, "parse_mode": "HTML", "token": "bot-token"}
    assert [d["user_id"] for d in harness.dispatched] == ["user-1", "user-2"], "every account, not only those with a position"
    first = harness.dispatched[0]
    assert first["notification_type"] == "ai_briefing" and first["url"] == "/briefing" and first["symbol"] == ""
    assert first["title"] == "AI briefing · Wed 7 Oct: Constellation" and first["payload"]["dedupe_key"] == "ai_briefing:user-1:2026-10-07"
    assert first["payload"]["items"][0]["headline"] == "Constellation (Nasdaq: CEG)" and first["payload"]["items"][0]["lyra_symbols"] == ["CEG", "NVDA"]

    running, final = harness.db["writes"]
    assert running["status"] == "running" and running["payload"]["date"] is None and running["payload"]["items"][0]["headline"] == "Constellation (Nasdaq: CEG)", "the research is on the ledger before any send"
    assert running["payload"]["cost_usd"] == 1.04 and running["payload"]["ai"] is True
    assert final["status"] == "success" and final["payload"]["date"] == "2026-10-07" and final["alerts_sent"] == 1
    assert (final["payload"]["operator_delivered"], final["payload"]["users_attempted"], final["payload"]["users_reached"]) == (True, 2, 2)

    assert ab.run(now=EVENING + timedelta(hours=1)) == 0
    assert len(harness.research_calls) == 1 and len(harness.sent) == 1 and len(harness.dispatched) == 2, "the second cron finds today on the ledger"


def test_run_resends_from_the_ledger_when_nothing_was_delivered(harness):
    harness.telegram_result = TelegramResult(sent_status="failed", error_message="telegram down")
    harness.dispatch_result = DispatchResult(attempted=True, ok=False, error_message="router down")
    assert ab.run(now=EVENING) == 1
    row = harness.db["stock_scanner_runs"][0]
    assert row["status"] == "failed" and row["payload"]["date"] is None and row["payload"]["date_attempted"] == "2026-10-07" and row["payload"]["items"]

    harness.telegram_result = None
    harness.dispatch_result = None
    assert ab.run(now=EVENING + timedelta(hours=1)) == 0
    assert len(harness.research_calls) == 1, "the stored items are resent; the research is not paid for twice"
    assert len(harness.sent) == 2 and "Constellation (Nasdaq: CEG)" in harness.sent[1]["message"]
    resend = harness.db["stock_scanner_runs"][1]["payload"]
    assert resend["reason"] == "resend" and resend["cost_usd"] == 0 and resend["date"] == "2026-10-07"

    assert ab.run(now=EVENING + timedelta(hours=2)) == 0
    assert len(harness.sent) == 2


def test_run_checks_the_items_and_tells_the_operator_what_was_removed(harness):
    harness.items = [_item(), _item(headline="SAP (NYSE: SAP)", ticker="SAP", exchange="NYSE", category="investment", sources=[{"label": "SAP", "url": "https://sap.com/never-fetched"}])]
    assert ab.run(now=EVENING) == 0
    message = harness.sent[0]["message"]
    assert "SAP (NYSE: SAP)" not in message and "Lyra's checks removed 1 item (source not opened, unseen source)." in message
    final = harness.db["stock_scanner_runs"][0]["payload"]
    assert (final["published"], final["removed"], final["removed_categories"]) == (2, 1, ["source not opened", "unseen source"])
    assert len(harness.dispatched[0]["payload"]["items"]) == 1


def test_run_sends_only_a_note_when_nothing_passes_and_stops_at_the_budget(harness):
    harness.items = [_item(sources=[{"label": "SAP", "url": "https://sap.com/never-fetched"}])]
    assert ab.run(now=EVENING) == 0
    assert harness.dispatched == [] and len(harness.sent) == 1
    assert harness.sent[0]["message"].startswith("🗞️ <b>Lyra AI briefing</b> · Wed 7 Oct\nNo briefing tonight: the model published 1 item(s) and Lyra&#x27;s checks removed every one (source not opened, unseen source).")
    row = harness.db["stock_scanner_runs"][0]
    assert row["status"] == "success" and row["payload"]["date"] == "2026-10-07" and row["alerts_sent"] == 0, "a night with nothing to say is not retried"

    harness.db["stock_scanner_runs"].append({"id": "spent", "job_name": "ai_briefing", "status": "success", "started_at": (EVENING - timedelta(days=1)).isoformat(), "payload": {"date": "2026-10-06", "cost_usd": 40.0, "ai": True, "effort": "high", "items": []}})
    harness.items = [_item()]
    assert ab.run(now=EVENING + timedelta(days=1)) == 0
    assert len(harness.research_calls) == 1, "over budget: no research"
    assert "No briefing tonight: this month&#x27;s $40 briefing budget is used up." in harness.sent[-1]["message"]
    assert harness.db["stock_scanner_runs"][-1]["payload"]["reason"] == "budget" and harness.db["stock_scanner_runs"][-1]["status"] == "skipped"
    assert harness.db["stock_scanner_runs"][-1]["payload"]["date"] == "2026-10-08", "a spent budget will not change by the next firing - the day is done"


def test_a_night_the_model_could_not_run_stays_open_for_the_next_firing(harness):
    """The first forced run (2026-10-08) hit an empty Anthropic balance and claimed the day, which
    would have silenced that evening's real attempt after the top-up."""
    harness.research_overrides = {"reason": "billing", "note": "the Anthropic account's credit balance is too low - top up under Plans & Billing", "searches": 0, "fetches": 0, "cost_usd": 0.0}
    harness.items = []
    assert ab.run(now=EVENING) == 0
    assert len(harness.sent) == 1 and "top up under Plans &amp; Billing" in harness.sent[0]["message"] and harness.dispatched == []
    row = harness.db["stock_scanner_runs"][0]
    assert row["status"] == "failed" and row["payload"]["date"] is None and row["payload"]["reason"] == "billing" and row["alerts_sent"] == 0
    assert row["error_message"].startswith("the Anthropic account's credit balance is too low")

    harness.research_overrides = {}
    harness.items = [_item()]
    assert ab.run(now=EVENING + timedelta(hours=1)) == 0
    assert len(harness.research_calls) == 2 and len(harness.sent) == 2 and "Constellation (Nasdaq: CEG)" in harness.sent[1]["message"], "credit back by the second firing: the briefing goes out"
    assert harness.db["stock_scanner_runs"][1]["payload"]["date"] == "2026-10-07"


def test_recent_briefings_feed_the_repeat_checks(harness):
    harness.db["stock_scanner_runs"].append({"id": "yesterday", "job_name": "ai_briefing", "status": "success", "started_at": (EVENING - timedelta(days=1)).isoformat(), "payload": {"date": "2026-10-06", "cost_usd": 1.0, "ai": True, "effort": "high", "items": [_item()]}})
    assert ab.run(now=EVENING) == 0
    assert "Already covered in the last 7 days" in harness.research_calls[0]["brief"] and "- Constellation (Nasdaq: CEG) (Tue 6 Oct)" in harness.research_calls[0]["brief"]
    assert "removed every one (already covered)" in harness.sent[0]["message"], "the same source cited again is a repeat, whatever the new words"
    assert harness.dispatched == []


def test_run_honours_force_quiet_hours_and_the_knobs(harness, monkeypatch):
    monkeypatch.setenv("BRIEFING_FORCE", "true")
    monkeypatch.setenv("BRIEFING_MODEL", "claude-sonnet-5-5")
    monkeypatch.setenv("BRIEFING_EFFORT", "medium")
    monkeypatch.setenv("BRIEFING_MAX_SEARCHES", "8")
    monkeypatch.setenv("BRIEFING_MAX_FETCHES", "4")
    monkeypatch.setenv("SUMMARY_QUIET_HOURS", "19-7")
    assert ab.run(now=EARLY) == 0, "force ignores the send time"
    assert harness.research_calls[0] == {"brief": harness.research_calls[0]["brief"], "model": "claude-sonnet-5-5", "effort": "medium", "max_searches": 8, "max_fetches": 4}
    assert harness.sent[0]["silent"] is True
    assert ab.run(now=EARLY) == 0 and len(harness.research_calls) == 2, "force also ignores the ledger"


def test_run_is_a_no_op_without_the_flag_or_a_destination(harness, monkeypatch):
    harness.settings_overrides["enable_ai_briefing"] = False
    assert ab.run(now=EVENING) == 0 and harness.research_calls == []
    harness.settings_overrides.update(enable_ai_briefing=True, notification_dispatch_url="", notification_dispatch_secret="")
    monkeypatch.delenv("SUMMARY_TELEGRAM_CHAT_ID")
    assert ab.run(now=EVENING) == 0 and harness.research_calls == []
