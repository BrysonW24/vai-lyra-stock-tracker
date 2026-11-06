"""What a figure means - the checks a figure check cannot make (workers/stock_scanner/read_meaning.py).

Every "wrong" sentence below was written by an open model in the first bake-off (2026-11-06) about
one of the three sessions in tests/fixtures/bakeoff, quoting only true figures, and passed the
figure check. Every "right" sentence is one the same models wrote about the same sessions that is
true, and must survive.
"""
from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from workers.stock_scanner.ai_read_guard import guard_ai_read
from workers.stock_scanner.daily_read import build_facts, build_meaning, build_sheet
from workers.stock_scanner.read_meaning import (
    ReadMeaning,
    count_problems,
    counted_digits,
    digits_for_words,
    meaning_problems,
    membership_problems,
    names_for,
    rank_problems,
    status_problems,
)

FIXTURES = Path(__file__).parent / "fixtures" / "bakeoff"
THRESHOLDS = SimpleNamespace(alert_score_threshold=75, watchlist_score_threshold=60)


def _facts(label: str):
    fixture = json.loads((FIXTURES / f"session-{label}.json").read_text(encoding="utf-8"))
    return build_facts(fixture["rows"], THRESHOLDS, daily=True)


@pytest.fixture(scope="module")
def selloff() -> ReadMeaning:
    return build_meaning(_facts("broad-selloff"))


@pytest.fixture(scope="module")
def rally() -> ReadMeaning:
    return build_meaning(_facts("broad-rally"))


@pytest.fixture(scope="module")
def quiet() -> ReadMeaning:
    return build_meaning(_facts("quiet"))


# --- numbers written as words -----------------------------------------------------------------


@pytest.mark.parametrize(
    ("written", "read"),
    [
        ("only one name up out of sixty-one scanned", "only 1 name up out of 61 scanned"),
        ("twenty-five names weakening and no strong setups", "25 names weakening and no strong setups"),
        ("Twelve names moved into watchlist territory", "12 names moved into watchlist territory"),
        ("the lone one to rise", "the lone one to rise"),  # a pronoun, not a count
        ("no one expected it", "no one expected it"),
        ("AKAM and one more", "AKAM and 1 more"),
        ("sixty‑one names and a one‑up, 60‑down day", "61 names and a one-up, 60-down day"),
        ("forty five names", "45 names"),
        ("Seventeen of nineteen", "17 of 19"),
    ],
)
def test_a_number_written_as_a_word_is_read_as_that_number(written: str, read: str) -> None:
    assert digits_for_words(written) == read


@pytest.mark.parametrize(
    ("written", "checked"),
    [
        # A number word in front of something the facts count is a count, and is checked as one.
        ("sixty-one names were scanned", "61 names were scanned"),
        ("Seven prior strong setups dropped out", "7 prior strong setups dropped out"),
        ("Only one name rose while sixty others fell", "Only 1 name rose while 60 others fell"),
        ("Forty-four names hit new lows", "44 names hit new lows"),
        # A number word that counts nothing the facts count is a turn of phrase, and is left alone.
        ("Seven of the eight groups fell", "Seven of the eight groups fell"),
        ("outnumbered by more than three to one", "outnumbered by more than three to one"),
        ("A twenty-four hour rout left no group untouched", "A twenty-four hour rout left no group untouched"),
        ("Strong setups dropped to four from seven", "Strong setups dropped to four from seven"),
        ("one of the hardest-hit groups", "one of the hardest-hit groups"),
        # The reader's own book: the session's totals say nothing about it.
        ("Two of your holdings are now weakening", "Two of your holdings are now weakening"),
        ("Three names on your watchlist are near a trigger", "Three names on your watchlist are near a trigger"),
        ("Two of the names you hold were invalidated", "Two of the names you hold were invalidated"),
    ],
)
def test_only_a_count_of_names_or_setups_is_read_as_a_figure(written: str, checked: str) -> None:
    assert counted_digits(written) == checked


def test_names_a_group_goes_by_are_longest_first() -> None:
    assert names_for("cloud_data", "cloud and data") == ("cloud and data", "cloud & data", "cloud")
    assert names_for("mega_cap_platform", "mega-cap platforms")[0] == "mega cap platforms"
    assert names_for("made_up", "Made-Up Group") == ("made up group",)


# --- the facts, as the checks hold them --------------------------------------------------------


