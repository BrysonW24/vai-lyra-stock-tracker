# Lyra Forward Bets - Two Prophecies Worth Building

> Date: 2026-06-18
> Status: Strategy / prophecy. Forward-looking, not committed scope. No metrics here are real - they are illustrative.
> Author: founder dogfooding session.

Lyra today is a research-first, deterministic oversold-recovery console: the worker owns every number (RSI, MACD histogram, score, lifecycle state, watchlist triggers, portfolio overlays), the dark command-centre renders them dense and live, and the AI copilot only explains what is already on the screen - it never invents a value and never gives advice. This doc prophesises two bets that would make Lyra feel like a remarkable, alive product without ever breaking that contract. Bet 1 makes the screen itself responsive to the moment. Bet 2 makes the app ask, like a real app would, whether it actually helped.

The thread tying both together: the deterministic engine stays the source of truth, and we use the AI plus a thin loop of human signal to make the experience feel composed-for-you rather than fixed-for-everyone.

---

## Bet 1 - Generative UI ("GenUI") on the spot

### Vision

A strong oversold-recovery setup fires on a ticker - say RSI back in the 38-46 reset band, MACD histogram still negative but turning up, price within 8% of its 60-period low, score jumping. Instead of the user having to mentally assemble what that means against their own position, Lyra surfaces a quiet inline prompt right where the signal lives:

> "Want to see what this could look like?"

One tap, and Lyra composes a bespoke view on the spot inside the command centre - tailored to that signal and to this user's context (their cash available, max position size, risk comfort, whether they already hold it). Not a generic ticker page. A view built for this signal, for this person, in this moment: the recovery-window score-heat bars, the MACD-turn histogram, a short grounded narrative of what is and is not confirming, and - because the engine knows the user's `cashAvailable` and `maxPositionSizePct` - a framing of where this sits relative to their constraints, described as research, never as a recommendation.

### Why it matters

Today's dashboard is dense and excellent, but it is fixed. Every user sees the same panels in the same order, and the work of "what does this mean for me, right now" happens in the user's head. That is the gap between a tool and a copilot.

GenUI closes it without diluting the density that makes Lyra feel like a terminal:

- The dashboard stays the calm, deterministic home. GenUI is additive - a composed answer to a specific moment, not a replacement for the standing layout.
- It turns a signal from a number into a briefing. The user sees the same numbers they trust, arranged to answer the question the signal raises.
- It is personal in the way that matters: the layout and emphasis adapt to whether the user holds the name, has cash to deploy, and leans conservative or aggressive - all data Lyra already has in `operator_profiles` and consolidates in `buildConstraintsBlock` / `buildGrounding`.

This is the difference between "here is a chart" and "here is what this turn looks like for you" - and it is the kind of thing that makes someone show the app to a friend.

### How it works (grounded in what exists)

The hard constraint that makes this safe and credible, and the only one that matters: **the deterministic engine owns every number; the AI generates only the presentation - layout, emphasis, ordering, narrative. The AI never produces a value.**

This is not a new principle bolted on. It is the existing Lyra contract (`CLAUDE.md`: "AI explains; the deterministic engine decides. The AI never invents a number") extended from prose to pixels. Three mechanisms already in the codebase make it enforceable rather than aspirational:

1. **The numbers come pre-computed, not generated.** `buildGrounding(data, now)` in `chat-context.ts` already assembles the user's holdings, watchlist, top signals, prime setups and catalysts into a compact deterministic snapshot. A GenUI view is fed from exactly this snapshot. The AI is handed the data; it does not fetch or compute it.

2. **The model emits a spec, not values.** The agent layer already produces strict, schema-validated structured output - `AGENT_REGISTRY` defines `.strict()` Zod output schemas, and `validateAgentOutput` rejects any payload whose shape drifts (the comment notes that order-shaped fields injected into a `trade_readiness` payload fail at validation, not downstream). GenUI reuses this exact pattern: the model returns a *view spec* - which vetted primitives to render, in what order, with which titles and which narrative text - and references data by key (e.g. `series: "scoreHistory"`, `metric: "rsi"`), never by literal number.

