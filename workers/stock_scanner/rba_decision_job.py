"""RBA decision alert - the 2:30pm Sydney rate call, in your channels minutes later.

Runs from its own calendar-gated cron (.github/workflows/rba-decision-alert.yml) at
2:31pm Sydney on the 8 seeded decision days a year (see macro_calendar.RBA_DECISION_DATES,
verified from the RBA's published schedule). On any other day it exits clean immediately.

Doctrine, in order of what can go wrong:
1. The decision statement is DISCOVERED, never guessed: media-release URLs (mr-YY-NN) are
   numbered sequentially across ALL release types, so the job reads the year index and
   finds today's item titled "Monetary Policy Decision". The RSS feed is only ~2 items
   deep, so the HTML index is the primary surface.
2. The rate is EXTRACTED from the official statement text by regex, never inferred. The
   statement always states the action ("leave ... unchanged at X per cent" / "lower ...
   to X per cent"), so held/cut/raised needs no stored prior.
3. Every fetch degrades honestly: rba.gov.au is known to 403 datacenter IPs, so if the
   fetch or parse fails the alert STILL fires - from the seeded calendar alone - saying
   the decision is out and linking the statement, without claiming a number it never read.
4. The AUD/USD move since just before the announcement is measured from Yahoo intraday
   quotes; on failure the line is omitted.

Demo-safe: no dispatch secret = clean no-op.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo

import requests

from workers.stock_scanner.config import load_settings
from workers.stock_scanner.logger import get_logger
from workers.stock_scanner.macro_calendar import RBA_DECISION_DATES
from workers.stock_scanner.notification_dispatch import dispatch_notification
from workers.stock_scanner.supabase_repo import SupabaseRepository

LOGGER = get_logger("stock_scanner.rba_decision_job")

SYDNEY = ZoneInfo("Australia/Sydney")
BROWSER_HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}
TIMEOUT = 15

MEDIA_INDEX_URL = "https://www.rba.gov.au/media-releases/{year}/"
RBA_BASE = "https://www.rba.gov.au"

# How long the job waits for the release to appear after 2:30pm (it publishes on the
# minute; CDN cache-control is max-age=30, so a couple of minutes is generous).
POLL_ATTEMPTS = 8
POLL_INTERVAL_SECONDS = 90


@dataclass(frozen=True)
class ParsedDecision:
    """The action and rate as stated in the official decision text."""

    action: str  # 'held' | 'cut' | 'raised'
    rate_pct: float


def parse_decision_statement(text: str) -> Optional[ParsedDecision]:
    """Extract (action, new cash rate) from official statement prose. Returns None when
    the wording does not match - the caller then reports the decision WITHOUT a number
    rather than inventing one. Patterns cover the Board's standing formulations:
    'leave the cash rate target unchanged at 3.85 per cent',
    'lower the cash rate target by 25 basis points to 3.60 per cent',
    'raise the cash rate target by 25 basis points to 4.10 per cent'."""
    flat = re.sub(r"\s+", " ", text)
    match = re.search(
        r"\b(leave|hold|maintain|lower|reduce|cut|raise|increase|lift)\b"
        r"[^.]{0,160}?cash rate(?: target)?[^.]{0,120}?"
        r"\b(?:at|to)\s+(\d+(?:\.\d+)?)\s*per\s*cent",
        flat,
        re.IGNORECASE,
    )
    if not match:
        return None
    verb = match.group(1).lower()
    rate = float(match.group(2))
    if verb in {"leave", "hold", "maintain"}:
        action = "held"
    elif verb in {"lower", "reduce", "cut"}:
        action = "cut"
    else:
        action = "raised"
    return ParsedDecision(action=action, rate_pct=rate)


def find_decision_release_url(index_html: str) -> Optional[str]:
    """The decision statement's URL from the year index. Titles since March 2025 read
    'Statement by the Monetary Policy Board: Monetary Policy Decision'."""
    for match in re.finditer(r'<a[^>]+href="([^"]+)"[^>]*>([^<]+)</a>', index_html):
        href, title = match.group(1), match.group(2)
        if "monetary policy decision" in title.lower():
            return href if href.startswith("http") else f"{RBA_BASE}{href}"
    return None


def fetch_decision_text(now_sydney: datetime) -> Optional[str]:
    """Discover and fetch today's decision statement text. None on any failure - the
    datacenter-IP 403 documented in docs/messaging-roadmap.md lands here."""
    try:
        index = requests.get(
            MEDIA_INDEX_URL.format(year=now_sydney.year), headers=BROWSER_HEADERS, timeout=TIMEOUT
        )
        index.raise_for_status()
        url = find_decision_release_url(index.text)
        if not url:
            return None
        release = requests.get(url, headers=BROWSER_HEADERS, timeout=TIMEOUT)
        release.raise_for_status()
        return re.sub(r"<[^>]+>", " ", release.text)
    except requests.RequestException as exc:
        LOGGER.warning("Decision statement fetch failed (expected on blocked IPs): %s", exc)
        return None


def fetch_audusd_move_since(cutoff_utc: datetime) -> Optional[tuple[float, float]]:
    """(price at/just before cutoff, latest price) from Yahoo intraday 5m bars. None on
    any failure or when no bar precedes the cutoff."""
    try:
        resp = requests.get(
            "https://query1.finance.yahoo.com/v8/finance/chart/AUDUSD=X?interval=5m&range=1d",
            headers=BROWSER_HEADERS,
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        result = resp.json()["chart"]["result"][0]
        stamps = result["timestamp"]
        closes = result["indicators"]["quote"][0]["close"]
        cutoff = cutoff_utc.timestamp()
        before = [c for t, c in zip(stamps, closes) if c is not None and t <= cutoff]
        after = [c for t, c in zip(stamps, closes) if c is not None]
        if not before or not after:
            return None
        return before[-1], after[-1]
    except (requests.RequestException, KeyError, IndexError, TypeError, ValueError) as exc:
        LOGGER.warning("AUDUSD intraday fetch failed: %s", exc)
        return None


def compose_decision_alert(
    decision: Optional[ParsedDecision],
    audusd: Optional[tuple[float, float]],
) -> tuple[str, str]:
    """Pure composer: (title, body). Degrades line by line - a missing number is omitted,
    never estimated."""
    if decision is not None:
        verb = {"held": "holds at", "cut": "cuts to", "raised": "raises to"}[decision.action]
        title = f"RBA {verb} {decision.rate_pct:.2f}%"
        first = (
            f"Decision at 2:30pm Sydney: the cash rate target was "
            f"{decision.action} at {decision.rate_pct:.2f}%."
            if decision.action == "held"
            else f"Decision at 2:30pm Sydney: the cash rate target was "
            f"{decision.action} to {decision.rate_pct:.2f}%."
        )
    else:
        title = "RBA decision is out"
        first = (
            "The Monetary Policy Board's decision published at 2:30pm Sydney. "
            "The statement could not be read automatically, so no number is quoted here."
        )

    lines = [first]
    if audusd is not None:
        pre, post = audusd
        if pre > 0:
            move_pct = ((post - pre) / pre) * 100
            direction = "less" if move_pct > 0 else "more"
            lines.append(
                f"AUD/USD moved {pre:.4f} to {post:.4f} since just before the announcement "
                f"({move_pct:+.2f}%), so USD holdings are worth about {abs(move_pct):.2f}% "
                f"{direction} in AUD terms than this morning."
            )
    lines.append("Full statement: rba.gov.au/media-releases. Source: RBA.")
    return title, "\n".join(lines)


def run(now: datetime | None = None, sleep=None) -> int:
    """Gate on the seeded calendar, poll for the statement, dispatch. Returns sends."""
    import time

    if now is None:
        now = datetime.now(timezone.utc)
    if sleep is None:
        sleep = time.sleep
    now_sydney = now.astimezone(SYDNEY)
    today_iso = now_sydney.date().isoformat()

    if today_iso not in RBA_DECISION_DATES:
        LOGGER.info("Not an RBA decision day (%s Sydney) - exiting clean", today_iso)
        return 0

    settings = load_settings()
    if not settings.notification_dispatch_enabled:
        LOGGER.info("Notification dispatch unconfigured - decision job is a no-op")
        return 0
    repo = SupabaseRepository(settings)

    decision: Optional[ParsedDecision] = None
    for attempt in range(POLL_ATTEMPTS):
        text = fetch_decision_text(now_sydney)
        if text is not None:
            decision = parse_decision_statement(text)
            if decision is not None:
                break
        if attempt < POLL_ATTEMPTS - 1:
            sleep(POLL_INTERVAL_SECONDS)

    # 2:25pm Sydney today as the pre-announcement FX baseline.
    cutoff = now_sydney.replace(hour=14, minute=25, second=0, microsecond=0).astimezone(timezone.utc)
    audusd = fetch_audusd_move_since(cutoff)

    title, body = compose_decision_alert(decision, audusd)

    user_ids = repo.load_active_user_ids()
    if not user_ids and settings.default_user_id:
        user_ids = [settings.default_user_id]

    sent = 0
    for user_id in user_ids:
        result = dispatch_notification(
            settings,
            user_id=user_id,
            symbol="MACRO",
            alert_type="macro_event",
            title=title,
            body=body,
            reason=f"RBA monetary policy decision, {today_iso} (seeded calendar)",
            payload={
                "kind": "rba_decision",
                "action": decision.action if decision else None,
                "rate_pct": decision.rate_pct if decision else None,
                "dedupe_key": f"macro_event:rba_decision:{user_id}:{today_iso}",
            },
            relevance_score=100,
            notification_type="macro_event",
            url="/calendar",
        )
        if result.ok and not result.deduped:
            sent += 1
    LOGGER.info("RBA decision alert: parsed=%s sent=%s", decision is not None, sent)
    return sent


def main() -> None:
    run()


if __name__ == "__main__":
    main()
