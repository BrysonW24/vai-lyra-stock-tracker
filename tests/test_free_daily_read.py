"""The free market read end to end on the runner's side: facts from the app, prose from a model if
one passes the guard, figures from code in every case, and one signed publish - or a plain reason
why not. The app's own checks on what arrives are tested in src/app/api/updates/publish."""
from __future__ import annotations

import json
import logging
from pathlib import Path

import pytest

import workers.stock_scanner.daily_read as dr
import workers.stock_scanner.free_daily_read as fdr
import workers.stock_scanner.open_model as om
from workers.stock_scanner.app_client import AppError, Facts

CONTRACTS = Path(__file__).resolve().parents[1] / "contracts" / "updates"
FIXTURE = json.loads((CONTRACTS / "facts-fixture.json").read_text(encoding="utf-8"))
FACTS = Facts(session=FIXTURE["session"], rows=FIXTURE["rows"], hash=FIXTURE["hash"], listed=FIXTURE["listed"], published=False)
CHAIN = om.parse_chain("groq:openai/gpt-oss-120b,local:gemma-4-e4b-qat")
PROSE = "A split session: AMD became a strong setup while CRM dropped out of strong setup.\n\nNVDA joined the watchlist on 1.8x its usual volume."


def _facts():
    return dr.build_facts(FACTS.rows, fdr.THRESHOLDS, daily=True)


def _narration(text, *, reason="ok", provider="groq", model="openai/gpt-oss-120b"):
    return dr.Narration(text=text, model=model, effort="", reason=reason, provider=provider)


def _writer(narration, tried):
    """A stand-in for narrate_open that records the sheet it was handed."""

    def narrate_open(sheet, chain, **_):
        narrate_open.calls.append((sheet, chain))
        return narration, tried

    narrate_open.calls = []
    return narrate_open


# --- the figures ---------------------------------------------------------------------------------


def test_figure_blocks_turn_the_telegram_html_sections_into_titled_plain_lines():
    sections = ["<b>The session</b>\n1 up, 7 down &amp; 0 flat\n<i>Breadth</i> was poor", "<b>Setups</b>\n\n2 strong", "", "<b>Only a title</b>"]
    assert fdr.figure_blocks(sections) == [
        {"title": "The session", "lines": ["1 up, 7 down & 0 flat", "Breadth was poor"]},
        {"title": "Setups", "lines": ["2 strong"]},
        {"title": "Only a title", "lines": []},
    ]


def test_the_figures_for_the_apps_facts_are_code_composed_and_name_the_transitions():
    blocks = fdr.figure_blocks(dr.figure_sections(_facts()))
    assert blocks and all(block["title"] and isinstance(block["lines"], list) for block in blocks)
    joined = " ".join(line for block in blocks for line in [block["title"], *block["lines"]])
    assert "AMD" in joined and "CRM" in joined and "<" not in joined


# --- compose_read --------------------------------------------------------------------------------


def test_compose_read_sends_the_app_everything_it_checks_with_the_prose_and_its_writer(monkeypatch):
    writer = _writer(_narration(PROSE), [("groq:openai/gpt-oss-120b", "ok")])
    monkeypatch.setattr(fdr, "narrate_open", writer)
    read, tried = fdr.compose_read(_facts(), FACTS.session, FACTS.hash, CHAIN, rehearsal=False, replace=False)
    assert tried == [("groq:openai/gpt-oss-120b", "ok")]
    assert set(read) == {"kind", "session", "factsHash", "sheet", "figures", "prose", "proseNote", "writer", "rehearsal", "replace"}
    assert (read["kind"], read["session"], read["factsHash"]) == ("market_read", "2026-11-05", FIXTURE["hash"])
    assert read["prose"] == PROSE and read["proseNote"] is None
    assert read["writer"] == {"provider": "groq", "model": "openai/gpt-oss-120b"}
    assert read["rehearsal"] is False and read["replace"] is False
    # The sheet the app re-checks the prose against is the one the model was given.
    (handed_sheet, handed_chain), = writer.calls
    assert read["sheet"] == handed_sheet.text and handed_chain == CHAIN
    assert read["figures"] == fdr.figure_blocks(dr.figure_sections(_facts()))


def test_compose_read_says_why_there_is_no_prose_when_every_model_was_stopped_by_the_guard(monkeypatch):
    monkeypatch.setattr(fdr, "narrate_open", _writer(_narration(None, reason="guard_blocked", provider="local", model="gemma-4-e4b-qat"), [("groq:openai/gpt-oss-120b", "guard_blocked"), ("local:gemma-4-e4b-qat", "guard_blocked")]))
    read, tried = fdr.compose_read(_facts(), FACTS.session, FACTS.hash, CHAIN, rehearsal=True, replace=False)
    assert len(tried) == 2
    assert read["prose"] is None and read["writer"] is None and read["proseNote"] == fdr.GUARD_NOTE
    assert read["rehearsal"] is True and read["figures"], "the figures publish whatever happened to the prose"