def test_the_meaning_is_built_from_the_session_facts(selloff: ReadMeaning) -> None:
    assert selloff.counts["weakening"]["any"] == frozenset({25})
    assert selloff.counts["invalidated"]["any"] == frozenset({6})
    assert selloff.counts["no_signal"]["any"] == frozenset({23})
    assert selloff.counts["strong"]["became"] == frozenset({0})
    assert selloff.counts["strong"]["dropped"] == frozenset({7, 6})
    assert selloff.counts["strong"]["now"] == frozenset({0}) and selloff.counts["strong"]["prior"] == frozenset({7})
    assert selloff.counts["watchlist"]["became"] == frozenset({2})
    assert selloff.group_order[0] == "mega_cap_platform" and selloff.group_order[-1] == "semiconductor"
    assert selloff.member["TER"] == "semiconductor" and selloff.member["SNAP"] == "consumer_internet"
    assert selloff.status_now["MSFT"] == "watchlist" and selloff.status_now["AMD"] == "invalidated"


# --- a count given the wrong meaning -------------------------------------------------------------


def test_a_count_attached_to_the_wrong_status_is_caught(selloff: ReadMeaning, rally: ReadMeaning, quiet: ReadMeaning) -> None:
    # 25 names were weakening; 7 is how many dropped out of strong setup.
    assert count_problems("Lyra's score engine found no new strong setups, but 7 names weakened from the previous close, 6 invalidated and 7 dropped out of strong setups.", selloff) == ["7 weakening"]
    # 6 strong setups were invalidated; 7 dropped out.
    assert count_problems("This widespread decline invalidated seven strong setups and pushed twenty-five others into weakening status.", selloff) == ["7 invalidated"]
    # 23 names had no signal.
    assert count_problems("Seven names fell from strong to no signal.", selloff) == ["7 no signal"]
    # 12 names were on the watchlist at the close; 7 moved onto it.
    assert count_problems("Twelve names moved into watchlist territory as scores improved, but 16 setups weakened and 3 invalidated, leaving 27 with no signal.", rally) == ["12 watchlist"]
    # 2 new strong setups; 4 in all.
    assert count_problems("Lyra's score engine marked 4 new strong setups, including PTC and SPOT, while five names slipped out of strong status.", quiet) == ["4 strong"]


def test_a_total_said_to_have_moved_is_checked_at_both_ends(selloff: ReadMeaning, quiet: ReadMeaning) -> None:
    # 7 strong setups at the previous close, none at this one.
    assert count_problems("Strong setups fell to six from seven.", selloff) == ["6 strong"]
    assert count_problems("Strong setups fell to 0 from 7.", selloff) == []
    assert count_problems("Strong setups dropped to 4 from 2.", quiet) == ["2 strong"]  # 7 before, 4 now
    assert count_problems("The number of strong setups rose to 4 from 2.", quiet) == ["2 strong"]
    assert count_problems("The number of strong setups fell to 4 from 7.", quiet) == []
    # A score that follows the word "setups" is still a score.
    assert count_problems("PTC and SPOT became strong setups as their scores jumped to 75.", quiet) == []
    assert count_problems("NOW moved to a watchlist setup after its score rose to 60 from 33.", quiet) == []


@pytest.mark.parametrize(
    "sentence",
    [
        # The reader's own book: its counts are not the session's.
        "Two of your holdings are now weakening.",
        "Your 2 holdings in semiconductors are weakening.",
        "Two of the names you hold were invalidated.",
        "Three names on your watchlist are near a trigger.",
        # A status word that is not the status.
        "60 of 61 names fell and no strong setups remained.",
        "Just 1 name rose and strong setups disappeared from the scan.",
        "Only one name showed strong buying, RPD up 2.7%.",
        "Eleven names fell on weakening momentum in semiconductors.",
    ],
)
def test_a_count_that_is_not_about_the_sessions_setups_is_left_alone(sentence: str, selloff: ReadMeaning) -> None:
    assert count_problems(sentence, selloff) == []


@pytest.mark.parametrize(
    "sentence",
    [
        "At close Lyra had no strong setups, 7 watchlist setups, 25 weakening, 6 invalidated and 23 no signal.",
        "Seven prior strong setups dropped out, and six names, including AMD and HOOD, were invalidated.",
        "Six strong setups were invalidated - CRM, SNAP, ANET, DBX, AMD and HOOD.",
        "The session caused a sharp erosion of conviction, with 7 strong setups dropping out and 6 names invalidated.",
        "ANET saw a sharp score fall to 53 from 100, while ESTC and AKAM showed the biggest score rises, moving to 63 and 38 respectively.",
        "MSFT, CRM, SNAP, ANET, DBX, AMD and one more dropped out of strong setup.",
        "Breadth was heavily skewed, showing 1 up and 60 down.",
        "AMD fell 17.3%, DOCN 15.9% and TER 15.2%.",
        "The remaining names: 25 weakening and 23 with no signal.",
    ],
)
def test_true_counts_about_the_selloff_are_left_alone(sentence: str, selloff: ReadMeaning) -> None:
    assert count_problems(sentence, selloff) == []


