"""Which open model should write Lyra's updates? Measure it before deciding.

    BAKEOFF_TARGETS="local:gemma-4-12b-qat" python -m workers.stock_scanner.model_bakeoff

Runs from `.github/workflows/model-bakeoff.yml` (manual dispatch only). The founder asked on
2026-11-06 for Lyra's updates to be written by open-source models at no cost. Two questions decide
how: which free hosted model writes best, and whether a model small enough to run on a GitHub
runner (16 GB, no GPU) is good enough - and fast enough - to be the floor that depends on nobody's
free allowance. Neither is a matter of opinion, so this job measures both on Lyra's real tasks:

  * THE READ. Three real sessions (a broad rally, a sharp sell-off, a quiet day - public daily
    bars scored by Lyra's own engine, in tests/fixtures/bakeoff) go through the production path:
    `build_facts` -> `build_sheet` -> the market-read prompt -> `guard_ai_read`. What counts is
    whether the read survives the guard and how much of it the guard had to delete.
  * THE BRIEFING ITEM. Four synthetic pages (a contract, results with an analyst's "buy" quote
    planted in them, a weekly roundup, a private funding round) go through `write_item` and the
    same `check_item` the briefing uses. What counts is whether figures are copied exactly, the
    advice is left out, the roundup is skipped, and nothing private is given a ticker.
  * SPEED. Seconds per answer and tokens a second, from the server's own timings where it gives
    them. A read that takes forty minutes is not a floor.

The fixtures are public market data and invented articles - no holdings, no users - so the full
outputs go into the results file (uploaded as an artifact) for a person to read and grade. The log
still prints metrics only: that is this repository's rule for every worker, and a habit worth
keeping where it costs nothing.
"""
from __future__ import annotations

import json
import os
import platform
import sys
import time
from pathlib import Path
from types import SimpleNamespace
from typing import Any

from workers.stock_scanner.ai_read_guard import guard_ai_read, split_paragraphs, split_sentences
from workers.stock_scanner.daily_read import READ_REQUEST, build_facts, build_sheet
from workers.stock_scanner.free_briefing import (
    ITEM_PROMPT,
    ITEM_SCHEMA,
    MAX_OUTPUT_TOKENS as ITEM_OUTPUT_TOKENS,
    PROMPT_VERSION as ITEM_PROMPT_VERSION,
    Article,
    article_window,
    item_brief,
    item_from_answer,
)
from workers.stock_scanner.free_read import MARKET_READ_PROMPT, MAX_OUTPUT_TOKENS as READ_OUTPUT_TOKENS, PROMPT_VERSION as READ_PROMPT_VERSION
from workers.stock_scanner.logger import get_logger
from workers.stock_scanner.open_model import Completion, Target, complete, parse_chain, parse_json_object

LOGGER = get_logger("stock_scanner.model_bakeoff")

FIXTURE_DIR = Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "bakeoff"
TARGETS_ENV = "BAKEOFF_TARGETS"
RESULTS_ENV = "BAKEOFF_RESULTS"
PAUSE_ENV = "BAKEOFF_PAUSE_SECONDS"
DEFAULT_RESULTS = "bakeoff-results.json"
DEFAULT_PAUSE = 6.0  # between calls to a hosted target: a free tier's per-minute token limit is small
RATE_LIMIT_WAIT = 65.0
# The engine's thresholds, as the no-account app applies them (src/lib/live-signals.ts).
THRESHOLDS = SimpleNamespace(alert_score_threshold=75, watchlist_score_threshold=60)


def load_fixtures(directory: Path = FIXTURE_DIR) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    sessions = [json.loads(path.read_text(encoding="utf-8")) for path in sorted(directory.glob("session-*.json"))]
    articles = [json.loads(path.read_text(encoding="utf-8")) for path in sorted(directory.glob("article-*.json"))]
    return sessions, articles


