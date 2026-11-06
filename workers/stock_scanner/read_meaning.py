"""What a figure MEANS: the checks on a model-written read that the figure check cannot make.

`ai_read_guard` proves that every figure in a read is one the facts stated, attached to the ticker
it belongs to, with the direction the facts gave it. That is enough for a frontier model. It is not
enough for a small open-weight one, which copies figures faithfully and then says the wrong thing
ABOUT them. The first bake-off (2026-11-06, 24 reads by four local models) passed the figure check
24 times out of 24 with nothing removed - and read by eye, half of them carried a slip like these:

  * a count given the wrong meaning - "7 names weakened" (25 did; 7 dropped out of strong setup),
    "invalidated seven strong setups" (6), "12 names moved into watchlist" (12 were on it at the
    close; 7 moved in), "4 new strong setups" (2 new; 4 in all);
  * a group called the worst when it was not - "the worst average loss in AI infrastructure at
    11.3%" (semiconductors fell 11.5%);
  * a ticker tied to a group it is not in - "ABNB and SNAP ... pulling the fintech group down";
  * a ticker sent to a status it does not have - "MSFT ... fell from strong to no signal" (it
    closed as a watchlist setup).

Every one of those is a statement the facts already settle, so code can settle it. This module
holds the facts in the shape the checks need (`ReadMeaning`, filled in by `daily_read.build_meaning`)
and finds the sentences that contradict them. A sentence that does is REMOVED, like any other the
guard rejects; the read still stands on what is left, and the figures block under it is exact
either way.

The checks only ever remove, so their cost is a true sentence lost - and a read thinned below two
sentences is not sent at all. Each rule is therefore narrow on purpose: it fires on the shapes the
slips actually took and leaves alone what merely resembles them (a count about the reader's own
book, "one of the hardest-hit groups", "the day's biggest gain", "strong buying"). Two corpora pin
both sides: every sentence the first bake-off's models wrote (tests/fixtures/bakeoff/
reads-first-bakeoff.json) and a reviewer's 144 true and false sentences about the same sessions
(reads-review-cases.json).

What it still cannot see: a claim the facts do not rank ("the strongest signals are in ESTC and
AKAM"), a count given for the wrong moment ("20 watchlist setups at the close" when 20 was the
day before), and wording that is merely loose. Pure functions, no I/O.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

# --- a number written as a word is a number --------------------------------------------------

_UNITS = {
    "zero": 0, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9,
    "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16,
    "seventeen": 17, "eighteen": 18, "nineteen": 19,
}  # fmt: skip
_ONES = {"one": 1, **{word: value for word, value in _UNITS.items() if 2 <= value <= 9}}
_TENS = {"twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90}
_ALL = {**_TENS, **_UNITS}
# The hyphens a model may type instead of "-" to JOIN words (U+2010 and the non-breaking U+2011, as
# in "sixty-one" or "consumer-internet"). Dashes that SEPARATE (U+2013, U+2014) are left alone:
# made plain, a range such as 330-350 would read as "minus 350".
_DASHES = chr(0x2010) + chr(0x2011)
_NUMBER_WORD = rf"(?:(?:{'|'.join(_TENS)})[\s-](?:{'|'.join(_ONES)})|{'|'.join(_ALL)})"
_COMPOUND_RE = re.compile(rf"\b({'|'.join(_TENS)})[\s-]({'|'.join(_ONES)})\b", re.IGNORECASE)
_SIMPLE_RE = re.compile(rf"\b({'|'.join(_ALL)})\b", re.IGNORECASE)
# "one" is a number only where it counts something ("one name", "one more", "one up"); elsewhere it
# is a pronoun ("the lone one", "no one") or a hedge ("one of the hardest hit").
_ONE_RE = re.compile(r"\bone(?=\s+(?:names?|stocks?|tickers?|setups?|more|up|down)\b)", re.IGNORECASE)
# The things the facts count. A number word in front of one of them is a count the facts can check.
_COUNTED = r"(?:names?|stocks?|tickers?|setups?|others?)"
# A number word, then up to two describing words, then something the facts count: "sixty-one names",
# "seven prior strong setups", "sixty others".
_COUNTED_WORD_RE = re.compile(rf"\b({_NUMBER_WORD}|one)\b(?=(?:\s+[a-z-]+){{0,2}}\s+{_COUNTED}\b)", re.IGNORECASE)
# Words that make a count about the reader's own book, which the session's totals say nothing about.
_READERS_OWN_RE = re.compile(r"\b(?:your|you|yours|holdings?|held|positions?|portfolio|book)\b", re.IGNORECASE)


def plain_hyphens(text: str) -> str:
    """The same text with word-joining typographic hyphens made plain."""
    for dash in _DASHES:
        text = text.replace(dash, "-")
    return text


def _number(word: str) -> int:
    word = word.lower()
    parts = re.split(r"[\s-]", word)
    return _TENS[parts[0]] + _ONES[parts[1]] if len(parts) == 2 else {**_ALL, "one": 1}[word]


def digits_for_words(text: str) -> str:
    """The same text with every cardinal number written as digits ("sixty-one names" -> "61
    names"). For reading what a sentence CLAIMS; nothing here is shown to a reader."""
    text = plain_hyphens(text)
    text = _COMPOUND_RE.sub(lambda match: str(_TENS[match.group(1).lower()] + _ONES[match.group(2).lower()]), text)
    text = _SIMPLE_RE.sub(lambda match: str(_ALL[match.group(1).lower()]), text)
    return _ONE_RE.sub("1", text)


def counted_digits(text: str) -> str:
    """The same text with a number word written as digits ONLY where it counts names or setups -
    the things the facts count, and so the only spelled numbers the figure check can hold to the
    facts. "Sixty-one names" becomes "61 names"; "seven of the eight groups", "three to one" and
    "a twenty-four hour rout" are left as the turns of phrase they are, and so is a count of the
    reader's own holdings, which the session's totals say nothing about."""
    text = plain_hyphens(text)

    def swap(match: re.Match[str]) -> str:
        around = text[max(0, match.start() - 24) : match.end() + 40]
        return match.group(0) if _READERS_OWN_RE.search(around) else str(_number(match.group(1)))

    return _COUNTED_WORD_RE.sub(swap, text)


# --- the facts, in the shape the checks need -------------------------------------------------

# The other names each of the scanner's groups goes by. The display name (daily_read.group_name)
# is always one of them; these are the short forms a model reaches for.
GROUP_ALIASES: dict[str, tuple[str, ...]] = {
    "cloud_data": ("cloud and data", "cloud & data", "cloud"),
    "cybersecurity": ("cybersecurity", "cyber security", "cyber"),
    "consumer_internet": ("consumer internet",),
    "fintech_tech": ("fintech",),
    "mega_cap_platform": ("mega cap platforms", "mega cap platform", "mega caps", "mega cap", "megacaps", "megacap"),
    "software": ("software",),
    "ai_infrastructure": ("ai infrastructure", "ai infra"),
    "semiconductor": ("semiconductors", "semiconductor", "semis", "chipmakers", "chips"),
}

STATUSES = ("strong", "watchlist", "weakening", "invalidated", "no_signal")


@dataclass(frozen=True)
class ReadMeaning:
    """What the session's facts say about counts, groups and statuses - the things a read can get
    wrong while quoting only true figures."""

    # status -> how the count came about ("any", "now", "prior", "became", "dropped") -> the counts the facts state
    counts: dict[str, dict[str, frozenset[int]]] = field(default_factory=dict)
    group_order: tuple[str, ...] = ()  # group keys, best to worst
    group_names: dict[str, tuple[str, ...]] = field(default_factory=dict)  # group key -> names, lower case
    member: dict[str, str] = field(default_factory=dict)  # ticker -> group key
    status_now: dict[str, str] = field(default_factory=dict)  # ticker -> one of STATUSES, at the close


def status_word(status: str) -> str:
    """The engine's status id as this module's word for it."""
    return {"strong_setup": "strong", "watchlist_setup": "watchlist"}.get(status, status)


def names_for(category: str, display: str) -> tuple[str, ...]:
    """Every name a group goes by, lower case with hyphens opened, longest first."""
    names = {display.lower().replace("-", " "), *GROUP_ALIASES.get(category, ())}
    return tuple(sorted(names, key=lambda name: (-len(name), name)))


# --- counts ------------------------------------------------------------------------------------

_STATUS_RE = {
    "no_signal": re.compile(r"\bno[- ]signals?\b", re.IGNORECASE),
    # "strong" is the status only where it names one: "strong setups", "dropped from strong",
    # "from strong to no signal". "Strong gains", "strong buying" and "a strong day" are not.
    "strong": re.compile(r"\bstrong\b(?=[- ](?:setups?|status|names?|signals?|territory|category)\b|\s+to\b|\s*$)", re.IGNORECASE),
    "watchlist": re.compile(r"\bwatch[- ]?list\b", re.IGNORECASE),
    # "weakening names", "7 names weakened" - not "weakening momentum" or "weakening demand".
    "weakening": re.compile(r"\bweaken(?:ing|ed|s)?\b(?!\s+(?:momentum|demand|breadth|volume|trend|prices?|sentiment|conditions|economy|outlook|data|dollar|yields?))", re.IGNORECASE),
    "invalidated": re.compile(r"\binvalidat(?:ed|ion|ions|es|e)\b", re.IGNORECASE),
}
_BECAME_RE = re.compile(
    r"\b(?:new|newly|became|become|becoming|moved into|moving into|entered|entering|joined|joining|formed|forming|turned|transitioned)\b", re.IGNORECASE
)
_DROPPED_RE = re.compile(r"\b(?:dropped out|dropping out|dropped from|slipped out|fell out|fell from|fall from|lost|left|dropped)\b", re.IGNORECASE)
# A bare whole number that could be a count: not money, not a percentage or a multiple, not half of
# "3 of 7", not a decimal - and not the sheet's own "and 1 more".
_COUNT_RE = re.compile(r"(?<![$\d.,])\b(\d{1,3})\b(?!\s*(?:%|percent|per cent|pct|x\b|of\s+\d|more\b|others?\b)|[.,]\d)")
# Where the words that belong to a count end: punctuation, the next number, a dash, or the start of
# another statement ("60 of 61 names fell AND no strong setups remained").
_REACH_END_RE = re.compile(r"[,;:()]|\b\d+\b| - | – | — |\b(?:and|but|while|whereas|as|after|before|because|so|though)\b", re.IGNORECASE)
# "score 85", "from 48", "fell to 32": a score, not a count.
_SCORE_BEFORE_RE = re.compile(r"(?:scores?|scored|from|to|at)\s*$", re.IGNORECASE)
_DESTINATION_RE = re.compile(r"\b(?:to|into)\s+(?:a\s+|the\s+)?(no[- ]signal|watch[- ]?list|strong)", re.IGNORECASE)
_CLAIMING_VERBS = (("invalidated", r"invalidat(?:ed|es|e|ing)"), ("weakening", r"weaken(?:ed|s|ing)?"))
_REACH_WORDS = 7
# "Strong setups fell to 6 from 7": the count now, and the count before. The verb must follow
# "setups" directly - in "became strong setups as their scores jumped to 75" the 75 is a score.
_TOTAL_MOVED_RE = re.compile(
    r"\b(strong|watch[- ]?list)[- ]setups\s+(?:fell|rose|dropped|grew|climbed|increased|decreased|declined|slipped|went|moved|shrank|narrowed|expanded)"
    r"\s+(?:back\s+)?to\s+(\d{1,3})\b(?:\s+from\s+(\d{1,3})\b)?",
    re.IGNORECASE,
)


def _status_key(word: str) -> str:
    word = word.lower().replace("-", " ")
    return {"no signal": "no_signal", "watch list": "watchlist"}.get(word, word)


def _reach_after(text: str, start: int) -> str:
    rest = text[start:]
    stop = _REACH_END_RE.search(rest)
    return " ".join((rest[: stop.start()] if stop else rest).split()[:_REACH_WORDS])


def count_problems(sentence: str, meaning: ReadMeaning) -> list[str]:
    """Counts the sentence attaches to a status that the facts attach to another."""
    if not meaning.counts:
        return []
    text = digits_for_words(sentence)
    problems: list[str] = []

    def allowed(status: str, movement: str) -> frozenset[int]:
        by_movement = meaning.counts.get(status, {})
        return by_movement.get(movement) or by_movement.get("any", frozenset())

    for match in re.finditer(r"\bno\s+(strong|watchlist)\s+setups?\b", text, re.IGNORECASE):  # a count of zero
        status = match.group(1).lower()
        if 0 not in allowed(status, "any"):
            problems.append(f"0 {status}")
    for match in _TOTAL_MOVED_RE.finditer(text):
        status = _status_key(match.group(1))
        now, prior = allowed(status, "now"), allowed(status, "prior")
        if now and int(match.group(2)) not in now:
            problems.append(f"{match.group(2)} {status}")
        elif match.group(3) and prior and int(match.group(3)) not in prior:
            problems.append(f"{match.group(3)} {status}")
    for match in _COUNT_RE.finditer(text):
        value = int(match.group(1))
        before = text[: match.start()]
        if _SCORE_BEFORE_RE.search(before):
            continue
        after = _reach_after(text, match.end())
        # A count of the reader's own holdings or watchlist is not a count of the session's.
        if _READERS_OWN_RE.search(" ".join(before.split()[-4:]) + " " + after):
            continue
        claims: list[tuple[str, str]] = []
        # The first status named after the count is the one it counts ("7 names weakened", "4 new
        # strong setups"); how it got there is in the words between ("moved into", "dropped out").
        first: tuple[int, str] | None = None
        for status, pattern in _STATUS_RE.items():
            found = pattern.search(after)
            if found and (first is None or found.start() < first[0]):
                first = (found.start(), status)
        if first is not None:
            lead = after[: first[0]]
            movement = "became" if _BECAME_RE.search(lead) else "dropped" if _DROPPED_RE.search(lead) else "any"
            claims.append((first[1], movement))
            destination = _DESTINATION_RE.search(after[first[0] :])  # "fell from strong to no signal"
            if destination:
                claims.append((_status_key(destination.group(1)), "any"))
        # A status verb directly before the count claims it too ("invalidated 7 strong setups").
        for status, verb in _CLAIMING_VERBS:
            if re.search(rf"\b{verb}\s+(?:all\s+|the\s+|another\s+|a\s+further\s+|some\s+)?$", before, re.IGNORECASE):
                claims.append((status, "any"))
        for status, movement in claims:
            pool = allowed(status, movement)
            if pool and value not in pool:
                problems.append(f"{value} {status.replace('_', ' ')}")
    return list(dict.fromkeys(problems))


# --- groups ------------------------------------------------------------------------------------

# A superlative about a GROUP. "Biggest" and "largest" count only with "average": on their own they
# are usually about one stock ("PANW posted the biggest gain").
_WORST_RE = re.compile(
    r"\b(?:worst|weakest|hardest[- ]hit|steepest|(?:biggest|largest|sharpest|heaviest)\s+average\s+(?:falls?|drops?|loss(?:es)?|declines?))\b", re.IGNORECASE
)
_BEST_RE = re.compile(
    r"\b(?:best|strongest|(?:biggest|largest)\s+average\s+(?:gains?|rises?|advances?)|led the (?:day|session|move|rally|charge|way|gains|advance|market))\b",
    re.IGNORECASE,
)
# "among the worst", "one of the hardest hit": a claim about a set, not about the extreme.
_HEDGE_RE = re.compile(r"\b(?:among|one of|1 of|some of)\s+(?:the\s+)?$", re.IGNORECASE)
# "the worst single move", "the best performer": about one stock, not a group.
_ONE_STOCK_RE = re.compile(r"^\s*(?:single|individual|one-day|performer|performing|mover|gainer|faller|decliner|name|stock|move)\b", re.IGNORECASE)
_SCOPE_END_RE = re.compile(r"[,;:]|\.(?!\d)")
_CLAUSE_RE = re.compile(r"[;:]|\b(?:while|whereas|but|although|though|even as|despite|compared (?:with|to)|than|unlike|versus|vs|relative to|against)\b", re.IGNORECASE)
_TICKER_RE = re.compile(r"(?<![A-Za-z0-9&.])[A-Z]{2,5}(?![A-Za-z0-9&])")


def _groups_in(text: str, meaning: ReadMeaning) -> tuple[list[tuple[int, str]], str]:
    """Each group the text names, as (offset, group key), and the text with those names blanked -
    so the "AI" of "AI infrastructure" is not then read as the ticker AI."""
    remaining = plain_hyphens(text).replace("-", " ")
    found: list[tuple[int, str]] = []
    pairs = sorted(((name, key) for key, names in meaning.group_names.items() for name in names), key=lambda pair: (-len(pair[0]), pair[0]))
    for name, key in pairs:
        pattern = re.compile(rf"(?<![A-Za-z]){re.escape(name)}(?![A-Za-z])", re.IGNORECASE)
        found.extend((match.start(), key) for match in pattern.finditer(remaining))
        remaining = pattern.sub(lambda match: " " * len(match.group(0)), remaining)
    return sorted(found), remaining


def rank_problems(sentence: str, meaning: ReadMeaning) -> list[str]:
    """A group called the best or the worst that the facts rank otherwise."""
    order = meaning.group_order
    if len(order) < 2:
        return []
    problems: list[str] = []
    for label, pattern in (("worst", _WORST_RE), ("best", _BEST_RE)):
        for cue in pattern.finditer(sentence):
            if _HEDGE_RE.search(sentence[: cue.start()]) or _ONE_STOCK_RE.search(sentence[cue.end() :]):
                continue
            # The groups the superlative is about: the ones after it up to the next comma, else the
            # ones before it back to the last comma.
            scope = _SCOPE_END_RE.split(sentence[cue.end() :], maxsplit=1)[0]
            named = {key for _offset, key in _groups_in(scope, meaning)[0]}
            if not named:
                scope = _SCOPE_END_RE.split(sentence[: cue.start()])[-1]
                named = {key for _offset, key in _groups_in(scope, meaning)[0]}
            if not named or len(named) >= len(order):
                continue
            expected = set(order[-len(named) :]) if label == "worst" else set(order[: len(named)])
            if named != expected:
                problems.append(f"{label}: {', '.join(sorted(named))}")
    return problems


def _clauses(sentence: str) -> list[str]:
    clauses: list[str] = []
    start = 0
    for match in _CLAUSE_RE.finditer(sentence):
        clauses.append(sentence[start : match.start()])
        start = match.start()
    clauses.append(sentence[start:])
    return clauses


def membership_problems(sentence: str, meaning: ReadMeaning) -> list[str]:
    """A ticker named in a clause about groups it does not belong to."""
    if not meaning.member:
        return []
    problems: list[str] = []
    for clause in _clauses(sentence):
        mentions, rest = _groups_in(clause, meaning)
        named = {key for _offset, key in mentions}
        if not named:
            continue
        for ticker in dict.fromkeys(_TICKER_RE.findall(rest)):
            group = meaning.member.get(ticker)
            if group is not None and group not in named:
                problems.append(f"{ticker} is not in {', '.join(sorted(named))}")
    return problems


# --- where a ticker ended ------------------------------------------------------------------------

_ARRIVED_RE = re.compile(r"\b(?:to|into|became|become|becoming|turned)\s+(?:a\s+|the\s+)?(no[- ]signal|watch[- ]?list|strong)\b", re.IGNORECASE)
# What may sit between two tickers of one list: "MSFT, CRM and AMD".
_LIST_GAP_RE = re.compile(r"^\s*(?:,\s*and|,|and|&)\s*$", re.IGNORECASE)


def _subject_tickers(text: str) -> list[str]:
    """The run of tickers closest to the end of `text` - the list a following verb is about. In
    "MSFT and CRM both fell out of strong setup, MSFT" that is the last MSFT alone."""
    found = list(_TICKER_RE.finditer(text))
    if not found:
        return []
    run = [found[-1]]
    for earlier in reversed(found[:-1]):
        if not _LIST_GAP_RE.match(text[earlier.end() : run[0].start()]):
            break
        run.insert(0, earlier)
    return [match.group(0) for match in run]


def status_problems(sentence: str, meaning: ReadMeaning) -> list[str]:
    """A ticker said to have ARRIVED at a status it does not hold at the close."""
    if not meaning.status_now:
        return []
    problems: list[str] = []
    for clause in _clauses(sentence):
        for arrived in _ARRIVED_RE.finditer(clause):
            want = _status_key(arrived.group(1))
            for ticker in dict.fromkeys(_subject_tickers(clause[: arrived.start()])):
                now = meaning.status_now.get(ticker)
                if now is None or now == want:
                    continue
                problems.append(f"{ticker} is {now.replace('_', ' ')}, not {want.replace('_', ' ')}")
    return list(dict.fromkeys(problems))


def meaning_problems(sentence: str, meaning: ReadMeaning | None) -> list[tuple[str, str]]:
    """Why a sentence contradicts what the facts mean, as (category, detail). Takes the sentence as
    written (number words and all). The categories are coarse and safe to log; the details name
    tickers and are for the stored record only."""
    if meaning is None:
        return []
    sentence = plain_hyphens(sentence)
    return (
        [("count contradicts the facts", detail) for detail in count_problems(sentence, meaning)]
        + [("group rank contradicts the facts", detail) for detail in rank_problems(sentence, meaning)]
        + [("ticker is not in that group", detail) for detail in membership_problems(sentence, meaning)]
        + [("status contradicts the facts", detail) for detail in status_problems(sentence, meaning)]
    )
