"""The guard on anything a model writes for the hourly summary.

Lyra's rule is that the deterministic engine decides and the AI explains: the model never invents a
number and never gives advice. A sentence in a prompt is not enforcement, so this is. It is the
worker-side twin of the app's `src/lib/ai/guardrails/prose.ts` + the regulated-advice guard in
`engine.ts`, and it goes further, because the facts here are structured:

  * every figure in the model's text must be one the facts stated - unit for unit, and attached to
    the same subject. A figure that belongs to one ticker may only appear in a sentence that names
    that ticker (or follows one that did); a breadth or market figure may appear anywhere;
  * a figure the facts gave a direction ("up 2.1%") may not be quoted with the opposite one
    ("fell 2.1%", "-2.1%");
  * a spelled-out magnitude ("forty percent", "doubled") counts as a figure and is not allowed;
  * a count written as a word ("sixty-one names") is read as the number it is, and checked like one;
  * a true figure given the wrong meaning - a count attached to the wrong status, a group called
    the worst when it was not, a ticker tied to a group it is not in, a ticker sent to a status it
    does not hold - contradicts the facts as surely as a wrong figure does (read_meaning.py);
  * every ticker it names must be one the facts named;
  * a sentence that predicts ("is likely to rebound", "expect more weakness", "tomorrow") is a
    sentence about something the facts cannot contain;
  * a sentence that breaks any of those is REMOVED - the rest of the read still stands;
  * advice or certainty language blocks the whole read, because there is no safe half of that.

The advice and prediction wording lives in contracts/guardrails/advice.json, shared with the app's
chat guard and pinned by test sentences on both sides. It was widened on 2026-11-06, when Lyra's
free features moved to open-weight models: a smaller model writes "Buy SPOT now", "gained 12
percent" or gives one group another group's direction where a frontier model did not, and the
guard as first written let all three through.

Pure functions, no I/O. What the guard cannot see: a true figure attached to the right ticker but
the wrong measure (its day move quoted as its hour move), a ranking the facts do not make ("the
strongest signals are in ESTC and AKAM"), and causes or news the model supplies from memory. The
prompt forbids all three; the figures block under the read shows the truth either way.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from workers.stock_scanner.read_meaning import ReadMeaning, digits_for_words, meaning_problems

# A numeral with optional thousands separators and decimals, the unit the facts always write
# explicitly (a leading $ or a trailing % / x), and any sign glued to it. A percentage written out
# in words ("12 percent", "12 per cent", "12 pct") is the same figure as "12%": read as a bare 12
# it would match any count of twelve the facts happened to contain.
_NUMBER_RE = re.compile(r"([+\-−])?(\$)?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)(%|[xX](?![a-zA-Z])|\s{0,2}(?i:per\s?cent|pct)\b)?")
_PERCENT_WORDS = frozenset({"%", "percent", "per cent", "pct"})

_SPELLED_FIGURE_RE = re.compile(
    r"\b(?:(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|"
    r"eighty|ninety|hundred|thousand|million|billion|trillion)[\s-]*percent|double[sd]?|doubling|"
    r"triple[sd]?|tripling|quadruple[sd]?)\b",
    re.IGNORECASE,
)

# Words that give a figure a direction when they sit just before it. Only these are read; an
# unknown verb means "no direction claimed" and the figure is checked for grounding alone.
_UP_WORDS = frozenset(
    "up rose rise rises rising gained gain gains gaining climbed climb climbs added adding advanced advance higher "
    "jumped jump rallied rally surged surge improved improving recovered recovering bounced bounce firmer".split()
)
_DOWN_WORDS = frozenset(
    "down fell fall falls falling dropped drop drops dropping lost loss losses losing slid slide slides sliding "
    "sank sink declined decline declines declining lower shed shedding slipped slip slips slipping retreated "
    "weakened weakening faded fading eased easing softer gave".split()
)
_DIRECTION_WINDOW = 3  # words before the figure that may carry its direction

# What may never be said, read from the contract the app's chat guard reads too.
CONTRACT_PATH = Path(__file__).resolve().parents[2] / "contracts" / "guardrails" / "advice.json"


def _contract_patterns(group: str) -> list[tuple[re.Pattern[str], str]]:
    contract = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    return [(re.compile(entry["pattern"], re.IGNORECASE if entry.get("flags") == "i" else 0), str(entry["why"])) for entry in contract[group]]


_ADVICE_PATTERNS: list[tuple[re.Pattern[str], str]] = _contract_patterns("advice")
_PREDICTION_PATTERNS: list[tuple[re.Pattern[str], str]] = _contract_patterns("prediction")
_PRICE_CALL_PATTERNS: list[tuple[re.Pattern[str], str]] = _contract_patterns("price_call")
# Where one clause of a sentence ends and the next begins, for deciding which group a figure is
# about: in "semiconductors lagged while the median name rose 0.8%" the 0.8% is not the group's.
_CLAUSE_BREAK_RE = re.compile(r"[;:]|\b(?:while|whereas|but|although|though|even as)\b", re.IGNORECASE)
# A clause that names one of these is about the whole scan or the market, not about a group.
_GENERAL_MEASURE_RE = re.compile(r"\b(?:median|breadth|market|index|indices|overall|s&p|nasdaq|vix|yield|aud)\b", re.IGNORECASE)
_ADVICE_FRAMING_RE = re.compile(r"\b(?:financial|investment) advice\b", re.IGNORECASE)

# Upper-case tokens that look like tickers but are ordinary market vocabulary.
_NOT_TICKERS = frozenset(
    {
        "A", "I", "AI", "US", "USA", "UK", "EU", "NY", "AUD", "USD", "NZD", "EUR", "JPY", "GBP", "VIX", "RSI", "MACD",
        "SMA", "EMA", "ETF", "IPO", "CEO", "CFO", "GDP", "CPI", "PPI", "PCE", "FOMC", "RBA", "FED", "SEC", "NYSE",
        "NASDAQ", "ASX", "BTC", "ETH", "OK", "PM", "AM", "ET", "EST", "EDT", "AEST", "AEDT", "UTC", "YTD", "QOQ",
        "YOY", "PE", "EPS", "FX", "OTC", "TV", "IT", "HR", "PR", "API", "GPU", "CPU", "SAAS", "LYRA", "EOD",
    }
)
_TICKER_RE = re.compile(r"(?<![A-Za-z0-9&.])[A-Z]{2,5}(?![A-Za-z0-9&])")
_WORD_RE = re.compile(r"[A-Za-z]+")


@dataclass(frozen=True)
class Figure:
    token: str  # "2.1%", "61", "$12", "3.1x" - the bare value plus its unit
    direction: int | None  # +1 / -1 when a sign or a direction word was attached, else None
    start: int  # offset of the numeral in the text it was found in


def figures_in(text: str) -> list[Figure]:
    """Every figure in `text`, with its unit and any direction the text attached to it."""
    found: list[Figure] = []
    previous_end = 0
    for match in _NUMBER_RE.finditer(text):
        sign, dollar, value, suffix = match.groups()
        unit = " ".join((suffix or "").lower().split())
        if unit in _PERCENT_WORDS or unit == "percent":
            token = f"{value}%"
        elif unit:
            token = f"{value}x"
        elif dollar:
            token = f"${value}"
        else:
            token = value
        direction: int | None = None
        if sign:
            direction = 1 if sign == "+" else -1
        else:
            # Only words in the same clause, after any earlier figure, can carry this figure's
            # direction: in "SNOW fell 1.9%, score 95" the "fell" belongs to 1.9%, not to 95 - and in
            # "1 name rose while 60 fell" the "rose" belongs to the 1.
            clause_start = max(
                [previous_end]
                + [index + 1 for index, char in enumerate(text[: match.start()]) if char in ",;:()"]
                + [found.end() for found in _CLAUSE_BREAK_RE.finditer(text, 0, match.start())]
            )
            before = _WORD_RE.findall(text[clause_start : match.start()])[-_DIRECTION_WINDOW:]
            for word in reversed(before):
                lowered = word.lower()
                if lowered in _UP_WORDS:
                    direction = 1
                    break
                if lowered in _DOWN_WORDS:
                    direction = -1
                    break
        found.append(Figure(token, direction, match.start(3)))
        previous_end = match.end()
    return found


def split_sentences(text: str) -> list[str]:
    return [part for part in re.split(r"(?<=[.!?])\s+", text.strip()) if part.strip()]


def split_paragraphs(text: str) -> list[str]:
    """Paragraphs are blank-line separated; markdown emphasis is stripped, other whitespace folded."""
    cleaned = text.replace("*", "").replace("_", " ").strip().strip('"')
    return [" ".join(part.split()) for part in re.split(r"\n\s*\n", cleaned) if part.strip()]


def prediction_findings(sentence: str) -> list[str]:
    """Why a sentence reads as a forecast - empty when it describes only what happened."""
    return list(dict.fromkeys(why for pattern, why in _PREDICTION_PATTERNS if pattern.search(sentence)))


def price_call_findings(text: str) -> list[str]:
    """Why a piece of company news reads as a forecast of the share price. News may report what a
    company expects of itself; what its shares will do is nobody's fact."""
    return list(dict.fromkeys(why for pattern, why in _PRICE_CALL_PATTERNS if pattern.search(text)))


