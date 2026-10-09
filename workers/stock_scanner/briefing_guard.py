"""Checks on the AI briefing before anyone sees it.

The daily read's guard (ai_read_guard.py) can check every figure against the engine, because the
engine wrote the facts. The briefing's facts come from the web, so its checks are different. An
item is kept only when:

- every source it cites was actually returned by a web search or opened by a web fetch during the
  research (a link the model wrote from memory is not a source);
- at least one of those sources was opened and came back as text, so there is something to check
  the item against;
- every figure in the item appears in the text of a source the item cites - the model is told to
  quote figures as the source gives them, and an item whose figure is not in its own source is out;
- it does not advise (the same patterns the read is held to);
- a listed company carries a ticker and a private one does not;
- none of its sources was cited in a recent briefing - a repeat is a repeat even in new words.

Pure functions, no I/O, so the whole thing is testable without a model or a network.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field, replace
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit

from workers.stock_scanner.ai_read_guard import advice_findings

# The briefing's spine (2026-10-08, the founder: "call out groups ... robotics, semiconductors, AI,
# minerals, commodities, quantum ... those groups that are really important to the world"). These
# are the app's own theme slugs (src/lib/generated/themes.json - the /themes pages), pinned equal by
# a test, so a theme heading in the briefing is a theme page in the app. "other" is for a genuine
# development that fits none - never a reason to drop a verified item.
THEMES = (
    "agi-infrastructure",
    "semiconductors",
    "power-grid",
    "nuclear-uranium",
    "critical-minerals",
    "robotics-automation",
    "quantum-computing",
    "space-economy",
    "defence-drones",
    "cybersecurity",
    "other",
)
# The standing desks: the kinds of event the founder wants two lines on every night even when
# nothing happened ("new filings, IPOs ... venture capital ... small caps ... government spending").
STANDING_DESKS = ("ipo", "venture", "government", "small_cap")
DESKS = ("news",) + STANDING_DESKS
MAX_ITEMS = 10
MAX_SOURCES_PER_ITEM = 4
MAX_NOTE_CHARS = 240
# Fields are clamped, never silently dropped: a model that writes an essay still yields an item.
MAX_FIELD_CHARS = 700
MAX_HEADLINE_CHARS = 140

_TICKER_RE = re.compile(r"^[A-Z0-9][A-Z0-9.\-]{0,9}$")
_EXCHANGE_IN_HEADLINE_RE = re.compile(
    r"\((?:NYSE|NASDAQ|ASX|LSE|TSX|TSXV|HKEX|SEHK|TSE|SGX|NSE|BSE|Euronext|Xetra|AMEX|OTC)\b[^)]*\)", re.IGNORECASE
)
# A figure: digits with optional thousands separators and decimals, not glued to a letter or a
# dot on the left (so "Q2", "GPT-6" -> 6 counts but "v2.1" does not become "1", "A100" is skipped).
_NUMBER_RE = re.compile(r"(?<![\w.,])(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?")
_TRACKING_PARAMS = ("utm_", "fbclid", "gclid", "mc_cid", "mc_eid", "ref")
# Lyra labels an item from its fields; a label the model also wrote into the headline would show twice.
_HEADLINE_LABEL_RE = re.compile(r"\s*\((?:private|catch-up|catch up|not listed|unlisted)\)\s*$", re.IGNORECASE)


@dataclass(frozen=True)
class Source:
    label: str
    url: str


@dataclass(frozen=True)
class BriefingItem:
    headline: str
    theme: str  # one of THEMES - the section the item sits under
    listed: bool
    what_happened: str
    why_it_matters: str
    risks: str
    sources: tuple[Source, ...]
    exchange: str = ""
    ticker: str = ""
    not_disclosed: str = ""
    lyra_symbols: tuple[str, ...] = ()
    catch_up: bool = False
    desk: str = "news"  # one of DESKS - a standing desk when the item is that kind of event

    @property
    def text(self) -> str:
        """Everything a reader sees, for the figure and advice checks."""
        return " ".join(part for part in (self.headline, self.what_happened, self.why_it_matters, self.risks, self.not_disclosed) if part)

    def to_dict(self) -> dict[str, Any]:
        return {
            "headline": self.headline,
            "theme": self.theme,
            "desk": self.desk,
            "listed": self.listed,
            "exchange": self.exchange,
            "ticker": self.ticker,
            "what_happened": self.what_happened,
            "why_it_matters": self.why_it_matters,
            "risks": self.risks,
            "not_disclosed": self.not_disclosed,
            "sources": [{"label": source.label, "url": source.url} for source in self.sources],
            "lyra_symbols": list(self.lyra_symbols),
            "catch_up": self.catch_up,
        }


@dataclass(frozen=True)
class GuardOutcome:
    kept: list[BriefingItem]
    removed: list[tuple[BriefingItem, list[str]]] = field(default_factory=list)

    @property
    def categories(self) -> list[str]:
        """The coarse reasons items were removed - safe to log and to put on the ledger."""
        return sorted({reason.split(":")[0] for _item, reasons in self.removed for reason in reasons})


def _clean(value: Any, limit: int) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def canonical_url(url: str) -> str:
    """One spelling per page: lower-case host, no fragment, no tracking parameters, no trailing
    slash - so a source cited as the model saw it matches the same page as the tool returned it."""
    try:
        parts = urlsplit(str(url or "").strip())
    except ValueError:
        return ""
    if parts.scheme not in ("http", "https") or not parts.netloc:
        return ""
    host = parts.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    path = re.sub(r"/+$", "", parts.path) or ""
    query = urlencode([(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if not k.lower().startswith(_TRACKING_PARAMS)])
    return f"{host}{path}" + (f"?{query}" if query else "")


def numbers_in(text: str) -> set[str]:
    """Every figure in the text, spelled one way: '2,700' and '2700' are the same figure, '4.3' is
    not '43'. Years count - a date is a fact like any other."""
    found: set[str] = set()
    for whole, decimals in _NUMBER_RE.findall(text or ""):
        found.add(whole.replace(",", "") + (decimals or ""))
    return found


def parse_source(raw: Any) -> Source | None:
    if isinstance(raw, str):
        url = raw.strip()
        return Source(label="Source", url=url) if canonical_url(url) else None
    if not isinstance(raw, dict):
        return None
    url = str(raw.get("url") or "").strip()
    if not canonical_url(url):
        return None
    return Source(label=_clean(raw.get("label") or "Source", 60), url=url)


def parse_item(raw: Any) -> BriefingItem | None:
    """One published item, or None when it is not even the right shape. Shape only - whether it is
    TRUE is check_item's job."""
    if not isinstance(raw, dict):
        return None
    headline = _HEADLINE_LABEL_RE.sub("", _clean(raw.get("headline"), MAX_HEADLINE_CHARS)).strip()
    what_happened = _clean(raw.get("what_happened"), MAX_FIELD_CHARS)
    why_it_matters = _clean(raw.get("why_it_matters"), MAX_FIELD_CHARS)
    risks = _clean(raw.get("risks"), MAX_FIELD_CHARS)
    if not headline or not what_happened or not why_it_matters or not risks:
        return None
    # A label is never a reason to lose a checked item: an unknown theme files under "other", an
    # unknown desk is ordinary news (rows stored before v0.136.0 carried a category instead).
    theme = str(raw.get("theme") or "").strip().lower()
    desk = str(raw.get("desk") or "").strip().lower()
    sources = tuple(source for source in (parse_source(entry) for entry in (raw.get("sources") or [])) if source)[:MAX_SOURCES_PER_ITEM]
    symbols = raw.get("lyra_symbols") or []
    return BriefingItem(
        headline=headline,
        theme=theme if theme in THEMES else "other",
        desk=desk if desk in DESKS else "news",
        listed=bool(raw.get("listed")),
        what_happened=what_happened,
        why_it_matters=why_it_matters,
        risks=risks,
        sources=sources,
        exchange=_clean(raw.get("exchange"), 20),
        ticker=_clean(raw.get("ticker"), 12).upper(),
        not_disclosed=_clean(raw.get("not_disclosed"), MAX_FIELD_CHARS),
        lyra_symbols=tuple(dict.fromkeys(str(s).strip().upper() for s in symbols if str(s).strip())) if isinstance(symbols, list) else (),
        catch_up=bool(raw.get("catch_up")),
    )


