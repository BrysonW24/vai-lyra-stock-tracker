"""A briefing item by an open model: one page in, one checked item out, the source attached by code."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

import workers.stock_scanner.free_briefing as fb
import workers.stock_scanner.open_model as om
from tests.test_open_model import FakeResponse, Recorder, chat

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "bakeoff"
UNIVERSE = ["AMD", "MSFT", "NVDA"]


def _article(label="private-funding-round") -> fb.Article:
    fixture = json.loads((FIXTURES / f"article-{label}.json").read_text(encoding="utf-8"))
    return fb.Article(fixture["url"], fixture["final_url"], fixture["title"], fb.article_window(fixture["text"]), fixture["source"])


def _answer(**overrides) -> dict:
    base = {
        "skip": False,
        "headline": "Lumen Foundry",
        "lead": "Lumen Foundry raises $1.2 billion for photonic AI chips.",
        "theme": "semiconductors",
        "desk": "venture",
        "listed": False,
        "exchange": "",
        "ticker": "",
        "what_happened": "Lumen Foundry announced a $1.2 billion Series D that values it at $9.8 billion after the new money.",
        "why_it_matters": "The money funds its second chip, L2, and reserves packaging capacity for 2 years.",
        "risks": "Its chips depend on a single packaging supplier and its power claim rests on its own tests.",
        "not_disclosed": "Revenue, losses and the sovereign fund's terms.",
        "lyra_symbols": [],
    }
    base.update(overrides)
    return base


def _keys(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "groq-key")
    monkeypatch.setenv("CLOUDFLARE_AI_TOKEN", "cf-token")
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "acct")


def test_the_source_is_the_page_the_job_opened_whatever_the_model_claims():
    article = _article()
    invented = _answer(sources=[{"label": "A page nobody opened", "url": "https://elsewhere.example/made-up"}])
    outcome = fb.item_from_answer(invented, article, covered=set(), universe=set(UNIVERSE))
    assert outcome.outcome == "kept" and outcome.item is not None
    assert [(source.label, source.url) for source in outcome.item.sources] == [("Lumen Foundry press release", article.final_url)]
    assert outcome.item.desk == "venture" and outcome.item.theme == "semiconductors" and not outcome.item.listed


def test_a_figure_the_page_did_not_print_removes_the_item():
    outcome = fb.item_from_answer(_answer(what_happened="Lumen Foundry raised $1.5 billion at a $9.8 billion valuation."), _article(), covered=set(), universe=set())
    assert outcome.item is None and outcome.outcome == "removed" and outcome.categories == ["figure not in source"]
    # A year the page never wrote is a figure like any other.
    dated = fb.item_from_answer(_answer(why_it_matters="It funds the L2 chip due in 2027."), _article(), covered=set(), universe=set())
    assert dated.outcome == "removed" and dated.categories == ["figure not in source"]


def test_a_figure_must_match_the_page_scale_and_all():
    """The page says "$1.2 billion" and "3 data-centre operators". A bare-number check finds a 3 on
    the page and lets "$3 billion" through; the scale is part of the figure."""
    from workers.stock_scanner.briefing_guard import scaled_figures_in

    assert scaled_figures_in("$1.2 billion, 1.20bn, 41 per cent, 41%, $318.4m, 38 boats, 20k jobs") == {("1.2", "billion"), ("41", "%"), ("318.4", "million"), ("20", "thousand")}
    article = _article()
    inflated = fb.item_from_answer(_answer(lead="Lumen Foundry raises $3 billion for photonic chips."), article, covered=set(), universe=set())
    assert inflated.outcome == "removed" and inflated.categories == ["figure not in source"]
    wrong_scale = fb.item_from_answer(_answer(lead="Lumen Foundry raises $1.2 million for photonic chips."), article, covered=set(), universe=set())
    assert wrong_scale.categories == ["figure not in source"]
    short_form = fb.item_from_answer(_answer(lead="Lumen Foundry raises $1.2bn for photonic AI chips."), article, covered=set(), universe=set())
    assert short_form.outcome == "kept", "the page's own figure in its short form is the same figure"
    percent = fb.item_from_answer(_answer(risks="Its claim of 70 percent less power per query rests on its own tests."), article, covered=set(), universe=set())
    assert percent.outcome == "kept"


def test_a_range_in_the_source_gives_both_ends_their_scale_and_a_hyphen_is_not_a_different_figure():
    from workers.stock_scanner.briefing_guard import scaled_figures_in

    source = "Guidance is $330-350 million, with margin of 10 to 15% and a $1.2-billion buyback; between 40 and 45 million units."
    assert scaled_figures_in(source, ranges=True) == {
        ("350", "million"), ("330", "million"), ("15", "%"), ("10", "%"), ("1.2", "billion"), ("45", "million"), ("40", "million"),
    }  # fmt: skip
    assert ("330", "million") not in scaled_figures_in(source), "only a source is read for ranges"
    article = fb.Article("https://news.example.org/a", "https://news.example.org/a", "Helix guidance", source, "Helix")
    written = _answer(
        headline="Helix Compute",
        lead="Helix guides to $330 million to $350 million.",
        what_happened="Helix guided to between $330 million and $350 million with a margin of 10% to 15% and a $1.2 billion buyback.",
        why_it_matters="The buyback is new.",
        risks="Unit volumes of 40 million to 45 million are a forecast.",
        not_disclosed="",
        desk="news",
    )
    assert fb.item_from_answer(written, article, covered=set(), universe=set()).outcome == "kept"
    # Two unrelated numbers a model joined with "and" are not a range the source has to match.
    assert scaled_figures_in("in 2026 and 41% growth") == {("41", "%")}
    # A single letter is a scale only when glued to the number.
    assert scaled_figures_in("a 6 m tall robot, $40m raised, 20k units, a $5B fund, 38 boats") == {("40", "million"), ("20", "thousand"), ("5", "billion")}


def test_a_figure_printed_only_in_the_title_counts_because_the_model_was_shown_the_title():
    article = fb.Article("https://news.example.org/b", "https://news.example.org/b", "Lumen Foundry raises $1.2 billion", "Lumen Foundry announced a Series D today. It is a private company.", "Lumen")
    assert "$1.2 billion" in article.shown and "<page>\nLumen Foundry raises $1.2 billion" in fb.item_brief(article, [])
    answer = _answer(
        lead="Lumen Foundry raises $1.2 billion.", what_happened="Lumen Foundry announced a Series D.", why_it_matters="It is new money.", risks="Terms were not given.", not_disclosed=""
    )
    assert fb.item_from_answer(answer, article, covered=set(), universe=set()).outcome == "kept"
    empty = fb.Article(article.url, article.final_url, article.title, "   ", article.source)
    assert fb.item_from_answer(answer, empty, covered=set(), universe=set()).categories == ["source not opened"], "a title alone is not an opened page"


def test_a_ticker_the_page_does_not_print_is_a_guess_and_a_share_price_forecast_is_not_news():
    article = _article("listed-results-with-advice")
    base = dict(
        headline="Helix Compute", lead="Helix Compute's revenue rose 41%.", theme="agi-infrastructure", desk="news", listed=True, exchange="Nasdaq",
        what_happened="Helix Compute reported revenue of $318.4 million, up 41%.", why_it_matters="Backlog stood at $1.9 billion.", risks="Customer concentration.", not_disclosed="",
    )  # fmt: skip
    assert fb.item_from_answer(_answer(**base, ticker="HLXC"), article, covered=set(), universe=set()).outcome == "kept"
    guessed = fb.item_from_answer(_answer(**base, ticker="HELX"), article, covered=set(), universe=set())
    assert guessed.outcome == "removed" and guessed.categories == ["ticker not in source"]
    forecast = fb.item_from_answer(_answer(**{**base, "why_it_matters": "The shares are likely to rise on the backlog."}, ticker="HLXC"), article, covered=set(), universe=set())
    assert forecast.outcome == "removed" and forecast.categories == ["prediction"]


def test_a_short_ticker_must_sit_where_a_ticker_sits():
    page = "A spokesperson said the deal closes in March. IT spending rose. Agilent (NYSE: A) and Gartner (NYSE:IT) both reported. Helix (Nasdaq: HLXC) too."
    assert fb.ticker_printed("A", page) and fb.ticker_printed("IT", page) and fb.ticker_printed("HLXC", page)
    plain = "A spokesperson said IT spending rose at Helix Compute."
    assert not fb.ticker_printed("A", plain) and not fb.ticker_printed("IT", plain) and not fb.ticker_printed("HLXC", plain)
    assert not fb.ticker_printed("HLX", "Helix (Nasdaq: HLXC)"), "a ticker is not a prefix of another"


def test_only_the_fields_lyra_asked_for_are_read():
    article = _article()
    extra = _answer(catch_up=True, sources=[{"label": "x", "url": "https://elsewhere.example/"}], confidence=0.99)
    outcome = fb.item_from_answer(extra, article, covered=set(), universe=set())
    assert outcome.outcome == "kept" and outcome.item.catch_up is False, "a flag the model added is dropped, not trusted"
    assert fb.item_from_answer({"skip": "true"}, article, covered=set(), universe=set()).outcome == "skipped"
    assert fb.item_from_answer({"skip": " TRUE "}, article, covered=set(), universe=set()).outcome == "skipped"


def test_a_figure_outside_the_window_the_model_was_shown_does_not_count():
    """The guard checks against exactly what the model read. A page whose text was not kept is a
    page that was not opened."""
    fixture = json.loads((FIXTURES / "article-private-funding-round.json").read_text(encoding="utf-8"))
    short = fb.Article(fixture["url"], fixture["final_url"], fixture["title"], fb.article_window(fixture["text"], limit=300), fixture["source"])
    assert "$2.1 billion" not in short.text and len(short.text) <= 300
    late = _answer(why_it_matters="It has raised $2.1 billion in total.", what_happened="Lumen Foundry announced a $1.2 billion Series D.", risks="None named in the opening.")
    assert fb.item_from_answer(late, short, covered=set(), universe=set()).categories == ["figure not in source"]
    unread = fb.Article(fixture["url"], fixture["final_url"], fixture["title"], "", fixture["source"])
    assert fb.item_from_answer(_answer(), unread, covered=set(), universe=set()).categories == ["source not opened"]


def test_advice_a_guessed_ticker_and_a_repeat_are_all_removed():
    article = _article()
    advice = fb.item_from_answer(_answer(why_it_matters="Investors should consider buying into the next round."), article, covered=set(), universe=set())
    assert advice.outcome == "removed" and "advice" in advice.categories
    guessed = fb.item_from_answer(_answer(ticker="LUMN"), article, covered=set(), universe=set())
    assert guessed.categories == ["private with ticker"]
    unlisted = fb.item_from_answer(_answer(listed=True), article, covered=set(), universe=set())
    assert unlisted.categories == ["listed without ticker"]
    from workers.stock_scanner.briefing_guard import canonical_url

    repeat = fb.item_from_answer(_answer(), article, covered={canonical_url(article.final_url)}, universe=set())
    assert repeat.categories == ["already covered"]


def test_a_listed_company_keeps_its_ticker_and_only_universe_symbols_are_tagged():
    article = _article("listed-results-with-advice")
    answer = _answer(
        headline="Helix Compute (Nasdaq: HLXC)",
        lead="Helix Compute's revenue rose 41% as margins narrowed.",
        theme="agi-infrastructure",
        desk="news",
        listed=True,
        exchange="Nasdaq",
        ticker="hlxc",
        what_happened="Helix Compute reported third-quarter revenue of $318.4 million, up 41%, with gross margin at 27.5%.",
        why_it_matters="Backlog stood at $1.9 billion while two customers made up 58% of revenue.",
        risks="Customer concentration and the timing of the plant ramp.",
        not_disclosed="A margin outlook.",
        lyra_symbols=["NVDA", "HLXC", "nvda"],
    )
    outcome = fb.item_from_answer(answer, article, covered=set(), universe=set(UNIVERSE))
    assert outcome.outcome == "kept" and outcome.item.ticker == "HLXC" and outcome.item.lyra_symbols == ("NVDA",)
    assert outcome.item.sources[0].label == "Helix Compute investor relations"


def test_a_skip_or_a_shapeless_answer_is_not_an_item():
    article = _article("weekly-roundup")
    assert fb.item_from_answer({"skip": True}, article, covered=set(), universe=set()).outcome == "skipped"
    assert fb.item_from_answer(None, article, covered=set(), universe=set()).outcome == "unparsable"
    assert fb.item_from_answer({"skip": False, "headline": "Only a headline"}, article, covered=set(), universe=set()).outcome == "unparsable"


def test_the_window_is_the_start_of_the_page_cut_at_a_natural_break():
    text = "Title line\n\n\n\n" + "First paragraph.   It has   two sentences.\n\n" + ("Filler sentence number one. " * 400)
    window = fb.article_window(text, limit=500)
    assert window.startswith("Title line\n\nFirst paragraph. It has two sentences.") and len(window) <= 500 and window.endswith(".")
    assert fb.article_window("  short page  ") == "short page" and fb.article_window("") == ""


def test_a_model_that_fails_hands_the_page_on_but_a_removed_item_gets_no_second_opinion(monkeypatch):
    _keys(monkeypatch)
    article = _article()
    targets = om.parse_chain("groq:openai/gpt-oss-120b,cloudflare:@cf/google/gemma-4-26b-a4b-it")

    post = Recorder(FakeResponse(status=429), FakeResponse(payload=chat(json.dumps(_answer()))))
    monkeypatch.setattr(om.requests, "post", post)
    outcome, tried = fb.write_item(article, targets, covered=set(), universe=UNIVERSE)
    assert outcome.outcome == "kept" and outcome.item.headline == "Lumen Foundry"
    assert tried == [("groq:openai/gpt-oss-120b", "rate_limit"), ("cloudflare:@cf/google/gemma-4-26b-a4b-it", "kept")]
    sent = post.calls[1]["json"]
    assert sent["response_format"] == {"type": "json_object"} and post.calls[0]["json"]["response_format"]["type"] == "json_schema"
    assert "<page>" in sent["messages"][1]["content"] and "AMD, MSFT, NVDA" in sent["messages"][1]["content"]

    post = Recorder(FakeResponse(payload=chat("Sure! Here you go.")), FakeResponse(payload=chat("```json\n" + json.dumps({"skip": True}) + "\n```")))
    monkeypatch.setattr(om.requests, "post", post)
    outcome, tried = fb.write_item(article, targets, covered=set(), universe=UNIVERSE)
    assert outcome.outcome == "skipped" and [result for _spec, result in tried] == ["unparsable", "skipped"]

    wrong = _answer(what_happened="Lumen Foundry raised $5 billion.")
    post = Recorder(FakeResponse(payload=chat(json.dumps(wrong))), FakeResponse(payload=chat(json.dumps(_answer()))))
    monkeypatch.setattr(om.requests, "post", post)
    outcome, tried = fb.write_item(article, targets, covered=set(), universe=UNIVERSE)
    assert outcome.item is None and outcome.outcome == "removed" and len(post.calls) == 1, "asking until something passes is how a wrong item gets through"

    assert fb.write_item(article, [], covered=set(), universe=UNIVERSE)[0].outcome == "no_model"


def test_the_schema_is_strict_and_the_prompt_plainly_written():
    properties = fb.ITEM_SCHEMA["properties"]
    assert fb.ITEM_SCHEMA["additionalProperties"] is False and sorted(fb.ITEM_SCHEMA["required"]) == sorted(properties)
    assert "sources" not in properties, "the model is never asked for a URL"
    assert "—" not in fb.ITEM_PROMPT and "–" not in fb.ITEM_PROMPT
    assert fb.PROMPT_VERSION.startswith("free_briefing@")


@pytest.mark.parametrize("label", ["government-contract", "listed-results-with-advice", "weekly-roundup", "private-funding-round"])
def test_every_bakeoff_article_is_marked_synthetic_and_fits_the_window(label):
    fixture = json.loads((FIXTURES / f"article-{label}.json").read_text(encoding="utf-8"))
    assert fixture["synthetic"] is True and "invented" in fixture["note"]
    assert len(fixture["text"]) <= fb.ARTICLE_WINDOW_CHARS and "example." in fixture["url"]
