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
    assert verdict.categories == ["ticker not in the facts", "spelled-out figure"]


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
