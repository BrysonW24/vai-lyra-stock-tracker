from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any


@dataclass(frozen=True)
class Ticker:
    symbol: str
    provider_symbol: str = ""
    company_name: str = ""
    sector: str = "Technology"
    industry: str = ""
    category: str = ""
    exchange: str = ""
    country: str = "US"
    currency: str = "USD"
    scan_timeframe: str = "1h"


@dataclass(frozen=True)
class Candle:
    symbol: str
    timeframe: str
    candle_time: datetime
    open: float | None
    high: float | None
    low: float | None
    close: float | None
    adjusted_close: float | None
    volume: float | None
    source: str

    def to_record(self) -> dict[str, Any]:
        record = asdict(self)
        record["candle_time"] = self.candle_time.isoformat()
        return record


@dataclass(frozen=True)
class IndicatorSnapshot:
    symbol: str
    timeframe: str
    candle_time: datetime
    close: float | None
    volume: float | None
    rsi_14: float | None
    rsi_delta_1: float | None
    rsi_delta_2: float | None
    rsi_state: str
    macd: float | None
    macd_signal: float | None
    macd_histogram: float | None
    macd_histogram_delta_1: float | None
    macd_histogram_delta_2: float | None
    macd_state: str
    sma_20: float | None
    sma_50: float | None
    sma_200: float | None
    ema_12: float | None
    ema_26: float | None
    volume_sma_20: float | None
    volume_ratio: float | None
    volume_state: str
    price_vs_sma_20: float | None
    price_vs_sma_50: float | None
    price_vs_sma_200: float | None
    distance_from_20_period_low: float | None
    distance_from_60_period_low: float | None
    distance_from_120_period_low: float | None
    trend_state: str

    def to_record(self) -> dict[str, Any]:
        record = asdict(self)
        record["candle_time"] = self.candle_time.isoformat()
        return record

    def raw_payload(self, previous: "IndicatorSnapshot | None", two_periods_ago: "IndicatorSnapshot | None") -> dict[str, Any]:
        payload = self.to_record()
        payload["previous_rsi_14"] = previous.rsi_14 if previous else None
        payload["previous_macd_histogram"] = previous.macd_histogram if previous else None
        payload["previous_volume"] = previous.volume if previous else None
        payload["rsi_14_two_periods_ago"] = two_periods_ago.rsi_14 if two_periods_ago else None
        payload["macd_histogram_two_periods_ago"] = two_periods_ago.macd_histogram if two_periods_ago else None
        payload["macd_histogram_slope"] = self.macd_histogram_delta_1
        return payload


@dataclass(frozen=True)
class SignalScoreResult:
    symbol: str
    timeframe: str
    candle_time: datetime
    final_score: float
    rsi_score: float
    macd_score: float
    price_location_score: float
    trend_score: float
    volume_score: float
    rsi_reason: str
    macd_reason: str
    price_location_reason: str
    trend_reason: str
    volume_reason: str
    score_payload: dict[str, Any]

    def to_record(self) -> dict[str, Any]:
        record = asdict(self)
        record["candle_time"] = self.candle_time.isoformat()
        return record


@dataclass(frozen=True)
class SignalResult:
    symbol: str
    timeframe: str
    candle_time: datetime
    signal_type: str
    signal_status: str
    signal_score: float
    previous_signal_score: float | None
    signal_score_delta: float | None
    action_state: str
    lifecycle_state: str
    explanation: dict[str, Any]
    raw_payload: dict[str, Any]

    def to_record(self) -> dict[str, Any]:
        record = asdict(self)
        record["candle_time"] = self.candle_time.isoformat()
        return record


@dataclass(frozen=True)
class PortfolioPosition:
    id: str | None
    symbol: str
    quantity: float
    average_buy_price: float
    brokerage_fee: float = 0.0
    purchase_date: str | None = None
    target_allocation_pct: float | None = None
    stop_loss_price: float | None = None
    take_profit_price: float | None = None
    notes: str | None = None
    # Multi-user: which user owns this position. None in single-operator mode.
    user_id: str | None = None


