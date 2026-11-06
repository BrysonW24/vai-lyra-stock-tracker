"""The hourly summary's guard: the model may only say what the facts said, about the thing they said it about."""
from __future__ import annotations

from workers.stock_scanner.ai_read_guard import FactSheet, figures_in, guard_ai_read


def _sheet() -> FactSheet:
    sheet = FactSheet()
    sheet.say(sheet.general("Names scanned this hour: 99."))
    sheet.say(sheet.general("Breadth this hour: 61 up, 32 down, 6 flat."))
    sheet.say("Biggest gains this hour: " + sheet.about("NVDA", "NVDA up 2.1%") + ", " + sheet.about("AMD", "AMD up 1.8%") + ".")
    sheet.say("Biggest falls this hour: " + sheet.about("SNOW", "SNOW down 1.9%") + ".")
    sheet.say("Became strong setups on this bar: " + sheet.about("COIN", "COIN (score 95, from 58)") + ".")
    sheet.say(sheet.general("Market backdrop: S&P 500 up 0.7% on the day, VIX at 16.1."))
    sheet.say("The reader's holdings: " + sheet.about("MSFT", "MSFT: down 0.2% this hour, position up 14.2% overall") + ".")
    return sheet


def test_figures_carry_unit_and_direction():
    found = {figure.token: figure.direction for figure in figures_in("NVDA up 2.1%, SNOW fell 1.9%, score 95, change of +12, -0.4%, 3.1x volume, $12")}
    assert found == {"2.1%": 1, "1.9%": -1, "95": None, "12": 1, "0.4%": -1, "3.1x": None, "$12": None}


def test_a_grounded_read_passes_unchanged():
    text = (
        "Breadth was broad, with 61 of the 99 names up on the hour. NVDA led at up 2.1% while SNOW lagged, down 1.9%. "
        "COIN became a strong setup with its score at 95. The backdrop was firm, with the S&P 500 up 0.7% on the day."
    )
    verdict = guard_ai_read(text, _sheet())
    assert verdict.ok and verdict.removed == []
    assert verdict.text == text


def test_a_figure_the_facts_never_gave_removes_only_its_sentence():
    text = "NVDA led at up 2.1%. AMD gained 4.5% on heavy volume. SNOW lagged, down 1.9%."
    verdict = guard_ai_read(text, _sheet())
    assert verdict.ok
    assert verdict.removed == ["AMD gained 4.5% on heavy volume."]
    assert verdict.categories == ["figure not in the facts for this subject"]
    assert verdict.text == "NVDA led at up 2.1%. SNOW lagged, down 1.9%."


def test_a_tickers_figure_cannot_be_moved_to_another_ticker():
    # 1.8% is AMD's figure; attributing it to SNOW is wrong even though the figure exists in the facts
    verdict = guard_ai_read("SNOW rose 1.8% on the hour. NVDA led at up 2.1%. Breadth was broad with 61 names up.", _sheet())
    assert verdict.ok
    assert verdict.removed == ["SNOW rose 1.8% on the hour."]


def test_a_pronoun_sentence_inherits_the_previous_tickers():
    verdict = guard_ai_read("NVDA led the hour. It added 2.1% on the bar. Breadth was broad with 61 names up.", _sheet())
    assert verdict.ok and verdict.removed == []


def test_direction_flips_are_caught():
    verdict = guard_ai_read("NVDA fell 2.1% on the hour. SNOW lagged, down 1.9%. Breadth was broad with 61 names up.", _sheet())
    assert verdict.ok
    assert verdict.removed == ["NVDA fell 2.1% on the hour."]
    assert "direction contradicts the facts" in verdict.categories
    signed = guard_ai_read("NVDA ended at -2.1%. SNOW lagged, down 1.9%. Breadth was broad with 61 names up.", _sheet())
    assert signed.removed == ["NVDA ended at -2.1%."]


def test_a_figure_with_no_stated_direction_is_not_direction_checked():
    # 95 is a score; "rose to 95" claims no direction the facts contradict
    verdict = guard_ai_read("COIN rose to 95 and became a strong setup. NVDA led at up 2.1%.", _sheet())
    assert verdict.ok and verdict.removed == []


