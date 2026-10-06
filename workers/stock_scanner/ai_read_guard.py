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
  * every ticker it names must be one the facts named;
  * a sentence that breaks any of those is REMOVED - the rest of the read still stands;
  * advice or certainty language blocks the whole read, because there is no safe half of that.

Pure functions, no I/O. What the guard cannot see: a true figure attached to the right ticker but
the wrong measure (its day move quoted as its hour move), and causes or news the model supplies
from memory. The prompt forbids both; the figures block under the read shows the truth either way.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

# A numeral with optional thousands separators and decimals, the unit the facts always write
# explicitly (a leading $ or a trailing % / x), and any sign glued to it.
_NUMBER_RE = re.compile(r"([+\-−])?(\$)?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)(%|[xX](?![a-zA-Z]))?")

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

# The same four families the app's regulated-advice guard blocks.
_ADVICE_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(
            r"\b(?:you should|i (?:recommend|suggest|advise)|my advice)\b.{0,30}\b(?:buy|sell|short|invest|purchase)\b",
            re.IGNORECASE,
        ),
        "directive advice to trade",
    ),
    (re.compile(r"\b(?:buy|sell|short) (?:it|now|today|immediately)\b", re.IGNORECASE), "time-pressured buy/sell instruction"),
    (
        re.compile(
            r"\b(?:guarantee[sd]?|risk[- ]free|can'?t lose|sure thing|will (?:definitely|certainly) (?:go up|rise|moon))\b",
            re.IGNORECASE,
        ),
        "certainty / guaranteed-return claim",
    ),
]
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
        if suffix == "%":
            token = f"{value}%"
        elif suffix:
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
            # direction: in "SNOW fell 1.9%, score 95" the "fell" belongs to 1.9%, not to 95.
            clause_start = max([previous_end] + [index + 1 for index, char in enumerate(text[: match.start()]) if char in ",;:()"])
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


def advice_findings(text: str) -> list[str]:
    findings = [why for pattern, why in _ADVICE_PATTERNS if pattern.search(text)]
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

    Build it with `general()` for facts about the whole scan or the market and `about(symbol, ...)`
    for facts about one ticker; both return the text they were given so the caller can keep
    composing lines. `say()` adds a line without registering anything (labels, explanations).
    """

    lines: list[str] = field(default_factory=list)
    general_figures: set[str] = field(default_factory=set)
    by_symbol: dict[str, set[str]] = field(default_factory=dict)
    # (symbol or None, token) -> the directions the facts attached to that figure
    directions: dict[tuple[str | None, str], set[int]] = field(default_factory=dict)

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

    def _register(self, text: str, symbol: str | None) -> None:
        for figure in figures_in(text):
            (self.general_figures if symbol is None else self.by_symbol[symbol]).add(figure.token)
            if figure.direction is not None:
                self.directions.setdefault((symbol, figure.token), set()).add(figure.direction)

    def allowed_directions(self, token: str, symbols: set[str]) -> set[int]:
        """Every direction the facts gave this figure in this context; empty = none claimed."""
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
MAX_SENTENCES = 8


def _mentions(sentence: str, symbols: set[str]) -> set[str]:
    found: set[str] = set()
    for symbol in symbols:
        if re.search(rf"(?<![A-Za-z0-9&.]){re.escape(symbol)}(?![A-Za-z0-9&])", sentence):
            found.add(symbol)
    return found


def _unknown_tickers(sentence: str, known: set[str]) -> list[str]:
    return [token for token in _TICKER_RE.findall(sentence) if token not in known and token not in _NOT_TICKERS]


def guard_ai_read(text: str, sheet: FactSheet) -> GuardResult:
    """Check a model-written read against the fact sheet it was written from."""
    cleaned = " ".join(text.replace("*", "").replace("_", " ").split()).strip().strip('"')
    if not cleaned:
        return GuardResult(ok=False, text="", reasons=["empty"], categories=["empty"])

    kept: list[str] = []
    removed: list[str] = []
    reasons: list[str] = []
    categories: list[str] = []
    context_symbols: set[str] = set()  # tickers named by the previous kept sentence, for pronouns

    for sentence in split_sentences(cleaned):
        mentioned = _mentions(sentence, sheet.symbols)
        scope = mentioned or context_symbols
        problems: list[tuple[str, str]] = []

        allowed = set(sheet.general_figures)
        for symbol in scope:
            allowed |= sheet.by_symbol.get(symbol, set())
        for figure in figures_in(sentence):
            if figure.token not in allowed:
                problems.append(("figure not in the facts for this subject", figure.token))
                continue
            if figure.direction is not None:
                stated = sheet.allowed_directions(figure.token, scope)
                if stated and figure.direction not in stated:
                    problems.append(("direction contradicts the facts", figure.token))

        spelled = _SPELLED_FIGURE_RE.search(sentence)
        if spelled:
            problems.append(("spelled-out figure", spelled.group(0)))
        for ticker in _unknown_tickers(sentence, sheet.symbols):
            problems.append(("ticker not in the facts", ticker))

        if problems:
            removed.append(sentence)
            for category, detail in problems:
                reasons.append(f"{category}: {detail}")
                categories.append(category)
            continue
        kept.append(sentence)
        if mentioned:
            context_symbols = mentioned

    kept = kept[:MAX_SENTENCES]
    survivor = " ".join(kept)
    advice = advice_findings(survivor)
    if advice:
        return GuardResult(ok=False, text="", removed=removed, reasons=reasons + advice, categories=categories + ["advice"])
    if len(kept) < MIN_SENTENCES:
        return GuardResult(
            ok=False, text="", removed=removed, reasons=reasons + ["too little survived the checks"], categories=categories + ["too short"]
        )
    return GuardResult(ok=True, text=survivor, removed=removed, reasons=reasons, categories=categories)
