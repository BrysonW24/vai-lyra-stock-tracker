from datetime import datetime, timedelta, timezone

import pytest

from workers.stock_scanner.digest_job import compose_digest
from workers.stock_scanner.models import Candle
from workers.stock_scanner.outcome_engine import OutcomeDistribution
from workers.stock_scanner.outcome_job import (
    FOLLOWUP_MIN_BARS,
    build_followup_body,
    label_outcomes,
    parse_ts,
)
from tests.test_signal_engine import settings


SIGNAL_TIME = datetime(2026, 7, 1, 14, 0, tzinfo=timezone.utc)


class FakeRepo:
    """Minimal stand-in exposing exactly the repo surface label_outcomes touches."""

    def __init__(self, signals: list[dict], candles: list[Candle]) -> None:
        self.signals = signals
        self.candles = candles

    def load_signals_for_outcomes(self, since, statuses, timeframe):
        return [row for row in self.signals if row["signal_status"] in statuses]

    def load_candles_from(self, symbol, timeframe, start):
        return [c for c in self.candles if c.symbol == symbol and c.candle_time >= start]


def hourly_candles(start: datetime, closes: list[float]) -> list[Candle]:
    return [
        Candle(
            symbol="NVDA",
            timeframe="1h",
            candle_time=start + timedelta(hours=offset),
            open=close,
            high=close,
            low=close,
            close=close,
            adjusted_close=close,
            volume=1000.0,
            source="test",
        )
        for offset, close in enumerate(closes)
    ]


def signal_row(candle_time: datetime = SIGNAL_TIME, status: str = "strong_setup") -> dict:
    return {
        "symbol": "NVDA",
        "candle_time": candle_time.isoformat(),
        "signal_type": "momentum_recovery_v1",
        "signal_status": status,
        "signal_score": 82,
    }


def test_parse_ts_handles_offset_and_zulu() -> None:
    assert parse_ts("2026-07-01T14:00:00+00:00") == SIGNAL_TIME
    assert parse_ts("2026-07-01T14:00:00Z") == SIGNAL_TIME


def test_label_outcomes_computes_forward_returns_from_stored_candles() -> None:
    # Entry candle at 100, then 40 bars climbing - the 7th bar after entry is the 1d horizon.
    closes = [100.0] + [100.0 + bar for bar in range(1, 41)]
    repo = FakeRepo([signal_row()], hourly_candles(SIGNAL_TIME, closes))

    outcomes, followups = label_outcomes(repo, settings(), now=SIGNAL_TIME + timedelta(days=3))

    assert len(outcomes) == 1
    outcome = outcomes[0]
    assert outcome.symbol == "NVDA"
    assert outcome.signal_score == 82
    assert outcome.return_1d == pytest.approx(7.0)  # bar 7 closed at 107 from a 100 entry
    assert outcome.return_5d == pytest.approx(35.0)  # bar 35 closed at 135
    # 5d horizon resolved and the signal is recent, so it is a follow-up candidate.
    assert len(followups) == 1


def test_label_outcomes_skips_too_young_signals() -> None:
    closes = [100.0, 101.0, 102.0]  # only 2 bars after entry - below the 1d horizon
    repo = FakeRepo([signal_row()], hourly_candles(SIGNAL_TIME, closes))

    outcomes, followups = label_outcomes(repo, settings(), now=SIGNAL_TIME + timedelta(hours=3))

    assert outcomes == []
    assert followups == []


def test_label_outcomes_does_not_follow_up_on_old_signals() -> None:
    closes = [100.0] * (FOLLOWUP_MIN_BARS + 5)
    repo = FakeRepo([signal_row()], hourly_candles(SIGNAL_TIME, closes))

    # 60 days later the 5d horizon resolved long ago - labeling still happens,
    # but no follow-up message (a first-ever backfill must not spam history).
    outcomes, followups = label_outcomes(repo, settings(), now=SIGNAL_TIME + timedelta(days=60))

    assert len(outcomes) == 1
    assert followups == []


def test_followup_body_is_engine_owned_and_carries_the_cohort_baseline() -> None:
    closes = [100.0] + [100.0 + bar * 0.2 for bar in range(1, 41)]
    repo = FakeRepo([signal_row()], hourly_candles(SIGNAL_TIME, closes))
    outcomes, _ = label_outcomes(repo, settings(), now=SIGNAL_TIME + timedelta(days=3))
    distribution = OutcomeDistribution(
        signal_type="momentum_recovery_v1",
        signal_status="strong_setup",
        sample_size=41,
        return_1d_median=0.8,
        return_5d_median=3.2,
        return_20d_median=None,
        return_60d_median=None,
        return_1d_win_rate=58.0,
        return_5d_win_rate=63.0,
        return_20d_win_rate=0.0,
        return_60d_win_rate=0.0,
        max_upside_median=None,
        worst_drawdown_min=None,
    )

    body = build_followup_body(outcomes[0], distribution)

    assert "NVDA strong setup from 2026-07-01" in body
    assert "+7.0% after 5 trading days" in body
    assert "median 5d +3.2%" in body
    assert "win rate 63%" in body
    assert "Research, not advice." in body


def test_compose_digest_summarises_engine_rows() -> None:
    latest_signals = [
        {"symbol": "NVDA", "signal_status": "strong_setup", "signal_score": 82, "signal_score_delta": 6},
        {"symbol": "AMD", "signal_status": "watchlist_setup", "signal_score": 61, "signal_score_delta": None},
        {"symbol": "MSFT", "signal_status": "inactive", "signal_score": 22, "signal_score_delta": -3},
    ]
    alerts = [
        {"symbol": "NVDA", "alert_type": "strong_setup", "sent_status": "sent"},
        {"symbol": "AMD", "alert_type": "score_jump", "sent_status": "failed"},
    ]

    title, body, payload = compose_digest(latest_signals, alerts, "today")

    assert title == "Today digest: 1 strong / 1 watch setups"
    assert "3 symbols scored, 1 strong setups, 1 watchlist setups, 1 alerts sent." in body
    assert "Top setups: NVDA 82/100 (+6), AMD 61/100." in body
    assert "Research, not advice." in body
    assert payload["top_setups"][0]["symbol"] == "NVDA"


def test_compose_digest_handles_a_quiet_day() -> None:
    title, body, payload = compose_digest([], [], "today")

    assert title == "Today digest: no active setups"
    assert "nothing in the reset band" in body
    assert payload["strong_setups"] == 0
