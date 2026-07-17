"""
Provider abstraction for calendar events (earnings, macro, product, conference) and IPO data.

Supports Finnhub (live) and demo providers (no API key required).
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
class CalendarEvent:
    """Immutable calendar event from any source."""

    id: str
    date: str  # ISO date string (YYYY-MM-DD)
    type: str  # 'earnings', 'macro', 'product_launch', 'investor_day', 'conference', 'options_expiry'
    ticker: str | None  # None for MACRO events
    title: str
    importance: str  # 'high', 'medium', 'low'


@dataclass(frozen=True)
class IpoCompany:
    """Immutable IPO company record from any source."""

    symbol: str
    company_name: str
    ipo_date: str  # ISO date string (YYYY-MM-DD)
    exchange: str
    category: str
    status: str  # 'upcoming', 'priced', 'recent'
    offer_price: float
    shares_offered_m: float  # millions
    proceeds_usd_m: float  # capital raised, $M
    valuation_usd_m: float  # implied market cap, $M
    revenue_ttm_usd_m: float | None = None
    revenue_growth_pct: float | None = None
    gross_margin_pct: float | None = None
    net_income_usd_m: float | None = None
    profitable: bool = False
    employees: int | None = None
    products: list[str] | None = None
    notable_projects: list[str] | None = None
    key_people: list[dict[str, str]] | None = None
    description: str = ""
    domain: str = ""


class EventsProvider(Protocol):
    """Protocol for calendar event providers."""

    # True only for a real data source. The worker persists to the LIVE company_events / ipos
    # tables (which the user-facing calendar reads) ONLY when this is True - fabricated demo
    # data must never masquerade as real events in the product.
    is_live: bool

    def fetch_events(self, days: int = 30) -> list[CalendarEvent]:
        """Fetch upcoming calendar events. Returns empty list on failure."""
        ...

    def fetch_ipos(self) -> list[IpoCompany]:
        """Fetch IPO calendar data. Returns empty list on failure."""
        ...


class FinnhubEventsProvider:
    """Live Finnhub events provider. Requires FINNHUB_API_KEY."""

    is_live = True

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key
        self.base_url = "https://finnhub.io/api/v1"

    def fetch_events(self, days: int = 30) -> list[CalendarEvent]:
        """Fetch calendar events from Finnhub. Returns empty list on error."""
        try:
            import requests

            now = datetime.now(timezone.utc)
            from_date = now.strftime("%Y-%m-%d")
            to_date = (now + __import__("datetime").timedelta(days=days)).strftime("%Y-%m-%d")

            # Fetch earnings calendar
            url = f"{self.base_url}/calendar/earnings"
            params = {
                "from": from_date,
                "to": to_date,
                "token": self.api_key,
            }

            resp = requests.get(url, params=params, timeout=10)
            resp.raise_for_status()
            data = resp.json() or {}

            events = []
            for item in data.get("earningsCalendar", []):
                try:
                    event = CalendarEvent(
                        id=f"earnings-{item.get('symbol', '')}-{item.get('date', '')}",
                        date=item.get("date", ""),
                        type="earnings",
                        ticker=item.get("symbol"),
                        title=f"{item.get('symbol', '')} Earnings",
                        importance=_infer_event_importance(item.get("symbol", "")),
                    )
                    events.append(event)
                except Exception as e:
                    logger.warning(f"Failed to parse Finnhub earnings event: {e}")
                    continue

            return events
        except Exception as e:
            logger.warning(f"Failed to fetch Finnhub events: {e}")
            return []

    def fetch_ipos(self) -> list[IpoCompany]:
        """Fetch IPO calendar from Finnhub. Returns empty list on error."""
        try:
            import requests

            url = f"{self.base_url}/calendar/ipo"
            params = {
                "token": self.api_key,
            }

            resp = requests.get(url, params=params, timeout=10)
            resp.raise_for_status()
            data = resp.json() or {}

            ipos = []
            for item in data.get("ipoCalendar", []):
                try:
                    ipo = IpoCompany(
                        symbol=item.get("symbol", ""),
                        company_name=item.get("name", ""),
                        ipo_date=item.get("date", ""),
                        exchange=item.get("exchange", "NASDAQ"),
                        category="pending",  # Finnhub doesn't categorize
                        status="upcoming",
                        offer_price=float(item.get("price", 0)) if item.get("price") else 0.0,
                        shares_offered_m=float(item.get("shares", 0)) if item.get("shares") else 0.0,
                        proceeds_usd_m=0.0,  # Calculated
                        valuation_usd_m=0.0,  # Calculated
                        description=item.get("name", ""),
                        domain="",
                    )
                    ipos.append(ipo)
                except Exception as e:
                    logger.warning(f"Failed to parse Finnhub IPO event: {e}")
                    continue

            return ipos
        except Exception as e:
            logger.warning(f"Failed to fetch Finnhub IPOs: {e}")
            return []


class DemoEventsProvider:
    """Demo events provider. No API key required. Deterministic test data."""

    is_live = False

    def __init__(self) -> None:
        self.demo_events = self._build_demo_events()
        self.demo_ipos = self._build_demo_ipos()

    def fetch_events(self, days: int = 30) -> list[CalendarEvent]:
        """Return demo events. No network calls."""
        # In a real scenario, you could filter by date range here.
        # For now, return all demo events.
        return self.demo_events

    def fetch_ipos(self) -> list[IpoCompany]:
        """Return demo IPOs. No network calls."""
        return self.demo_ipos

    @staticmethod
    def _build_demo_events() -> list[CalendarEvent]:
        """Build deterministic demo calendar events spanning ~30 days from 2026-06-03."""
        return [
            # Week 1 (June 3-9)
            CalendarEvent(
                id="macro-fomc-20260604",
                date="2026-06-04",
                type="macro",
                ticker=None,
                title="FOMC Interest Rate Decision",
                importance="high",
            ),
            CalendarEvent(
                id="earnings-nvda-20260605",
                date="2026-06-05",
                type="earnings",
                ticker="NVDA",
                title="Nvidia Q1 FY2027 Earnings",
                importance="high",
            ),
            CalendarEvent(
                id="earnings-amd-20260606",
                date="2026-06-06",
                type="earnings",
                ticker="AMD",
                title="AMD Q1 2026 Earnings",
                importance="high",
            ),
            CalendarEvent(
                id="earnings-crm-20260606",
                date="2026-06-06",
                type="earnings",
                ticker="CRM",
                title="Salesforce Q1 FY2027 Earnings",
                importance="high",
            ),
            CalendarEvent(
                id="macro-cpi-20260609",
                date="2026-06-09",
                type="macro",
                ticker=None,
                title="US CPI Release",
                importance="high",
            ),
            # Week 2 (June 10-16)
            CalendarEvent(
                id="earnings-msft-20260610",
                date="2026-06-10",
                type="earnings",
                ticker="MSFT",
                title="Microsoft Q4 FY2026 Earnings",
                importance="high",
            ),
            CalendarEvent(
                id="earnings-aapl-20260611",
                date="2026-06-11",
                type="earnings",
                ticker="AAPL",
                title="Apple Q3 FY2026 Earnings",
                importance="high",
            ),
            CalendarEvent(
                id="conference-computex-20260610",
                date="2026-06-10",
                type="conference",
                ticker="NVDA",
                title="Computex Conference (NVDA keynote)",
                importance="medium",
            ),
            CalendarEvent(
                id="earnings-adbe-20260612",
                date="2026-06-12",
                type="earnings",
                ticker="ADBE",
                title="Adobe Q2 FY2026 Earnings",
                importance="high",
            ),
            CalendarEvent(
                id="macro-nfp-20260613",
                date="2026-06-13",
                type="macro",
                ticker=None,
                title="US Jobs Report (NFP)",
                importance="high",
            ),
            CalendarEvent(
                id="earnings-snow-20260613",
                date="2026-06-13",
                type="earnings",
                ticker="SNOW",
                title="Snowflake Q1 FY2027 Earnings",
                importance="high",
            ),
            CalendarEvent(
                id="earnings-now-20260615",
                date="2026-06-15",
                type="earnings",
                ticker="NOW",
                title="ServiceNow Q1 2026 Earnings",
                importance="medium",
            ),
            # Week 3 (June 17-23)
            CalendarEvent(
                id="product-launch-panw-20260617",
                date="2026-06-17",
                type="product_launch",
                ticker="PANW",
                title="Palo Alto Networks Next Gen Security Announcement",
                importance="medium",
            ),
            CalendarEvent(
                id="earnings-crwd-20260618",
                date="2026-06-18",
                type="earnings",
                ticker="CRWD",
                title="CrowdStrike Q1 2026 Earnings",
                importance="high",
            ),
            CalendarEvent(
                id="macro-options-expiry-20260620",
                date="2026-06-20",
                type="options_expiry",
                ticker=None,
                title="June Monthly Options Expiry",
                importance="medium",
            ),
            CalendarEvent(
                id="earnings-ddog-20260619",
                date="2026-06-19",
                type="earnings",
                ticker="DDOG",
                title="Datadog Q1 2026 Earnings",
                importance="medium",
            ),
            CalendarEvent(
                id="earnings-avgo-20260620",
                date="2026-06-20",
                type="earnings",
                ticker="AVGO",
                title="Broadcom Q2 FY2026 Earnings",
                importance="high",
            ),
            CalendarEvent(
                id="investor-day-msft-20260621",
                date="2026-06-21",
                type="investor_day",
                ticker="MSFT",
                title="Microsoft Investor Day",
                importance="medium",
            ),
            # Week 4 (June 24-30)
            CalendarEvent(
                id="macro-fomc-minutes-20260625",
                date="2026-06-25",
                type="macro",
                ticker=None,
                title="FOMC Meeting Minutes",
                importance="medium",
            ),
            CalendarEvent(
                id="conference-tesla-ai-20260626",
                date="2026-06-26",
                type="conference",
                ticker=None,
                title="Tesla AI Day (hypothetical)",
                importance="medium",
            ),
            CalendarEvent(
                id="macro-cpi-final-20260628",
                date="2026-06-28",
                type="macro",
                ticker=None,
                title="Core CPI Final Reading",
                importance="low",
            ),
        ]

    @staticmethod
    def _build_demo_ipos() -> list[IpoCompany]:
        """Build deterministic demo IPO calendar (~12 companies)."""
        return [
            # Recent IPOs
            IpoCompany(
                symbol="ARM",
                company_name="Arm Holdings",
                ipo_date="2023-09-14",
                exchange="NASDAQ",
                category="semiconductor",
                status="recent",
                offer_price=51.0,
                shares_offered_m=95.5,
                proceeds_usd_m=4870,
                valuation_usd_m=54500,
                revenue_ttm_usd_m=3230,
                revenue_growth_pct=21,
                gross_margin_pct=95,
                net_income_usd_m=790,
                profitable=True,
                employees=7100,
                products=["Cortex CPU IP", "Mali GPU IP", "Neoverse server cores"],
                notable_projects=["Armv9 architecture rollout"],
                key_people=[{"name": "Rene Haas", "role": "CEO"}],
                description="Designs the CPU architecture licensed into the majority of the world's smartphones.",
                domain="arm.com",
            ),
            IpoCompany(
                symbol="CRWV",
                company_name="CoreWeave",
                ipo_date="2025-03-28",
                exchange="NASDAQ",
                category="ai_infrastructure",
                status="recent",
                offer_price=40.0,
                shares_offered_m=37.5,
                proceeds_usd_m=1500,
                valuation_usd_m=23000,
                revenue_ttm_usd_m=1920,
                revenue_growth_pct=420,
                gross_margin_pct=74,
                net_income_usd_m=-310,
                profitable=False,
                employees=1000,
                products=["GPU cloud (H100/H200)", "Kubernetes-native compute"],
                notable_projects=["Hyperscale GPU data centres"],
                key_people=[{"name": "Michael Intrator", "role": "CEO"}],
                description="GPU-specialised cloud provider supplying large-scale NVIDIA compute.",
                domain="coreweave.com",
            ),
            IpoCompany(
                symbol="RDDT",
                company_name="Reddit",
                ipo_date="2024-03-21",
                exchange="NYSE",
                category="consumer_internet",
                status="recent",
                offer_price=34.0,
                shares_offered_m=22,
                proceeds_usd_m=748,
                valuation_usd_m=6400,
                revenue_ttm_usd_m=1300,
                revenue_growth_pct=62,
                gross_margin_pct=90,
                net_income_usd_m=30,
                profitable=True,
                employees=2200,
                products=["Reddit communities", "Advertising platform", "Data licensing API"],
                notable_projects=["AI data-licensing deals"],
                key_people=[{"name": "Steve Huffman", "role": "CEO"}],
                description="Community discussion platform monetising via advertising and data licensing.",
                domain="reddit.com",
            ),
            # Upcoming IPOs
            IpoCompany(
                symbol="DBRX",
                company_name="Databricks",
                ipo_date="2026-09-15",
                exchange="NASDAQ",
                category="cloud_data",
                status="upcoming",
                offer_price=95.0,
                shares_offered_m=50,
                proceeds_usd_m=4750,
                valuation_usd_m=62000,
                revenue_ttm_usd_m=3000,
                revenue_growth_pct=60,
                gross_margin_pct=80,
                net_income_usd_m=-200,
                profitable=False,
                employees=7500,
                products=["Lakehouse platform", "Mosaic AI", "Delta Lake"],
                notable_projects=["Data + AI lakehouse"],
                key_people=[{"name": "Ali Ghodsi", "role": "CEO"}],
                description="Data + AI lakehouse platform; one of the most anticipated upcoming listings.",
                domain="databricks.com",
            ),
            IpoCompany(
                symbol="STRP",
                company_name="Stripe",
                ipo_date="2026-11-01",
                exchange="NYSE",
                category="fintech_tech",
                status="upcoming",
                offer_price=70.0,
                shares_offered_m=60,
                proceeds_usd_m=4200,
                valuation_usd_m=70000,
                revenue_ttm_usd_m=5000,
                revenue_growth_pct=30,
                gross_margin_pct=75,
                net_income_usd_m=300,
                profitable=True,
                employees=8000,
                products=["Payments API", "Billing", "Connect"],
                notable_projects=["Global payments infrastructure"],
                key_people=[{"name": "Patrick Collison", "role": "CEO"}],
                description="Global payments and financial-infrastructure platform.",
                domain="stripe.com",
            ),
            IpoCompany(
                symbol="CNVA",
                company_name="Canva",
                ipo_date="2026-10-20",
                exchange="NASDAQ",
                category="software",
                status="upcoming",
                offer_price=45.0,
                shares_offered_m=40,
                proceeds_usd_m=1800,
                valuation_usd_m=32000,
                revenue_ttm_usd_m=2500,
                revenue_growth_pct=40,
                gross_margin_pct=80,
                net_income_usd_m=200,
                profitable=True,
                employees=5000,
                products=["Design platform", "Magic Studio (AI)"],
                notable_projects=["Generative-AI design suite"],
                key_people=[{"name": "Melanie Perkins", "role": "CEO"}],
                description="Australian visual-communication platform with deep generative-AI features.",
                domain="canva.com",
            ),
            IpoCompany(
                symbol="CBRS",
                company_name="Cerebras Systems",
                ipo_date="2026-08-12",
                exchange="NASDAQ",
                category="semiconductor",
                status="upcoming",
                offer_price=28.0,
                shares_offered_m=30,
                proceeds_usd_m=840,
                valuation_usd_m=8000,
                revenue_ttm_usd_m=400,
                revenue_growth_pct=220,
                gross_margin_pct=40,
                net_income_usd_m=-50,
                profitable=False,
                employees=400,
                products=["Wafer-scale engine", "CS-3 systems"],
                notable_projects=["Wafer-scale AI training"],
                key_people=[{"name": "Andrew Feldman", "role": "CEO"}],
                description="Wafer-scale AI chip maker positioning against GPUs.",
                domain="cerebras.net",
            ),
            IpoCompany(
                symbol="DISC",
                company_name="Discord",
                ipo_date="2026-12-05",
                exchange="NYSE",
                category="consumer_internet",
                status="upcoming",
                offer_price=38.0,
                shares_offered_m=35,
                proceeds_usd_m=1330,
                valuation_usd_m=16000,
                revenue_ttm_usd_m=900,
                revenue_growth_pct=28,
                gross_margin_pct=80,
                net_income_usd_m=-40,
                profitable=False,
                employees=1000,
                products=["Chat & voice communities", "Nitro subscriptions"],
                notable_projects=["Creator monetisation"],
                key_people=[{"name": "Jason Citron", "role": "CEO"}],
                description="Real-time community chat platform.",
                domain="discord.com",
            ),
            IpoCompany(
                symbol="CHYM",
                company_name="Chime",
                ipo_date="2026-07-30",
                exchange="NASDAQ",
                category="fintech_tech",
                status="upcoming",
                offer_price=30.0,
                shares_offered_m=40,
                proceeds_usd_m=1200,
                valuation_usd_m=12000,
                revenue_ttm_usd_m=1700,
                revenue_growth_pct=25,
                gross_margin_pct=60,
                net_income_usd_m=30,
                profitable=True,
                employees=1400,
                products=["Mobile banking", "SpotMe"],
                notable_projects=["Member-first neobank platform"],
                key_people=[{"name": "Chris Britt", "role": "CEO"}],
                description="Consumer neobank focused on fee-free mobile banking.",
                domain="chime.com",
            ),
            IpoCompany(
                symbol="PLAI",
                company_name="Plaid",
                ipo_date="2026-11-18",
                exchange="NASDAQ",
                category="fintech_tech",
                status="upcoming",
                offer_price=36.0,
                shares_offered_m=30,
                proceeds_usd_m=1080,
                valuation_usd_m=12000,
                revenue_ttm_usd_m=500,
                revenue_growth_pct=25,
                gross_margin_pct=75,
                net_income_usd_m=-20,
                profitable=False,
                employees=1200,
                products=["Bank-account connectivity API", "Identity verification"],
                notable_projects=["Open-finance network"],
                key_people=[{"name": "Zach Perret", "role": "CEO"}],
                description="Financial-data connectivity layer powering fintech apps.",
                domain="plaid.com",
            ),
            IpoCompany(
                symbol="GENS",
                company_name="Genesys",
                ipo_date="2026-09-30",
                exchange="NASDAQ",
                category="software",
                status="upcoming",
                offer_price=40.0,
                shares_offered_m=35,
                proceeds_usd_m=1400,
                valuation_usd_m=18000,
                revenue_ttm_usd_m=2400,
                revenue_growth_pct=22,
                gross_margin_pct=70,
                net_income_usd_m=100,
                profitable=True,
                employees=6000,
                products=["Cloud contact centre", "Experience orchestration"],
                notable_projects=["Conversational AI for CX"],
                key_people=[{"name": "Tony Bates", "role": "CEO"}],
                description="Cloud customer-experience and contact-centre platform.",
                domain="genesys.com",
            ),
            IpoCompany(
                symbol="NETS",
                company_name="Netskope",
                ipo_date="2026-10-08",
                exchange="NASDAQ",
                category="cybersecurity",
                status="upcoming",
                offer_price=34.0,
                shares_offered_m=30,
                proceeds_usd_m=1020,
                valuation_usd_m=9500,
                revenue_ttm_usd_m=700,
                revenue_growth_pct=30,
                gross_margin_pct=75,
                net_income_usd_m=-80,
                profitable=False,
                employees=3000,
                products=["SASE platform", "SSE"],
                notable_projects=["Single-vendor SASE"],
                key_people=[{"name": "Sanjay Beri", "role": "CEO"}],
                description="Secure access service edge (SASE) security platform.",
                domain="netskope.com",
            ),
        ]


def create_events_provider() -> EventsProvider:
    """
    Factory function: creates Finnhub provider if FINNHUB_API_KEY is set,
    otherwise returns demo provider.
    """
    api_key = os.getenv("FINNHUB_API_KEY")
    if api_key:
        logger.info("Using Finnhub events provider")
        return FinnhubEventsProvider(api_key)
    else:
        logger.info("Using demo events provider (no FINNHUB_API_KEY set)")
        return DemoEventsProvider()


def _infer_event_importance(ticker: str) -> str:
    """Heuristic: major tech stocks -> high importance. Others -> medium."""
    major = {"NVDA", "MSFT", "AAPL", "GOOGL", "TSLA", "META", "AMZN"}
    return "high" if ticker.upper() in major else "medium"