def test_general_figures_may_appear_anywhere():
    verdict = guard_ai_read("Only 32 names fell. The VIX sat at 16.1 and the S&P 500 rose 0.7%.", _sheet())
    assert verdict.ok and verdict.removed == []


def test_unknown_tickers_and_spelled_out_magnitudes_are_removed():
    text = "NVDA led at up 2.1%. TSLA ripped higher. Roughly forty percent of names rose. SNOW lagged, down 1.9%."
    verdict = guard_ai_read(text, _sheet())
    assert verdict.ok
    assert verdict.removed == ["TSLA ripped higher.", "Roughly forty percent of names rose."]
    # "forty percent" is read as 40% and checked like any other figure: nobody's facts hold it.
    assert verdict.categories == ["ticker not in the facts", "figure not in the facts for this subject"]

    # A magnitude that cannot be read as a number is still not allowed.
    doubled = guard_ai_read("NVDA led at up 2.1%. Volume doubled across the scan. SNOW lagged, down 1.9%.", _sheet())
    assert doubled.removed == ["Volume doubled across the scan."] and doubled.categories == ["spelled-out figure"]


def test_market_vocabulary_is_not_a_ticker():
    verdict = guard_ai_read("The VIX and the RSI picture matter for US names. NVDA led at up 2.1%. MACD readings improved broadly.", _sheet())
    assert verdict.ok and verdict.removed == []


def test_advice_blocks_the_whole_read():
    verdict = guard_ai_read("NVDA led at up 2.1%. You should buy it now. SNOW lagged, down 1.9%.", _sheet())
    assert not verdict.ok and verdict.text == ""
    assert "advice" in verdict.categories


def test_too_little_surviving_blocks_the_read():
    verdict = guard_ai_read("AMD gained 4.5%. TSLA led.", _sheet())
    assert not verdict.ok and "too short" in verdict.categories
    assert guard_ai_read("   ", _sheet()).ok is False


def test_markdown_noise_is_stripped_and_long_reads_are_capped():
    text = "**NVDA** led at up 2.1%. " + " ".join("Breadth stayed broad with 61 names up." for _ in range(12))
    verdict = guard_ai_read(text, _sheet())
    assert verdict.ok
    assert verdict.text.startswith("NVDA led")
    assert verdict.text.count(". ") + 1 == 10


def test_holdings_figures_attach_to_the_holding():
    sheet = _sheet()
    ok = guard_ai_read("MSFT slipped 0.2% this hour but the position is still up 14.2% overall. NVDA led at up 2.1%.", sheet)
    assert ok.ok and ok.removed == []
    wrong = guard_ai_read("NVDA is up 14.2% overall. SNOW lagged, down 1.9%.", sheet)
    assert wrong.removed == ["NVDA is up 14.2% overall."]


def test_paragraph_breaks_survive_and_empty_paragraphs_vanish():
    text = (
        "NVDA led at up 2.1%. SNOW lagged, down 1.9%.\n\n"
        "AMD gained 4.5% on heavy volume.\n\n"
        "COIN became a strong setup with its score at 95.   \n  \n  Breadth was broad with 61 names up."
    )
    verdict = guard_ai_read(text, _sheet())
    assert verdict.ok
    assert verdict.text == "NVDA led at up 2.1%. SNOW lagged, down 1.9%.\n\nCOIN became a strong setup with its score at 95.\n\nBreadth was broad with 61 names up."
    assert verdict.removed == ["AMD gained 4.5% on heavy volume."]


# --- widened on 2026-11-06 for open-weight models (contracts/guardrails/advice.json) --------------

import json  # noqa: E402
import re  # noqa: E402

import pytest  # noqa: E402

from workers.stock_scanner.ai_read_guard import CONTRACT_PATH, advice_findings, prediction_findings, price_call_findings  # noqa: E402

CONTRACT = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))


def test_a_percentage_written_in_words_is_the_same_figure():
    found = {figure.token: figure.direction for figure in figures_in("gained 12 percent, fell 3 per cent, up 4pct, 7 percentage points, 2.1%, rose 9  percent")}
    assert found == {"12%": 1, "3%": -1, "4%": 1, "7": None, "2.1%": None, "9%": 1}
    # 99 is a count in the facts; "99 percent" is a different claim and is not grounded by it.
    verdict = guard_ai_read("Breadth was broad, with 61 names up. Nearly 99 percent of names moved. NVDA led at up 2.1%.", _sheet())
    assert verdict.removed == ["Nearly 99 percent of names moved."] and verdict.categories == ["figure not in the facts for this subject"]


