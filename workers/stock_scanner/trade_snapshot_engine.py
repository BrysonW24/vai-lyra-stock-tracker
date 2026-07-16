"""Trade Day Snapshot Engine.

Reconstructs market context at entry from STORED history and computes forward performance.
Pure, testable, deterministic - no AI, no randomness, no investment advice.

Given a holding + buy date, build a snapshot capturing:
- Entry-day technical indicators (RSI, MACD, moving averages, volume ratio)
- Entry-day signal score and market regime
- Forward returns at multiple horizons (5d, 20d, 60d, 120d)
- Max drawdown and max upside after entry
- Deterministic learning summary (trade type + entry quality classification)
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from workers.stock_scanner.models import IndicatorSnapshot, SignalResult
from workers.stock_scanner.outcome_engine import _compute_forward_returns


@dataclass(frozen=True)
class TradeDaySnapshot:
    """Complete snapshot of a trade entry and subsequent performance."""

    id: str | None = None
    symbol: str = ""
    purchase_date: datetime | None = None
    entry_price: float = 0.0
    # Entry-day technical context
    rsi_on_entry: float | None = None
    macd_state_on_entry: str | None = None
    macd_histogram_on_entry: float | None = None
    volume_ratio_on_entry: float | None = None
    price_vs_sma_20_on_entry: float | None = None
    price_vs_sma_50_on_entry: float | None = None
    price_vs_sma_200_on_entry: float | None = None
    distance_from_20_period_low_on_entry: float | None = None
    signal_score_on_entry: float | None = None
    market_regime_on_entry: str | None = None
    # Forward performance
    return_5d: float | None = None
    return_20d: float | None = None
    return_60d: float | None = None
    return_120d: float | None = None
    max_drawdown_after_entry: float | None = None
    max_upside_after_entry: float | None = None
    # Learning summary: list of deterministic observations
    learning_summary: list[str] | None = None
    # Timestamps
    created_at: datetime | None = None
    updated_at: datetime | None = None

    def to_record(self) -> dict[str, Any]:
        """Convert to database record."""
        return {
            "id": self.id,
            "symbol": self.symbol,
            "purchase_date": self.purchase_date.isoformat() if self.purchase_date else None,
            "entry_price": self.entry_price,
            "rsi_on_entry": self.rsi_on_entry,
            "macd_state_on_entry": self.macd_state_on_entry,
            "macd_histogram_on_entry": self.macd_histogram_on_entry,
            "volume_ratio_on_entry": self.volume_ratio_on_entry,
            "price_vs_sma_20_on_entry": self.price_vs_sma_20_on_entry,
            "price_vs_sma_50_on_entry": self.price_vs_sma_50_on_entry,
            "price_vs_sma_200_on_entry": self.price_vs_sma_200_on_entry,
            "distance_from_20_period_low_on_entry": self.distance_from_20_period_low_on_entry,
            "signal_score_on_entry": self.signal_score_on_entry,
            "market_regime_on_entry": self.market_regime_on_entry,
            "return_5d": self.return_5d,
            "return_20d": self.return_20d,
            "return_60d": self.return_60d,
            "return_120d": self.return_120d,
            "max_drawdown_after_entry": self.max_drawdown_after_entry,
            "max_upside_after_entry": self.max_upside_after_entry,
            "learning_summary": self.learning_summary,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


def _classify_trade_type(
    rsi_on_entry: float | None,
    macd_state: str | None,
    price_vs_sma_50: float | None,
    distance_from_low: float | None,
) -> str:
    """
    Classify trade type from entry-day technical indicators.

    Returns one of:
    - "momentum_continuation" - price above moving average, RSI in recovery band
    - "oversold_bounce" - price near 60-period low, RSI below 40
    - "trend_entry" - price crossing above SMA, MACD bullish
    - "overextended_entry" - price extended above SMA, momentum deteriorating
    - "uncertain_setup" - conflicting signals
    """
    rsi = rsi_on_entry or 50
    price_loc = price_vs_sma_50 or 0
    distance = distance_from_low or 50

    # Oversold bounce: price near low + RSI low
    if distance is not None and distance <= 10 and rsi < 40:
        return "oversold_bounce"

    # Overextended entry: price extended + weak momentum (CHECK FIRST before momentum continuation)
    if price_loc is not None and price_loc > 12 and macd_state in ("bearish", "weakening"):
        return "overextended_entry"

    # Momentum continuation: price moderately above SMA50 + RSI in recovery band + MACD bullish
    if (price_loc is not None and price_loc > 1 and 35 <= rsi <= 65
        and macd_state in ("bullish", "strengthening")):
        return "momentum_continuation"

    # Trend entry: price at or just breaking above SMA + MACD bullish
    if price_loc is not None and -1 <= price_loc <= 3 and macd_state == "bullish":
        return "trend_entry"

    return "uncertain_setup"


def _classify_entry_quality(
    trade_type: str,
    signal_score: float | None,
    volume_ratio: float | None,
    rsi_on_entry: float | None,
    macd_state: str | None,
    price_vs_sma_50: float | None,
) -> str:
    """
    Classify entry quality from deterministic facts.

    Returns one of:
    - "strong" - high score, good setup alignment, volume confirmation
    - "moderate" - decent score, some setup alignment
    - "weak" - low score or conflicting signals
    """
    score = signal_score or 0
    volume = volume_ratio or 0.7
    rsi = rsi_on_entry or 50
    price_loc = price_vs_sma_50 or 0

    # Strong: high score, good volume, aligned MACD
    if score >= 65 and volume >= 1.0 and macd_state in ("bullish", "strengthening") and 35 <= rsi <= 60:
        return "strong"

    # Weak: low score or poor alignment
    if score < 40 or volume < 0.7 or macd_state in ("bearish", "weakening"):
        return "weak"

    # Moderate: middle ground
    if 40 <= score < 65:
        return "moderate"

    return "moderate"


def build_trade_day_snapshot(
    symbol: str,
    buy_date: datetime,
    entry_price: float,
    indicators_on_date: IndicatorSnapshot | None,
    signal_on_date: SignalResult | None,
    candles_after_entry: list[Any] | None = None,
    horizons_bars: dict[str, int] | None = None,
) -> TradeDaySnapshot:
    """
    Build a trade day snapshot from entry data and forward candles.

    Args:
        symbol: stock ticker
        buy_date: entry date
        entry_price: entry price
        indicators_on_date: IndicatorSnapshot from entry date (or None)
        signal_on_date: SignalResult from entry date (or None)
        candles_after_entry: list of Candle objects after entry (for return calculation)
        horizons_bars: horizon bar counts (default: 5d=35, 20d=140, 60d=420, 120d=840)

    Returns:
        TradeDaySnapshot with all entry context and forward returns.
    """
    if horizons_bars is None:
        horizons_bars = {"5d": 35, "20d": 140, "60d": 420, "120d": 840}

    # Extract entry-day technical context from indicators
    rsi_on_entry = indicators_on_date.rsi_14 if indicators_on_date else None
    macd_state_on_entry = indicators_on_date.macd_state if indicators_on_date else None
    macd_histogram_on_entry = indicators_on_date.macd_histogram if indicators_on_date else None
    volume_ratio_on_entry = indicators_on_date.volume_ratio if indicators_on_date else None
    price_vs_sma_20 = indicators_on_date.price_vs_sma_20 if indicators_on_date else None
    price_vs_sma_50 = indicators_on_date.price_vs_sma_50 if indicators_on_date else None
    price_vs_sma_200 = indicators_on_date.price_vs_sma_200 if indicators_on_date else None
    distance_from_low = indicators_on_date.distance_from_20_period_low if indicators_on_date else None

    # Extract signal context
    signal_score_on_entry = signal_on_date.signal_score if signal_on_date else None
    market_regime_on_entry = signal_on_date.signal_status if signal_on_date else None

    # Compute forward returns from candles after entry
    returns = {"return_5d": None, "return_20d": None, "return_60d": None, "return_120d": None}
    max_upside = None
    max_drawdown = None

    if candles_after_entry:
        # Compute forward returns using outcome_engine logic
        returns_dict, max_upside, max_drawdown = _compute_forward_returns(
            entry_price=entry_price,
            candles_after=candles_after_entry,
            horizons_bars=horizons_bars,
        )
        returns = {
            "return_5d": returns_dict.get("return_5d"),
            "return_20d": returns_dict.get("return_20d"),
            "return_60d": returns_dict.get("return_60d"),
            "return_120d": returns_dict.get("return_120d"),
        }

    # Classify trade type and entry quality
    trade_type = _classify_trade_type(rsi_on_entry, macd_state_on_entry, price_vs_sma_50, distance_from_low)
    entry_quality = _classify_entry_quality(
        trade_type, signal_score_on_entry, volume_ratio_on_entry, rsi_on_entry, macd_state_on_entry, price_vs_sma_50
    )

    # Build deterministic learning summary
    learning_notes: list[str] = []

    # Trade type note
    if trade_type == "momentum_continuation":
        learning_notes.append("Entry was a momentum continuation trade supported by price above moving averages.")
    elif trade_type == "oversold_bounce":
        learning_notes.append("Entry was an oversold bounce from technical lows with RSI reset.")
    elif trade_type == "trend_entry":
        learning_notes.append("Entry captured a price break above key moving averages with MACD confirmation.")
    elif trade_type == "overextended_entry":
        learning_notes.append("Entry occurred when price was extended and momentum was deteriorating.")
    else:
        learning_notes.append("Entry context showed mixed signals.")

    # Entry quality note
    if entry_quality == "strong":
        learning_notes.append("Entry quality was strong with high signal score and volume confirmation.")
    elif entry_quality == "weak":
        learning_notes.append("Entry quality was weak with low signal score or limited volume support.")
    else:
        learning_notes.append("Entry quality was moderate.")

    # Volume analysis
    if volume_ratio_on_entry is not None:
        if volume_ratio_on_entry >= 1.2:
            learning_notes.append("Volume on entry day was significantly elevated, supporting the move.")
        elif volume_ratio_on_entry < 0.8:
            learning_notes.append("Volume on entry day was below average, limiting conviction.")

    # Price location analysis
    if price_vs_sma_50 is not None:
        if price_vs_sma_50 > 12:
            learning_notes.append("Stock was extended above the 50-period SMA at entry.")
        elif price_vs_sma_50 < -5:
            learning_notes.append("Stock was below the 50-period SMA at entry, indicating weakness.")

    # MACD analysis
    if macd_state_on_entry:
        if macd_state_on_entry == "bullish":
            learning_notes.append("MACD was bullish at entry, confirming upside momentum.")
        elif macd_state_on_entry == "bearish":
            learning_notes.append("MACD was bearish at entry, conflicting with the bullish setup.")

    # RSI analysis
    if rsi_on_entry is not None:
        if 35 <= rsi_on_entry <= 50:
            learning_notes.append("RSI was in the reset band (35-50), indicating recovery potential.")
        elif rsi_on_entry > 65:
            learning_notes.append("RSI was elevated (>65), suggesting potential momentum exhaustion.")

    # Forward performance note (if available)
    if returns.get("return_60d") is not None:
        if returns["return_60d"] > 15:
            learning_notes.append("Trade worked well over 60 days with strong positive returns.")
        elif returns["return_60d"] < -10:
            learning_notes.append("Trade faced significant headwinds over 60 days.")
    if max_drawdown is not None and max_drawdown < -15:
        learning_notes.append("Trade experienced a substantial peak-to-trough drawdown after entry.")

    return TradeDaySnapshot(
        symbol=symbol,
        purchase_date=buy_date,
        entry_price=entry_price,
        rsi_on_entry=rsi_on_entry,
        macd_state_on_entry=macd_state_on_entry,
        macd_histogram_on_entry=macd_histogram_on_entry,
        volume_ratio_on_entry=volume_ratio_on_entry,
        price_vs_sma_20_on_entry=price_vs_sma_20,
        price_vs_sma_50_on_entry=price_vs_sma_50,
        price_vs_sma_200_on_entry=price_vs_sma_200,
        distance_from_20_period_low_on_entry=distance_from_low,
        signal_score_on_entry=signal_score_on_entry,
        market_regime_on_entry=market_regime_on_entry,
        return_5d=returns.get("return_5d"),
        return_20d=returns.get("return_20d"),
        return_60d=returns.get("return_60d"),
        return_120d=returns.get("return_120d"),
        max_drawdown_after_entry=max_drawdown,
        max_upside_after_entry=max_upside,
        learning_summary=learning_notes,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