3. **Fabricated numbers are caught at the gate.** Any narrative string the model writes for the view passes through `assertNoFabricatedNumbers(outputText, allowedNumbers)` from `guardrails/schema.ts`, where `allowedNumbers` is the set of numerals present in the deterministic snapshot. A numeral the model invented that is not in the evidence is flagged and the view is rejected or degraded. The normalisation already handles "1,200.50" covering "1200.5", so the guard is value-based, not string-fragile.

So the data binding is the safety mechanism. The renderer reads numerals only from the deterministic snapshot keyed in the spec; the model's job is composition and prose, both of which are validated.

#### The three technical approaches, and the recommendation

There are three honest ways to build "generate a view on the spot," in increasing order of power and risk:

**(A) Schema-constrained / component-allowlist generation.** The model does not emit code or markup. It picks and parameterises from a vetted set of primitives the app already ships. Lyra's `ChartPrimitives.tsx` already gives us the allowlist: `MiniSparkline`, `MiniCandlestick`, `DenseLineChart`, `MacdHistogramChart`, `ScoreHeatBars`, plus card primitives like `MetricStrip`, `SetupChecklist`, `StatusBadge`. The model returns something like:

```
{
  "layout": "stack",
  "blocks": [
    { "kind": "scoreHeatBars", "dataRef": "scoreHistory", "title": "Recovery window" },
    { "kind": "macdHistogram", "dataRef": "macdPoints", "title": "Momentum turn" },
    { "kind": "narrative", "text": "<grounded prose, numeral-checked>" },
    { "kind": "constraintFraming", "dataRef": "userConstraints" }
  ]
}
```

A Zod schema (same `.strict()` discipline as the agent registry) validates that every `kind` is in the allowlist and every `dataRef` resolves to a key in the deterministic snapshot. A client renderer switches over `kind` and renders the real React primitive with real data. There is no arbitrary code path. XSS surface is zero because nothing the model writes is interpreted as markup - the only free text is narrative, rendered as text, and numeral-checked first.

**(B) Sandboxed generated markup.** The model emits HTML/SVG/JSX which is sanitised and rendered. More flexible, far more dangerous: every output is a potential XSS vector, sanitisation is a permanent arms race, the dense terminal aesthetic is impossible to guarantee, and reproducibility evaporates. Rejected.

**(C) Server-rendered spec to client renderer.** The model's spec (from approach A) is validated and resolved server-side - data bound, numerals checked, primitive list locked - and a fully-resolved render tree is sent to the client, which only paints. This is approach A with the trust boundary moved to the server, where the BYO/hosted key already lives.

**Recommendation: A, executed as C.** Component-allowlist generation, with the spec validated and data-bound on the server before it ever reaches the browser. Reasons:

- **No hallucinated numbers reach the screen.** Numerals are bound from the deterministic snapshot by key; the only generated text is narrative, and it passes `assertNoFabricatedNumbers`.
- **No XSS.** The client renders known React primitives over typed data. The model never emits anything the browser interprets.
- **Determinism and reproducibility.** A view spec is a small JSON object. Persist it with the signal snapshot and the same view re-renders identically tomorrow. This matters in a finance product where "why did it show me that" must be answerable.
- **Latency and cost stay bounded.** The spec is tiny (a few hundred tokens), so generation is fast and cheap - it composes a layout, it does not write a wall of text or any data. The heavy numeric work was already done by the deterministic worker.
- **Caching is natural.** Cache the validated spec keyed by `(signalId, signalSnapshotHash, userConstraintsHash)`. Identical inputs reuse the cached layout - no model call at all. The thematic-context join in `chat-context.ts` is already a "deterministic-first, no model call" pattern; GenUI extends it.
- **Graceful degradation is free.** When AI is off (demo mode, no key, gateway error), there is no spec - so Lyra renders a sensible default composition of the same primitives over the same deterministic data. The user still gets a useful view; they just get the standing layout instead of a composed one. This mirrors how the Daily Brief and notification composer "always fall back to the deterministic render" (gateway.ts header comment).