@pytest.mark.parametrize(
    "sentence",
    [
        "At close Lyra has three strong setups, twelve watchlist setups and sixteen weakening.",
        "Two names became strong, AKAM (score 85, from 48) and COIN (score 80, from 43).",
        "Four names dropped from strong, DBX, IBM, DOCU and NOW.",
        "Seven names entered watchlist, including HOOD, DELL, NET, AI, SNAP, TENB and one more.",
        "Watchlist setups grew to 12, with HOOD, DELL, NET, AI, SNAP and TENB joining the list.",
        "Overall, 16 names weakened, 3 invalidated and 27 showed no signal at close.",
        "The quality of early-turn setups weakened, as the number of strong setups dropped to 3.",
        "Three former strong setups including IBM and DOCU were invalidated after their scores fell sharply.",
        "Cloud and data led the day, up 5.8% on average, all six names in that group moving higher.",
        "Semiconductors slipped 0.6% on average, three of seven names up, SWKS down 5.4% the biggest fall.",
    ],
)
def test_true_counts_about_the_rally_are_left_alone(sentence: str, rally: ReadMeaning) -> None:
    assert count_problems(sentence, rally) == []


# --- a group ranked wrongly ----------------------------------------------------------------------


def test_a_group_called_the_worst_when_it_was_not_is_caught(selloff: ReadMeaning) -> None:
    wrong = "Mega‑cap platforms, software, cybersecurity, consumer internet, fintech, cloud and data, AI infrastructure and semiconductors all fell, with the worst average loss in AI infrastructure at 11.3%."
    assert rank_problems(wrong, selloff) == ["worst: ai_infrastructure"]
    assert rank_problems("Mega-cap platforms were the hardest hit.", selloff) == ["worst: mega_cap_platform"]
    assert rank_problems("Semiconductors led the session.", selloff) == ["best: semiconductor"]


@pytest.mark.parametrize(
    "sentence",
    [
        "All groups slipped, with the largest average drops in AI infrastructure (11.3%) and semiconductors (11.5%).",
        "Semiconductors were the worst group, down 11.5% on average.",
        "Mega-cap platforms held up best, down 2.4% on average.",
        "Semiconductors and cloud names were among the hardest hit, weighed by AMD down 17.3% and DOCN down 15.9%.",
        "AMD led the declines with a sharp drop of 17.3%.",
        "The biggest score rises were ESTC, AKAM and ENTG.",
        "RPD posted the biggest gain, up 2.7%.",
        # A hedge is a claim about a set, not about the extreme.
        "Cybersecurity was one of the hardest-hit groups, down 6.4% on average.",
        "Software was among the best groups, down 3.1% on average.",
        # About one stock, not about the group.
        "Cybersecurity held the day's biggest gain, RPD up 2.7%.",
        "Consumer internet had the worst single move, SNAP down 14.0%.",
        "Semiconductors had the worst performer, AMD down 17.3%.",
    ],
)
def test_true_or_unranked_statements_about_groups_are_left_alone(sentence: str, selloff: ReadMeaning) -> None:
    assert rank_problems(sentence, selloff) == []


def test_the_two_weakest_groups_may_be_named_together(quiet: ReadMeaning) -> None:
    assert rank_problems("Conversely, the consumer internet and fintech groups were the weakest, led by ABNB down 7.6% and AFRM down 5.1%.", quiet) == []
    assert rank_problems("Consumer internet and fintech saw the largest average declines, with ABNB down 7.6% and AFRM down 5.1%.", quiet) == []
    assert rank_problems("Cybersecurity led the session with an average gain of 2.4%.", quiet) == []
    assert rank_problems("Software and fintech saw the largest average declines.", quiet) == ["worst: fintech_tech, software"]


# --- a ticker in the wrong group -------------------------------------------------------------------


def test_a_ticker_tied_to_a_group_it_is_not_in_is_caught(quiet: ReadMeaning) -> None:
    assert membership_problems("In contrast, fintech fell 3.0% on average, all five names down, with AFRM dropping 5.1% and SNAP 5.9%.", quiet) == ["SNAP is not in fintech_tech"]
    assert membership_problems("The biggest falls were ABNB down 7.6%, SNAP down 5.9% and AFRM down 5.1%, pulling the fintech group into a 3.0% decline.", quiet) == [
        "ABNB is not in fintech_tech",
        "SNAP is not in fintech_tech",
    ]


