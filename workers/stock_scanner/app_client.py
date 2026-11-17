"""The writer's two calls to the app: fetch the session facts, publish the read.

The free updates are written on a GitHub runner, but the app is the source of truth. The runner
asks `GET /api/updates/facts` for the newest completed session's rows - in the shape `build_facts`
reads - and sends what it wrote to `POST /api/updates/publish`, signed with the one secret it holds
(UPDATES_PUBLISH_SECRET) over a timestamp and the exact body:

    x-lyra-signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">

The app checks the signature, that the read quotes the hash of the facts it served, and the prose
against its own guard, and stores the read. The same scheme lives in src/lib/updates/publish-auth.ts;
contracts/updates/signature-vector.json pins the two together.

Nothing here logs a URL, a body or a key: this repository's Actions logs are public.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Any

import requests

SIGNATURE_HEADER = "x-lyra-signature"
TIMEOUT_SECONDS = 60
# The app computes a session's facts on the first request after a close, which takes a while and
# answers 202 meanwhile. How long to keep asking.
FACTS_WAIT_SECONDS = 150
FACTS_POLL_SECONDS = 15


def sign(secret: str, timestamp: int, body: str) -> str:
    return hmac.new(secret.encode("utf-8"), f"{timestamp}.{body}".encode("utf-8"), hashlib.sha256).hexdigest()


def signature_header(secret: str, timestamp: int, body: str) -> str:
    return f"t={timestamp},v1={sign(secret, timestamp, body)}"


@dataclass(frozen=True)
class Facts:
    session: str  # the New York day, YYYY-MM-DD
    rows: list[dict[str, Any]]
    hash: str
    listed: int
    published: bool  # the app already holds a read for this session


class AppError(RuntimeError):
    """The app said no, or did not answer. `reason` is a short safe-to-log word."""

    def __init__(self, reason: str, status: int | None = None):
        super().__init__(reason)
        self.reason = reason
        self.status = status


def fetch_facts(base_url: str, *, get: Any = requests.get, sleep: Any = time.sleep, clock: Any = time.monotonic) -> Facts:
    """The newest completed session's facts, waiting while the app computes them."""
    url = f"{base_url.rstrip('/')}/api/updates/facts"
    deadline = clock() + FACTS_WAIT_SECONDS
    while True:
        try:
            response = get(url, timeout=TIMEOUT_SECONDS)
        except requests.RequestException as exc:
            raise AppError("connection") from exc
        if response.status_code == 202 and clock() < deadline:
            sleep(FACTS_POLL_SECONDS)
            continue
        try:
            payload = response.json()
        except ValueError as exc:
            raise AppError("unparsable", response.status_code) from exc
        if response.status_code != 200 or not payload.get("ok"):
            raise AppError(str(payload.get("reason") or f"status_{response.status_code}"), response.status_code)
        rows = payload.get("rows")
        if not isinstance(rows, list) or not rows:
            raise AppError("no_rows", response.status_code)
        return Facts(
            session=str(payload.get("session") or ""),
            rows=rows,
            hash=str(payload.get("hash") or ""),
            listed=int(payload.get("listed") or 0),
            published=bool(payload.get("published")),
        )


def publish(base_url: str, secret: str, read: dict[str, Any], *, post: Any = requests.post, now: Any = time.time) -> dict[str, Any]:
    """Send one read. Returns the app's answer; raises AppError when it refused or did not answer."""
    body = json.dumps(read, ensure_ascii=False, separators=(",", ":"))
    timestamp = int(now())
    headers = {"content-type": "application/json", SIGNATURE_HEADER: signature_header(secret, timestamp, body)}
    try:
        response = post(f"{base_url.rstrip('/')}/api/updates/publish", data=body.encode("utf-8"), headers=headers, timeout=TIMEOUT_SECONDS)
    except requests.RequestException as exc:
        raise AppError("connection") from exc
    try:
        payload = response.json()
    except ValueError as exc:
        raise AppError("unparsable", response.status_code) from exc
    if response.status_code != 200 or not payload.get("ok"):
        raise AppError(str(payload.get("reason") or f"status_{response.status_code}"), response.status_code)
    return payload
