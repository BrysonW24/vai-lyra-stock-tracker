"""
Scout fetchers - one guarded adapter per source kind.

Every adapter returns a list of normalized ScoutItem and NEVER raises: a dead feed, a
changed API shape, or a missing key degrades to an empty list with a log line. Demo mode
(no keys, no network expectation) is served by demo_items() so the loop always has shape.

Adapters:
  - fetch_finnhub_general: Finnhub /news?category=general - the broad market firehose.
  - fetch_rss: stdlib RSS 2.0 / Atom parsing (no new dependency) for open feeds.
  - fetch_firecrawl: Firecrawl hosted API (env:FIRECRAWL_API_KEY) for registered crawl
    targets - the sanctioned crawler per the Vivacity open-source registry (self-hosting
    a crawler daemon would break Lyra's no-daemon infra doctrine).
  - X sources are access-gated (gated:x-api) and skipped until credentials exist.
"""

from __future__ import annotations

import hashlib
import logging
import os
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

from workers.scout.sources import ScoutSource

logger = logging.getLogger(__name__)

USER_AGENT = "LyraScout/1.0 (+https://vai-lyra-stock-tracker.vercel.app)"
TIMEOUT_S = 15


@dataclass(frozen=True)
class ScoutItem:
    """One normalized piece of broad signal, from any source kind."""

    id: str
    source_id: str
    source_kind: str
    url: str | None
    title: str
    summary: str
    published_at: datetime | None


def item_id(url: str | None, title: str) -> str:
    """Deterministic id so re-runs upsert instead of duplicating."""
    return hashlib.sha256(f"{url or ''}|{title}".encode()).hexdigest()[:24]


def _mk(source: ScoutSource, title: str, summary: str, url: str | None, published: datetime | None) -> ScoutItem | None:
    title = (title or "").strip()
    if not title:
        return None
    return ScoutItem(
        id=item_id(url, title),
        source_id=source.id,
        source_kind=source.kind,
        url=url,
        title=title[:500],
        summary=(summary or "").strip()[:2000],
        published_at=published,
    )


def fetch_finnhub_general(source: ScoutSource, max_items: int = 100) -> list[ScoutItem]:
    """Finnhub general-news firehose. Requires FINNHUB_API_KEY."""
    api_key = os.environ.get("FINNHUB_API_KEY")
    if not api_key:
        return []
    try:
        import requests

        resp = requests.get(
            "https://finnhub.io/api/v1/news",
            params={"category": "general", "token": api_key},
            timeout=TIMEOUT_S,
            headers={"User-Agent": USER_AGENT},
        )
        resp.raise_for_status()
        items: list[ScoutItem] = []
        for row in resp.json()[:max_items]:
            published = None
            if row.get("datetime"):
                published = datetime.fromtimestamp(int(row["datetime"]), tz=timezone.utc)
            item = _mk(source, row.get("headline", ""), row.get("summary", ""), row.get("url"), published)
            if item:
                items.append(item)
        return items
    except Exception as exc:  # noqa: BLE001
        logger.error("finnhub general news failed: %s", exc)
        return []


def _parse_feed_datetime(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return parsedate_to_datetime(raw)  # RFC 2822 (RSS pubDate)
    except Exception:  # noqa: BLE001
        pass
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))  # ISO 8601 (Atom)
    except Exception:  # noqa: BLE001
        return None


