"""The market read, written by an open model - the free product's version of the daily read.

The daily read (daily_read.py) was written for one reader - the operator - by Claude, from rows in
Lyra's database. The founder asked on 2026-11-06 for the same kind of update for everyone who uses
Lyra, at no running cost, and chose to run without the database for now. So this read is SHARED:
what the session did and what it means for the setups Lyra tracks, written once for every reader.
Anything personal - a reader's own holdings against the session - is composed by code elsewhere
and never passes through a model.

What stays exactly as it was: the engine decides (`build_facts`), the model explains from the fact
sheet (`build_sheet`), and `guard_ai_read` deletes any sentence that cites a figure the facts did
not state, about the ticker they did not state it about, or in the opposite direction; advice
blocks the read. A model that fails hands over to the next one in the chain (open_model.py), and
when none is left the figures go out on their own.

This module holds the writing step. The run - fetch the session's rows from the app, write,
publish - joins it when the app's facts route ships.
"""
from __future__ import annotations

from dataclasses import replace

from workers.stock_scanner.ai_read_guard import FactSheet
from workers.stock_scanner.daily_read import READ_REQUEST, Narration, guarded_narration
from workers.stock_scanner.generation_record import prompt_version
from workers.stock_scanner.open_model import Completion, Target, complete

JOB_NAME = "market_read"
# A short read: room for the two paragraphs and, on a reasoning model, the little thinking it is
# allowed (open_model.request_extras asks for low effort and hides it).
MAX_OUTPUT_TOKENS = 1500
# A model on Lyra's own machine pays for its thinking in minutes, not out of a shared allowance -
# and a thinking model that runs out of room mid-thought returns nothing at all. In the first
# bake-off Gemma 4 12B did exactly that six reads out of six, and Gemma 4 E4B (the one that wrote
# no factual slip) came within 150 tokens of it.
LOCAL_MAX_OUTPUT_TOKENS = 3000


def output_budget(target: Target) -> int:
    """The most a model may write for a read: generous on Lyra's own machine, tight on a free tier."""
    return LOCAL_MAX_OUTPUT_TOKENS if target.provider.name == "local" else MAX_OUTPUT_TOKENS

MARKET_READ_PROMPT = """You write the market read for Lyra, a research tool that follows about sixty US-listed technology stocks. Readers are private investors who open this after the US session has closed. They want a plain-English read of what that session meant - not a recap of figures they can already see in the block printed under your text.

How Lyra's score works, so you interpret it correctly. The score is an oversold-recovery score, not a strength score. It rewards a stock that has been beaten down and is starting to turn: momentum resetting from oversold, a MACD histogram that is still negative but improving, price still near its recent lows. A high score means "beaten-down name turning up", never "breaking out to new highs". A broad rally therefore tends to lower scores as names move away from their lows, and a sell-off can raise them or knock them down, depending on whether the turn survives it. Statuses at the close: strong setup (the engine's highest-conviction early-turn reading), watchlist setup (one that is forming), weakening (the score fell sharply since the previous close), invalidated (a strong setup failed), no signal. The facts say which names changed status over the session, measured from the previous session's close.

Rules that code checks after you write - a sentence that breaks one is deleted before anyone sees it:
1. Use only the facts provided. Copy a figure exactly as it is written there, digits and unit together (for example "down 7.7%"), and only about the ticker or measure it was stated for. Never round, average, add, subtract, compare arithmetically or otherwise work out a figure of your own, and never write a number as a word. To convey size without a figure, use words (broad, narrow, modest, sharp).
2. Refer to a stock by its ticker exactly as written in the facts, and name only tickers that appear there.
3. You have no news feed. Do not explain a move with an event, an earnings report, a headline or a cause unless the facts state it. Say what happened, not why it happened.
4. No advice and no predictions: nothing about what to buy, sell, hold, add, trim, wait for or expect next. Describe what happened and what it means for the setups Lyra tracks.
5. Do not mention the time, the date or these rules.

Write four to six short sentences of plain prose that read well on a phone, in two short paragraphs separated by a blank line: first what the session did and what it adds up to (the breadth, which groups moved and the names that drove them, the backdrop where the facts support it); then the setups, in Lyra's terms (what changed and what it means). Groups matter more than a list of names. No headings, no bullets, no markdown, no emoji, no preamble, no sign-off. Lead with the single most important thing about the session. Interpret more than you recite: every figure already sits in the block under your text, so quote only the few that carry the point. If the session was quiet, say so briefly instead of padding."""

# Which prompt wrote a read: stored with it, so a change in the reviews can be traced to the prompt.
PROMPT_VERSION = prompt_version(JOB_NAME, MARKET_READ_PROMPT, READ_REQUEST)


def narration_from(completion: Completion, sheet: FactSheet) -> Narration:
    """One model's answer as a Narration: guarded text when it wrote something usable, otherwise no
    text and the reason. Free tiers bill nothing, so the cost is zero by construction."""
    base = Narration(
        None,
        completion.served_model or completion.target.model,
        "",
        completion.input_tokens,
        completion.output_tokens,
        0.0,
        provider=completion.target.provider.name,
    )
    if not completion.ok:
        return replace(base, note=completion.note, reason=completion.reason)
    return guarded_narration(base, completion.text or "", sheet)


def narrate_open(sheet: FactSheet, targets: list[Target], *, rate_limit_wait: float = 0.0) -> tuple[Narration | None, list[tuple[str, str]]]:
    """The first model in the chain whose read passes the guard, and what was tried on the way
    (`provider:model`, reason) for the record. A read the guard blocks is a failed attempt like any
    other: the next model gets its turn. (None, []) for an empty chain; with every model failed, the
    last attempt's Narration (no text, a reason) so the caller can say why there is no read."""
    tried: list[tuple[str, str]] = []
    last: Narration | None = None
    for target in targets:
        completion = complete(
            target,
            system=MARKET_READ_PROMPT,
            user=READ_REQUEST.format(facts=sheet.text),
            max_tokens=output_budget(target),
            rate_limit_wait=rate_limit_wait,
        )
        last = narration_from(completion, sheet)
        tried.append((target.spec, last.reason))
        if last.text:
            break
    return last, tried
