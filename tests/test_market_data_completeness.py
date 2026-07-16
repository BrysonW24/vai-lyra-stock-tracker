from datetime import datetime, timedelta, timezone

import pytest

from workers.stock_scanner.market_data import download_with_retry, drop_incomplete_last_candle
from workers.stock_scanner.models import Candle


def candle(open_time: datetime, close: float = 100.0) -> Candle:
    return Candle(
        symbol="NVDA",
        timeframe="1h",
        candle_time=open_time,
        open=close,
        high=close,
        low=close,
        close=close,
        adjusted_close=close,
        volume=1000.0,
        source="test",
    )


def test_drops_the_in_progress_hourly_bar() -> None:
    # Scanner fires at :05 - the bar that opened at 14:00 is only 5 minutes formed.
    now = datetime(2026, 7, 16, 14, 5, tzinfo=timezone.utc)
    candles = [
        candle(datetime(2026, 7, 16, 12, 0, tzinfo=timezone.utc)),
        candle(datetime(2026, 7, 16, 13, 0, tzinfo=timezone.utc)),
        candle(datetime(2026, 7, 16, 14, 0, tzinfo=timezone.utc)),
    ]

    kept = drop_incomplete_last_candle(candles, "1h", now=now)

    assert [c.candle_time.hour for c in kept] == [12, 13]


def test_keeps_a_fully_formed_last_bar() -> None:
    # At 15:00 exactly, the 14:00 bar has completed - publishing it is reproducible.
    now = datetime(2026, 7, 16, 15, 0, tzinfo=timezone.utc)
    candles = [
        candle(datetime(2026, 7, 16, 13, 0, tzinfo=timezone.utc)),
        candle(datetime(2026, 7, 16, 14, 0, tzinfo=timezone.utc)),
    ]

    kept = drop_incomplete_last_candle(candles, "1h", now=now)

    assert len(kept) == 2


def test_drops_the_in_progress_daily_bar_and_sorts() -> None:
    now = datetime(2026, 7, 16, 18, 0, tzinfo=timezone.utc)
    complete = candle(datetime(2026, 7, 15, 0, 0, tzinfo=timezone.utc))
    in_progress = candle(datetime(2026, 7, 16, 0, 0, tzinfo=timezone.utc))

    kept = drop_incomplete_last_candle([in_progress, complete], "1d", now=now)

    assert kept == [complete]


def test_unknown_timeframe_and_empty_list_pass_through() -> None:
    now = datetime(2026, 7, 16, 14, 5, tzinfo=timezone.utc)
    candles = [candle(datetime(2026, 7, 16, 14, 0, tzinfo=timezone.utc))]

    assert drop_incomplete_last_candle(candles, "5m", now=now) == candles
    assert drop_incomplete_last_candle([], "1h", now=now) == []


def test_download_with_retry_recovers_after_transient_failures() -> None:
    attempts: list[int] = []
    delays: list[float] = []

    def flaky() -> str:
        attempts.append(1)
        if len(attempts) < 3:
            raise ConnectionError("yfinance hiccup")
        return "frame"

    result = download_with_retry(flaky, attempts=3, base_delay_seconds=2.0, sleep=delays.append)

    assert result == "frame"
    assert len(attempts) == 3
    assert delays == [2.0, 4.0]


def test_download_with_retry_raises_after_exhaustion() -> None:
    def always_down() -> str:
        raise ConnectionError("provider down")

    with pytest.raises(ConnectionError):
        download_with_retry(always_down, attempts=3, sleep=lambda _: None)
