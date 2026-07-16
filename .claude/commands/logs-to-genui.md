# /logs-to-genui - turn logs + event data into on-the-spot GenUI

You are Claude Code running in the Lyra repo. Run the chain that takes operational data -
scanner logs, signal events, outcomes, notification results, feedback volume - and turns it
into generated UI the user can actually look at, using Lyra's existing GenUI system. The
doctrine is non-negotiable (see `src/lib/findings/genui.ts`): **the AI composes the LAYOUT,
the deterministic engine owns EVERY NUMBER.** A GenUI view never contains a figure the
engine did not compute; with no AI key it degrades to a deterministic default, never blank.

## What already exists (build WITH it, not beside it)

- **GenUI block system** - `src/lib/findings/genui.ts`: `metric_grid` / `bullets` /
  `timeline` / `risk_list` / `evidence_list` / `note`, an allow-listed metric set, a
  fabrication guard on prose, and `buildDefaultGenUIView` as the no-AI fallback.
- **Compose endpoint** - `src/app/api/findings/genui/route.ts`: resolves data server-side,
  asks the model for layout only, validates, falls back to the default view.
- **Events -> findings projection** - `src/lib/findings/from-events.ts`: the proven pattern
  for turning raw event streams into `Finding`-shaped objects that GenUI can render.
- **The data** - signal events (`src/lib/signal-events.ts`), outcomes
  (`src/lib/outcomes.ts`, worker `outcome_engine.py`), score history
  (`src/lib/score-history.ts`), notification dispatch results, scanner run logs
  (GitHub Actions), `[feedback]` log lines.

## Stage 1 - Collect and pick the story

1. Pull the operational data for the window you care about (last scan, last day, last week):
   scanner run results, signal events fired, outcome wins/losses, alerts sent vs failed,
   feedback volume by type.
2. Pick ONE view per loop - e.g. "what did the scanner do overnight", "how are my signals
   resolving", "alert delivery health". Scope discipline beats a mega-dashboard.

**Gate:** you can list the exact deterministic numbers the view will show, and where each
one comes from in code. If a number has no engine source, it does not go in the view.

## Stage 2 - Distill deterministic metrics (engine side)

1. Compute the metrics server-side in a lib module (follow `from-events.ts`: project raw
   events into a typed, engine-owned object). No metric math in components, none in prompts.
2. Extend the GenUI allow-list the same way `METRIC_DEFS` does it in `genui.ts` - a `key`,
   a `label`, and a deterministic `get`. The fabrication guard's allow-set of numbers must
   include every figure the view can mention.
3. Unit-test the projection (see `tests/findings-from-events.test.ts` for the pattern):
   deterministic input events -> exact expected metrics.

## Stage 3 - Compose the GenUI view

1. Reuse the block vocabulary; only add a new block kind if none of the six fits, and add
   it to the validator + renderer + default view in the same change.
2. The AI prompt gets: the allow-listed metric keys, short context prose, and the block
   schema - never raw numbers to restate, never raw logs to summarise into figures.
3. `buildDefaultGenUIView`-style fallback first: the deterministic default view IS the
   feature; the AI layout is the garnish. Ship the default, then let the AI reorder it.

**Gate:** with no AI key configured, the view renders complete and correct. `validateGenUIView`
plus the fabrication guard pass on AI output; malformed AI output falls back, never 500s.

## Stage 4 - Surface it

- In-app: a drawer or card on the page where the question naturally arises (`/radar` for
  scan health, `/trades`/`/paper` for outcome views, `/settings` notifications for delivery
  health).
- Push the headline through existing channels if it warrants attention (Telegram digest,
  Web Push) - the notification carries engine numbers only.

## Stage 5 - Verify + ship

1. `npm run type-check && npm run test && npm run build` (add worker tests if worker code
   changed: `npm run worker:test`).
2. Version bump via `RELEASES` in `src/lib/version.ts` + `npm run release`, commit, push.
3. Close the loop per `/feedback-loop` if the view answers a user-reported question.

**Done means:** one new engine-owned view, tested, rendering without AI, enhanced with AI,
shipped under a version number.
