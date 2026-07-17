"""
Market context snapshot module - fetches free market data and derives regime classification.

Sources:
- Indices (S&P 500, Nasdaq, Dow), Volatility (VIX), Bonds (10Y yield): Yahoo Finance v8 chart endpoint (no key required)
- FX (USD index via EURUSD proxy): Yahoo Finance
- Commodities (Gold, Oil): Yahoo Finance
- Crypto (BTC): CoinGecko API (free tier, no key required)
- Fear & Greed Index: alternative.me API (free, no key required)

Regime classification: deterministic rules over index momentum, volatility, and sentiment.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
import logging
from typing import Any, Optional

import requests

logger = logging.getLogger(__name__)

YAHOO_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{}?interval=1d&range=2d"
YAHOO_HEADERS = {"User-Agent": "Mozilla/5.0"}
COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true"
FEAR_GREED_URL = "https://api.alternative.me/fng/?limit=1"

TIMEOUT = 10


@dataclass(frozen=True)
class MarketSnapshot:
    """Clean market context with % changes and regime classification."""
    captured_at: datetime
    sp500_price: Optional[float]
    sp500_change_pct: Optional[float]
    nasdaq_price: Optional[float]
    nasdaq_change_pct: Optional[float]
    dow_price: Optional[float]
    dow_change_pct: Optional[float]
    vix_price: Optional[float]
    vix_change_pct: Optional[float]
    yield_10y: Optional[float]
    yield_10y_change_pct: Optional[float]
    gold_price: Optional[float]
    gold_change_pct: Optional[float]
    oil_price: Optional[float]
    oil_change_pct: Optional[float]
    btc_price: Optional[float]
    btc_change_pct: Optional[float]
    # AUD/USD matters uniquely here: the audience is Australian holding US stocks, so
    # this pair converts every USD return into what the user actually banks. Feeds the
    # macro companions and the weekly report's AUD-terms line.
    audusd_price: Optional[float]
    audusd_change_pct: Optional[float]
    # ASX 200: the user's local market backdrop (feeds the macro strip's live overlay).
    axjo_price: Optional[float]
    axjo_change_pct: Optional[float]
    fear_greed_index: Optional[int]
    fear_greed_label: Optional[str]
    regime: str  # 'risk_on', 'neutral', 'risk_off'

    def to_dict(self) -> dict[str, Any]:
        return {
            "captured_at": self.captured_at.isoformat(),
            "sp500_price": self.sp500_price,
            "sp500_change_pct": self.sp500_change_pct,
            "nasdaq_price": self.nasdaq_price,
            "nasdaq_change_pct": self.nasdaq_change_pct,
            "dow_price": self.dow_price,
            "dow_change_pct": self.dow_change_pct,
            "vix_price": self.vix_price,
            "vix_change_pct": self.vix_change_pct,
            "yield_10y": self.yield_10y,
            "yield_10y_change_pct": self.yield_10y_change_pct,
            "gold_price": self.gold_price,
            "gold_change_pct": self.gold_change_pct,
            "oil_price": self.oil_price,
            "oil_change_pct": self.oil_change_pct,
            "btc_price": self.btc_price,
            "btc_change_pct": self.btc_change_pct,
            "audusd_price": self.audusd_price,
            "audusd_change_pct": self.audusd_change_pct,
            "axjo_price": self.axjo_price,
            "axjo_change_pct": self.axjo_change_pct,
            "fear_greed_index": self.fear_greed_index,
            "fear_greed_label": self.fear_greed_label,
            "regime": self.regime,
        }


def _fetch_yahoo(symbol: str) -> dict[str, Optional[float]]:
    """Fetch price and daily % change for a Yahoo Finance symbol. Returns None values on failure."""
    try:
        resp = requests.get(
            YAHOO_URL.format(symbol),
            headers=YAHOO_HEADERS,
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        meta = data["chart"]["result"][0]["meta"]
        price = meta.get("regularMarketPrice")
        prev = meta.get("chartPreviousClose")
        if price is None or prev is None or prev == 0:
            return {"price": None, "change_pct": None}
        change_pct = ((price - prev) / prev) * 100
        return {"price": price, "change_pct": change_pct}
    except Exception as e:
        logger.warning(f"Failed to fetch {symbol}: {e}")
        return {"price": None, "change_pct": None}


def _fetch_crypto_btc() -> dict[str, Optional[float]]:
    """Fetch BTC price and 24h % change from CoinGecko."""
    try:
        resp = requests.get(COINGECKO_URL, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        btc_data = data.get("bitcoin", {})
        price = btc_data.get("usd")
        change_pct = btc_data.get("usd_24h_change")
        if price is None:
            return {"price": None, "change_pct": None}
        return {"price": price, "change_pct": change_pct or 0}
    except Exception as e:
        logger.warning(f"Failed to fetch BTC: {e}")
        return {"price": None, "change_pct": None}


def _fetch_fear_greed() -> tuple[Optional[int], Optional[str]]:
    """Fetch Fear & Greed Index from alternative.me."""
    try:
        resp = requests.get(FEAR_GREED_URL, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        entry = data["data"][0]
        value = int(entry["value"])
        label = entry["value_classification"]
        return value, label
    except Exception as e:
        logger.warning(f"Failed to fetch Fear & Greed: {e}")
        return None, None


def _classify_regime(
    sp500_change: Optional[float],
    nasdaq_change: Optional[float],
    dow_change: Optional[float],
    vix_price: Optional[float],
    fear_greed: Optional[int],
) -> str:
    """
    Deterministic regime classification.

    Rules:
    - risk_off: VIX > 25 OR Fear & Greed < 30 OR 2+ indices down
    - risk_on: VIX < 15 AND Fear & Greed > 70 AND all indices green
    - neutral: otherwise
    """
    indices = [sp500_change, nasdaq_change, dow_change]
    indices_valid = [c for c in indices if c is not None]

    # Count down days
    down_count = sum(1 for c in indices_valid if c < 0)

    # Risk-off signals
    if vix_price is not None and vix_price > 25:
        return "risk_off"
    if fear_greed is not None and fear_greed < 30:
        return "risk_off"
    if len(indices_valid) >= 2 and down_count >= 2:
        return "risk_off"

    # Risk-on signals
    if (vix_price is not None and vix_price < 15 and
        fear_greed is not None and fear_greed > 70 and
        down_count == 0):
        return "risk_on"

    return "neutral"


def build_market_context() -> MarketSnapshot:
    """
    Fetch all market data and return a clean snapshot with regime classification.
    Failures per source are caught and that value becomes None; missing data does not break the snapshot.
    """
    captured_at = datetime.now(timezone.utc)

    # Fetch indices
    sp500 = _fetch_yahoo("^GSPC")
    nasdaq = _fetch_yahoo("^IXIC")
    dow = _fetch_yahoo("^DJI")

    # Fetch volatility and bonds
    vix = _fetch_yahoo("^VIX")
    yield_10y = _fetch_yahoo("^TNX")

    # Fetch commodities
    gold = _fetch_yahoo("GC=F")
    oil = _fetch_yahoo("CL=F")

    # FX: the AUD lens on USD holdings (same free Yahoo endpoint as the indices)
    audusd = _fetch_yahoo("AUDUSD=X")
    axjo = _fetch_yahoo("^AXJO")

    # Fetch crypto and sentiment
    btc = _fetch_crypto_btc()
    fear_greed, fear_label = _fetch_fear_greed()

    # Classify regime
    regime = _classify_regime(
        sp500.get("change_pct"),
        nasdaq.get("change_pct"),
        dow.get("change_pct"),
        vix.get("price"),
        fear_greed,
    )

    return MarketSnapshot(
        captured_at=captured_at,
        sp500_price=sp500.get("price"),
        sp500_change_pct=sp500.get("change_pct"),
        nasdaq_price=nasdaq.get("price"),
        nasdaq_change_pct=nasdaq.get("change_pct"),
        dow_price=dow.get("price"),
        dow_change_pct=dow.get("change_pct"),
        vix_price=vix.get("price"),
        vix_change_pct=vix.get("change_pct"),
        yield_10y=yield_10y.get("price"),
        yield_10y_change_pct=yield_10y.get("change_pct"),
        gold_price=gold.get("price"),
        gold_change_pct=gold.get("change_pct"),
        oil_price=oil.get("price"),
        oil_change_pct=oil.get("change_pct"),
        btc_price=btc.get("price"),
        btc_change_pct=btc.get("change_pct"),
        audusd_price=audusd.get("price"),
        audusd_change_pct=audusd.get("change_pct"),
        axjo_price=axjo.get("price"),
        axjo_change_pct=axjo.get("change_pct"),
        fear_greed_index=fear_greed,
        fear_greed_label=fear_label,
        regime=regime,
    )
