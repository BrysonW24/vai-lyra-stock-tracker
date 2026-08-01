# /model-generation-eval - archive + visualise a completed model generation

Run this EVERY time a model generation completes (a full standing-loop cycle:
`build -> retrain -> compare -> eval -> one-shot holdout -> record`, plus the promotion decision).
It turns the raw cycle into three durable, comparable surfaces: a head-to-head visual board, a
generation-log entry, and a report snapshot - so any future session can see what changed, how often,
and which changes produced the biggest effects on the model.

Owns: `lyra-evals/boards/`, `lyra-evals/generations/`, the published eval-board artifact.
Reads: `lyra-evals/model-metrics-history.jsonl`, `.ew-backtest-cache/reports/*.json`,
`src/lib/generated/emerging-winner-model*.json`, the previous generation's board.

## Doctrine (restate it, it travels with the work)

- **Reproduce, never trust memory.** Numbers come from the metrics history (keyed by corpus sha)
  and the report JSONs on disk. If a dev report might be stale, re-run `eval` - it is deterministic
  and must reproduce the recorded record byte-identically. NEVER re-run `holdout` for a board:
  the one-shot rule outranks visualisation.
- **Naming trap in the history JSONL:** within each record, `champion`/`challenger_real_v1` mean
  champion/challenger AT THAT TIME. After a promotion, the same model changes column between
  records. Resolve lineage by model, not by column name.
- **Deltas are directional unless CI90s separate.** Overlapping intervals = "directional evidence,
  not proof", stated on the board and in the log.
- **In-sample flattery is named.** Once a real-data champion is promoted, its dev-split numbers are
  flattered (it trained on those rows). Only the holdout is a fair fight; say so wherever a dev
  number appears.
- **Instability is an open question, not a finding.** A result that reverses when an input is
  corrected (gen-2's tier flip) ships flagged, with a stability check queued - never as a claim.
- **Refused challengers are shown with their numbers.** The system saying "no" is evidence of
  discipline; hiding it would be the dishonest thing.
- **The difference verdict is the PAIRED test, never CI overlap.** Two marginal CIs can overlap
  while the paired difference is decisive; overlap-eyeballing will eventually block a genuinely
  better challenger silently. `compare` and `eval` emit `paired_delta_ci` (paired symbol-clustered
  bootstrap on identical rows); gate on `lift_at_k.ci_excludes_zero`. On a tie the pre-committed
  must-beat rule keeps the incumbent.
- **Archive per-row scores every generation** (`gen-NNN/scores-holdout.jsonl`): without them the
  next generation cannot run a paired CROSS-generation test and the "improvement came from data"
  claim stays marginal-only (the gen-1 vs gen-2 lesson).
- **Every attempt is logged**, not just promotions: retrain / compare / holdout scoring /
  promote / refuse all append to `lyra-evals/model-attempt-log.jsonl`. Temporal rules cannot see
  selection bias across the search; the trial count is the cheapest guard that can.
- **Lead discrimination with average precision (PR-AUC), not ROC-AUC.** At a 13% base rate ROC-AUC
  is systematically flattering under imbalance; report it, but the headline discrimination stat on
  boards and cards is PR-AUC against the random-ranker floor (= the base rate).
- **Report weak calibration, not only ECE.** ECE verifies moderate calibration; the
  `calibration_weak` block (slope, intercept, Spiegelhalter z) is where prevalence-shift
  overconfidence shows up. Slope 1 / intercept 0 is the target vocabulary.

## Stages (each ends at a gate)

1. **Confirm the generation is really closed.** The metrics history has a new record with the new
   corpus sha; the promotion decision (promote/refuse) is made and recorded; `eval-report-dev.json`,
   `eval-report-holdout.json`, `champion-vs-challenger.json` exist for this corpus.
   Gate: record's corpus sha == reports' corpus sha.

2. **Snapshot the reports.** `mkdir lyra-evals/generations/gen-NNN/` (zero-padded, next integer)
   and copy the three report JSONs in. The cache dir is gitignored; this folder is the durable copy.
   Gate: three files present, shas match the generation.

3. **Extract both generations' numbers.** New gen + previous gen from the history JSONL; holdout
   detail (k-scan, calibration bins, per-quarter cohorts, tiers, deployment restatement) from the
   snapshot; weights from the artifact JSONs (deployed champion + this generation's challenger).
   Gate: every value about to appear on the board has a named source file.

4. **Build the comparison board.** Copy the PREVIOUS board as the template (visual identity is
   continuity - differences should read as content, not redesign). Update the `const D = {...}`
   data object, the prose, the delta table, the grade cards (grades move on evidence only), and the
   what-shipped changelog. Name it `model-eval-board-v{N}-vs-v{N-1}.html`. Keep both themes, keep
   tooltips, keep the honesty callouts. No em dashes in copy.

5. **Graph gate (MANDATORY - a board with empty boxes must never ship).**
   `node lyra-evals/boards/prerender-board.mjs lyra-evals/boards/model-eval-board-v{N}-vs-v{N-1}.html`
   This bakes the SVGs into the HTML (static viewers show graphs without JS) and exits non-zero on
   any empty/NaN chart. Gate: script prints OK with every chart id listed.

6. **Adversarial number check.** A separate pass (subagent when available) re-derives every number
   on the board from the source JSONs and reports mismatches. Fix every mismatch, re-run stage 5.
   Gate: zero mismatches.

7. **Log the generation.** Append the newest-first entry to
   `lyra-evals/generations/GENERATION-LOG.md`: what changed, results table, **biggest observed
   effect** (the retro field that powers future tuning), watch-outs, grade movement, evidence links.
   Update the index table in `lyra-evals/boards/README.md`.

8. **Publish + ship.** Republish the standing artifact (same URL - it is the founder's bookmark),
   then commit with a version bump per repo rules (`RELEASES` entry in `src/lib/version.ts`,
   `npm run release`, tests green). Gate: artifact updated, push accepted.

## Why this exists

The founder's ask (2026-08-02): every new generation gets v-current vs v-previous put against each
other so we can observe the differences and change; all boards and reports collect in one
destination so we can look back at what was changing, how often, and what had the biggest effects -
and use that to decide what to tune next, including tuning DOWN an aspect a past change amplified.