def parse_feed_xml(xml_text: str, source: ScoutSource, max_items: int = 40) -> list[ScoutItem]:
    """Parse RSS 2.0 or Atom with the stdlib - tolerant of either shape."""
    items: list[ScoutItem] = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as exc:
        logger.error("feed %s unparseable: %s", source.id, exc)
        return []

    ns_atom = "{http://www.w3.org/2005/Atom}"
    # RSS 2.0: <channel><item>; Atom: <feed><entry>
    entries = root.findall(".//item") or root.findall(f".//{ns_atom}entry")
    for entry in entries[:max_items]:
        def text(tag: str) -> str | None:
            el = entry.find(tag) if not tag.startswith("{") else entry.find(tag)
            return el.text if el is not None and el.text else None

        title = text("title") or text(f"{ns_atom}title") or ""
        summary = text("description") or text(f"{ns_atom}summary") or text(f"{ns_atom}content") or ""
        url = text("link")
        if url is None:
            link_el = entry.find(f"{ns_atom}link")
            url = link_el.get("href") if link_el is not None else None
        published = _parse_feed_datetime(
            text("pubDate") or text(f"{ns_atom}published") or text(f"{ns_atom}updated")
        )
        item = _mk(source, title, summary, url, published)
        if item:
            items.append(item)
    return items


def fetch_rss(source: ScoutSource) -> list[ScoutItem]:
    """Fetch + parse one open feed. Dead feeds degrade to []."""
    try:
        import requests

        resp = requests.get(source.target, timeout=TIMEOUT_S, headers={"User-Agent": USER_AGENT})
        resp.raise_for_status()
        return parse_feed_xml(resp.text, source)
    except Exception as exc:  # noqa: BLE001
        logger.error("rss %s failed: %s", source.id, exc)
        return []


def fetch_firecrawl(source: ScoutSource) -> list[ScoutItem]:
    """Scrape one registered crawl target through Firecrawl's hosted API.

    The whole page becomes ONE item (title + markdown excerpt) - enough for the attach +
    cluster engines to read the signal without building a bespoke parser per site.
    """
    api_key = os.environ.get("FIRECRAWL_API_KEY")
    if not api_key:
        return []
    try:
        import requests

        resp = requests.post(
            "https://api.firecrawl.dev/v1/scrape",
            json={"url": source.target, "formats": ["markdown"], "onlyMainContent": True},
            headers={"Authorization": f"Bearer {api_key}", "User-Agent": USER_AGENT},
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json().get("data", {})
        markdown = data.get("markdown", "")
        title = (data.get("metadata") or {}).get("title") or source.name
        if not markdown:
            return []
        item = _mk(source, title, markdown[:2000], source.target, datetime.now(tz=timezone.utc))
        return [item] if item else []
    except Exception as exc:  # noqa: BLE001
        logger.error("firecrawl %s failed: %s", source.id, exc)
        return []


def fetch_source(source: ScoutSource) -> list[ScoutItem]:
    """Route a source to its adapter. Unknown/gated kinds return []."""
    if source.kind == "api":
        return fetch_finnhub_general(source)
    if source.kind == "rss":
        return fetch_rss(source)
    if source.kind == "crawl":
        return fetch_firecrawl(source)
    return []  # x sources are gated until credentials exist


def demo_items(source_id: str = "demo") -> list[ScoutItem]:
    """Deterministic sample items so demo mode exercises the whole loop."""
    base = datetime.now(tz=timezone.utc) - timedelta(hours=6)
    rows = [
        ("US Department of Energy announces fusion pilot funding round", "The DOE named a cohort of private fusion companies for milestone-based awards targeting pilot plants in the early 2030s.", "https://example.com/doe-fusion"),
        ("Second fusion startup signs utility power purchase agreement", "A commercial fusion developer signed a conditional PPA with a regional utility, the second such agreement this quarter.", "https://example.com/fusion-ppa"),
        ("Hyperscaler expands data-centre campus with dedicated substation", "The buildout adds gigawatt-scale power infrastructure in the US Midwest.", "https://example.com/dc-substation"),
    ]
    out: list[ScoutItem] = []
    for i, (title, summary, url) in enumerate(rows):
        out.append(
            ScoutItem(
                id=item_id(url, title),
                source_id=source_id,
                source_kind="rss",
                url=url,
                title=title,
                summary=summary,
                published_at=base + timedelta(minutes=i),
            )
        )
    return out
