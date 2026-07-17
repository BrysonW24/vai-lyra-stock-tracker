"""
Deterministic theme attachment - the engine half of "noticing".

Every scout item is matched against the vertical map (themes, supply-chain nodes,
companies, commodities from src/lib/generated/*.json - the same single source of truth
the app renders). No AI here: attachment is keyword/entity matching with word
boundaries, so the result is reproducible and inspectable. Items that match nothing are
flagged `unmapped` - those are the raw material for the cluster engine.

Ticker matching is deliberately conservative: symbols only count when written as $SYM,
or as a standalone uppercase word of 4-5 letters - two-letter tickers like EU or PL are
ordinary words far too often to trust bare.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
GENERATED = REPO_ROOT / "src" / "lib" / "generated"

# Generic words that appear in theme/node names but carry no attachment signal alone.
STOP_TERMS = {
    "infrastructure", "economy", "computing", "automation", "minerals", "energy",
    "systems", "technologies", "technology", "solutions", "resources", "group",
    "holdings", "corp", "corporation", "inc", "company", "industries", "platforms",
    "the", "and", "of",
}


@dataclass(frozen=True)
class Attachment:
    matched_themes: tuple[str, ...]
    symbols: tuple[str, ...]

    @property
    def unmapped(self) -> bool:
        return not self.matched_themes


def _load(name: str) -> list[dict]:
    path = GENERATED / name
    if not path.exists():
        return []
    return json.loads(path.read_text())


def _terms_for_phrase(phrase: str) -> list[str]:
    """Meaningful lowercase terms from a name - multi-word phrases kept whole first."""
    phrase = phrase.lower().strip()
    words = [w for w in re.split(r"[^a-z0-9&-]+", phrase) if w and w not in STOP_TERMS and len(w) > 3]
    terms = []
    if len(phrase.split()) > 1 and len(phrase) > 8:
        terms.append(phrase)  # full phrase match is the strongest signal
    terms.extend(words)
    return terms


@lru_cache(maxsize=1)
def build_index() -> dict[str, frozenset[str]]:
    """term -> theme slugs. Built once per process from the generated map."""
    index: dict[str, set[str]] = {}

    def add(term: str, slug: str) -> None:
        if len(term) < 4:
            return
        index.setdefault(term, set()).add(slug)

    for t in _load("themes.json"):
        for term in _terms_for_phrase(t["name"]):
            add(term, t["slug"])
    for n in _load("supply-chain-nodes.json"):
        for term in _terms_for_phrase(n["name"]):
            add(term, n["theme"])
        for c in n.get("commodities", []):
            if c.lower() not in ("water", "steel", "electricity"):  # too generic to attach on
                add(c.lower(), n["theme"])
    for c in _load("theme-companies.json"):
        for term in _terms_for_phrase(c["name"]):
            add(term, c["theme"])

    return {k: frozenset(v) for k, v in index.items()}


@lru_cache(maxsize=1)
def symbol_theme_map() -> dict[str, str]:
    """UPPER symbol -> primary theme slug."""
    return {c["symbol"].upper(): c["theme"] for c in _load("theme-companies.json")}


_DOLLAR_SYM = re.compile(r"\$([A-Z]{1,5})\b")
_BARE_SYM = re.compile(r"\b([A-Z]{4,5})\b")


def detect_symbols(text: str) -> tuple[str, ...]:
    """Known tickers in raw text: $SYM always counts; bare only for 4-5 letter symbols."""
    known = symbol_theme_map()
    found: list[str] = []
    for m in _DOLLAR_SYM.finditer(text):
        if m.group(1) in known and m.group(1) not in found:
            found.append(m.group(1))
    for m in _BARE_SYM.finditer(text):
        if m.group(1) in known and m.group(1) not in found:
            found.append(m.group(1))
    return tuple(found)


def attach(title: str, summary: str, exceptions: frozenset[tuple[str, str]] | None = None) -> Attachment:
    """Match one item against the vertical map.

    `exceptions` holds accumulated human corrections as (theme, term) pairs (v3 attach
    learning, scout_attach_exceptions): a term a maintainer ruled must NOT attach to a
    theme (tritium wastewater cleanup is not fusion energy). Corrections are enforced
    here - once recorded, the same mis-attach can never recur."""
    text = f"{title} {summary}"
    lower = text.lower()
    index = build_index()
    exceptions = exceptions or frozenset()
    themes: set[str] = set()

    def allowed(term: str, slug: str) -> bool:
        return (slug, term) not in exceptions

    for term, slugs in index.items():
        if " " in term:
            if term in lower:
                themes.update(s for s in slugs if allowed(term, s))
        elif re.search(rf"\b{re.escape(term)}\b", lower):
            # Single terms only attach when unambiguous (one owning theme) - a word
            # shared by three themes is noise, a word owned by one is signal.
            if len(slugs) == 1:
                themes.update(s for s in slugs if allowed(term, s))

    symbols = detect_symbols(text)
    for sym in symbols:
        themes.add(symbol_theme_map()[sym])

    return Attachment(matched_themes=tuple(sorted(themes)), symbols=symbols)
