"""
Scout source registry loader.

Sources live in content/scout-sources.jsonl (curated + adversarially verified editorial
content, same pipeline as the theme/company registries). Each row:
  { id, kind: 'api'|'rss'|'x'|'crawl', name, target, niches: [...], why, access, cadence }

access forms:
  - "open"            - no credential needed (public RSS)
  - "env:<KEY_NAME>"  - active only when that env var is set (e.g. env:FINNHUB_API_KEY,
                        env:FIRECRAWL_API_KEY)
  - "gated:x-api"     - registered but dormant until X API access exists

The loader never crashes on a bad row - it logs and skips, so one malformed line cannot
take down the whole scout.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = REPO_ROOT / "content" / "scout-sources.jsonl"

VALID_KINDS = {"api", "rss", "x", "crawl"}


@dataclass(frozen=True)
class ScoutSource:
    id: str
    kind: str
    name: str
    target: str
    niches: tuple[str, ...]
    why: str
    access: str
    cadence: str

    @property
    def env_key(self) -> str | None:
        if self.access.startswith("env:"):
            return self.access.split(":", 1)[1]
        return None


def load_sources(path: Path = REGISTRY_PATH) -> list[ScoutSource]:
    """Load every registry row; malformed rows are logged and skipped."""
    if not path.exists():
        logger.warning("scout-sources registry missing at %s", path)
        return []
    sources: list[ScoutSource] = []
    for i, line in enumerate(path.read_text().splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
            if row["kind"] not in VALID_KINDS:
                raise ValueError(f"bad kind {row['kind']!r}")
            sources.append(
                ScoutSource(
                    id=row["id"],
                    kind=row["kind"],
                    name=row["name"],
                    target=row["target"],
                    niches=tuple(row.get("niches", [])),
                    why=row.get("why", ""),
                    access=row.get("access", "open"),
                    cadence=row.get("cadence", "nightly"),
                )
            )
        except Exception as exc:  # noqa: BLE001 - one bad row must not kill the scout
            logger.error("scout-sources line %d skipped: %s", i, exc)
    return sources


def active_sources(sources: list[ScoutSource] | None = None) -> list[ScoutSource]:
    """Sources the scout can actually pull RIGHT NOW: open, or env-gated with the key set.

    gated:* sources (X) are registered intent, not fetchable - they are excluded here but
    reported by `gated_sources` so the doctor/summary can say what is waiting on access.
    """
    sources = load_sources() if sources is None else sources
    active: list[ScoutSource] = []
    for s in sources:
        if s.access == "open":
            active.append(s)
        elif s.env_key and os.environ.get(s.env_key):
            active.append(s)
    return active


def gated_sources(sources: list[ScoutSource] | None = None) -> list[ScoutSource]:
    """Registered sources waiting on a credential (missing env key or gated:x-api)."""
    sources = load_sources() if sources is None else sources
    return [s for s in sources if s not in active_sources(sources)]