#### How it reuses what exists

- **AI gateway** (`gateway.ts`): one `complete()` call, provider-agnostic. GenUI is just another caller - and a small, cheap one. BYO / free / hosted tiers apply unchanged.
- **Grounding layer** (`buildGrounding`, `buildConstraintsBlock`, the thematic join): already produces the exact deterministic snapshot a spec binds against. No new data plumbing.
- **System prompt + guardrails** (`system-prompt.ts`, `guardrails/`): `LYRA_GUARDRAILS` (grounding, not-advice, safety, honesty), the injection isolation, and the fabrication check all apply to the GenUI call verbatim. One edit to the shared prompt raises the floor here too.
- **Chart + card primitives** (`ChartPrimitives.tsx`, `MetricStrip`, `SetupChecklist`, `terminal-panel` styling): the allowlist already exists and already matches the dense dark aesthetic (`#0d1117` panels, `#43d18b` green, `#f3a33a` amber, mono labels). Nothing new to design.
- **Agent structured-output pattern** (`AGENT_REGISTRY`, `validateAgentOutput`): the spec validator is the same discipline, applied to a new "view_composer" output schema.

### Phased path (each phase shippable)

- **Phase 0 - Spec it, don't build it (this doc).** Define the view-spec schema and the primitive allowlist as a `.strict()` Zod contract next to the agent registry. No UI yet. Shippable as types + tests.
- **Phase 1 - "Explain this signal" narrative card.** Add the inline "Want to see what this could look like?" affordance on a strong signal. On tap, generate a single grounded narrative card (no layout composition yet) using the existing grounding + fabrication guard. This is GenUI's smallest honest unit and reuses today's chat plumbing almost entirely.
- **Phase 2 - Composed card from the allowlist.** The model returns a short ordered list of 2-3 allowlisted primitives + narrative for that signal, server-validated and data-bound. Now it is a *composed* view, still inside one card, still degrading to a default composition when AI is off.
- **Phase 3 - Full on-the-spot composed view.** The composed view expands to a drawer/panel scoped to the signal and the user's constraints, with caching keyed on the snapshot hash and persisted specs for reproducibility. This is the full vision, reached without a single phase that was not independently useful.

### Risks and mitigations

- **Hallucinated numbers.** Mitigated structurally: numerals are bound by key from the deterministic snapshot; narrative passes `assertNoFabricatedNumbers` against the allowed set; a failed check degrades to the default composition rather than shipping a wrong number.
- **XSS / unsafe rendering.** Mitigated by approach A-as-C: no model-emitted markup, client renders known primitives, free text rendered as text.
- **It reads as advice.** The same `NOT ADVICE` guardrail applies; the "constraint framing" block describes where a setup sits relative to the user's own limits as research context, never "buy this / size it at X." Trade-readiness style verdicts, if used, stay inside the existing three-value enum.
- **Latency / cost.** Specs are tiny and cached on `(signal, snapshot, constraints)` hashes; most views after the first are model-free.
- **Determinism complaints ("why this view?").** Specs are persisted with the snapshot, so any view is replayable and explainable.
- **Aesthetic drift.** The allowlist is the guardrail - the model can only compose primitives that already match the terminal look, so it cannot produce something off-brand.
- **AI off.** Default composition over the same data. The feature is additive; its absence is never a broken screen.

---

## Bet 2 - Dogfooding feedback and an app-store-feel rating loop

### Vision

After a couple of weeks of real use, Lyra does what a real, polished app does: it asks, at the right moment, "Did Lyra help you?" - a clean, app-store-style ask that makes a side-project feel like a shipped product. For the founder dogfooding it now, the star rating is the *texture* that makes it feel real; the actual prize is the one-tap "what helped / what did not" capture that feeds the next iteration.