def _speed(completion: Completion) -> dict[str, Any]:
    rate = completion.tokens_per_second
    prompt_rate = completion.timings.get("prompt_per_second")
    return {
        "reason": completion.reason,
        "seconds": round(completion.seconds, 1),
        "input_tokens": completion.input_tokens,
        "output_tokens": completion.output_tokens,
        "tokens_per_second": round(rate, 2) if rate else None,
        "prompt_tokens_per_second": round(float(prompt_rate), 1) if prompt_rate else None,
    }


def read_case(target: Target, fixture: dict[str, Any], **call: Any) -> dict[str, Any]:
    """One session through the production read path with one model."""
    facts = build_facts(fixture["rows"], THRESHOLDS, daily=True)
    case: dict[str, Any] = {"task": "read", "case": fixture["label"], "target": target.spec}
    if facts is None:
        return {**case, "reason": "no_facts", "passed": False}
    sheet = build_sheet(facts)
    completion = complete(target, system=MARKET_READ_PROMPT, user=READ_REQUEST.format(facts=sheet.text), max_tokens=READ_OUTPUT_TOKENS, **call)
    case.update(_speed(completion))
    if not completion.ok:
        return {**case, "passed": False}
    text = completion.text or ""
    verdict = guard_ai_read(text, sheet)
    written = sum(len(split_sentences(paragraph)) for paragraph in split_paragraphs(text))
    return {
        **case,
        "passed": verdict.ok,
        "sentences_written": written,
        "sentences_removed": len(verdict.removed),
        "guard_categories": sorted(set(verdict.categories)),
        "text": text,
        "kept_text": verdict.text,
        "removed_text": verdict.removed,
    }


def item_case(target: Target, fixture: dict[str, Any], *, universe: list[str], **call: Any) -> dict[str, Any]:
    """One page through the item-writing path with one model."""
    expect = fixture.get("expect") or {}
    article = Article(
        url=fixture["url"],
        final_url=fixture.get("final_url") or fixture["url"],
        title=fixture.get("title", ""),
        text=article_window(fixture["text"]),
        source=fixture.get("source", ""),
    )
    completion = complete(
        target,
        system=ITEM_PROMPT,
        user=item_brief(article, universe),
        max_tokens=ITEM_OUTPUT_TOKENS,
        temperature=0.2,
        schema=ITEM_SCHEMA,
        schema_name="briefing_item",
        **call,
    )
    case: dict[str, Any] = {"task": "item", "case": fixture["label"], "target": target.spec, **_speed(completion)}
    if not completion.ok:
        return {**case, "outcome": completion.reason, "passed": False}
    answer = parse_json_object(completion.text)
    outcome = item_from_answer(answer, article, covered=set(), universe=set(universe))
    should_skip = bool(expect.get("skip"))
    if should_skip:
        passed = outcome.outcome == "skipped"
    else:
        item = outcome.item
        passed = (
            item is not None
            and ("listed" not in expect or item.listed is bool(expect["listed"]))
            and ("ticker" not in expect or item.ticker == expect["ticker"])
            and ("desk" not in expect or item.desk == expect["desk"])
        )
    return {
        **case,
        "outcome": outcome.outcome,
        "passed": passed,
        "json_valid": answer is not None,
        "guard_categories": outcome.categories,
        "item": outcome.item.to_dict() if outcome.item else None,
        "text": completion.text,
    }


