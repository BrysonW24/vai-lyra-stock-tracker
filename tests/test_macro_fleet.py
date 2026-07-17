"""The macro/event fleet (v0.45.0): seeded calendar, RBA decision parsing, CGT radar,
event radar, and the benchmark/AUD-terms enrichment lines.

What these pin, by module:
- macro_calendar: seed rows are shaped for the market_calendar_events contract the
  frontend actually reads; companion targeting runs on the Sydney calendar; derived
  dates (minutes +14d, chart pack +1d) stay locked to the verified schedule.
- rba_decision_job: the statement regex extracts held/cut/raised + the rate from the
  Board's real formulations and REFUSES to invent a number from garbage; the composer
  degrades line by line.
- cgt_radar: band logic self-heals across skipped runs, losses are excluded, and the
  gain is measured from cost base including fees.
- event_radar: earnings alerts fire only for tracked names inside the window; IPO
  notices respect status and window.
- benchmark_line / aud_terms_line: real math from stored snapshots, omitted (never
  estimated) when history does not cover the window.
"""

from datetime import date, datetime, timezone

from workers.stock_scanner.cgt_radar import CgtNotice, cgt_notices_for, compose_cgt_notice
from workers.stock_scanner.digest_job import aud_terms_line
from workers.stock_scanner.event_radar import earnings_notices, ipo_notices
from workers.stock_scanner.macro_calendar import (
    FOMC_DECISION_DATES,
    RBA_DECISION_DATES,
    macro_calendar_rows,
    macro_companions_for,
    rba_chart_pack_date,
    rba_minutes_date,
)
from workers.stock_scanner.models import PortfolioPosition
from workers.stock_scanner.rba_decision_job import (
    compose_decision_alert,
    find_decision_release_url,
    parse_decision_statement,
    ParsedDecision,
)
from workers.stock_scanner.review_job import benchmark_line


def utc(y: int, m: int, d: int, hour: int = 22) -> datetime:
    return datetime(y, m, d, hour, tzinfo=timezone.utc)


class TestMacroCalendarSeeds:
    def test_rows_match_the_frontend_contract(self):
        rows = macro_calendar_rows()
        # 16 RBA decisions x 3 rows (decision + minutes + chart pack) + 8 FOMC.
        assert len(rows) == len(RBA_DECISION_DATES) * 3 + len(FOMC_DECISION_DATES)
        for row in rows:
            assert set(row) == {"event_id", "event_date", "event_type", "title", "description", "importance"}
            assert row["event_type"] == "economic_release"  # renders as 'macro' via the alias
            assert row["importance"] in {"high", "medium"}
            date.fromisoformat(row["event_date"])  # every date parses

    def test_event_ids_are_stable_and_unique(self):
        rows = macro_calendar_rows()
        ids = [row["event_id"] for row in rows]
        assert len(set(ids)) == len(ids)
        assert "rba-decision-2026-08-11" in ids
        assert "fomc-decision-2026-07-29" in ids

    def test_derived_dates_follow_the_published_pattern(self):
        decision = date(2026, 8, 11)
        assert rba_minutes_date(decision) == date(2026, 8, 25)
        assert rba_chart_pack_date(decision) == date(2026, 8, 12)

    def test_decisions_are_high_importance(self):
        rows = {row["event_id"]: row for row in macro_calendar_rows()}
        assert rows["rba-decision-2026-08-11"]["importance"] == "high"
        assert rows["rba-chart-pack-2026-08-12"]["importance"] == "medium"


class TestMacroCompanions:
    def test_decision_morning_prebrief(self):
        companions = macro_companions_for(date(2026, 8, 11), audusd=0.6512)
        kinds = [c.kind for c in companions]
        assert kinds == ["rba_prebrief"]
        assert "2:30pm" in companions[0].body
        assert "0.6512" in companions[0].body

    def test_audusd_none_omits_the_line(self):
        companions = macro_companions_for(date(2026, 8, 11), audusd=None)
        assert "AUD/USD" not in companions[0].body

    def test_minutes_and_chart_pack_mornings(self):
        assert [c.kind for c in macro_companions_for(date(2026, 8, 25))] == ["rba_minutes"]
        assert [c.kind for c in macro_companions_for(date(2026, 8, 12))] == ["rba_chart_pack"]

    def test_fomc_morning_after(self):
        # FOMC decides Jul 29 US time; Sydney's next morning is Jul 30.
        assert [c.kind for c in macro_companions_for(date(2026, 7, 30))] == ["fomc_after"]

    def test_quiet_day_has_no_companions(self):
        assert macro_companions_for(date(2026, 7, 20)) == []