@dataclass(frozen=True)
class PortfolioOverlay:
    position_id: str | None
    symbol: str
    candle_time: datetime
    current_price: float | None
    market_value: float
    unrealised_pl: float
    unrealised_pl_pct: float
    portfolio_weight_pct: float
    signal_score: float
    signal_status: str
    action_state: str
    risk_state: str
    explanation: dict[str, Any]
    # Multi-user: which operator this overlay belongs to. None in single-operator mode.
    user_id: str | None = None

    def to_record(self) -> dict[str, Any]:
        record = asdict(self)
        record["candle_time"] = self.candle_time.isoformat()
        return record


@dataclass(frozen=True)
class WatchlistItem:
    id: str | None
    symbol: str
    target_price: float | None
    target_signal_score: float = 75.0
    rsi_min: float = 35.0
    rsi_max: float = 50.0
    require_macd_histogram_rising: bool = True
    require_volume_ratio: float = 0.8
    notes: str | None = None
    # Multi-user: which user owns this watchlist item. None in single-operator mode.
    user_id: str | None = None


@dataclass(frozen=True)
class WatchlistOverlay:
    watchlist_item_id: str | None
    symbol: str
    candle_time: datetime
    current_price: float | None
    distance_to_target_price_pct: float | None
    signal_score: float
    signal_status: str
    watchlist_trigger_state: str
    explanation: dict[str, Any]
    # Multi-user: which operator this overlay belongs to. None in single-operator mode.
    user_id: str | None = None

    def to_record(self) -> dict[str, Any]:
        record = asdict(self)
        record["candle_time"] = self.candle_time.isoformat()
        return record


DEFAULT_TICKERS = [
    Ticker("AAPL", "AAPL", "Apple", "Technology", "Consumer Electronics", "mega_cap_platform", "NASDAQ"),
    Ticker("MSFT", "MSFT", "Microsoft", "Technology", "Software", "mega_cap_platform", "NASDAQ"),
    Ticker("NVDA", "NVDA", "Nvidia", "Technology", "Semiconductors", "ai_infrastructure", "NASDAQ"),
    Ticker("AMD", "AMD", "Advanced Micro Devices", "Technology", "Semiconductors", "semiconductor", "NASDAQ"),
    Ticker("AVGO", "AVGO", "Broadcom", "Technology", "Semiconductors", "ai_infrastructure", "NASDAQ"),
    Ticker("GOOGL", "GOOGL", "Alphabet", "Technology", "Internet", "mega_cap_platform", "NASDAQ"),
    Ticker("META", "META", "Meta Platforms", "Technology", "Internet", "consumer_internet", "NASDAQ"),
    Ticker("AMZN", "AMZN", "Amazon", "Technology", "Ecommerce / Cloud", "mega_cap_platform", "NASDAQ"),
    Ticker("CRM", "CRM", "Salesforce", "Technology", "Software", "enterprise_software", "NYSE"),
    Ticker("ADBE", "ADBE", "Adobe", "Technology", "Software", "software", "NASDAQ"),
    Ticker("NOW", "NOW", "ServiceNow", "Technology", "Software", "enterprise_software", "NYSE"),
    Ticker("PANW", "PANW", "Palo Alto Networks", "Technology", "Cybersecurity", "cybersecurity", "NASDAQ"),
    Ticker("CRWD", "CRWD", "CrowdStrike", "Technology", "Cybersecurity", "cybersecurity", "NASDAQ"),
    Ticker("SNOW", "SNOW", "Snowflake", "Technology", "Data Cloud", "cloud_data", "NYSE"),
    Ticker("TSLA", "TSLA", "Tesla", "Technology", "EV / AI", "consumer_internet", "NASDAQ"),
]
