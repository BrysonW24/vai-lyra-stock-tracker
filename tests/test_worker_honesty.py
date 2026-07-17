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


class TestEventsWorkerHonesty:
    def test_rejected_persist_fails_the_run(self):
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


class TestScoutWorkerHonesty:
    def test_rejected_persist_fails_the_run(self, monkeypatch):
        import workers.scout.main as mod

        # No active sources -> deterministic demo items, zero network.
        monkeypatch.setattr(mod, "active_sources", lambda registry: [])
        monkeypatch.setattr(mod, "gated_sources", lambda registry: [])
        summary = run_scout_worker(None, FakeRepo(RejectingClient()))
        assert summary["status"] == "failed"
        assert "persisted 0" in (summary.get("error") or "")
