"""The market read by an open model: the same facts and the same guard, a chain of writers, no cost."""
from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

import workers.stock_scanner.daily_read as dr
import workers.stock_scanner.free_read as fr
import workers.stock_scanner.open_model as om
from tests.test_open_model import FakeResponse, Recorder, chat

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "bakeoff"
THRESHOLDS = SimpleNamespace(alert_score_threshold=75, watchlist_score_threshold=60)
GOOD = (
    "Cybersecurity led a split session, with the group up 2.4% on average and PANW up 5.0%. "
    "Fintech was the weak spot, down 3.0% on average, and ABNB down 7.6% weighed on consumer internet.\n\n"
    "The setups thinned out: 4 strong setups at the close against 7 strong at the previous close. "
    "SPOT became a strong setup, while AFRM dropped out of strong setup."
)
INVENTED = "NVDA jumped 9.9% on record earnings. Semiconductors gained 12 percent."


def _sheet(label="quiet"):
    fixture = json.loads((FIXTURES / f"session-{label}.json").read_text(encoding="utf-8"))
    return dr.build_sheet(dr.build_facts(fixture["rows"], THRESHOLDS, daily=True))


def _keys(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "groq-key")
    monkeypatch.setenv("CLOUDFLARE_AI_TOKEN", "cf-token")
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "acct")


def test_a_real_sessions_daily_bars_make_a_sheet_with_no_first_hour_in_it():
    sheet = _sheet("broad-selloff")
    assert sheet.text.startswith("This is a full US session, measured from the previous session's close to this session's close.")
    assert "first hour" not in sheet.text and "hourly bars" not in sheet.text
    assert "Breadth on the session (close against the previous close): 1 up, 60 down, 0 flat." in sheet.text
    assert "semiconductors down 11.5% on average" in sheet.text and "semiconductors" in sheet.subject_names


def test_the_first_model_whose_read_passes_the_guard_writes_it(monkeypatch):
    _keys(monkeypatch)
    post = Recorder(FakeResponse(payload=chat(INVENTED)), FakeResponse(payload=chat(GOOD, usage=(1300, 140))))
    monkeypatch.setattr(om.requests, "post", post)
    targets = om.parse_chain("groq:openai/gpt-oss-120b,cloudflare:@cf/google/gemma-4-26b-a4b-it,local:gemma-4-12b")
    narration, tried = fr.narrate_open(_sheet(), targets)
    assert narration.text == GOOD and narration.guard_removed == 0
    assert narration.provider == "cloudflare" and narration.cost_usd == 0.0 and narration.effort == ""
    assert (narration.input_tokens, narration.output_tokens) == (1300, 140)
    assert tried == [("groq:openai/gpt-oss-120b", "guard_blocked"), ("cloudflare:@cf/google/gemma-4-26b-a4b-it", "ok")]
    assert len(post.calls) == 2, "the model on the runner is not asked once a hosted one has written the read"
    sent = post.calls[0]["json"]["messages"]
    assert sent[0]["content"] == fr.MARKET_READ_PROMPT and "<facts>" in sent[1]["content"] and "Names scanned: 61." in sent[1]["content"]


def test_a_sentence_the_facts_do_not_support_is_cut_and_the_rest_goes_out(monkeypatch):
    _keys(monkeypatch)
    monkeypatch.setattr(om.requests, "post", Recorder(FakeResponse(payload=chat(GOOD + " " + INVENTED))))
    narration, tried = fr.narrate_open(_sheet(), om.parse_chain("groq:openai/gpt-oss-120b"))
    assert narration.text == GOOD and narration.guard_removed == 2 and tried == [("groq:openai/gpt-oss-120b", "ok")]


def test_when_every_model_fails_the_caller_learns_why_and_nothing_is_invented(monkeypatch):
    _keys(monkeypatch)
    monkeypatch.setattr(om.requests, "post", Recorder(FakeResponse(status=429), FakeResponse(status=503)))
    targets = om.parse_chain("groq:openai/gpt-oss-120b,cloudflare:@cf/google/gemma-4-26b-a4b-it")
    narration, tried = fr.narrate_open(_sheet(), targets)
    assert narration.text is None and narration.reason == "api_503" and narration.note and narration.provider == "cloudflare"
    assert [reason for _spec, reason in tried] == ["rate_limit", "api_503"]
    assert fr.narrate_open(_sheet(), []) == (None, [])


def test_the_message_names_the_open_model_and_reports_no_price(monkeypatch):
    fixture = json.loads((FIXTURES / "session-quiet.json").read_text(encoding="utf-8"))
    facts = dr.build_facts(fixture["rows"], THRESHOLDS, daily=True)
    narration = dr.Narration(GOOD, "openai/gpt-oss-120b", "", 1300, 140, 0.0, provider="groq")
    message = dr.compose_message(facts, narration, month_to_date=0.0, budget=10.0, reader_zone=dr.ZoneInfo("Australia/Sydney"))
    assert "🤖 gpt-oss-120b (Groq) · an open model on a free tier" in message
    assert "$" not in message.split("🤖")[1], "a free model has no price, no effort level and no monthly budget to report"
    assert "US session of Wed 23 Sep" in message and "first" not in message.split("📊")[0]
    own = dr.Narration(GOOD, "gemma-4-12b-qat", "", 1300, 140, 0.0, provider="local")
    assert "🤖 gemma-4-12b-qat (Lyra's own copy) · an open model running on Lyra's own machine" in dr.compose_message(
        facts, own, month_to_date=0.0, budget=10.0, reader_zone=dr.ZoneInfo("Australia/Sydney")
    )
    paid = dr.Narration(GOOD, "claude-opus-5-5", "high", 2000, 1500, 0.038)
    assert "Claude Opus 5.5 at high effort · $0.038 this read" in dr.compose_message(facts, paid, month_to_date=1.0, budget=10.0, reader_zone=dr.ZoneInfo("Australia/Sydney"))


def test_the_prompt_is_versioned_and_plainly_written():
    assert fr.PROMPT_VERSION.startswith("market_read@") and len(fr.PROMPT_VERSION) == len("market_read@") + 12
    assert "—" not in fr.MARKET_READ_PROMPT and "–" not in fr.MARKET_READ_PROMPT
    assert "No advice and no predictions" in fr.MARKET_READ_PROMPT and "never write a number as a word" in fr.MARKET_READ_PROMPT