def parse_items(raw: Any) -> list[BriefingItem]:
    if not isinstance(raw, list):
        return []
    return [item for item in (parse_item(entry) for entry in raw) if item is not None]


def parse_desk_notes(raw: Any) -> dict[str, str]:
    """The model's one-sentence note per standing desk - what it looked for and found, or that
    nothing surfaced. A note is not checked against a source, so it may carry no figure and no
    advice: one that does is blanked, and the composer prints the default line instead. Anything
    with a figure belongs in an item, where the guard can hold it to its source."""
    notes: dict[str, str] = {}
    source = raw if isinstance(raw, dict) else {}
    for desk in STANDING_DESKS:
        text = _clean(source.get(desk), MAX_NOTE_CHARS)
        notes[desk] = "" if not text or numbers_in(text) or advice_findings(text) else text
    return notes


def check_item(
    item: BriefingItem,
    *,
    seen: set[str],
    fetched: dict[str, str],
    covered: set[str],
    universe: set[str],
) -> tuple[BriefingItem, list[str]]:
    """The cleaned item and the reasons it must not go out (none = it may). `seen` and `fetched` are
    canonical URLs the research actually returned / opened (fetched maps to the page text);
    `covered` is canonical URLs cited by recent briefings; `universe` is Lyra's scanned symbols."""
    reasons: list[str] = []
    canon = [canonical_url(source.url) for source in item.sources]
    if not canon:
        reasons.append("no source")
    unseen = [url for url in canon if url not in seen]
    if unseen:
        reasons.append(f"unseen source: {len(unseen)} of {len(canon)} not returned by any search or fetch")
    opened = [fetched[url] for url in canon if url in fetched and fetched[url]]
    if canon and not opened:
        reasons.append("source not opened: none of the item's sources was fetched as text")
    if opened:
        available: set[str] = set()
        for text in opened:
            available |= numbers_in(text)
        missing = sorted(numbers_in(item.text) - available)
        if missing:
            reasons.append(f"figure not in source: {len(missing)} figure(s) absent from the item's own sources")
    advice = advice_findings(item.text)
    if advice:
        reasons.append("advice: " + "; ".join(advice))
    if item.listed and not _TICKER_RE.match(item.ticker):
        reasons.append("listed without ticker")
    if not item.listed and (item.ticker or _EXCHANGE_IN_HEADLINE_RE.search(item.headline)):
        reasons.append("private with ticker")
    if any(url in covered for url in canon):
        reasons.append("already covered: a source was cited in a recent briefing")
    cleaned = replace(item, lyra_symbols=tuple(symbol for symbol in item.lyra_symbols if symbol in universe))
    return cleaned, reasons


def guard_briefing(
    items: list[BriefingItem],
    *,
    seen: set[str],
    fetched: dict[str, str],
    covered: set[str],
    universe: set[str],
    max_items: int = MAX_ITEMS,
) -> GuardOutcome:
    """Every item through check_item; the first `max_items` that pass are the briefing (the model
    is told to order by importance, so the cap trims the tail, never the lead)."""
    kept: list[BriefingItem] = []
    removed: list[tuple[BriefingItem, list[str]]] = []
    for item in items:
        cleaned, reasons = check_item(item, seen=seen, fetched=fetched, covered=covered, universe=universe)
        if reasons:
            removed.append((item, reasons))
        elif len(kept) < max_items:
            kept.append(cleaned)
    return GuardOutcome(kept=kept, removed=removed)
