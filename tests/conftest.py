"""Suite-wide test isolation.

The one rule here: a test run must never write to a real ledger.

`workers/emerging_winner/backtest.py` appends every modelling attempt (retrain, compare, promote)
to `lyra-evals/model-attempt-log.jsonl`. That file exists to keep the trial count honest - "without
a trial count, nobody can tell one clean confirmation from the best of forty tries". The tests
exercise those same code paths, and until this fixture existed each `pytest` run appended its fake
retrains and forced promotions to the real file: by 2026-10-05, 27 of its 56 committed lines came
from pytest temp directories. An audit trail that is half test noise cannot answer the question it
was built for.
"""
from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _never_write_the_real_attempt_ledger(tmp_path, monkeypatch):
    from workers.emerging_winner import backtest

    monkeypatch.setattr(backtest, "ATTEMPT_LOG", str(tmp_path / "model-attempt-log.jsonl"))