### Why it matters

A solo founder dogfooding their own app loses the outside signal that a rating loop manufactures: a forced, low-friction moment to answer "is this actually useful, or am I just admiring my own dashboard." Done right, it is a weekly heartbeat of honest product signal. Done wrong (a fixed timer, an unhappy user dumped onto the public store), it is noise and a one-star review. The refinements below are the difference.

### How it works (grounded in what exists)

**Trigger on a value moment, not a timer.** Do not ask on "day 14, 7pm" regardless of state. Ask when the app just *paid off*, because that is when the answer is both honest and positive:

- a watchlist target was hit (`watchlist_price_move`, `triggerState` reaching target in the grounding data),
- a logged paper trade is in profit (`paper_trade_closed` / `paper_position_move` in the notification types),
- a notification the user acted on demonstrably mattered,
- an N-day usage streak (the user keeps coming back - itself a value signal).

The notification router (`notifications/router.ts`) already classifies exactly these event types deterministically, so the trigger is read off events the system already emits - no new tracking. The ask is gated on a value moment AND the frequency cap below.

**Two-step gate (the standard best practice).** Never send an unhappy user to the public store.

1. Privately, inside the app: "Enjoying Lyra?" with a simple thumbs up / thumbs down.
2. Thumbs up -> route to the real store 5-star prompt (or, today, the in-app rating modal).
3. Thumbs down -> route to a private "What is missing?" form - never to the store.

This protects the public rating and, more importantly, routes the most valuable signal (an unhappy moment) into a channel where it actually helps the product.

**Ground the ask in real usage.** The prompt should reference what the app has actually done for this user, so it never feels like a generic popup: "Lyra has sent you 12 alerts and you logged 3 trades this week - how is it going?" All of this is already tracked - notifications delivered (router + delivery records), trades logged (paper trade events), signals viewed. The same `buildGrounding` instinct applies: make the ask specific to this user's real activity.

**Frequency cap.** Apple's StoreKit allows roughly 3 review prompts per 365 days, and the OS silently drops extras - so the cap must live in our own logic, not be assumed. For the dogfooding fortnight specifically: ask around day 7 and day 14, each value-gated, each with a clear "don't ask again." After that, fall back to the standing per-year cap. Persist "last asked", "responded", and "don't ask again" per user so the cap is deterministic and testable - the same way the router persists dedupe keys.

**The structured weekly check-in is the real prize.** The star is texture; the structured "what helped / what did not" is what feeds iteration. Propose a lightweight weekly dogfooding check-in: one value-moment-triggered card per week with two one-tap fields -

- "What helped most this week?" (single-select over real features: signals, alerts, the copilot, paper trades, the dashboard) and
- "What got in your way?" (single-select + optional one-line free text).

Two taps, structured, logged. Over a few weeks that is a ranked, longitudinal view of what is actually carrying the product - far more useful than a 4.5-star average.

**Implementation note - feedback-capture-first, store-rating-second.** Today Lyra is web/PWA, so simulate the store experience with an in-app modal and log every response to Supabase (a small `feedback_signals` table keyed by user, event type, value-moment trigger, rating, structured answers, timestamp). The existing `FeedbackWidget.tsx` already does most of this job - it posts structured feedback to `/api/feedback` (which files a GitHub issue when configured) and matches the dark aesthetic exactly. The rating loop is largely a value-moment-triggered, two-step-gated wrapper around that widget, plus the Supabase log. When Lyra is later wrapped in Capacitor for TestFlight, swap the "thumbs up -> store" leg to the native `SKStoreReviewController` (`requestReview`); the private thumbs-down -> form leg stays in-app on every platform. For a solo dogfooder right now, the capture-to-Supabase path is the whole point; the native store prompt is a later, thin swap.

### How it reuses what exists