HOLD_TEXT = """At its meeting today, the Board decided to leave the cash rate target
unchanged at 3.85 per cent. Inflation has continued to moderate."""

CUT_TEXT = """At its meeting today, the Board decided to lower the cash rate target
by 25 basis points to 3.60 per cent, effective 12 August."""

RAISE_TEXT = """At its meeting today, the Board decided to raise the cash rate target
by 25 basis points to 4.10 per cent."""


class TestDecisionParsing:
    def test_hold(self):
        parsed = parse_decision_statement(HOLD_TEXT)
        assert parsed == ParsedDecision(action="held", rate_pct=3.85)

    def test_cut(self):
        parsed = parse_decision_statement(CUT_TEXT)
        assert parsed == ParsedDecision(action="cut", rate_pct=3.60)

    def test_raise(self):
        parsed = parse_decision_statement(RAISE_TEXT)
        assert parsed == ParsedDecision(action="raised", rate_pct=4.10)

    def test_garbage_returns_none_never_a_number(self):
        assert parse_decision_statement("The Board discussed the economy at length.") is None
        assert parse_decision_statement("") is None

    def test_release_url_discovery(self):
        html = (
            '<a href="/media-releases/2026/mr-26-15.html">'
            "Statement by the Monetary Policy Board: Monetary Policy Decision</a>"
            '<a href="/media-releases/2026/mr-26-14.html">Some other release</a>'
        )
        url = find_decision_release_url(html)
        assert url == "https://www.rba.gov.au/media-releases/2026/mr-26-15.html"
        assert find_decision_release_url("<p>nothing here</p>") is None


class TestDecisionComposer:
    def test_full_alert(self):
        title, body = compose_decision_alert(
            ParsedDecision(action="held", rate_pct=3.85), audusd=(0.6520, 0.6534)
        )
        assert title == "RBA holds at 3.85%"
        assert "held at 3.85%" in body
        assert "0.6520 to 0.6534" in body
        assert "Source: RBA" in body

    def test_unparsed_alert_claims_no_number(self):
        title, body = compose_decision_alert(None, audusd=None)
        assert title == "RBA decision is out"
        assert "%" not in title
        assert "no number is quoted" in body

    def test_cut_title(self):
        title, _ = compose_decision_alert(ParsedDecision(action="cut", rate_pct=3.60), None)
        assert title == "RBA cuts to 3.60%"


def position(symbol="AVGO", purchase="2025-08-16", qty=10.0, avg=100.0, fee=5.0):
    return PortfolioPosition(
        id=f"pos-{symbol}", symbol=symbol, quantity=qty, average_buy_price=avg,
        brokerage_fee=fee, purchase_date=purchase, user_id="u1",
    )


class TestCgtRadar:
    def test_30d_band(self):
        # Anniversary 2026-08-16; 25 days out sits in the 30d band.
        notices = cgt_notices_for([position()], {"AVGO": 150.0}, date(2026, 7, 22))
        assert len(notices) == 1
        assert notices[0].band == "30d"
        assert notices[0].anniversary == date(2026, 8, 16)

    def test_7d_band_and_zero_day(self):
        assert cgt_notices_for([position()], {"AVGO": 150.0}, date(2026, 8, 12))[0].band == "7d"
        assert cgt_notices_for([position()], {"AVGO": 150.0}, date(2026, 8, 16))[0].band == "7d"

    def test_outside_bands_is_silent(self):
        assert cgt_notices_for([position()], {"AVGO": 150.0}, date(2026, 6, 1)) == []
        assert cgt_notices_for([position()], {"AVGO": 150.0}, date(2026, 8, 17)) == []

    def test_loss_positions_are_excluded(self):
        assert cgt_notices_for([position()], {"AVGO": 90.0}, date(2026, 7, 22)) == []

    def test_missing_close_is_skipped(self):
        assert cgt_notices_for([position()], {"AVGO": None}, date(2026, 7, 22)) == []

    def test_gain_measured_from_cost_base_including_fees(self):
        notice = cgt_notices_for([position()], {"AVGO": 150.0}, date(2026, 7, 22))[0]
        # cost base 10*100+5 = 1005; value 1500 -> +49.25%
        assert abs(notice.gain_pct - ((1500 - 1005) / 1005) * 100) < 1e-9

    def test_compose_copy_is_general_information(self):
        notice = CgtNotice("pos-1", "AVGO", "30d", date(2026, 8, 16), 25, 49.3)
        title, body = compose_cgt_notice(notice)
        assert "AVGO reaches 12 months held in 25 days" == title
        assert "General information, not tax advice." in body
        assert "50% discount" in body