def test_compose_read_says_no_model_could_write_when_none_answered_or_the_chain_is_empty(monkeypatch):
    monkeypatch.setattr(fdr, "narrate_open", _writer(_narration(None, reason="unavailable"), [("groq:openai/gpt-oss-120b", "unavailable")]))
    read, _ = fdr.compose_read(_facts(), FACTS.session, FACTS.hash, CHAIN, rehearsal=False, replace=True)
    assert read["prose"] is None and read["proseNote"] == fdr.NO_MODEL_NOTE and read["replace"] is True

    def never(*_args, **_kwargs):
        raise AssertionError("no model is asked when the chain is empty")

    monkeypatch.setattr(fdr, "narrate_open", never)
    read, tried = fdr.compose_read(_facts(), FACTS.session, FACTS.hash, [], rehearsal=False, replace=False)
    assert tried == [] and read["prose"] is None and read["proseNote"] == fdr.NO_MODEL_NOTE


def test_an_empty_answer_counts_as_no_prose(monkeypatch):
    monkeypatch.setattr(fdr, "narrate_open", _writer(_narration(""), [("groq:openai/gpt-oss-120b", "ok")]))
    read, _ = fdr.compose_read(_facts(), FACTS.session, FACTS.hash, CHAIN, rehearsal=False, replace=False)
    assert read["prose"] is None and read["writer"] is None and read["proseNote"] == fdr.NO_MODEL_NOTE


# --- main ----------------------------------------------------------------------------------------


class Published:
    def __init__(self, answer=None, error=None):
        self.answer, self.error, self.calls = answer or {"ok": True, "session": "2026-11-05", "prose": True, "rehearsal": False}, error, []

    def __call__(self, base_url, secret, read):
        self.calls.append((base_url, secret, read))
        if self.error:
            raise self.error
        return self.answer


def _run(monkeypatch, *, facts=FACTS, fetch_error=None, publish=None, env=None):
    for name in ("LYRA_APP_URL", "UPDATES_PUBLISH_SECRET", "OPEN_MODEL_CHAIN", "FREE_READ_REHEARSAL", "FREE_READ_REPLACE"):
        monkeypatch.delenv(name, raising=False)
    for name, value in (env or {}).items():
        monkeypatch.setenv(name, value)

    def fetch_facts(base_url):
        fetch_facts.urls.append(base_url)
        if fetch_error:
            raise fetch_error
        return facts

    fetch_facts.urls = []
    monkeypatch.setattr(fdr, "fetch_facts", fetch_facts)
    publish = publish or Published()
    monkeypatch.setattr(fdr, "publish", publish)
    monkeypatch.setattr(fdr, "narrate_open", _writer(_narration(PROSE, provider="local", model="gemma-4-e4b-qat"), [("local:gemma-4-e4b-qat", "ok")]))
    code = fdr.main()
    return code, fetch_facts, publish


def test_main_publishes_one_read_for_the_session_with_lyras_own_model_by_default(monkeypatch, caplog):
    caplog.set_level(logging.INFO)
    code, fetch, published = _run(monkeypatch, env={"UPDATES_PUBLISH_SECRET": "s" * 40})
    assert code == 0
    assert fetch.urls == [fdr.DEFAULT_APP_URL]
    ((base_url, secret, read),) = published.calls
    assert (base_url, secret) == (fdr.DEFAULT_APP_URL, "s" * 40)
    assert read["session"] == "2026-11-05" and read["factsHash"] == FIXTURE["hash"] and read["prose"] == PROSE
    assert read["writer"] == {"provider": "local", "model": "gemma-4-e4b-qat"}
    assert read["rehearsal"] is False and read["replace"] is False
    # The log carries counts and labels only.
    text = caplog.text
    assert "published for session 2026-11-05" in text and "8 rows of 10 listed" in text
    assert PROSE.split("\n")[0] not in text and FIXTURE["hash"] not in text and fdr.DEFAULT_APP_URL not in text


def test_main_honours_the_app_url_the_chain_the_rehearsal_and_replace_flags(monkeypatch):
    code, fetch, published = _run(
        monkeypatch,
        env={"UPDATES_PUBLISH_SECRET": "s" * 40, "LYRA_APP_URL": "https://preview.example/", "OPEN_MODEL_CHAIN": "groq:openai/gpt-oss-120b", "FREE_READ_REHEARSAL": "1", "FREE_READ_REPLACE": "1"},
    )
    assert code == 0 and fetch.urls == ["https://preview.example/"]
    ((base_url, _secret, read),) = published.calls
    assert base_url == "https://preview.example/" and read["rehearsal"] is True and read["replace"] is True
    (_sheet, chain), = fdr.narrate_open.calls
    assert [f"{t.provider.name}:{t.model}" for t in chain] == ["groq:openai/gpt-oss-120b"]