def _group_sheet() -> FactSheet:
    sheet = FactSheet()
    sheet.say(sheet.general("Breadth on the session: 31 up, 30 down."))
    sheet.say(
        "By group: "
        + sheet.about_subject("cybersecurity", "cybersecurity up 2.4% on average, 9 of 9 names up")
        + ", led by "
        + sheet.about("PANW", "PANW up 5.0%")
        + "; "
        + sheet.about_subject("consumer internet", "consumer internet down 2.4% on average, 2 of 7 names up")
        + "; "
        + sheet.about_subject("semiconductors", "semiconductors down 1.7% on average, 1 of 7 names up")
        + "."
    )
    return sheet


def test_a_groups_direction_cannot_be_handed_to_another_group():
    """Two groups moved 2.4% in opposite directions. Read as general figures alone, 'cybersecurity
    fell 2.4%' is grounded (2.4% was stated, and stated as a fall); it is still false."""
    sheet = _group_sheet()
    wrong = guard_ai_read("Cybersecurity fell 2.4% on average. Breadth was split, 31 up. Consumer internet rose 2.4% on average. PANW was up 5.0%.", sheet)
    assert wrong.removed == ["Cybersecurity fell 2.4% on average.", "Consumer internet rose 2.4% on average."]
    assert set(wrong.categories) == {"direction contradicts the facts"} and wrong.text == "Breadth was split, 31 up. PANW was up 5.0%."
    right = guard_ai_read("Cybersecurity rose 2.4% on average, led by PANW up 5.0%. Consumer internet fell 2.4% on average.", sheet)
    assert right.ok and right.removed == []
    # Naming both groups in one sentence allows each its own direction; the singular still names the group.
    both = guard_ai_read("Cybersecurity rose 2.4% while consumer internet fell 2.4%. Semiconductor stocks rose 1.7% on average. Breadth was split, 31 up.", sheet)
    assert both.removed == ["Semiconductor stocks rose 1.7% on average."]
    # A sentence that names no group may still quote the figure with a direction the facts gave it.
    assert guard_ai_read("The best group rose 2.4% on average. Breadth was split, with 31 up and 30 down.", sheet).removed == []


def test_a_group_owns_only_the_figures_in_its_own_clause_and_a_longer_name_is_not_a_shorter_one():
    sheet = FactSheet()
    sheet.say(sheet.general("Median move on the session: up 0.8%. Breadth: 31 up, 30 down."))
    sheet.say(
        sheet.about_subject("semiconductors", "semiconductors down 0.8% on average")
        + "; "
        + sheet.about_subject("software", "software up 1.4% on average")
        + "; "
        + sheet.about_subject("enterprise software", "enterprise software down 1.4% on average")
        + "."
    )
    # The median's 0.8% is not the group's, though the group is named earlier in the sentence.
    kept = guard_ai_read("Semiconductors lagged while the median name rose 0.8%. Breadth was split, with 31 up.", sheet)
    assert kept.ok and kept.removed == []
    # "Enterprise software" is its own group: it does not borrow software's direction.
    swapped = guard_ai_read("Enterprise software rose 1.4% on average. Software rose 1.4% on average. Breadth was split, with 31 up.", sheet)
    assert swapped.removed == ["Enterprise software rose 1.4% on average."] and swapped.categories == ["direction contradicts the facts"]
    assert guard_ai_read("Enterprise software fell 1.4% on average. Breadth was split, with 31 up.", sheet).removed == []
    # A clause that names no group carries on about the sentence's group, unless it names a
    # measure of the whole scan (the median, above).
    for wrong in (
        "Semiconductors were the weak spot: the group rose 0.8% on average.",
        "Semiconductors, though weak early, rose 0.8% on average.",
        "Semiconductors slipped early but the group rose 0.8% on average.",
    ):
        assert guard_ai_read(wrong + " Breadth was split, with 31 up and 30 down.", sheet).removed == [wrong], wrong
    # In one clause the group still owns its figure, wherever in the clause its name sits.
    assert guard_ai_read("Semiconductors, the weakest group, rose 0.8% on average. Breadth was split, with 31 up and 30 down.", sheet).removed == [
        "Semiconductors, the weakest group, rose 0.8% on average."
    ]


