"""The model bake-off: real tasks through the real guards, metrics in the log, outputs only in the file."""
from __future__ import annotations

import json
import logging

import pytest

import workers.stock_scanner.model_bakeoff as mb
import workers.stock_scanner.open_model as om
from tests.test_free_briefing import _answer
from tests.test_free_read import GOOD, INVENTED
from tests.test_open_model import ENV, FakeResponse, Recorder, chat

SESSIONS, ARTICLES = mb.load_fixtures()
QUIET = next(session for session in SESSIONS if session["label"] == "quiet")
FUNDING = next(article for article in ARTICLES if article["label"] == "private-funding-round")
ROUNDUP = next(article for article in ARTICLES if article["label"] == "weekly-roundup")


def _target(spec="local:gemma-4-12b-qat"):
    (target,) = om.parse_chain(spec)
    return target


def test_the_fixtures_are_real_sessions_in_the_shape_the_read_is_built_from():
    assert [session["label"] for session in SESSIONS] == ["broad-rally", "broad-selloff", "quiet"]
    for session in SESSIONS:
        assert session["bars"] == "daily" and "No holdings" in session["note"] and len(session["rows"]) >= 50
        for row in session["rows"]:
            assert set(row) == {"symbol", "category", "stock_signals", "stock_candles"}
            assert len(row["stock_signals"]) == 2 and len(row["stock_candles"]) == 2
            assert set(row["stock_signals"][0]) == {"candle_time", "signal_score", "signal_status", "volume_ratio"}
            assert row["stock_signals"][0]["candle_time"] == row["stock_candles"][0]["candle_time"], "the close is read off the bar the score was taken on"
        facts = mb.build_facts(session["rows"], mb.THRESHOLDS, daily=True)
        assert facts is not None and facts.daily and facts.complete and facts.session.isoformat() == session["session"]
        assert len(facts.tickers) == len(session["rows"]), "every name is on the session and scored through to its close"
    assert len(ARTICLES) == 4 and all(article["synthetic"] for article in ARTICLES)


def test_a_read_case_reports_what_the_guard_did_and_how_fast_the_model_wrote():
    timed = chat(GOOD + " " + INVENTED, usage=(1250, 160), timings={"prompt_per_second": 38.0, "predicted_per_second": 3.4})
    case = mb.read_case(_target(), QUIET, env=ENV, post=Recorder(FakeResponse(payload=timed)))
    assert case["passed"] and case["reason"] == "ok" and case["target"] == "local:gemma-4-12b-qat" and case["case"] == "quiet"
    assert (case["sentences_written"], case["sentences_removed"]) == (6, 2)
    assert case["guard_categories"] == ["figure not in the facts for this subject", "ticker not in the facts"]
    assert case["tokens_per_second"] == 3.4 and case["prompt_tokens_per_second"] == 38.0 and case["output_tokens"] == 160
    assert case["kept_text"] == GOOD and case["text"].endswith(INVENTED)

    blocked = mb.read_case(_target(), QUIET, env=ENV, post=Recorder(FakeResponse(payload=chat(INVENTED))))
    assert not blocked["passed"] and blocked["sentences_removed"] == 2
    failed = mb.read_case(_target("groq:openai/gpt-oss-120b"), QUIET, env={}, post=Recorder(FakeResponse(payload=chat(GOOD))))
    assert failed == {"task": "read", "case": "quiet", "target": "groq:openai/gpt-oss-120b", "reason": "no_key", "seconds": 0.0, "input_tokens": 0, "output_tokens": 0, "tokens_per_second": None, "prompt_tokens_per_second": None, "passed": False}


def test_an_item_case_is_right_when_the_page_becomes_the_item_it_should_or_is_skipped_when_it_should_be():
    post = Recorder(FakeResponse(payload=chat(json.dumps(_answer()))))
    kept = mb.item_case(_target(), FUNDING, universe=["NVDA"], env=ENV, post=post)
    assert kept["passed"] and kept["outcome"] == "kept" and kept["json_valid"] and kept["item"]["desk"] == "venture"
    assert kept["desk_right"] is True
    assert post.calls[0]["json"]["response_format"]["type"] == "json_schema"

    # A true item filed under the wrong desk is still a true item: the two are counted apart, so
    # a model is not marked down on truth for a filing decision.
    wrong_desk = mb.item_case(_target(), FUNDING, universe=[], env=ENV, post=Recorder(FakeResponse(payload=chat(json.dumps(_answer(desk="news"))))))
    assert wrong_desk["outcome"] == "kept" and wrong_desk["passed"] and wrong_desk["desk_right"] is False
    wrong_listing = mb.item_case(_target(), FUNDING, universe=[], env=ENV, post=Recorder(FakeResponse(payload=chat(json.dumps(_answer(listed=True, ticker="LUMN", exchange="NASDAQ"))))))
    assert not wrong_listing["passed"], "a private company given a ticker is not the item the page called for"
    invented = mb.item_case(_target(), FUNDING, universe=[], env=ENV, post=Recorder(FakeResponse(payload=chat(json.dumps(_answer(lead="Lumen raises $3 billion."))))))
    assert invented["outcome"] == "removed" and not invented["passed"] and invented["guard_categories"] == ["figure not in source"]

    skipped = mb.item_case(_target(), ROUNDUP, universe=[], env=ENV, post=Recorder(FakeResponse(payload=chat('{"skip": true}'))))
    assert skipped["passed"] and skipped["outcome"] == "skipped"
    written = mb.item_case(_target(), ROUNDUP, universe=[], env=ENV, post=Recorder(FakeResponse(payload=chat(json.dumps(_answer())))))
    assert not written["passed"], "a roundup is not an item, whatever was written from it"
    garbled = mb.item_case(_target(), FUNDING, universe=[], env=ENV, post=Recorder(FakeResponse(payload=chat("not json"))))
    assert garbled["outcome"] == "unparsable" and not garbled["json_valid"] and not garbled["passed"]


