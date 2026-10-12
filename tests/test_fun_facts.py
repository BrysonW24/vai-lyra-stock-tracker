"""The evening's financial fun fact: sourced facts only, one per date, in every copy of the briefing."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import workers.stock_scanner.ai_briefing as ab
import workers.stock_scanner.briefing_guard as bg
import workers.stock_scanner.briefing_subscribers as bs
import workers.stock_scanner.fun_facts as ff
from tests.test_ai_briefing import _item, _research

LIBRARY = Path(__file__).resolve().parents[1] / "content" / "finance-facts.jsonl"


def _library(tmp_path: Path) -> Path:
    rows = [
        {"id": "fact-001", "term": "ETF", "body": "An unsourced definition.", "category": "definition"},
        {"id": "fact-201", "term": "Polymer notes", "body": "Australia issued the world's first polymer banknote & kept it.", "category": "fun", "source": "Reserve Bank of Australia", "url": "https://banknotes.rba.gov.au/x"},
        {"id": "fact-202", "term": "Ticker", "body": "The stock ticker dates to 1867.", "category": "history", "source": "Smithsonian", "url": "https://www.si.edu/y"},
        {"id": "fact-203", "term": "Bad link", "body": "A fact with a plain-http source.", "category": "fun", "source": "x", "url": "http://insecure.example"},
    ]
    path = tmp_path / "facts.jsonl"
    path.write_text("\n".join(json.dumps(row) for row in rows) + "\nnot json\n", encoding="utf-8")
    return path


def test_only_sourced_facts_with_https_links_are_eligible(tmp_path):
    facts = ff.load_fun_facts(_library(tmp_path))
    assert [fact.id for fact in facts] == ["fact-201", "fact-202"]
    assert ff.load_fun_facts(tmp_path / "missing.jsonl") == []


def test_one_fact_a_day_in_turn_with_no_repeat_until_all_are_used(tmp_path):
    facts = ff.load_fun_facts(_library(tmp_path))
    days = [date(2026, 10, 13) + __import__("datetime").timedelta(days=n) for n in range(4)]
    picks = [ff.fact_for(day, facts).id for day in days]
    assert picks[0] != picks[1] and picks[0] == picks[2], "consecutive days take consecutive facts"
    assert ff.fact_for(date(2026, 10, 13), []) is None


def test_the_line_is_html_safe_and_names_its_source(tmp_path):
    fact = ff.load_fun_facts(_library(tmp_path))[0]
    assert ff.fact_html(fact) == '💡 <b>Fun fact:</b> Australia issued the world\'s first polymer banknote &amp; kept it. <a href="https://banknotes.rba.gov.au/x">Reserve Bank of Australia</a>'
    assert ff.fact_text(fact).startswith("Fun fact: Australia issued") and "https://banknotes.rba.gov.au/x" in ff.fact_text(fact)


def test_every_copy_of_the_briefing_ends_on_the_fact_before_its_footer(tmp_path):
    fact = ff.load_fun_facts(_library(tmp_path))[1]
    items = bg.parse_items([_item()])
    research = _research(items)
    operator = ab.compose_messages(items, day_label="Wed 7 Oct", desk_notes={}, research=research, removed=0, removed_categories=[], month_to_date=1.0, budget=40, fun_fact=fact)[-1]
    assert "💡 <b>Fun fact:</b> The stock ticker dates to 1867." in operator
    assert operator.index("💡") > operator.index("🔬 <b>Small caps") and operator.index("💡") < operator.index("🤖 Claude")

    subscriber = bs.Subscriber(id="sub-1", token="t", channel="telegram", email="", chat_id="1", topics=(), holdings=())
    telegram = bs.compose_subscriber_messages(bs.personalise(items, subscriber), day_label="Wed 7 Oct", desk_notes={}, fun_fact=fact)[-1]
    assert telegram.index("💡 <b>Fun fact:</b>") < telegram.index("Reply STOP to unsubscribe")
    _subject, html_body, text = bs.compose_subscriber_email(bs.personalise(items, subscriber), day_label="Wed 7 Oct", desk_notes={}, unsubscribe_url="https://lyra.example/u", fun_fact=fact)
    assert "💡 <strong>Fun fact:</strong> The stock ticker dates to 1867." in html_body and "Fun fact: The stock ticker dates to 1867. (Smithsonian: https://www.si.edu/y)" in text


def test_the_real_librarys_sourced_facts_are_well_formed():
    """Guards content/finance-facts.jsonl itself: what the briefing can send must be clean."""
    rows = [json.loads(line) for line in LIBRARY.read_text(encoding="utf-8").splitlines() if line.strip()]
    ids = [row["id"] for row in rows]
    assert len(ids) == len(set(ids)), "fact ids are unique"
    for row in rows:
        if "url" in row or "source" in row:
            assert row.get("source") and str(row.get("url", "")).startswith("https://"), row["id"]
            assert len(row["body"]) <= ff.MAX_FACT_CHARS, row["id"]
        assert "—" not in row["body"] and "–" not in row["body"], f"{row['id']}: plain hyphens only"