@pytest.mark.parametrize(
    "sentence",
    [
        "Cybersecurity led the session with an average gain of 2.4%, driven by PANW up 5.0% and CRWD up 5.0%.",
        "Conversely, the consumer internet and fintech groups were the weakest, led by ABNB down 7.6% and AFRM down 5.1%.",
        "Cybersecurity led the charge, while ABNB and AFRM fell 7.6% and 5.1% respectively.",
        "PANW and CRWD each gained 5.0%, while ABNB fell 7.6% and AFRM dropped 5.1%.",
        # "AI" here is part of the group's name, not the ticker AI (which is a software name).
        "Nearly every major group, including semiconductors and AI infrastructure, saw zero names up.",
        "Cybersecurity and consumer‑internet names also climbed, with CRWD and SPOT posting gains in their sectors.",
        # A comparison is not a membership claim.
        "ABNB fell 7.6% compared with a 1.0% average rise in software.",
        "MSFT, unlike the semiconductors, held up relatively well.",
        "PANW rose more than fintech as a whole.",
    ],
)
def test_tickers_named_with_their_own_group_are_left_alone(sentence: str, quiet: ReadMeaning) -> None:
    assert membership_problems(sentence, quiet) == []


# --- a ticker sent to a status it does not have ------------------------------------------------------


def test_a_ticker_sent_to_a_status_it_does_not_hold_is_caught(selloff: ReadMeaning) -> None:
    found = status_problems("MSFT, CRM, SNAP, ANET, DBX, AMD and one more fell from strong to no signal.", selloff)
    assert "MSFT is watchlist, not no signal" in found
    assert "AMD is invalidated, not no signal" in found


@pytest.mark.parametrize(
    "sentence",
    [
        "ADBE and ESTC moved into watchlist setups.",
        "MSFT slipped to watchlist from strong setup.",
        "ESTC saw its score rise to 63 from 43.",
        "AMD and HOOD were invalidated.",
        "Leaders such as MSFT and CRM lost their strong setup status as their scores fell sharply.",
        # The destination belongs to the ticker next to it, not to every ticker in the sentence.
        "MSFT and CRM both fell out of strong setup, MSFT to a watchlist setup.",
        "ADBE and ESTC became watchlist setups.",
    ],
)
def test_true_statements_about_where_a_ticker_ended_are_left_alone(sentence: str, selloff: ReadMeaning) -> None:
    assert status_problems(sentence, selloff) == []


def test_a_ticker_said_to_have_become_what_it_is_not_is_caught(rally: ReadMeaning) -> None:
    # AKAM and COIN became strong setups; NET became a watchlist setup.
    assert status_problems("AKAM, COIN and NET became strong setups.", rally) == ["NET is watchlist, not strong"]
    assert status_problems("AKAM and COIN became strong setups.", rally) == []


# --- together, and through the guard -----------------------------------------------------------------


def test_nothing_is_checked_without_the_facts() -> None:
    assert meaning_problems("7 names weakened and SNAP is fintech.", None) == []
    assert meaning_problems("7 names weakened and SNAP is fintech.", ReadMeaning()) == []


def test_the_categories_are_safe_to_log(selloff: ReadMeaning) -> None:
    found = meaning_problems("MSFT, CRM and AMD fell from strong to no signal, 7 names weakened.", selloff)
    categories = {category for category, _detail in found}
    assert categories == {"count contradicts the facts", "status contradicts the facts"}
    assert meaning_problems("Software was one of the hardest-hit groups.", selloff) == []  # the hedge survives being read
    assert all(not any(char.isupper() for char in category) for category in categories)  # no ticker in a category


def test_the_guard_removes_a_sentence_that_misreads_a_true_figure() -> None:
    facts = _facts("broad-selloff")
    sheet = build_sheet(facts)
    read = (
        "The session was a sharp sell-off, with 60 of 61 names down and a median move down 7.7%. "
        "Lyra's score engine found no new strong setups, but 7 names weakened from the previous close. "
        "AMD fell 17.3%, DOCN 15.9% and TER 15.2%."
    )
    verdict = guard_ai_read(read, sheet)
    assert verdict.ok
    assert verdict.removed == ["Lyra's score engine found no new strong setups, but 7 names weakened from the previous close."]
    assert verdict.categories == ["count contradicts the facts"]
    assert "7 names weakened" not in verdict.text