def test_the_summary_is_one_row_per_model_and_the_log_carries_no_model_text(caplog):
    caplog.set_level(logging.INFO)
    targets = om.parse_chain("local:gemma-4-12b-qat,groq:openai/gpt-oss-120b")
    speed = {"predicted_per_second": 4.0}
    answers = [FakeResponse(payload=chat(GOOD, timings=speed))] * 3 + [FakeResponse(payload=chat('{"skip": true}', timings=speed))] * 4
    slept: list[float] = []
    results = mb.run(targets, SESSIONS, ARTICLES, pause=6, sleep=slept.append, env={}, post=Recorder(*answers))
    local, hosted = results["summary"]
    assert local["target"] == "local:gemma-4-12b-qat" and local["reads"] == 3 and local["items"] == 4
    assert local["reads_passed"] == 1, "the read was written for the quiet session; on the other two its figures are not in the facts"
    assert local["items_right"] == 1 and local["tokens_per_second"] == 4.0 and local["failures"] == []
    assert hosted["failures"] == ["no_key"] and hosted["reads_passed"] == 0 and hosted["tokens_per_second"] is None
    assert slept == [6] * 7, "hosted targets are paced; the model on this machine is not"
    assert results["targets"] == ["local:gemma-4-12b-qat", "groq:openai/gpt-oss-120b"] and len(results["cases"]) == 14
    assert results["prompt_versions"]["read"].startswith("market_read@")

    table = mb.render(results["summary"])
    assert "local:gemma-4-12b-qat | 1/3" in table and "no_key" in table
    for text in (table, caplog.text):
        assert "Cybersecurity" not in text and "PANW" not in text, "metrics only - the outputs live in the results file"


def test_the_results_are_saved_after_every_case_so_a_job_that_runs_out_of_time_still_leaves_them():
    saved: list[int] = []
    post = Recorder(FakeResponse(payload=chat(GOOD)))
    mb.run(om.parse_chain("local:gemma-4-12b-qat"), SESSIONS, ARTICLES, pause=0, checkpoint=lambda results: saved.append(len(results["cases"])), env={}, post=post)
    assert saved == [1, 2, 3, 4, 5, 6, 7]


def test_main_writes_the_results_file_and_its_exit_code_says_whether_anything_was_measured(monkeypatch, tmp_path, capsys):
    monkeypatch.delenv("BAKEOFF_TARGETS", raising=False)
    assert mb.main() == 2, "no target, nothing to measure"

    out = tmp_path / "results.json"
    monkeypatch.setenv("BAKEOFF_TARGETS", "local:gemma-4-12b-qat")
    monkeypatch.setenv("BAKEOFF_RESULTS", str(out))
    monkeypatch.setattr(om.requests, "post", Recorder(FakeResponse(payload=chat(GOOD))))
    assert mb.main() == 0
    stored = json.loads(out.read_text(encoding="utf-8"))
    assert stored["summary"][0]["reads"] == 3 and stored["cases"][0]["text"] == GOOD
    assert "local:gemma-4-12b-qat" in capsys.readouterr().out

    monkeypatch.setattr(om.requests, "post", Recorder(FakeResponse(status=503)))
    assert mb.main() == 1, "every call failed: the run measured nothing and must not look green"


@pytest.mark.parametrize("workflow_target", ["groq:openai/gpt-oss-120b", "groq:qwen/qwen3.8-27b", "groq:openai/gpt-oss-20b", "cloudflare:@cf/google/gemma-4-26b-a4b-it", "cloudflare:@cf/openai/gpt-oss-120b"])
def test_every_hosted_target_the_workflow_names_parses(workflow_target):
    workflow = (mb.FIXTURE_DIR.parents[2] / ".github" / "workflows" / "model-bakeoff.yml").read_text(encoding="utf-8")
    assert workflow_target in workflow
    assert [target.spec for target in om.parse_chain(workflow_target)] == [workflow_target]
