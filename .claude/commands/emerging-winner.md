# /emerging-winner - the Emerging Winner Engine chain

Owns the small-cap "emerging winner" model stack: `workers/emerging_winner/`,
`src/lib/emerging-winner/`, `src/app/emerging-winners/`, `src/app/api/emerging-winners/`. Run it when
a winner-model component changes, a domain / gate / analogue is added, scoring drifts, or before
promoting anything from shadow-live. Spec + roadmap: `lyra-modelling/research/2026-07-29-emerging-winner-engine.md`
and `lyra-modelling/emerging-winner-engine.md`.

## Doctrine (restate it, it travels with the work)

- **The engine computes every number; nothing invents one.** Winner-similarity, probability, percentile
  and the outcome distribution are engine-owned and rendered as metric values, never as AI prose.
- **It informs, it never decides.** Output is a resemblance score + what is present / missing, never a
  buy/sell instruction and never a price target. Actions are research / watch / paper-bot only.
- **Shadow-live first.** Predictions are logged to the immutable ledger and only surfaced as truth after
  historical walk-forward + live calibration earn it. The deterministic scanner stays the safety backbone.
- **Coverage honesty.** A domain with no data is `unavailable` (never a weak trait); completeness and the
  composite are computed over available domains only; a thin read can never be a "strong candidate".
- **Risk gates protect capital.** Survivability / dilution / manipulation / liquidity / downside gates can
  downgrade or BLOCK a high-scoring name; a missing gate input is `insufficient`, never a silent pass.

## Stages (each ends at a gate; a red gate stops the chain at the root cause)

1. **Map the change.** State which of the six models it touches (M1 domain scorecard, M2 classifier,
   M3 analogues, M4 archetype+rank, M5 risk gates, M6 timing/network) and why. Gate: the touched files
   are all under this chain's coverage paths.

2. **Preserve the contract.** If the output shape changes, update `EmergingWinnerResult.to_dict()`
   (Python) AND `src/lib/emerging-winner/types.ts` in lockstep, and regenerate the demo
   (`src/lib/emerging-winner/demo.ts`) from the engine so it cannot drift. Gate: `npm run type-check`.

3. **Prove the behaviour.** Add or extend pytest in `tests/test_emerging_winner_engine.py` /
   `tests/test_emerging_winner_scorecard.py`. Non-negotiable invariants that must stay pinned: a pump is
   BLOCKED and excluded; unavailable data is `insufficient`/`unavailable`, never a pass/weak-trait; a
   blocked name has priority 0 and `surfaced=false`; the risk half is never empty; the pipeline is
   deterministic. Gate: `npm run worker:test`.

4. **Honesty of provenance.** If the model is still reference/heuristic (not trained on a real
   point-in-time winner dataset), the `provenance` strings and the surface banner must say so. Never
   present reference-v1 output as a validated track record. Gate: grep the changed modules for a truthful
   `provenance`/`model_version`.

5. **Persistence + schema.** If a table/column changed, edit migration `056_emerging_winner.sql`
   additively (never rewrite an applied table), keep the predictions ledger append-only, and update the
   data-economics budget. Gate: `npm run check:migrations` (and plan the manual prod apply - the nightly
   `check:schema-drift` reddens until it lands, by design).

6. **Ship it.** Prepend a `RELEASES` entry in `src/lib/version.ts`, `npm run release`, then
   `npm run test && npm run type-check && npm run build`. Gate: all green. Commit + push; announce after.

## Report (execution, not advice)

State what changed across the six models, the invariants re-proven with the test names, the calibration
/ walk-forward evidence if a model was retrained, and the shadow-live status (still logging, or promoted -
and on what evidence). "It looks better" is not a finding; cite the engine-owned numbers.