def test_the_guard_reads_a_spelled_number_as_a_figure() -> None:
    sheet = build_sheet(_facts("broad-selloff"))
    # 61 names were scanned and 60 fell: both are in the facts, however they are written.
    true_read = "Only one name rose while sixty others fell. The median move was down 7.7%. AMD fell 17.3%."
    assert guard_ai_read(true_read, sheet).removed == []
    # Forty-four is in nobody's facts: written as a word it used to pass unread.
    invented = "Forty-four names hit new lows. The median move was down 7.7%. AMD fell 17.3%."
    verdict = guard_ai_read(invented, sheet)
    assert verdict.removed == ["Forty-four names hit new lows."]
    assert verdict.categories == ["figure not in the facts for this subject"]


def test_every_sentence_removed_from_the_first_bakeoff_was_a_real_slip() -> None:
    """The measurement in the module's docstring, pinned. `reads-first-bakeoff.json` is every
    sentence the first bake-off's models wrote about the three sessions, each labelled by hand
    against the fact sheet: `slip` (a factual slip these checks must catch), `missed` (a slip
    they cannot see - the documented limits), `framing` (calls a setup an "opportunity": the
    wording rules remove that, not these checks) and `clean` (true, and must survive)."""
    cases = json.loads((FIXTURES / "reads-first-bakeoff.json").read_text(encoding="utf-8"))
    meanings = {label: build_meaning(_facts(label)) for label in ("broad-selloff", "broad-rally", "quiet")}
    labels: dict[str, int] = {}
    for case in cases:
        labels[case["label"]] = labels.get(case["label"], 0) + 1
        found = meaning_problems(case["sentence"], meanings[case["session"]])
        assert bool(found) is (case["label"] == "slip"), (case["label"], case["sentence"], found)
    assert labels == {"clean": 96, "slip": 9, "missed": 4, "framing": 2}


def test_the_guard_leaves_every_clean_sentence_of_the_first_bakeoff_alone() -> None:
    """The same corpus through the whole guard, one sentence at a time beside two that always pass:
    nothing true is removed, by the meaning checks or by reading spelled numbers as figures."""
    cases = json.loads((FIXTURES / "reads-first-bakeoff.json").read_text(encoding="utf-8"))
    sheets = {label: build_sheet(_facts(label)) for label in ("broad-selloff", "broad-rally", "quiet")}
    padding = " Names scanned: 61. Names scanned: 61."
    removed_clean = []
    removed_slips = 0
    for case in cases:
        verdict = guard_ai_read(case["sentence"] + padding, sheets[case["session"]])
        gone = case["sentence"] in verdict.removed
        if case["label"] == "clean" and gone:
            removed_clean.append((case["sentence"], verdict.reasons))
        if case["label"] == "slip":
            removed_slips += gone
    assert removed_clean == []
    assert removed_slips == 9


def test_the_reviewers_cases_behave_as_labelled() -> None:
    """`reads-review-cases.json`: 144 sentences an independent reviewer wrote about the same three
    sessions to break these checks, each labelled true or false against the fact sheet. Pinned:
      true                  - survives the whole guard;
      true-lost-to-figure   - true, and removed by the older figure rule because it states a
                              threshold the facts never do ("fell more than 3%") - a known cost;
      true-lost-to-wording  - true, and removed by a wording rule ("opportunities") - a known cost;
      false-caught          - removed;
      false-missed          - passes: the limits this module documents (a count given for the wrong
                              moment, a status before its count). Move one to false-caught when a
                              rule learns to see it.
    """
    cases = json.loads((FIXTURES / "reads-review-cases.json").read_text(encoding="utf-8"))
    facts = {label: _facts(label) for label in ("broad-selloff", "broad-rally", "quiet")}
    meanings = {label: build_meaning(item) for label, item in facts.items()}
    sheets = {label: build_sheet(item) for label, item in facts.items()}
    padding = " Names scanned: 61. Names scanned: 61."
    seen: dict[str, int] = {}
    for case in cases:
        verdict, sentence = case["verdict"], case["sentence"]
        seen[verdict] = seen.get(verdict, 0) + 1
        flagged = bool(meaning_problems(sentence, meanings[case["session"]]))
        removed = sentence in guard_ai_read(sentence + padding, sheets[case["session"]]).removed
        if verdict == "true":
            assert not flagged and not removed, sentence
        elif verdict in ("true-lost-to-figure", "true-lost-to-wording"):
            assert not flagged and removed, sentence
        elif verdict == "false-caught":
            assert removed, sentence
        else:
            assert verdict == "false-missed" and not removed, sentence
    assert seen == {"true": 111, "false-caught": 27, "false-missed": 3, "true-lost-to-figure": 2, "true-lost-to-wording": 1}