def test_a_sentence_that_predicts_is_removed_and_the_read_stands():
    text = "NVDA led at up 2.1%. The strength is likely to continue tomorrow. SNOW lagged, down 1.9%. Expect more weakness in software."
    verdict = guard_ai_read(text, _sheet())
    assert verdict.ok and verdict.text == "NVDA led at up 2.1%. SNOW lagged, down 1.9%."
    assert set(verdict.categories) == {"prediction"} and len(verdict.removed) == 2


@pytest.mark.parametrize("sentence", CONTRACT["vectors"]["advice_blocks"])
def test_every_advice_sentence_in_the_contract_blocks_the_whole_read(sentence):
    assert advice_findings(sentence), sentence
    verdict = guard_ai_read("NVDA led at up 2.1%. SNOW lagged, down 1.9%. " + sentence, _sheet())
    assert not verdict.ok and verdict.text == "" and "advice" in verdict.categories


@pytest.mark.parametrize(
    "sentence",
    [
        "You should buy NVDA before it rebounds tomorrow.",  # advice and a forecast in one sentence
        "Investors should buy NVDA, which is likely to rebound.",
        "Buy NVDA now, it could rally further.",
        "Buy SPOT now.",  # advice about a ticker the facts never named
        "AMD gained 4.5%, so you should buy it.",  # advice beside a figure the facts never gave
    ],
)
def test_advice_in_a_sentence_deleted_for_another_reason_still_blocks_the_read(sentence):
    """A forecast, an unknown ticker or an invented figure gets a sentence deleted. If the advice
    check read only what survived, that deletion would carry the advice out and the rest would be
    sent as though the model had behaved."""
    verdict = guard_ai_read("NVDA led at up 2.1%. SNOW lagged, down 1.9%. " + sentence, _sheet())
    assert not verdict.ok and verdict.text == "" and "advice" in verdict.categories


def test_advice_past_the_sentence_cap_still_blocks():
    padding = " ".join(["NVDA led at up 2.1%."] * 11)
    assert not guard_ai_read(padding + " Buy NVDA now.", _sheet()).ok


@pytest.mark.parametrize("sentence", CONTRACT["vectors"]["price_call_removes"])
def test_every_share_price_forecast_in_the_contract_is_caught(sentence):
    assert price_call_findings(sentence), sentence


@pytest.mark.parametrize("sentence", CONTRACT["vectors"]["price_call_keeps"])
def test_reporting_what_a_share_did_or_when_it_lists_is_not_a_forecast(sentence):
    assert price_call_findings(sentence) == [], sentence


@pytest.mark.parametrize("sentence", CONTRACT["vectors"]["advice_passes"])
def test_describing_the_market_is_not_advice(sentence):
    assert advice_findings(sentence) == [], sentence


@pytest.mark.parametrize("sentence", CONTRACT["vectors"]["prediction_removes"])
def test_every_prediction_sentence_in_the_contract_is_caught(sentence):
    assert prediction_findings(sentence), sentence


@pytest.mark.parametrize("sentence", CONTRACT["vectors"]["prediction_keeps"])
def test_describing_what_happened_is_not_a_prediction(sentence):
    assert prediction_findings(sentence) == [], sentence


def test_the_contract_uses_only_regex_both_python_and_javascript_read_the_same_way():
    for group in ("advice", "prediction", "price_call"):
        assert CONTRACT[group], group
        for entry in CONTRACT[group]:
            pattern = entry["pattern"]
            assert entry["flags"] in ("i", ""), entry["id"]
            assert "(?<" not in pattern and "(?P" not in pattern and "(?i" not in pattern, f"{entry['id']}: lookbehind, named groups and inline flags differ between the two engines"
            assert "—" not in entry["why"] and "–" not in entry["why"]
            re.compile(pattern)
    groups = ("advice", "prediction", "price_call")
    assert len({entry["id"] for group in groups for entry in CONTRACT[group]}) == sum(len(CONTRACT[group]) for group in groups)
