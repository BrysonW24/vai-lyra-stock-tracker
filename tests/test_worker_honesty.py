"""A worker that stores nothing must not report success - forcing tests.

Every test here reproduces a silent-green failure that ACTUALLY shipped:

- events: an outer try/except around the persist calls nullified the v0.42.0 fix that
  was built to propagate write failures - the run reported success with zero rows stored.
- intelligence: persist helpers swallowed every exception and the orchestrator set
  status="success" unconditionally (the pre-v0.42.0 shape, still live until this wave).
- fundamentals: the fatal handler returned status "error" but main() only failed on
  "failed", so a total crash exited 0 under a green nightly step.
- scout: the community_ideas upsert targeted a partial unique index (42P10, migration
  043) so every filed idea was rejected while the run reported ok.

If one of these tests starts failing, a silent-green regression has been reintroduced.
Do not weaken the assertions to make it pass.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from workers.events_worker.main import run_events_worker
from workers.fundamentals_worker.main import run_fundamentals_worker
from workers.intelligence_worker.main import run_intelligence_worker
from workers.scout.main import run_scout_worker


class RejectingClient:
    """Supabase client stand-in: every query builds, every execute is rejected.

    Mirrors the 42P10 shape - the client is reachable and the request is well-formed,
    but the database refuses the write.
    """

    def table(self, _name):
        return self

    def __getattr__(self, _name):
        # Any builder method (upsert/select/order/limit/delete/lt/insert/eq/...)
        # returns self so chains compose; only execute() fails.
        def _chain(*_args, **_kwargs):
            return self

        return _chain

    def execute(self):
        raise RuntimeError("write rejected (simulated 42P10)")


class FakeRepo:
    def __init__(self, client):
        self.client = client
        self.enabled = client is not None

    def load_active_tickers(self):
        return [SimpleNamespace(symbol="NVDA")]


class CrashingRepo:
    """Repo whose very first touch dies - simulates a DB outage before any loop runs."""

    client = None
    enabled = False

    def load_active_tickers(self):
        raise RuntimeError("connection refused")


@pytest.fixture(autouse=True)
def _no_live_keys(monkeypatch):
    # Force every provider to demo mode so no network is touched and fetches are
    # deterministic and non-empty.
    monkeypatch.delenv("FINNHUB_API_KEY", raising=False)


class _LiveEventsProvider:
    """A LIVE-flagged provider returning demo-shaped events, so persistence is attempted
    (the real demo provider is is_live=False and is intentionally NOT persisted)."""

    is_live = True

    def fetch_events(self, days=30):
        return [SimpleNamespace(id="e1", date="2026-07-20", type="earnings", ticker="NVDA", title="NVDA earnings", importance="high")]

    def fetch_ipos(self):
        return []


class TestEventsWorkerHonesty:
    def test_rejected_persist_fails_the_run(self, monkeypatch):
        import workers.events_worker.main as mod

        monkeypatch.setattr(mod, "create_events_provider", lambda: _LiveEventsProvider())
        summary = run_events_worker(None, FakeRepo(RejectingClient()))
        assert summary["status"] == "failed"

    def test_unknown_status_exits_nonzero(self, monkeypatch):
        import workers.events_worker.main as mod
        import workers.stock_scanner.config as config

        monkeypatch.setattr(config, "load_settings", lambda: None)
        monkeypatch.setattr(mod, "SupabaseRepository", lambda settings: None)
        monkeypatch.setattr(mod, "run_events_worker", lambda s, r: {"status": "error"})
        with pytest.raises(SystemExit):
            mod.main()

    def test_good_outcomes_exit_zero(self, monkeypatch):
        import workers.events_worker.main as mod
        import workers.stock_scanner.config as config

        monkeypatch.setattr(config, "load_settings", lambda: None)
        monkeypatch.setattr(mod, "SupabaseRepository", lambda settings: None)
        for status in ("success", "no_tickers"):
            monkeypatch.setattr(mod, "run_events_worker", lambda s, r, st=status: {"status": st})
            mod.main()  # must not raise


class TestIntelligenceWorkerHonesty:
    def test_fetched_but_persisted_zero_fails_the_run(self):
        summary = run_intelligence_worker(None, FakeRepo(RejectingClient()))
        assert summary["status"] == "failed"
        assert "persisted 0" in (summary.get("error") or "")

    def test_unknown_status_exits_nonzero(self, monkeypatch):
        import workers.intelligence_worker.main as mod
        import workers.stock_scanner.config as config

        monkeypatch.setattr(config, "load_settings", lambda: None)
        monkeypatch.setattr(mod, "SupabaseRepository", lambda settings: None)
        monkeypatch.setattr(mod, "run_intelligence_worker", lambda s, r: {"status": "error"})
        with pytest.raises(SystemExit):
            mod.main()


class TestFundamentalsWorkerHonesty:
    def test_fatal_crash_reports_error_status(self):
        summary = run_fundamentals_worker(None, CrashingRepo())
        assert summary["status"] == "error"

    def test_error_status_exits_nonzero(self, monkeypatch):
        """THE bug: fatal handler returns "error", main() only failed on "failed"."""
        import workers.fundamentals_worker.main as mod
        import workers.stock_scanner.config as config

        monkeypatch.setattr(config, "load_settings", lambda: None)
        monkeypatch.setattr(mod, "SupabaseRepository", lambda settings: None)
        monkeypatch.setattr(mod, "run_fundamentals_worker", lambda s, r: {"status": "error"})
        with pytest.raises(SystemExit):
            mod.main()


class RecordingClient:
    """Records every table the code tried to write, so a test can assert NOTHING was persisted."""

    def __init__(self):
        self.upserts = []

    def table(self, name):
        self._t = name
        return self

    def __getattr__(self, _name):
        def _chain(*a, **k):
            return self
        return _chain

    def upsert(self, *a, **k):
        self.upserts.append(self._t)
        return self

    def execute(self):
        return SimpleNamespace(data=[])


class TestDemoDataNeverPersists:
    """Fabricated demo data must never reach the live tables the product reads."""

    def test_events_demo_provider_is_not_persisted(self, monkeypatch):
        import workers.events_worker.main as mod

        class _DemoProvider:
            is_live = False
            def fetch_events(self, days=30):
                return [SimpleNamespace(id="e1", date="2026-07-20", type="earnings", ticker="NVDA", title="x", importance="high")]
            def fetch_ipos(self):
                return [SimpleNamespace(symbol="Z", company_name="Z", ipo_date="2026-08-01", exchange="NYSE", category="tech", status="expected", offer_price=None, shares_offered_m=None, proceeds_usd_m=None, valuation_usd_m=None, revenue_ttm_usd_m=None, revenue_growth_pct=None, gross_margin_pct=None, net_income_usd_m=None, profitable=None, employees=None, products=[], notable_projects=[], key_people=[], description="", domain="z.com")]

        monkeypatch.setattr(mod, "create_events_provider", lambda: _DemoProvider())
        client = RecordingClient()
        summary = run_events_worker(None, FakeRepo(client))
        assert summary["status"] == "success"  # demo run is a clean no-persist
        assert client.upserts == []  # NOTHING written to company_events / ipos / event_risks

    def test_scout_demo_fallback_is_not_persisted(self, monkeypatch):
        import workers.scout.main as mod

        # No live source -> demo fallback. It must run for shape but persist nothing.
        monkeypatch.setattr(mod, "active_sources", lambda registry: [])
        monkeypatch.setattr(mod, "gated_sources", lambda registry: [])
        client = RecordingClient()
        summary = run_scout_worker(None, FakeRepo(client))
        assert summary["status"] == "ok"
        assert client.upserts == []  # no scout_items, no community_ideas


class TestScoutWorkerHonesty:
    def test_rejected_persist_fails_the_run(self, monkeypatch):
        import workers.scout.main as mod
        from workers.scout.providers import ScoutItem

        # A GENUINE live source (not demo fallback) so persistence is actually attempted and the
        # rejecting client makes it fail. On a demo-fallback night the worker correctly persists
        # nothing (fabricated data must not reach live tables), so it would NOT fail here.
        monkeypatch.setattr(mod, "active_sources", lambda registry: [SimpleNamespace(id="live-src")])
        monkeypatch.setattr(mod, "gated_sources", lambda registry: [])
        monkeypatch.setattr(
            mod, "fetch_source",
            lambda source: [ScoutItem(id="x1", source_id="live-src", source_kind="rss", url="http://e/x", title="Live tonight", summary="s", published_at=None)],
        )
        summary = run_scout_worker(None, FakeRepo(RejectingClient()))
        assert summary["status"] == "failed"
        assert "persisted 0" in (summary.get("error") or "")
