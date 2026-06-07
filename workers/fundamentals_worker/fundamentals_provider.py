"""
Provider abstraction for company fundamentals fetching.

Supports Finnhub (live) and DemoFundamentalsProvider (no API key required).
Guarded: failures are caught and logged, never crash the worker.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Fundamentals:
    """Immutable fundamentals snapshot from any source."""

    symbol: str
    company_name: str
    sector: str
    industry: str
    market_cap: float | None  # billions USD
    enterprise_value: float | None  # billions USD
    revenue: float | None  # USD millions
    revenue_growth_yoy: float | None  # percent
    gross_margin: float | None  # percent
    operating_margin: float | None  # percent
    net_income: float | None  # USD millions
    free_cash_flow: float | None  # USD millions
    ebitda: float | None  # USD millions
    cash: float | None  # USD millions
    debt: float | None  # USD millions
    pe: float | None  # trailing P/E
    forward_pe: float | None
    price_to_sales: float | None
    ev_to_ebitda: float | None
    ev_to_revenue: float | None
    eps_growth: float | None  # percent YoY


class FundamentalsProvider(Protocol):
    """Protocol for fundamentals providers."""

    def fetch_fundamentals(self, symbol: str) -> Fundamentals | None:
        """Fetch fundamentals for a symbol. Returns None on failure."""
        ...


class FinnhubFundamentalsProvider:
    """Live Finnhub fundamentals provider. Requires FINNHUB_API_KEY."""

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key
        self.base_url = "https://finnhub.io/api/v1"

    def fetch_fundamentals(self, symbol: str) -> Fundamentals | None:
        """Fetch fundamentals from Finnhub. Returns None on error."""
        try:
            import requests

            url = f"{self.base_url}/company-basic-financials"
            params = {
                "symbol": symbol,
                "token": self.api_key,
            }

            resp = requests.get(url, params=params, timeout=10)
            resp.raise_for_status()
            data = resp.json()

            if "series" not in data:
                logger.warning(f"No financial series data for {symbol}")
                return None

            series = data.get("series", {})
            annual = series.get("annual", {})

            # Extract latest annual data
            def get_latest(key: str) -> float | None:
                if key not in annual:
                    return None
                vals = annual[key]
                if isinstance(vals, list) and vals:
                    latest = vals[0]
                    return float(latest.get("v")) if latest.get("v") is not None else None
                return None

            return Fundamentals(
                symbol=symbol,
                company_name=data.get("companyName", symbol),
                sector=data.get("finnhubIndustry", "Technology"),
                industry=data.get("finnhubIndustry", ""),
                market_cap=get_latest("marketCapitalization"),
                enterprise_value=get_latest("enterpriseValue"),
                revenue=get_latest("revenue"),
                revenue_growth_yoy=get_latest("revenueGrowth"),
                gross_margin=get_latest("grossMargin"),
                operating_margin=get_latest("operatingMargin"),
                net_income=get_latest("netIncome"),
                free_cash_flow=get_latest("freeCashFlow"),
                ebitda=get_latest("ebitda"),
                cash=get_latest("cash"),
                debt=get_latest("debt"),
                pe=get_latest("peRatio"),
                forward_pe=get_latest("forwardPeRatio"),
                price_to_sales=get_latest("priceToSalesTrailing12Months"),
                ev_to_ebitda=get_latest("enterpriseValueOverEbitda"),
                ev_to_revenue=get_latest("enterpriseValueOverRevenue"),
                eps_growth=get_latest("epsGrowth"),
            )
        except Exception as e:
            logger.warning(f"Failed to fetch Finnhub fundamentals for {symbol}: {e}")
            return None


class DemoFundamentalsProvider:
    """Demo fundamentals provider. No API key required."""

    def __init__(self) -> None:
        self.demo_data = self._build_demo_fundamentals()

    def fetch_fundamentals(self, symbol: str) -> Fundamentals | None:
        """Return demo fundamentals for symbol. No network calls."""
        return self.demo_data.get(symbol)

    @staticmethod
    def _build_demo_fundamentals() -> dict[str, Fundamentals]:
        """Build deterministic demo fundamentals for core tech tickers."""
        return {
            "NVDA": Fundamentals(
                symbol="NVDA",
                company_name="Nvidia",
                sector="Technology",
                industry="Semiconductors",
                market_cap=3100.0,
                enterprise_value=3050.0,
                revenue=60200.0,
                revenue_growth_yoy=126.0,
                gross_margin=71.2,
                operating_margin=52.1,
                net_income=25500.0,
                free_cash_flow=28100.0,
                ebitda=35200.0,
                cash=28500.0,
                debt=1200.0,
                pe=67.3,
                forward_pe=48.2,
                price_to_sales=50.8,
                ev_to_ebitda=86.5,
                ev_to_revenue=50.2,
                eps_growth=143.0,
            ),
            "MSFT": Fundamentals(
                symbol="MSFT",
                company_name="Microsoft",
                sector="Technology",
                industry="Software",
                market_cap=3050.0,
                enterprise_value=2920.0,
                revenue=245122.0,
                revenue_growth_yoy=16.3,
                gross_margin=69.8,
                operating_margin=46.2,
                net_income=88188.0,
                free_cash_flow=80200.0,
                ebitda=128400.0,
                cash=68900.0,
                debt=45600.0,
                pe=39.2,
                forward_pe=34.8,
                price_to_sales=12.1,
                ev_to_ebitda=22.3,
                ev_to_revenue=10.9,
                eps_growth=10.0,
            ),
            "AAPL": Fundamentals(
                symbol="AAPL",
                company_name="Apple",
                sector="Technology",
                industry="Consumer Electronics",
                market_cap=2900.0,
                enterprise_value=2750.0,
                revenue=394328.0,
                revenue_growth_yoy=2.1,
                gross_margin=46.1,
                operating_margin=30.5,
                net_income=96995.0,
                free_cash_flow=110543.0,
                ebitda=130100.0,
                cash=29941.0,
                debt=106599.0,
                pe=35.8,
                forward_pe=33.2,
                price_to_sales=7.4,
                ev_to_ebitda=20.9,
                ev_to_revenue=6.8,
                eps_growth=4.0,
            ),
            "GOOGL": Fundamentals(
                symbol="GOOGL",
                company_name="Alphabet",
                sector="Technology",
                industry="Internet Services",
                market_cap=2150.0,
                enterprise_value=2010.0,
                revenue=307394.0,
                revenue_growth_yoy=13.5,
                gross_margin=56.3,
                operating_margin=22.4,
                net_income=64741.0,
                free_cash_flow=68900.0,
                ebitda=95200.0,
                cash=110815.0,
                debt=13200.0,
                pe=28.1,
                forward_pe=24.6,
                price_to_sales=6.9,
                ev_to_ebitda=21.1,
                ev_to_revenue=6.5,
                eps_growth=18.0,
            ),
            "AMZN": Fundamentals(
                symbol="AMZN",
                company_name="Amazon",
                sector="Technology",
                industry="E-commerce",
                market_cap=1950.0,
                enterprise_value=1880.0,
                revenue=575149.0,
                revenue_growth_yoy=11.1,
                gross_margin=42.8,
                operating_margin=9.2,
                net_income=30345.0,
                free_cash_flow=55100.0,
                ebitda=71200.0,
                cash=61074.0,
                debt=43000.0,
                pe=58.2,
                forward_pe=49.8,
                price_to_sales=3.4,
                ev_to_ebitda=26.4,
                ev_to_revenue=3.3,
                eps_growth=12.0,
            ),
            "META": Fundamentals(
                symbol="META",
                company_name="Meta",
                sector="Technology",
                industry="Internet Services",
                market_cap=1850.0,
                enterprise_value=1810.0,
                revenue=134902.0,
                revenue_growth_yoy=22.1,
                gross_margin=80.2,
                operating_margin=38.5,
                net_income=23200.0,
                free_cash_flow=27100.0,
                ebitda=60300.0,
                cash=65317.0,
                debt=5100.0,
                pe=34.2,
                forward_pe=28.9,
                price_to_sales=13.7,
                ev_to_ebitda=29.9,
                ev_to_revenue=13.4,
                eps_growth=35.0,
            ),
            "AMD": Fundamentals(
                symbol="AMD",
                company_name="Advanced Micro Devices",
                sector="Technology",
                industry="Semiconductors",
                market_cap=245.0,
                enterprise_value=235.0,
                revenue=26600.0,
                revenue_growth_yoy=-4.1,
                gross_margin=47.8,
                operating_margin=2.1,
                net_income=1800.0,
                free_cash_flow=2100.0,
                ebitda=1700.0,
                cash=5900.0,
                debt=2100.0,
                pe=132.4,
                forward_pe=24.3,
                price_to_sales=9.2,
                ev_to_ebitda=138.2,
                ev_to_revenue=8.8,
                eps_growth=-89.0,
            ),
            "AVGO": Fundamentals(
                symbol="AVGO",
                company_name="Broadcom",
                sector="Technology",
                industry="Semiconductors",
                market_cap=320.0,
                enterprise_value=310.0,
                revenue=48100.0,
                revenue_growth_yoy=8.2,
                gross_margin=60.1,
                operating_margin=24.5,
                net_income=7200.0,
                free_cash_flow=8900.0,
                ebitda=12000.0,
                cash=3400.0,
                debt=12500.0,
                pe=45.2,
                forward_pe=38.9,
                price_to_sales=6.6,
                ev_to_ebitda=25.8,
                ev_to_revenue=6.4,
                eps_growth=5.0,
            ),
            "CRM": Fundamentals(
                symbol="CRM",
                company_name="Salesforce",
                sector="Technology",
                industry="Enterprise Software",
                market_cap=345.0,
                enterprise_value=340.0,
                revenue=33600.0,
                revenue_growth_yoy=8.5,
                gross_margin=73.6,
                operating_margin=9.8,
                net_income=2100.0,
                free_cash_flow=4300.0,
                ebitda=5100.0,
                cash=8600.0,
                debt=5200.0,
                pe=158.9,
                forward_pe=45.2,
                price_to_sales=10.3,
                ev_to_ebitda=66.7,
                ev_to_revenue=10.1,
                eps_growth=20.0,
            ),
            "NOW": Fundamentals(
                symbol="NOW",
                company_name="ServiceNow",
                sector="Technology",
                industry="Enterprise Software",
                market_cap=320.0,
                enterprise_value=310.0,
                revenue=9290.0,
                revenue_growth_yoy=27.2,
                gross_margin=77.3,
                operating_margin=3.2,
                net_income=250.0,
                free_cash_flow=1100.0,
                ebitda=600.0,
                cash=2800.0,
                debt=1900.0,
                pe=1256.0,
                forward_pe=42.8,
                price_to_sales=34.4,
                ev_to_ebitda=516.7,
                ev_to_revenue=33.4,
                eps_growth=32.0,
            ),
            "PANW": Fundamentals(
                symbol="PANW",
                company_name="Palo Alto Networks",
                sector="Technology",
                industry="Cybersecurity",
                market_cap=380.0,
                enterprise_value=370.0,
                revenue=8200.0,
                revenue_growth_yoy=19.5,
                gross_margin=77.2,
                operating_margin=11.3,
                net_income=650.0,
                free_cash_flow=1200.0,
                ebitda=1400.0,
                cash=4100.0,
                debt=2800.0,
                pe=58.5,
                forward_pe=48.2,
                price_to_sales=46.3,
                ev_to_ebitda=264.3,
                ev_to_revenue=45.1,
                eps_growth=24.0,
            ),
            "CRWD": Fundamentals(
                symbol="CRWD",
                company_name="CrowdStrike",
                sector="Technology",
                industry="Cybersecurity",
                market_cap=345.0,
                enterprise_value=340.0,
                revenue=2700.0,
                revenue_growth_yoy=30.5,
                gross_margin=80.1,
                operating_margin=22.4,
                net_income=400.0,
                free_cash_flow=640.0,
                ebitda=650.0,
                cash=3200.0,
                debt=400.0,
                pe=857.5,
                forward_pe=58.3,
                price_to_sales=127.8,
                ev_to_ebitda=523.1,
                ev_to_revenue=125.9,
                eps_growth=48.0,
            ),
            "SNOW": Fundamentals(
                symbol="SNOW",
                company_name="Snowflake",
                sector="Technology",
                industry="Cloud Data",
                market_cap=180.0,
                enterprise_value=175.0,
                revenue=1700.0,
                revenue_growth_yoy=33.3,
                gross_margin=68.2,
                operating_margin=-12.5,
                net_income=-250.0,
                free_cash_flow=-180.0,
                ebitda=-150.0,
                cash=2100.0,
                debt=50.0,
                pe=-681.0,
                forward_pe=52.1,
                price_to_sales=105.9,
                ev_to_ebitda=-1166.7,
                ev_to_revenue=102.9,
                eps_growth=-115.0,
            ),
        }


def create_fundamentals_provider() -> FundamentalsProvider:
    """
    Factory function: creates Finnhub provider if FINNHUB_API_KEY is set,
    otherwise returns demo provider.
    """
    api_key = os.getenv("FINNHUB_API_KEY")
    if api_key:
        logger.info("Using Finnhub fundamentals provider")
        return FinnhubFundamentalsProvider(api_key)
    else:
        logger.info("Using demo fundamentals provider (no FINNHUB_API_KEY set)")
        return DemoFundamentalsProvider()