def test_main_does_nothing_when_the_session_already_has_its_read(monkeypatch):
    already = Facts(session=FACTS.session, rows=FACTS.rows, hash=FACTS.hash, listed=FACTS.listed, published=True)
    code, _fetch, published = _run(monkeypatch, facts=already, env={"UPDATES_PUBLISH_SECRET": "s" * 40})
    assert code == 0 and published.calls == []
    # ...unless it is a rehearsal, or a replacement was asked for.
    code, _fetch, published = _run(monkeypatch, facts=already, env={"UPDATES_PUBLISH_SECRET": "s" * 40, "FREE_READ_REHEARSAL": "1"})
    assert code == 0 and len(published.calls) == 1 and published.calls[0][2]["rehearsal"] is True
    code, _fetch, published = _run(monkeypatch, facts=already, env={"UPDATES_PUBLISH_SECRET": "s" * 40, "FREE_READ_REPLACE": "1"})
    assert code == 0 and len(published.calls) == 1 and published.calls[0][2]["replace"] is True


def test_check_mode_tells_the_workflow_whether_a_read_is_needed_and_writes_nothing(monkeypatch, tmp_path):
    output = tmp_path / "github-output"
    output.write_text("earlier=1\n", encoding="utf-8")
    monkeypatch.setenv("GITHUB_OUTPUT", str(output))
    code, _fetch, published = _run(monkeypatch, env={"UPDATES_PUBLISH_SECRET": "s" * 40, "FREE_READ_CHECK": "1"})
    assert code == 0 and published.calls == [] and fdr.narrate_open.calls == []
    assert output.read_text(encoding="utf-8") == "earlier=1\nneeded=true\nsession=2026-11-05\n"

    output.write_text("", encoding="utf-8")
    already = Facts(session=FACTS.session, rows=FACTS.rows, hash=FACTS.hash, listed=FACTS.listed, published=True)
    code, _fetch, published = _run(monkeypatch, facts=already, env={"UPDATES_PUBLISH_SECRET": "s" * 40, "FREE_READ_CHECK": "1"})
    assert code == 0 and published.calls == []
    assert output.read_text(encoding="utf-8") == "needed=false\nsession=2026-11-05\n"
    # A rehearsal or a replacement is always needed.
    output.write_text("", encoding="utf-8")
    _run(monkeypatch, facts=already, env={"UPDATES_PUBLISH_SECRET": "s" * 40, "FREE_READ_CHECK": "1", "FREE_READ_REHEARSAL": "1"})
    assert "needed=true" in output.read_text(encoding="utf-8")


def test_check_mode_still_needs_the_secret_and_still_fails_when_the_app_refuses(monkeypatch):
    monkeypatch.delenv("GITHUB_OUTPUT", raising=False)
    code, fetch, _published = _run(monkeypatch, env={"FREE_READ_CHECK": "1"})
    assert code == 2 and fetch.urls == []
    code, _fetch, _published = _run(monkeypatch, fetch_error=AppError("no_prices", 503), env={"UPDATES_PUBLISH_SECRET": "s" * 40, "FREE_READ_CHECK": "1"})
    assert code == 1


def test_write_outputs_is_a_no_op_outside_actions(tmp_path):
    fdr.write_outputs({"needed": "true"}, None)
    target = tmp_path / "out"
    fdr.write_outputs({"needed": "true", "session": "2026-11-05"}, str(target))
    assert target.read_text(encoding="utf-8") == "needed=true\nsession=2026-11-05\n"


def test_main_refuses_to_run_without_the_publish_secret(monkeypatch, caplog):
    caplog.set_level(logging.ERROR)
    code, fetch, published = _run(monkeypatch, env={})
    assert code == 2 and fetch.urls == [] and published.calls == []
    assert "UPDATES_PUBLISH_SECRET is not set" in caplog.text


def test_main_reports_the_apps_reason_and_fails_when_the_facts_or_the_publish_are_refused(monkeypatch, caplog):
    caplog.set_level(logging.ERROR)
    code, _fetch, published = _run(monkeypatch, fetch_error=AppError("thin", 503), env={"UPDATES_PUBLISH_SECRET": "s" * 40})
    assert code == 1 and published.calls == [] and "did not serve the facts: thin (status 503)" in caplog.text

    caplog.clear()
    code, _fetch, published = _run(monkeypatch, publish=Published(error=AppError("facts_mismatch", 409)), env={"UPDATES_PUBLISH_SECRET": "s" * 40})
    assert code == 1 and len(published.calls) == 1 and "refused the read: facts_mismatch (status 409)" in caplog.text


def test_main_fails_when_the_rows_do_not_make_a_session(monkeypatch, caplog):
    caplog.set_level(logging.ERROR)
    empty = Facts(session="2026-11-05", rows=[{"symbol": "NVDA", "category": "ai_infrastructure", "stock_signals": [], "stock_candles": []}], hash=FACTS.hash, listed=10, published=False)
    code, _fetch, published = _run(monkeypatch, facts=empty, env={"UPDATES_PUBLISH_SECRET": "s" * 40})
    assert code == 1 and published.calls == [] and "did not make a session" in caplog.text


def test_the_default_chain_is_lyras_own_model_and_parses():
    (target,) = om.parse_chain(fdr.DEFAULT_CHAIN)
    assert target.provider.name == "local" and target.model == "gemma-4-e4b-qat"
    assert fdr.DEFAULT_APP_URL.startswith("https://") and not fdr.DEFAULT_APP_URL.endswith("/")
