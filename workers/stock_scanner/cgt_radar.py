"""CGT 12-month anniversary radar - the date your holding's tax treatment changes.

Australian CGT rules apply a 50% discount to capital gains on assets held over 12
months. Every input is already stored: purchase_date, quantity, average_buy_price,
brokerage_fee, and the latest close the scanner persisted. This module is pure date
arithmetic plus the cost-base math review_job already uses - it never fetches anything.

Trigger bands, not exact days: the nightly job only runs Mon-Fri, so "exactly 30 days
out" can fall on a weekend and never fire. Instead a position enters the 30-day band
(8-30 days out) and later the 7-day band (0-7 days out); each band fires once per
position, dedupe-keyed, whichever night the job first sees it. Loss positions are
excluded - the discount only applies to gains, and congratulating a loss would be noise.

Copy doctrine: the date math is from the user's records and the gain is measured from
stored prices; the message says exactly that, and closes with "General information, not
tax advice." - Lyra describes the rule, it never advises the trade.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from workers.stock_scanner.config import Settings
from workers.stock_scanner.logger import get_logger
from workers.stock_scanner.models import PortfolioPosition
from workers.stock_scanner.notification_dispatch import dispatch_notification
from workers.stock_scanner.review_job import format_pct
from workers.stock_scanner.supabase_repo import SupabaseRepository

LOGGER = get_logger("stock_scanner.cgt_radar")

SYDNEY = ZoneInfo("Australia/Sydney")

CGT_HOLDING_DAYS = 365
FIRST_NOTICE_DAYS = 30
FINAL_NOTICE_DAYS = 7


@dataclass(frozen=True)
class CgtNotice:
    """One anniversary notice due for one position."""

    position_id: str
    symbol: str
    band: str  # '30d' | '7d'
    anniversary: date
    days_left: int
    gain_pct: float


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def cgt_notices_for(
    positions: list[PortfolioPosition],
    latest_close_by_symbol: dict[str, float | None],
    sydney_today: date,
) -> list[CgtNotice]:
    """Pure: which positions are inside a notice band today, with their measured gain.
    Skips positions without a purchase date, without stored prices, or sitting at a loss."""
    notices: list[CgtNotice] = []
    for position in positions:
        purchase = _parse_date(position.purchase_date)
        if purchase is None or not position.id:
            continue
        latest = latest_close_by_symbol.get(position.symbol)
        if latest is None or latest <= 0 or position.quantity <= 0:
            continue
        cost_base = (position.quantity * position.average_buy_price) + position.brokerage_fee
        if cost_base <= 0:
            continue
        gain_pct = ((position.quantity * latest - cost_base) / cost_base) * 100
        if gain_pct <= 0:
            continue

        anniversary = purchase + timedelta(days=CGT_HOLDING_DAYS)
        days_left = (anniversary - sydney_today).days
        if FINAL_NOTICE_DAYS < days_left <= FIRST_NOTICE_DAYS:
            band = "30d"
        elif 0 <= days_left <= FINAL_NOTICE_DAYS:
            band = "7d"
        else:
            continue
        notices.append(
            CgtNotice(
                position_id=position.id,
                symbol=position.symbol,
                band=band,
                anniversary=anniversary,
                days_left=days_left,
                gain_pct=gain_pct,
            )
        )
    return notices


def compose_cgt_notice(notice: CgtNotice) -> tuple[str, str]:
    """Pure composer: (title, body)."""
    when = notice.anniversary.strftime("%d %b %Y")
    if notice.days_left == 0:
        title = f"{notice.symbol} reaches 12 months held today"
        lead = f"{notice.symbol} reaches 12 months held today ({when})."
    else:
        title = f"{notice.symbol} reaches 12 months held in {notice.days_left} days"
        lead = (
            f"{notice.symbol} reaches 12 months held on {when}, "
            f"{notice.days_left} day{'s' if notice.days_left != 1 else ''} from now."
        )
    body = "\n".join(
        [
            lead,
            f"Unrealised gain today: {format_pct(notice.gain_pct)} on cost base including fees.",
            "Australian CGT rules apply a 50% discount to capital gains on assets held "
            "over 12 months. The date math is from your records; the gain is measured "
            "from stored prices.",
            "General information, not tax advice. Verify with your accountant.",
        ]
    )
    return title, body


def send_cgt_notices(
    repo: SupabaseRepository,
    settings: Settings,
    now: datetime | None = None,
) -> int:
    """Dispatch due anniversary notices for every user. Returns fresh sends."""
    if now is None:
        now = datetime.now(timezone.utc)
    if not settings.notification_dispatch_enabled:
        return 0
    sydney_today = now.astimezone(SYDNEY).date()

    user_ids = repo.load_active_user_ids()
    if not user_ids and settings.default_user_id:
        user_ids = [settings.default_user_id]

    sent = 0
    for user_id in user_ids:
        positions = repo.load_portfolio_positions(user_id)
        if not positions:
            continue
        latest_closes = {
            symbol: repo.latest_close(symbol, settings.default_timeframe)
            for symbol in {position.symbol for position in positions}
        }
        for notice in cgt_notices_for(positions, latest_closes, sydney_today):
            title, body = compose_cgt_notice(notice)
            result = dispatch_notification(
                settings,
                user_id=user_id,
                symbol=notice.symbol,
                alert_type="cgt_anniversary",
                title=title,
                body=body,
                reason=(
                    f"{notice.symbol} purchase date + 365 days = {notice.anniversary.isoformat()} "
                    f"({notice.days_left} days away)"
                ),
                payload={
                    "band": notice.band,
                    "anniversary": notice.anniversary.isoformat(),
                    "gain_pct": round(notice.gain_pct, 2),
                    # Per-position + per-band: each band fires exactly once per lot.
                    "dedupe_key": f"cgt_anniversary:{user_id}:{notice.position_id}:{notice.band}",
                },
                relevance_score=100,
                notification_type="cgt_anniversary",
                url="/portfolio",
            )
            if result.ok and not result.deduped:
                sent += 1
    return sent
