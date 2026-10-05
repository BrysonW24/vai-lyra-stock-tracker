"""The scanner must store what changed, not the whole lookback, and must not ask the database to
echo its own writes back.

Both halves are pinned here because the failure they prevent was total: re-upserting ~120,000 candle
rows a run (and receiving all of them back) exhausted the Supabase egress quota, the project was
restricted, and every scan failed for four days (2026-09-26 to 2026-09-30).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import httpx
from postgrest import SyncPostgrestClient

from workers.stock_scanner.candle_persistence import (
    TAIL_OVERLAP_BARS,
    candles_to_persist,
    previous_signal_time,
)
from workers.stock_scanner.config import Settings
from workers.stock_scanner.models import Candle
from workers.stock_scanner.supabase_repo import SupabaseRepository


def _candle(when: datetime) -> Candle:
    return Candle(
        symbol="NVDA", timeframe="1h", candle_time=when,
        open=1.0, high=2.0, low=0.5, close=1.5, adjusted_close=1.5, volume=1000.0, source="test",
    )


def _session(day: datetime, bars: int = 7) -> list[Candle]:
    """One US session of hourly bars: 13:30 UTC onward."""
    start = day.replace(hour=13, minute=30, second=0, microsecond=0, tzinfo=timezone.utc)
    return [_candle(start + timedelta(hours=i)) for i in range(bars)]


MONDAY = datetime(2026, 9, 28)
TUESDAY = datetime(2026, 9, 29)


def test_first_scan_backfills_the_whole_lookback() -> None:
    candles = _session(MONDAY) + _session(TUESDAY)
    assert candles_to_persist(candles, None) == candles


def test_same_day_scan_writes_only_the_tail() -> None:
    candles = _session(MONDAY) + _session(TUESDAY)
    previous = candles[-2].candle_time  # the bar before the newest one, same trading day

    kept = candles_to_persist(candles, previous)

    # The previous bar, the newest bar, and the overlap before them - not the other 9 bars.
    assert kept == candles[-(2 + TAIL_OVERLAP_BARS):]
    assert kept[-1] == candles[-1]


def test_every_bar_since_the_previous_signal_is_written_after_a_same_day_gap() -> None:
    # Scanner missed three hours mid-session: nothing since the last stored signal may be dropped.
    candles = _session(TUESDAY)
    previous = candles[1].candle_time

    kept = candles_to_persist(candles, previous)

    assert [c.candle_time for c in kept] == [c.candle_time for c in candles]  # overlap reaches bar 0
    assert all(c in kept for c in candles[1:])


def test_a_new_trading_day_resyncs_the_whole_lookback() -> None:
    # Splits and dividends rewrite history upstream; one full write per session keeps the stored
    # history equal to what the indicators were computed from.
    candles = _session(MONDAY) + _session(TUESDAY, bars=1)
    previous = candles[-2].candle_time  # Monday's last bar; the newest bar is Tuesday's first

    assert candles_to_persist(candles, previous) == candles


def test_an_outage_heals_itself_on_the_next_run() -> None:
    two_weeks_ago = _session(datetime(2026, 9, 14))
    candles = two_weeks_ago + _session(MONDAY) + _session(TUESDAY)
    previous = two_weeks_ago[-1].candle_time

    assert candles_to_persist(candles, previous) == candles


def test_unsorted_input_is_written_in_time_order() -> None:
    candles = _session(TUESDAY)
    kept = candles_to_persist(list(reversed(candles)), None)
    assert kept == candles


def test_previous_signal_time_reads_the_stored_row_shapes() -> None:
    assert previous_signal_time(None) is None
    assert previous_signal_time({}) is None
    assert previous_signal_time({"candle_time": "not a time"}) is None
    expected = datetime(2026, 9, 29, 18, 30, tzinfo=timezone.utc)
    assert previous_signal_time({"candle_time": "2026-09-29T18:30:00+00:00"}) == expected
    assert previous_signal_time({"candle_time": "2026-09-29T18:30:00Z"}) == expected
    assert previous_signal_time({"candle_time": "2026-09-29T18:30:00"}) == expected  # naive = UTC


# --- wire behaviour: what the worker actually asks PostgREST for -------------------------------


def _settings() -> Settings:
    return Settings(
        supabase_url="", supabase_service_role_key="", telegram_bot_token="", telegram_chat_id="",
        market_data_provider="yfinance", ticker_symbols=(), default_timeframe="1h",
        lookback_period_days=180, alert_score_threshold=75, watchlist_score_threshold=60,
        signal_change_threshold=8, enable_telegram_alerts=False, enable_watchlist_alerts=False,
        enable_hourly_digest=False, enable_market_hours_guard=True, force_scan=False,
    )


def _recording_repo() -> tuple[SupabaseRepository, list[httpx.Request]]:
    """A real repository over a real PostgREST client whose transport records instead of sending."""
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        wants_rows = "return=representation" in request.headers.get("prefer", "")
        return httpx.Response(201, json=[{"id": "row-1"}] if wants_rows else None)

    repo = SupabaseRepository(_settings())
    repo.client = SyncPostgrestClient(  # type: ignore[assignment] - same .table() surface
        "http://postgrest.test/rest/v1",
        http_client=httpx.Client(transport=httpx.MockTransport(handler), base_url="http://postgrest.test/rest/v1"),
    )
    return repo, seen


def test_candle_writes_never_ask_for_the_rows_back() -> None:
    repo, seen = _recording_repo()

    assert repo.save_candles(_session(TUESDAY)) == 7

    assert len(seen) == 1
    prefer = seen[0].headers["prefer"]
    assert "return=minimal" in prefer
    assert "return=representation" not in prefer
    assert "resolution=merge-duplicates" in prefer  # still an idempotent upsert


def test_writes_that_need_an_id_ask_for_the_id_and_nothing_else() -> None:
    repo, seen = _recording_repo()

    assert repo.create_run("hourly_stock_scanner", "1h") == "row-1"

    assert len(seen) == 1
    assert seen[0].url.params.get("select") == "id"


def test_run_bookkeeping_and_alert_log_writes_send_no_echo() -> None:
    repo, seen = _recording_repo()

    repo.finish_run("run-1", status="success", tickers_scanned=3)
    repo.save_alert(
        signal_id=None, symbol="NVDA", alert_type="strong_setup", channel="multi_channel",
        message="m", sent_status="sent",
    )

    assert [request.method for request in seen] == ["PATCH", "POST"]
    assert all("return=minimal" in request.headers["prefer"] for request in seen)
