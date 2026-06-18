from __future__ import annotations

from typing import Any

from workers.stock_scanner.config import Settings
from workers.stock_scanner.models import IndicatorSnapshot, SignalResult, SignalScoreResult, Ticker


def _value(value: float | None, fallback: float = 0.0) -> float:
    return fallback if value is None else float(value)


def _score_delta(current_score: float, previous_score: float | None) -> float | None:
    if previous_score is None:
        return None
    return current_score - previous_score


def _reason(parts: list[str]) -> str:
    return "; ".join(parts) if parts else "No points awarded."


def calculate_score(latest: IndicatorSnapshot, previous: IndicatorSnapshot | None) -> SignalScoreResult:
    rsi_score = 0
    macd_score = 0
    price_location_score = 0
    trend_score = 0
    volume_score = 0

    rsi_reasons: list[str] = []
    macd_reasons: list[str] = []
    price_reasons: list[str] = []
    trend_reasons: list[str] = []
    volume_reasons: list[str] = []

    if latest.rsi_14 is not None and 35 <= latest.rsi_14 <= 50:
        rsi_score += 10
        rsi_reasons.append("RSI is inside 35-50 reset band")
    if latest.rsi_delta_1 is not None and latest.rsi_delta_1 > 0:
        rsi_score += 10
        rsi_reasons.append("RSI delta 1 is positive")
    if latest.rsi_delta_2 is not None and latest.rsi_delta_2 > 0:
        rsi_score += 5
        rsi_reasons.append("RSI delta 2 is positive")

    if latest.macd_histogram is not None and latest.macd_histogram < 0:
        macd_score += 8
        macd_reasons.append("MACD histogram is negative")
    if latest.macd_histogram_delta_1 is not None and latest.macd_histogram_delta_1 > 0:
        macd_score += 12
        macd_reasons.append("MACD histogram delta 1 is positive")
    if latest.macd_histogram_delta_2 is not None and latest.macd_histogram_delta_2 > 0:
        macd_score += 5
        macd_reasons.append("MACD histogram delta 2 is positive")
    if (
        latest.macd is not None
        and latest.macd_signal is not None
        and latest.macd < latest.macd_signal
        and latest.macd_histogram_delta_1 is not None
        and latest.macd_histogram_delta_1 > 0
    ):
        macd_score += 5
        macd_reasons.append("MACD is below signal while histogram improves")

    if latest.distance_from_60_period_low is not None and latest.distance_from_60_period_low <= 10:
        price_location_score += 10
        price_reasons.append("Price is within 10% of 60-period low")
    if latest.close is not None and latest.sma_50 is not None and latest.close <= latest.sma_50 * 1.03:
        price_location_score += 5
        price_reasons.append("Price is near or below 50-period SMA")

    if latest.close is not None and latest.sma_200 is not None and latest.close >= latest.sma_200:
        trend_score += 10
        trend_reasons.append("Price is above 200-period SMA")
    elif latest.close is not None and latest.sma_200 is not None and latest.close >= latest.sma_200 * 0.95:
        trend_score += 5
        trend_reasons.append("Price is within 5% below 200-period SMA")

    if latest.sma_20 is not None and latest.sma_50 is not None and latest.sma_20 >= latest.sma_50 * 0.95:
        trend_score += 5
        trend_reasons.append("SMA20 is within 5% of SMA50")

    if latest.volume_ratio is not None and latest.volume_ratio >= 0.8:
        volume_score += 5
        volume_reasons.append("Volume ratio is at least 0.8x")
    if latest.volume_ratio is not None and latest.volume_ratio >= 1.0:
        volume_score += 5
        volume_reasons.append("Volume ratio is at least 1.0x")
    if previous and latest.volume is not None and previous.volume is not None and latest.volume > previous.volume:
        volume_score += 5
        volume_reasons.append("Volume increased versus previous candle")

    final_score = min(rsi_score + macd_score + price_location_score + trend_score + volume_score, 100)

    return SignalScoreResult(
        symbol=latest.symbol,
        timeframe=latest.timeframe,
        candle_time=latest.candle_time,
        final_score=float(final_score),
        rsi_score=float(rsi_score),
        macd_score=float(macd_score),
        price_location_score=float(price_location_score),
        trend_score=float(trend_score),
        volume_score=float(volume_score),
        rsi_reason=_reason(rsi_reasons),
        macd_reason=_reason(macd_reasons),
        price_location_reason=_reason(price_reasons),
        trend_reason=_reason(trend_reasons),
        volume_reason=_reason(volume_reasons),
        score_payload={
            "strategy": "momentum_recovery_v1",
            "components": {
                "rsi": rsi_reasons,
                "macd": macd_reasons,
                "price_location": price_reasons,
                "trend": trend_reasons,
                "volume": volume_reasons,
            },
        },
    )


def assign_signal_status(final_score: float, previous_score: float | None, settings: Settings) -> str:
    if final_score >= settings.alert_score_threshold:
        return "strong_setup"
    if final_score >= settings.watchlist_score_threshold:
        return "watchlist_setup"
    if previous_score is not None and previous_score >= settings.alert_score_threshold and final_score < settings.watchlist_score_threshold:
        return "invalidated"
    if previous_score is not None and final_score < previous_score - settings.signal_change_threshold:
        return "weakening"
    return "no_signal"


def action_state_for(signal_status: str) -> str:
    if signal_status == "strong_setup":
        return "buy_review"
    if signal_status == "watchlist_setup":
        return "watch"
    if signal_status == "weakening":
        return "do_not_add"
    if signal_status == "invalidated":
        return "invalidated"
    return "hold"


