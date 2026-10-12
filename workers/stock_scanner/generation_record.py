"""Every message the workers send, on the record.

Until v0.137.0 only the cost of a generation reached the database (the run ledger); the text went
to Telegram and was gone. The 2026-10-13 review could recover three of the first twelve texts, and
only from session transcripts - so "what did we send this reader on Thursday, and why did they
leave?" had no answer. This module writes one `ai_runs` row (migration 019) per generation, before
it is sent:

- `output_payload.text`: the message exactly as the operator receives it (Telegram HTML, every
  part), with the parts count, the mode (production or rehearsal), tokens, cost and effort;
- `input_payload`: what the generation was made from - the read's fact sheet, the briefing's
  research brief and the guard's removals, the morning guide's quotes;
- `prompt_version`: `<job>@<12 hex>` over the system prompt and tool schema, so a change in quality
  can be traced to the prompt that wrote it;
- `input_hash`: sha256 of the input text, so two runs over the same facts are recognisable.

Privacy - ai_runs rows are readable by their owner, and rows with no owner by every signed-in
account (019's policy). A generation that carries a reader's book (the read, the morning guide) is
written with that reader's user id; only the briefing, which every account already sees on
/briefing, is written without one. A subscriber's personal copy is never stored: it is the
briefing's row reordered around holdings they gave us.

The row id is minted here so the feedback buttons (feedback.py) can carry it. Writing never raises:
a record that could not be written must not stop the message, it only sends without buttons.
"""

from __future__ import annotations

import hashlib
import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from workers.stock_scanner.logger import get_logger
from workers.stock_scanner.supabase_repo import _NO_ECHO

LOGGER = get_logger("stock_scanner.generation_record")

TABLE = "ai_runs"
PRODUCTION = "production"
REHEARSAL = "rehearsal"
# ok: the content as designed. fallback: sent without the model's part (the figures-only read).
# note: a one-line "nothing tonight" message - recorded, never reviewed, no buttons.
STATUSES = ("ok", "fallback", "note")


def prompt_version(job: str, *parts: Any) -> str:
    """`<job>@<first 12 hex of sha256>` over the parts in order (dicts and lists as sorted JSON)."""
    digest = hashlib.sha256()
    for part in parts:
        text = part if isinstance(part, str) else json.dumps(part, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        digest.update(text.encode())
        digest.update(b"\x00")
    return f"{job}@{digest.hexdigest()[:12]}"


def input_hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def new_generation_id() -> str:
    return str(uuid.uuid4())


@dataclass
class Generation:
    """One generation as it will be stored. `id` is minted up front so buttons can carry it."""

    agent_name: str
    prompt_version: str
    input_text: str
    text_parts: list[str]
    status: str = "ok"
    mode: str = PRODUCTION
    user_id: str | None = None
    model: str | None = None  # None for engine-only content (the morning guide, a figures-only read)
    effort: str | None = None
    input_tokens: int = 0
    cache_read_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    input_payload: dict[str, Any] = field(default_factory=dict)
    extra: dict[str, Any] = field(default_factory=dict)  # job-specific output fields (items, reason, ...)
    confidence: float | None = None  # 0-1, where the job reports one (the review's mean score / 5)
    id: str = field(default_factory=new_generation_id)

    def row(self) -> dict[str, Any]:
        if self.status not in STATUSES:
            raise ValueError(f"unknown generation status {self.status!r}")
        return {
            "id": self.id,
            "user_id": self.user_id or None,
            "agent_name": self.agent_name,
            "model_provider": "anthropic" if self.model else None,
            "model_name": self.model or None,
            "prompt_version": self.prompt_version,
            "input_hash": input_hash(self.input_text),
            "input_payload": {"input": self.input_text, **self.input_payload},
            "output_payload": {
                "text": "\n\n".join(self.text_parts),
                "parts": len(self.text_parts),
                "mode": self.mode,
                "effort": self.effort,
                "input_tokens": self.input_tokens,
                "cache_read_tokens": self.cache_read_tokens,
                "output_tokens": self.output_tokens,
                "cost_usd": round(self.cost_usd, 6),
                **self.extra,
            },
            "confidence_score": self.confidence,
            "status": self.status,
        }


def record_generation(client: Any, generation: Generation) -> bool:
    """Insert the generation's row; True when it is on the record. Never raises - retried twice,
    then logged (the error's type only: the public Actions log never carries content)."""
    if not client:
        return False
    try:
        row = generation.row()
    except ValueError as exc:
        LOGGER.warning("generation not recorded: %s", exc)
        return False
    last: Exception | None = None
    for attempt in range(3):
        try:
            client.table(TABLE).insert(row, returning=_NO_ECHO).execute()
            return True
        except Exception as exc:  # noqa: BLE001 - a record that fails must not stop the send
            last = exc
            if attempt < 2:
                time.sleep(1 + attempt)
    LOGGER.warning("generation %s not recorded: %s", generation.agent_name, type(last).__name__)
    return False