def summarise(cases: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """One row per model: how often its work could be published, and how fast it wrote."""
    rows: list[dict[str, Any]] = []
    for spec in dict.fromkeys(case["target"] for case in cases):
        own = [case for case in cases if case["target"] == spec]
        reads = [case for case in own if case["task"] == "read"]
        items = [case for case in own if case["task"] == "item"]
        answered = [case for case in own if case.get("reason") == "ok"]
        speeds = [case["tokens_per_second"] for case in answered if case.get("tokens_per_second")]
        read_seconds = [case["seconds"] for case in reads if case.get("reason") == "ok"]
        written = sum(case.get("sentences_written", 0) for case in reads)
        rows.append(
            {
                "target": spec,
                "reads_passed": sum(1 for case in reads if case.get("passed")),
                "reads": len(reads),
                "sentences_removed": sum(case.get("sentences_removed", 0) for case in reads),
                "sentences_written": written,
                "items_right": sum(1 for case in items if case.get("passed")),
                "items": len(items),
                "items_unparsable": sum(1 for case in items if case.get("outcome") == "unparsable"),
                "tokens_per_second": round(sum(speeds) / len(speeds), 2) if speeds else None,
                "seconds_per_read": round(sum(read_seconds) / len(read_seconds), 1) if read_seconds else None,
                "failures": sorted({case["reason"] for case in own if case.get("reason") not in (None, "ok")}),
            }
        )
    return rows


def render(summary: list[dict[str, Any]]) -> str:
    """The table for the log - numbers only."""
    lines = ["target | reads passed | sentences cut | items right | unparsable | tokens/s | s per read | failures"]
    for row in summary:
        lines.append(
            " | ".join(
                [
                    row["target"],
                    f"{row['reads_passed']}/{row['reads']}",
                    f"{row['sentences_removed']}/{row['sentences_written']}",
                    f"{row['items_right']}/{row['items']}",
                    str(row["items_unparsable"]),
                    "-" if row["tokens_per_second"] is None else f"{row['tokens_per_second']:.1f}",
                    "-" if row["seconds_per_read"] is None else f"{row['seconds_per_read']:.0f}",
                    ", ".join(row["failures"]) or "-",
                ]
            )
        )
    return "\n".join(lines)


def run(
    targets: list[Target],
    sessions: list[dict[str, Any]],
    articles: list[dict[str, Any]],
    *,
    pause: float = DEFAULT_PAUSE,
    sleep: Any = time.sleep,
    checkpoint: Any = None,
    **call: Any,
) -> dict[str, Any]:
    """Every target over every fixture. `checkpoint(results)` is called after each case, so a job
    that runs out of time still leaves the cases it finished."""
    universe = sorted({row["symbol"] for session in sessions for row in session.get("rows", [])})
    cases: list[dict[str, Any]] = []

    def results() -> dict[str, Any]:
        return {
            "runner": {"machine": platform.machine(), "cpus": os.cpu_count()},
            "prompt_versions": {"read": READ_PROMPT_VERSION, "item": ITEM_PROMPT_VERSION},
            "targets": [target.spec for target in targets],
            "summary": summarise(cases),
            "cases": cases,
        }

    for target in targets:
        hosted = target.provider.name != "local"
        for task, fixtures in (("read", sessions), ("item", articles)):
            for fixture in fixtures:
                options = {"rate_limit_wait": RATE_LIMIT_WAIT if hosted else 0.0, **call}
                case = read_case(target, fixture, **options) if task == "read" else item_case(target, fixture, universe=universe, **options)
                cases.append(case)
                LOGGER.info(
                    "bake-off %s %s %s: %s, passed=%s, %.0fs", target.spec, task, fixture["label"], case.get("reason"), case.get("passed"), case.get("seconds") or 0
                )
                if checkpoint is not None:
                    checkpoint(results())
                if hosted and pause > 0:
                    sleep(pause)
    return results()


def main() -> int:
    targets = parse_chain(os.environ.get(TARGETS_ENV))
    if not targets:
        LOGGER.error("%s names no usable target - nothing to measure", TARGETS_ENV)
        return 2
    sessions, articles = load_fixtures()
    if not sessions or not articles:
        LOGGER.error("the bake-off fixtures are missing from %s", FIXTURE_DIR.name)
        return 2
    try:
        pause = float(os.environ.get(PAUSE_ENV, DEFAULT_PAUSE))
    except ValueError:
        pause = DEFAULT_PAUSE
    out = Path(os.environ.get(RESULTS_ENV) or DEFAULT_RESULTS)

    def save(results: dict[str, Any]) -> None:
        out.write_text(json.dumps(results, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    results = run(targets, sessions, articles, pause=pause, checkpoint=save)
    save(results)
    print(render(results["summary"]))
    # A run in which no model answered anything measured nothing: say so with the exit code.
    return 0 if any(case.get("reason") == "ok" for case in results["cases"]) else 1


if __name__ == "__main__":
    sys.exit(main())
