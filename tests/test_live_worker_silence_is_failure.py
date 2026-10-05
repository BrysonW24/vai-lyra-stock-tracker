"""A LIVE provider that learns nothing about any ticker has failed - it has not had a quiet night.

Both workers used to report a clean status in exactly that case (fundamentals: "success" with 0
fetched; news: "no_news"), so a wrong endpoint, a revoked key or a rate limit on every call would
have produced green nightly runs and empty tables indefinitely.
"""
from __future__ import annotations

from workers.fundamentals_worker import main as fundamentals_main
from workers.intelligence_worker import main as intelligence_main
from workers.stock_scanner.models import Ticker


class _Repo:
    enabled = True
    client = object()

    def load_active_tickers(self):
        return [Ticker(symbol="NVDA"), Ticker(symbol="AMD"), Ticker(symbol="MSFT")]


class _SilentLiveFundamentals:
    is_live = True

    def fetch_fundamentals(self, _symbol):
        return None


class _SilentLiveNews:
    is_live = True

    def fetch_company_news(self, _symbol, days=7):
        return []


class _SilentDemoNews(_SilentLiveNews):
    is_live = False


def test_live_fundamentals_that_return_nothing_for_every_ticker_fail(monkeypatch) -> None:
    monkeypatch.setattr(fundamentals_main, "create_fundamentals_provider", lambda: _SilentLiveFundamentals())

    summary = fundamentals_main.run_fundamentals_worker(None, _Repo())

    assert summary["status"] == "failed"
    assert "0 of 3 tickers" in summary["error"]


def test_live_news_that_returns_nothing_for_every_ticker_fails(monkeypatch) -> None:
    monkeypatch.setattr(intelligence_main, "create_news_provider", lambda: _SilentLiveNews())

    summary = intelligence_main.run_intelligence_worker(None, _Repo())

    assert summary["status"] == "failed"
    assert "all 3 tickers" in summary["error"]


def test_a_demo_provider_with_no_news_is_still_just_no_news(monkeypatch) -> None:
    monkeypatch.setattr(intelligence_main, "create_news_provider", lambda: _SilentDemoNews())

    assert intelligence_main.run_intelligence_worker(None, _Repo())["status"] == "no_news"