def advice_findings(text: str) -> list[str]:
    findings = list(dict.fromkeys(why for pattern, why in _ADVICE_PATTERNS if pattern.search(text)))
    # "financial advice" is a finding unless it is the disclaimer form ("... not financial advice").
    for match in _ADVICE_FRAMING_RE.finditer(text):
        before = text[max(0, match.start() - 30):match.start()]
        if not re.search(r"\bnot\b", before, re.IGNORECASE):
            findings.append("framed as financial advice")
            break
    return findings


@dataclass
class FactSheet:
    """What the model was told, in the two forms this needs: the text, and who owns each figure.

    Build it with `general()` for facts about the whole scan or the market, `about(symbol, ...)`
    for facts about one ticker and `about_subject(name, ...)` for facts about a named group; each
    returns the text it was given so the caller can keep composing lines. `say()` adds a line
    without registering anything (labels, explanations).
    """

    lines: list[str] = field(default_factory=list)
    general_figures: set[str] = field(default_factory=set)
    by_symbol: dict[str, set[str]] = field(default_factory=dict)
    # (symbol, None or "subject:<name>", token) -> the directions the facts attached to that figure
    directions: dict[tuple[str | None, str], set[int]] = field(default_factory=dict)
    subject_names: set[str] = field(default_factory=set)  # lower-case names of the groups the facts describe
    # What the facts MEAN - which count goes with which status, the groups in order, who is in which
    # group. None for a sheet built without it; the meaning checks are then skipped.
    meaning: ReadMeaning | None = None

    @property
    def text(self) -> str:
        return "\n".join(self.lines)

    @property
    def symbols(self) -> set[str]:
        return set(self.by_symbol)

    def say(self, line: str) -> None:
        self.lines.append(line)

    def general(self, text: str) -> str:
        self._register(text, None)
        return text

    def about(self, symbol: str, text: str) -> str:
        symbol = symbol.upper()
        self.by_symbol.setdefault(symbol, set())
        self._register(text, symbol)
        return text

    def about_subject(self, name: str, text: str) -> str:
        """A fact about a named group ("semiconductors down 11.5% on average"). Its figures stay
        general - a sentence may quote one without naming the group - but its direction belongs to
        the group: when two groups share a figure and moved opposite ways, a sentence that names
        one of them may only give that one's direction."""
        subject = _subject_key(name)
        if subject:
            self.subject_names.add(subject)
            for figure in figures_in(text):
                if figure.direction is not None:
                    self.directions.setdefault((f"subject:{subject}", figure.token), set()).add(figure.direction)
        return self.general(text)

    def _register(self, text: str, symbol: str | None) -> None:
        for figure in figures_in(text):
            (self.general_figures if symbol is None else self.by_symbol[symbol]).add(figure.token)
            if figure.direction is not None:
                self.directions.setdefault((symbol, figure.token), set()).add(figure.direction)

    def allowed_directions(self, token: str, symbols: set[str], subjects: set[str] | frozenset[str] = frozenset()) -> set[int]:
        """Every direction the facts gave this figure in this context; empty = none claimed. When
        the sentence names a group the facts gave this figure for, that group's direction is the
        context (with the named tickers'); otherwise any direction the facts stated for it stands."""
        scoped: set[int] = set()
        for subject in subjects:
            scoped |= self.directions.get((f"subject:{subject}", token), set())
        if scoped:
            for symbol in symbols:
                scoped |= self.directions.get((symbol, token), set())
            return scoped
        allowed = set(self.directions.get((None, token), set()))
        for symbol in symbols:
            allowed |= self.directions.get((symbol, token), set())
        return allowed


