"""
Provider abstraction for company news fetching.

Supports Finnhub (live) and DemoNewsProvider (no API key required).
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
class NewsItem:
    """Immutable news item from any source."""

    symbol: str
    headline: str
    summary: str
    source: str  # e.g., 'Reuters', 'Bloomberg'
    source_domain: str  # e.g., 'reuters.com'
    category: str  # e.g., 'Earnings', 'Analyst upgrade'
    published_at: datetime
    url: str | None = None


class NewsProvider(Protocol):
    """Protocol for news providers."""

    # True only for a real upstream feed. The worker persists to the live news tables
    # ONLY when this is True (mirror events_worker) so fabricated demo items can never be
    # surfaced on /intelligence as real market news.
    is_live: bool

    def fetch_company_news(self, symbol: str, days: int = 7) -> list[NewsItem]:
        """Fetch recent news for a symbol. Returns empty list on failure."""
        ...


class FinnhubNewsProvider:
    """Live Finnhub news provider. Requires FINNHUB_API_KEY."""

    is_live = True

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key
        self.base_url = "https://finnhub.io/api/v1"

    def fetch_company_news(self, symbol: str, days: int = 7) -> list[NewsItem]:
        """Fetch news from Finnhub. Returns empty list on error."""
        try:
            import requests

            # Calculate date range
            now = datetime.now(timezone.utc)
            from_date = (now - __import__("datetime").timedelta(days=days)).strftime("%Y-%m-%d")
            to_date = now.strftime("%Y-%m-%d")

            url = f"{self.base_url}/company-news"
            params = {
                "symbol": symbol,
                "from": from_date,
                "to": to_date,
                "token": self.api_key,
            }

            resp = requests.get(url, params=params, timeout=10)
            resp.raise_for_status()
            data = resp.json()

            items = []
            for article in data:
                try:
                    published_ts = article.get("datetime", 0)
                    if isinstance(published_ts, int):
                        published_at = datetime.fromtimestamp(published_ts, tz=timezone.utc)
                    else:
                        published_at = datetime.now(timezone.utc)

                    item = NewsItem(
                        symbol=symbol,
                        headline=article.get("headline", ""),
                        summary=article.get("summary", "")[:200],  # Truncate to 200 chars
                        source=article.get("source", "Unknown"),
                        source_domain=article.get("url", "").split("/")[2] if article.get("url") else "",
                        category=_infer_category(article.get("headline", "")),
                        published_at=published_at,
                        url=article.get("url"),
                    )
                    items.append(item)
                except Exception as e:
                    logger.warning(f"Failed to parse Finnhub article for {symbol}: {e}")
                    continue

            return items
        except Exception as e:
            logger.warning(f"Failed to fetch Finnhub news for {symbol}: {e}")
            return []


class DemoNewsProvider:
    """Demo news provider returning ~25 deterministic items. No API key required."""

    is_live = False

    def __init__(self) -> None:
        self.demo_items = self._build_demo_feed()

    def fetch_company_news(self, symbol: str, days: int = 7) -> list[NewsItem]:
        """Return demo items filtered by symbol. No network calls."""
        return [item for item in self.demo_items if item.symbol == symbol]

    @staticmethod
    def _build_demo_feed() -> list[NewsItem]:
        """Build deterministic demo feed across key tickers."""
        now = datetime.now(timezone.utc)

        items = [
            # NVDA
            NewsItem(
                symbol="NVDA",
                headline="NVDA raised to conviction buy on H100 demand strength",
                summary="Goldman elevates NVDA to conviction buy; datacentre GPU orders at capacity through Q4.",
                source="Goldman Sachs",
                source_domain="goldmansachs.com",
                category="Analyst upgrade",
                published_at=now.replace(day=3, hour=8, minute=30),
            ),
            NewsItem(
                symbol="NVDA",
                headline="Taiwan production capacity hits record; NVDA/TSMC extended partnership",
                summary="TSMC double-shifts N3; NVIDIA contract commitments through 2027 announced.",
                source="Semicon News",
                source_domain="semiconductorengineering.com",
                category="Macro",
                published_at=now.replace(day=30, month=5, hour=15),
            ),
            # AMD
            NewsItem(
                symbol="AMD",
                headline="TSMC accelerates HBM3 production for AI chip demand surge",
                summary="TSMC commits additional capacity to HBM3; both NVDA and AMD see supply benefits.",
                source="Reuters",
                source_domain="reuters.com",
                category="AI announcement",
                published_at=now.replace(day=3, hour=7, minute=15),
            ),
            NewsItem(
                symbol="AMD",
                headline="AMD Q1 data centre CPUs exceed expectations",
                summary="AMD reports 35% YoY server CPU growth; EPYC market share gains vs. Intel steady.",
                source="AMD Inc.",
                source_domain="amd.com",
                category="Earnings",
                published_at=now.replace(day=1, month=6, hour=21),
            ),
            NewsItem(
                symbol="AMD",
                headline="AMD Ryzen AI 300-series mobile chips beat expected specs",
                summary="New Ryzen AI chips show 15% perf boost vs. Qualcomm; Dell, Lenovo confirm orders.",
                source="TechCrunch",
                source_domain="techcrunch.com",
                category="Product launch",
                published_at=now.replace(day=29, month=5, hour=10, minute=45),
            ),
            # MSFT
            NewsItem(
                symbol="MSFT",
                headline="Copilot Pro enterprise tier launches with custom LLM support",
                summary="Microsoft rolls out Copilot Pro for Fortune 500 enterprises; early adoption strong.",
                source="Microsoft IR",
                source_domain="microsoft.com",
                category="Product launch",
                published_at=now.replace(day=2, month=6, hour=22),
            ),
            NewsItem(
                symbol="MSFT",
                headline="MSFT price target raised to $475 on Copilot monetisation runway",
                summary="Wedbush confident MSFT can extract premium pricing as CoPilot adoption widens.",
                source="Wedbush",
                source_domain="wedbush.com",
                category="Analyst upgrade",
                published_at=now.replace(day=29, month=5, hour=14),
            ),
            NewsItem(
                symbol="MSFT",
                headline="Fed signals pauses rate hikes; tech valuations stabilising",
                summary="Powell commentary supports extended pause in rate hikes; benefits high-growth tech.",
                source="Federal Reserve",
                source_domain="federalreserve.gov",
                category="Macro",
                published_at=now.replace(day=1, month=6, hour=10, minute=15),
            ),
            # GOOGL
            NewsItem(
                symbol="GOOGL",
                headline="DOJ antitrust trial witness testimony weakens Google defence position",
                summary="Competitive pressures from Perplexity and OpenAI cited; search market share debate continues.",
                source="CNBC",
                source_domain="cnbc.com",
                category="Regulatory",
                published_at=now.replace(day=1, month=6, hour=12),
            ),
            NewsItem(
                symbol="GOOGL",
                headline="Google Gemini 2.0 API now public; enterprise adoption accelerating",
                summary="Gemini API open to all developers; billions in inference volume expected by Q4.",
                source="Google AI",
                source_domain="google.com",
                category="AI announcement",
                published_at=now.replace(day=29, month=5, hour=20),
            ),
            # SNOW
            NewsItem(
                symbol="SNOW",
                headline="SNOW Q1 revenue beat; raises FY guidance on AI Analytics adoption",
                summary="Snowflake reports 34% YoY growth; AI-powered analytics module driving expansion.",
                source="Snowflake Inc.",
                source_domain="snowflake.com",
                category="Earnings",
                published_at=now.replace(day=2, month=6, hour=20, minute=30),
            ),
            NewsItem(
                symbol="SNOW",
                headline="Snowflake and Datadog integrate; customers can monitor SNOW workloads",
                summary="New partnership deepens integration; benefits both platforms in enterprise stickiness.",
                source="Forbes",
                source_domain="forbes.com",
                category="Partnership",
                published_at=now.replace(day=30, month=5, hour=12, minute=30),
            ),
            # PANW
            NewsItem(
                symbol="PANW",
                headline="PANW maintains overweight; AI-driven threat detection market expanding",
                summary="Morgan Stanley sees 25% CAGR in security AI; PANW leadership position strengthening.",
                source="Morgan Stanley",
                source_domain="morganstanley.com",
                category="Analyst upgrade",
                published_at=now.replace(day=2, month=6, hour=14),
            ),
            NewsItem(
                symbol="PANW",
                headline="PANW, CRWD among top 3 in AI-powered security magic quadrant",
                summary="Both leaders recognised for threat detection AI; market consolidating around feature-rich platforms.",
                source="Gartner",
                source_domain="gartner.com",
                category="AI announcement",
                published_at=now.replace(day=31, month=5, hour=9),
            ),
            NewsItem(
                symbol="PANW",
                headline="PANW settles data breach class-action for $49M",
                summary="Settlement covers 2023 supply chain incident; reputational risk contained.",
                source="SecurityWeek",
                source_domain="securityweek.com",
                category="Litigation",
                published_at=now.replace(day=28, month=5, hour=11),
            ),
            # CRWD
            NewsItem(
                symbol="CRWD",
                headline="CrowdStrike unveils real-time adversary intel powered by Claude API",
                summary="CRWD integrates Claude to accelerate threat hunting; reduces MTTR by 40%.",
                source="Bloomberg",
                source_domain="bloomberg.com",
                category="AI announcement",
                published_at=now.replace(day=2, month=6, hour=10, minute=45),
            ),
            NewsItem(
                symbol="CRWD",
                headline="CrowdStrike expects record Q2 as enterprise shifts to modern EDR architecture",
                summary="CRWD CFO guidance raises confidence in sustained 40%+ growth rate.",
                source="Wall Street Journal",
                source_domain="wsj.com",
                category="Guidance",
                published_at=now.replace(day=27, month=5, hour=9),
            ),
            # AVGO
            NewsItem(
                symbol="AVGO",
                headline="AVGO raises FY26 guidance on AI datacenter interconnect strength",
                summary="Broadcom lifts revenue guidance $500M+ driven by ultra-high-speed SerDes demand.",
                source="Broadcom IR",
                source_domain="broadcom.com",
                category="Guidance",
                published_at=now.replace(day=2, month=6, hour=9),
            ),
            NewsItem(
                symbol="AVGO",
                headline="AVGO buy rating reaffirmed; AI interconnect TAM expanding faster than expected",
                summary="Citi raises TAM estimate to $50B by 2030; AVGO position strengthening.",
                source="Citi",
                source_domain="citi.com",
                category="Analyst upgrade",
                published_at=now.replace(day=28, month=5, hour=13, minute=15),
            ),
            # CRM
            NewsItem(
                symbol="CRM",
                headline="CRM downgraded to equal weight on valuation concerns post-rally",
                summary="Barclays cuts CRM rating; stock has priced in Slack momentum already.",
                source="Barclays",
                source_domain="barclays.com",
                category="Analyst downgrade",
                published_at=now.replace(day=1, month=6, hour=14, minute=30),
            ),
            NewsItem(
                symbol="CRM",
                headline="Salesforce acquires workflow automation startup Mindy; $200M+ deal",
                summary="CRM expands AI workflow capabilities; Mindy founders join AI chief office.",
                source="SEC (8-K)",
                source_domain="sec.gov",
                category="M&A",
                published_at=now.replace(day=30, month=5, hour=8),
            ),
            # NOW
            NewsItem(
                symbol="NOW",
                headline="NOW Q1 RPO grows 19% YoY; AI workflow automation accelerating",
                summary="ServiceNow sees strong ACV expansion in AI vertical; guidance slightly raised.",
                source="ServiceNow Inc.",
                source_domain="servicenow.com",
                category="Earnings",
                published_at=now.replace(day=31, month=5, hour=20),
            ),
            NewsItem(
                symbol="NOW",
                headline="NOW stock: Evercore upgrades to outperform on workflow AI momentum",
                summary="Evercore sees NOW as best-in-class SaaS workflow platform; raises PT to $310.",
                source="Evercore",
                source_domain="evercoreisI.com",
                category="Analyst upgrade",
                published_at=now.replace(day=27, month=5, hour=15, minute=30),
            ),
            # DDOG (bonus)
            NewsItem(
                symbol="DDOG",
                headline="DDOG outperform maintained; observability moat widening vs. peers",
                summary="Oppenheimer confident Datadog edge in LLM/AI workload monitoring grows margins.",
                source="Oppenheimer",
                source_domain="oppenheimer.com",
                category="Analyst upgrade",
                published_at=now.replace(day=31, month=5, hour=16, minute=45),
            ),
            # ADBE (bonus)
            NewsItem(
                symbol="ADBE",
                headline="Adobe Firefly 3.0 gen-fill feature beats Midjourney in user testing",
                summary="User preference survey shows Adobe catching up in generative quality; Creative Cloud stickiness rising.",
                source="The Verge",
                source_domain="theverge.com",
                category="Product launch",
                published_at=now.replace(day=31, month=5, hour=11, minute=30),
            ),
        ]

        return items


def create_news_provider() -> NewsProvider:
    """
    Factory function: creates Finnhub provider if FINNHUB_API_KEY is set,
    otherwise returns demo provider.
    """
    api_key = os.getenv("FINNHUB_API_KEY")
    if api_key:
        logger.info("Using Finnhub news provider")
        return FinnhubNewsProvider(api_key)
    else:
        logger.info("Using demo news provider (no FINNHUB_API_KEY set)")
        return DemoNewsProvider()


def _infer_category(headline: str) -> str:
    """Infer news category from headline keywords."""
    headline_lower = headline.lower()

    if any(word in headline_lower for word in ["earnings", "q1", "q2", "q3", "q4", "revenue", "guidance", "eps"]):
        return "Earnings"
    elif any(word in headline_lower for word in ["upgrade", "outperform", "conviction buy"]):
        return "Analyst upgrade"
    elif any(word in headline_lower for word in ["downgrade", "underperform", "equal weight", "sell"]):
        return "Analyst downgrade"
    elif any(word in headline_lower for word in ["partnership", "collaboration", "integr"]):
        return "Partnership"
    elif any(word in headline_lower for word in ["launch", "announce", "release", "unveil"]):
        return "Product launch"
    elif any(word in headline_lower for word in ["ai", "artificial", "machine learning", "llm", "copilot"]):
        return "AI announcement"
    elif any(word in headline_lower for word in ["regulate", "compliance", "fda", "doe", "ftc", "antitrust"]):
        return "Regulatory"
    elif any(word in headline_lower for word in ["lawsuit", "settlement", "litigation", "probe"]):
        return "Litigation"
    elif any(word in headline_lower for word in ["merger", "acquisition", "acquire", "m&a"]):
        return "M&A"
    elif any(word in headline_lower for word in ["macro", "fed", "interest rate", "inflation"]):
        return "Macro"
    else:
        return "News"