class TestEventRadar:
    EVENTS = [
        {"event_type": "earnings", "ticker": "NVDA", "event_date": "2026-07-18", "title": "NVDA Q2 earnings"},
        {"event_type": "earnings", "ticker": "XYZ", "event_date": "2026-07-18", "title": "XYZ earnings"},
        {"event_type": "earnings", "ticker": "AMD", "event_date": "2026-07-25", "title": "AMD earnings"},
        {"event_type": "conference", "ticker": "NVDA", "event_date": "2026-07-18", "title": "Keynote"},
    ]

    def test_only_tracked_symbols_inside_window(self):
        notices = earnings_notices(self.EVENTS, {"NVDA", "AMD"}, date(2026, 7, 17))
        assert [n.symbol for n in notices] == ["NVDA"]  # XYZ untracked, AMD outside window
        assert "tomorrow" in notices[0].title

    def test_ipo_window_and_status(self):
        ipos = [
            {"symbol": "NEWCO", "company_name": "NewCo", "ipo_date": "2026-07-18",
             "exchange": "NASDAQ", "status": "upcoming", "valuation_usd_m": 12000},
            {"symbol": "OLDCO", "company_name": "OldCo", "ipo_date": "2026-07-18",
             "exchange": "NYSE", "status": "recent", "valuation_usd_m": 500},
            {"symbol": "FARCO", "company_name": "FarCo", "ipo_date": "2026-09-01",
             "exchange": "NYSE", "status": "upcoming", "valuation_usd_m": 500},
        ]
        notices = ipo_notices(ipos, date(2026, 7, 17))
        assert [n.symbol for n in notices] == ["NEWCO"]
        assert "$12.0B" in notices[0].body


class SnapshotRepo:
    """Snapshot reader stub for the enrichment lines."""

    def __init__(self, start: dict, latest: dict) -> None:
        self.start = start
        self.latest = latest

    def load_snapshot_value_at_or_after(self, key, _start):
        return self.start.get(key)

    def load_latest_snapshot_value(self, key):
        return self.latest.get(key)


class TestEnrichmentLines:
    def test_benchmark_line_math(self):
        repo = SnapshotRepo({"sp500_price": 6000.0}, {"sp500_price": 6120.0})
        line = benchmark_line(repo, utc(2026, 7, 1), portfolio_pct=4.1)
        assert "S&P 500 over the same window: +2.0%." in line
        assert "ahead of the index" in line  # 4.1 - 2.0 = +2.1 ahead

    def test_benchmark_line_omitted_without_history(self):
        assert benchmark_line(SnapshotRepo({}, {}), utc(2026, 7, 1), 4.1) is None

    def test_aud_terms_combine(self):
        # AUD fell 1.9% -> USD holdings worth ~1.94% more in AUD terms on top of +1.2%.
        repo = SnapshotRepo({"audusd_price": 0.6712}, {"audusd_price": 0.6584})
        line = aud_terms_line(repo, utc(2026, 7, 10), usd_pct=1.2)
        fx_move = ((0.6584 - 0.6712) / 0.6712) * 100
        expected = ((1 + 0.012) * (1 - fx_move / 100) - 1) * 100
        assert f"{'+' if expected > 0 else ''}{expected:.1f}%" in line
        assert "AUD fell 1.9%" in line

    def test_aud_terms_omitted_without_history(self):
        assert aud_terms_line(SnapshotRepo({}, {}), utc(2026, 7, 10), 1.2) is None