@dataclass(frozen=True)
class GuardResult:
    """`ok` False means the read must not be sent at all; `text` is what survives when it is True."""

    ok: bool
    text: str
    removed: list[str] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)  # reader-safe detail; never log on a public runner
    categories: list[str] = field(default_factory=list)  # one coarse label per removal, safe to log


# A read that loses most of itself to the guard is not a read worth sending.
MIN_SENTENCES = 2
MAX_SENTENCES = 10


def _subject_key(name: str) -> str:
    return " ".join(str(name or "").lower().split())


def _subject_mentions(sentence: str, subjects: set[str]) -> list[tuple[int, str]]:
    """Where each named group is mentioned, as (offset, group), singular or plural ("semiconductor
    stocks"). Longer names are matched first and their words are then spent, so "enterprise
    software" is not also a mention of "software"."""
    found: list[tuple[int, str]] = []
    remaining = sentence
    for subject in sorted(subjects, key=lambda name: (-len(name), name)):
        stem = subject[:-1] if subject.endswith("s") and len(subject) > 3 else subject
        pattern = re.compile(rf"(?<![A-Za-z]){re.escape(stem)}s?(?![A-Za-z])", re.IGNORECASE)
        found.extend((match.start(), subject) for match in pattern.finditer(remaining))
        remaining = pattern.sub(lambda match: " " * len(match.group(0)), remaining)
    return found


