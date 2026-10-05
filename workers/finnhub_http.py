"""The one doorway to Finnhub for every worker that calls it.

Three things the per-worker `requests.get` calls each got wrong, fixed once here:

1. Rate limit. The free tier allows 60 calls a minute. The news worker asked for one ticker after
   another with no pause - 100+ calls in well under a minute - so everything past the 60th would
   have been refused (HTTP 429), logged as a warning and treated as "no news for that ticker".
   Alphabetically the last third of the universe would have gone dark every night. Calls here are
   spaced to stay under the limit, across every worker that runs in the same process.
2. A refusal is not an empty result. A 429 waits out the window and retries once; any other error
   is raised, so the caller can tell "Finnhub said no" from "Finnhub had nothing".
3. The key stays out of the logs. Finnhub takes the key as a query parameter, and the HTTP
   library puts the full URL - key included - in its error text. Every error raised from here has
   the key removed first.
"""
from __future__ import annotations

import logging
import time
from typing import Any, Callable

logger = logging.getLogger("finnhub_http")

BASE_URL = "https://finnhub.io/api/v1"

# 60 calls a minute on the free tier; one call per 1.1s is ~54 a minute, with headroom.
MIN_INTERVAL_SECONDS = 1.1
# The limit is a rolling minute, so after a refusal wait one out in full before the single retry.
RATE_LIMIT_WAIT_SECONDS = 61.0

_last_call_at: float | None = None


class FinnhubError(RuntimeError):
    """A Finnhub call that did not return data. The message never contains the API key."""


def redact(text: str, api_key: str) -> str:
    return text.replace(api_key, "[redacted]") if api_key else text


def reset_throttle() -> None:
    """Test seam: forget when the last call happened."""
    global _last_call_at
    _last_call_at = None


def finnhub_get(
    path: str,
    params: dict[str, Any],
    api_key: str,
    *,
    timeout: float = 10,
    sleep: Callable[[float], None] = time.sleep,
    clock: Callable[[], float] = time.monotonic,
    http_get: Callable[..., Any] | None = None,
) -> Any:
    """GET a Finnhub endpoint and return the decoded JSON, throttled and with the key kept private."""
    global _last_call_at
    if http_get is None:
        import requests

        http_get = requests.get

    url = f"{BASE_URL}/{path.lstrip('/')}"
    for attempt in (1, 2):
        if _last_call_at is not None:
            wait = MIN_INTERVAL_SECONDS - (clock() - _last_call_at)
            if wait > 0:
                sleep(wait)
        _last_call_at = clock()
        try:
            response = http_get(url, params={**params, "token": api_key}, timeout=timeout)
        except Exception as exc:  # noqa: BLE001 - transport errors carry the URL, and the URL carries the key
            raise FinnhubError(redact(f"{path}: {exc}", api_key)) from None
        status = response.status_code
        if status == 429 and attempt == 1:
            logger.warning("Finnhub rate limit hit on %s - waiting %.0fs before one retry", path, RATE_LIMIT_WAIT_SECONDS)
            sleep(RATE_LIMIT_WAIT_SECONDS)
            continue
        if status >= 400:
            raise FinnhubError(f"{path}: HTTP {status}")
        return response.json()
    raise FinnhubError(f"{path}: still rate limited after waiting")  # pragma: no cover - loop always returns/raises