def lifecycle_state_for(signal_status: str, previous_status: str | None, score_delta: float | None, settings: Settings) -> str:
    if previous_status is None:
        return "new_signal" if signal_status in {"strong_setup", "watchlist_setup"} else "unchanged"
    if signal_status == "invalidated":
        return "invalidated"
    if previous_status != "strong_setup" and signal_status == "strong_setup":
        return "upgraded"
    if previous_status == "strong_setup" and signal_status == "watchlist_setup":
        return "downgraded"
    if previous_status in {"invalidated", "weakening"} and signal_status in {"watchlist_setup", "strong_setup"}:
        return "recovered"
    if score_delta is not None and abs(score_delta) >= settings.signal_change_threshold:
        return "upgraded" if score_delta > 0 else "downgraded"
    if previous_status == signal_status:
        return "continuing"
    return "unchanged"


def structured_explanation(latest: IndicatorSnapshot, score: SignalScoreResult, action_state: str) -> dict[str, Any]:
    triggered_because: list[str] = []
    missing_confirmation: list[str] = []
    risk_notes = ["Signal is technical only and does not include earnings, filings, or news context"]

    if latest.rsi_14 is not None and latest.rsi_14 < 50 and latest.rsi_delta_1 is not None and latest.rsi_delta_1 > 0:
        triggered_because.append("RSI is below 50 and rising")
    else:
        missing_confirmation.append("RSI is not yet below 50 and rising")

    if latest.macd_histogram is not None and latest.macd_histogram < 0 and latest.macd_histogram_delta_1 is not None and latest.macd_histogram_delta_1 > 0:
        triggered_because.append("MACD histogram is negative but improving")
    else:
        missing_confirmation.append("MACD histogram recovery is not confirmed")

    if latest.distance_from_60_period_low is not None and latest.distance_from_60_period_low <= 10:
        triggered_because.append("Price is within 10% of the 60-period low")
    else:
        missing_confirmation.append("Price is not close enough to the 60-period low")

    if latest.volume_ratio is not None and latest.volume_ratio >= 0.8:
        triggered_because.append("Volume is at least 80% of the 20-period average")
    else:
        missing_confirmation.append("Volume confirmation is weak")

    if latest.macd is not None and latest.macd_signal is not None and latest.macd <= latest.macd_signal:
        missing_confirmation.append("MACD bullish cross has not occurred yet")

    return {
        "triggered_because": triggered_because,
        "missing_confirmation": missing_confirmation,
        "risk_notes": risk_notes,
        "action": action_state,
        "score_components": {
            "rsi": score.rsi_score,
            "macd": score.macd_score,
            "price_location": score.price_location_score,
            "trend": score.trend_score,
            "volume": score.volume_score,
        },
    }


def calculate_signal(
    ticker: Ticker,
    latest: IndicatorSnapshot,
    previous: IndicatorSnapshot | None,
    two_periods_ago: IndicatorSnapshot | None,
    settings: Settings,
    previous_signal: dict[str, Any] | None = None,
) -> tuple[SignalScoreResult, SignalResult]:
    score = calculate_score(latest, previous)
    previous_score_raw = previous_signal.get("signal_score") if previous_signal else None
    previous_score = float(previous_score_raw) if previous_score_raw is not None else None
    previous_status = previous_signal.get("signal_status") if previous_signal else None
    score_delta = _score_delta(score.final_score, previous_score)
    signal_status = assign_signal_status(score.final_score, previous_score, settings)
    action_state = action_state_for(signal_status)
    lifecycle_state = lifecycle_state_for(signal_status, previous_status, score_delta, settings)

    raw_payload = latest.raw_payload(previous, two_periods_ago)
    raw_payload.update(
        {
            "provider_symbol": ticker.provider_symbol or ticker.symbol,
            "company_name": ticker.company_name,
            "category": ticker.category,
            "rsi_delta": latest.rsi_delta_1,
            "hist_delta": latest.macd_histogram_delta_1,
            "score_delta": score_delta,
            "macd_state": latest.macd_state,
            "rsi_state": latest.rsi_state,
            "volume_state": latest.volume_state,
            "trend_state": latest.trend_state,
            # Component scores so the pure-Supabase read path can render the
            # "what makes the score" breakdown bars (data.ts maps these by name)
            # without the live overlay. Caps: rsi 25, macd 30, price location 15,
            # trend 15, volume 15 - matching the frontend SCORE_COMPONENTS.
            "rsi_score": score.rsi_score,
            "macd_score": score.macd_score,
            "price_location_score": score.price_location_score,
            "trend_score": score.trend_score,
            "volume_score": score.volume_score,
        }
    )

    signal = SignalResult(
        symbol=ticker.symbol,
        timeframe=latest.timeframe,
        candle_time=latest.candle_time,
        signal_type="momentum_recovery_v1",
        signal_status=signal_status,
        signal_score=score.final_score,
        previous_signal_score=previous_score,
        signal_score_delta=score_delta,
        action_state=action_state,
        lifecycle_state=lifecycle_state,
        explanation=structured_explanation(latest, score, action_state),
        raw_payload=raw_payload,
    )
    return score, signal


def should_send_alert(current: SignalResult, previous_signal: dict[str, Any] | None, settings: Settings) -> bool:
    previous_status = previous_signal.get("signal_status") if previous_signal else None
    previous_score_raw = previous_signal.get("signal_score") if previous_signal else None
    previous_score = float(previous_score_raw) if previous_score_raw is not None else None

    if current.signal_status == "strong_setup" and previous_status != "strong_setup":
        return True

    if previous_score is not None and current.signal_score - previous_score >= settings.signal_change_threshold:
        return True

    if current.signal_status == "invalidated":
        return True

    if settings.enable_watchlist_alerts and current.signal_status == "watchlist_setup" and previous_status != "watchlist_setup":
        return True

    return False