def _clause_of(sentence: str, position: int) -> tuple[int, int]:
    """The stretch of the sentence, between clause breaks, that holds `position`."""
    start, end = 0, len(sentence)
    for match in _CLAUSE_BREAK_RE.finditer(sentence):
        if match.end() <= position:
            start = match.end()
        elif match.start() >= position:
            end = match.start()
            break
    return start, end


def _mentions(sentence: str, symbols: set[str]) -> set[str]:
    found: set[str] = set()
    for symbol in symbols:
        if re.search(rf"(?<![A-Za-z0-9&.]){re.escape(symbol)}(?![A-Za-z0-9&])", sentence):
            found.add(symbol)
    return found


def _unknown_tickers(sentence: str, known: set[str]) -> list[str]:
    return [token for token in _TICKER_RE.findall(sentence) if token not in known and token not in _NOT_TICKERS]


def guard_ai_read(text: str, sheet: FactSheet) -> GuardResult:
    """Check a model-written read against the fact sheet it was written from. Paragraph breaks
    survive (the reader sees short paragraphs); a paragraph that loses every sentence disappears."""
    paragraphs = split_paragraphs(text)
    if not paragraphs:
        return GuardResult(ok=False, text="", reasons=["empty"], categories=["empty"])

    kept: list[list[str]] = []
    removed: list[str] = []
    reasons: list[str] = []
    categories: list[str] = []
    context_symbols: set[str] = set()  # tickers named by the previous kept sentence, for pronouns
    total = 0

    for paragraph in paragraphs:
        kept.append([])
        for sentence in split_sentences(paragraph):
            if total >= MAX_SENTENCES:
                break
            # The sentence as it is CHECKED: a count written as a word is the number it is, and a
            # typographic hyphen is a hyphen. The reader is still shown what the model wrote.
            checked = digits_for_words(sentence)
            mentioned = _mentions(checked, sheet.symbols)
            scope = mentioned or context_symbols
            group_mentions = _subject_mentions(checked, sheet.subject_names)
            problems: list[tuple[str, str]] = []

            allowed = set(sheet.general_figures)
            for symbol in scope:
                allowed |= sheet.by_symbol.get(symbol, set())
            for figure in figures_in(checked):
                if figure.token not in allowed:
                    problems.append(("figure not in the facts for this subject", figure.token))
                    continue
                if figure.direction is not None:
                    # The groups named in the same clause as the figure are the ones it can be about.
                    # A clause that names no group carries on about the sentence's ("cybersecurity
                    # was the weak spot: the group rose 2.4%") - unless it names a measure of the
                    # whole scan ("... while the median name rose 0.8%").
                    clause_start, clause_end = _clause_of(checked, figure.start)
                    subjects = {subject for position, subject in group_mentions if clause_start <= position < clause_end}
                    if not subjects and not _GENERAL_MEASURE_RE.search(checked[clause_start:clause_end]):
                        subjects = {subject for _position, subject in group_mentions}
                    stated = sheet.allowed_directions(figure.token, scope, subjects)
                    if stated and figure.direction not in stated:
                        problems.append(("direction contradicts the facts", figure.token))

            # What is left spelled out after the numbers were read is a magnitude that cannot be
            # checked ("doubled", "one percent" as a turn of phrase).
            spelled = _SPELLED_FIGURE_RE.search(checked)
            if spelled:
                problems.append(("spelled-out figure", spelled.group(0)))
            for ticker in _unknown_tickers(sentence, sheet.symbols):
                problems.append(("ticker not in the facts", ticker))
            for why in prediction_findings(sentence):
                problems.append(("prediction", why))
            problems.extend(meaning_problems(checked, sheet.meaning))

            if problems:
                removed.append(sentence)
                for category, detail in problems:
                    reasons.append(f"{category}: {detail}")
                    categories.append(category)
                continue
            kept[-1].append(sentence)
            total += 1
            if mentioned:
                context_symbols = mentioned

    survivor = "\n\n".join(" ".join(sentences) for sentences in kept if sentences)
    # Advice is looked for in everything the model wrote, not in what survived: a sentence deleted
    # for another reason (a forecast, an unknown ticker) must not carry its advice out with it and
    # leave the rest to be sent as if the model had behaved.
    advice = advice_findings("\n".join(paragraphs))
    if advice:
        return GuardResult(ok=False, text="", removed=removed, reasons=reasons + advice, categories=categories + ["advice"])
    if total < MIN_SENTENCES:
        return GuardResult(
            ok=False, text="", removed=removed, reasons=reasons + ["too little survived the checks"], categories=categories + ["too short"]
        )
    return GuardResult(ok=True, text=survivor, removed=removed, reasons=reasons, categories=categories)