- **`FeedbackWidget.tsx`**: the structured-capture UI and `/api/feedback` -> GitHub-issue path already exist, on-brand. The rating loop wraps and triggers it.
- **`notifications/router.ts`**: already classifies the exact value-moment event types (watchlist hits, paper trade closes, etc.) the trigger reads.
- **Supabase + `operator_profiles`**: the existing per-user persistence pattern (`user-context.ts`) is where "last asked / responded / don't ask again" and the structured answers live.
- **Notification delivery + trades + signal views**: already tracked, so grounding the ask in real usage needs no new instrumentation.

### Phased path (each phase shippable)

- **Phase 1 - Capture-first, value-gated.** Add the value-moment trigger + the two-step gate (thumbs up/down). Thumbs up -> in-app star modal; thumbs down -> the existing feedback form. Log everything to a `feedback_signals` table. Frequency cap (day 7 + day 14 for now, then per-year) in our own logic. Fully useful for the founder today, no native dependency.
- **Phase 2 - Structured weekly check-in.** Add the one-card, two-tap "what helped / what got in the way" weekly card over real feature names. This is the iteration engine.
- **Phase 3 - Native store swap.** On Capacitor/TestFlight, swap the thumbs-up leg to `SKStoreReviewController`. Keep the private thumbs-down -> form path identical on every platform.

### Risks and mitigations

- **Nagging the user.** Value-moment gating + a deterministic frequency cap + "don't ask again" persisted per user. The router's existing dedupe discipline is the model.
- **Unhappy users hitting the public store.** Structurally prevented by the two-step gate - thumbs-down never reaches the store, only the private form.
- **Hollow star average.** The star is explicitly secondary; the structured weekly check-in is the metric we actually act on.
- **Asking at a bad moment.** Triggers are read off real positive value events, not a clock, so the ask lands when the answer is honest.
- **Platform assumption.** Build capture-first on web/PWA into Supabase now; treat the native store prompt as a thin later swap, not a blocker.
- **Solo-founder bias.** A single dogfooder's signal is thin - so capture it *structured and longitudinal* (weekly, ranked) rather than as a one-off rating, so trends emerge even from one user, and the schema is ready for real users later.

---

## Near-term seeds we could plant now

Small, cheap things in the current codebase that make both bets dramatically cheaper later. None of these require committing to the bets:

- **Stabilise primitive prop contracts.** The chart and card primitives in `ChartPrimitives.tsx` are already clean; giving each a small, documented, typed prop interface (and a stable `kind` name) turns them into the GenUI allowlist for free.
- **Add a `dataRef`-friendly snapshot shape.** `buildGrounding` already assembles the deterministic snapshot; exposing it as a keyed object (`{ scoreHistory, macdPoints, rsi, userConstraints, ... }`) means a future view spec can bind by key with zero new plumbing.
- **Extract `assertNoFabricatedNumbers` as a reusable "render gate."** It already exists and is pure; wrapping it as a tiny `safeNarrative(text, snapshot)` helper makes every future generated string safe by default - useful well beyond GenUI.
- **Sketch the view-spec Zod schema next to the agent registry.** Even unused, a `.strict()` `ViewSpec` schema + tests is the contract Bet 1 Phase 1 builds on, and it costs an afternoon.
- **Add a `feedback_signals` Supabase table + "last asked / don't ask again" fields on the profile.** This is the entire persistence layer for Bet 2 and is independently useful for any feedback capture today.
- **Tag notification events with a `valueMoment: boolean` (or reuse existing types) at the router.** The router already knows which events are wins; making that explicit gives Bet 2 its trigger with no new detection logic.
- **Reuse `FeedbackWidget`'s controlled-open mode.** It already supports a parent-owned `open` prop with no launcher - exactly what a value-moment-triggered rating loop needs.

Both bets share one spine: the deterministic engine owns the truth, the AI composes and explains, and a thin loop of human signal tells us whether it landed. That is the version of Lyra worth being excited about - and most of the foundation is already on disk.
