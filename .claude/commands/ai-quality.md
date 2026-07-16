# /ai-quality - keep the AI layer safe, grounded and evaluated

You are Claude Code running in the Lyra repo. Run the AI upkeep loop: evals first, then
guardrails, then cost/resilience, then knowledge freshness, then the system card. This
chain owns `src/lib/ai/`, `src/lib/knowledge/`, `content/` (the compiled reference docs),
the `/api/ai/*` routes, and the `/ai-ops` founder surface. Doctrine is non-negotiable:
**the AI explains; the deterministic engine decides. The AI never invents a number and
never gives advice - research only.**

## What already exists (build WITH it)

- **Evals** - `src/lib/ai/eval/`: `golden-cases.ts` + `gate.ts` (groundedness),
  `quality-cases.ts` + `quality-gate.ts` (answer quality), knowledge retrieval eval in
  `src/lib/knowledge/eval/retrieval-eval.ts`. All run inside `npm run test`.
- **Guardrails** - `src/lib/ai/guardrails/`: `engine.ts` (injection/grounding/advice/
  content-safety), `prose.ts` (`guardProse` output gate - strips fabricated figures,
  digits AND spelled-out), `injection.ts`, `schema.ts`. Chat + brief routes are gated.
- **Cost + resilience** - `budget-tracker.ts` (hosted-key token ceilings,
  `LYRA_HOSTED_TOKENS_PER_RUN/DAY`), circuit breaker in `gateway.ts` (5 fails -> open 60s,
  429s never retried on hosted keys), `resilience.ts`, `credentials.ts` (BYOK never
  logged or persisted).
- **Knowledge layer** - deterministic: `scripts/build-knowledge.mjs` compiles `content/`
  + reference docs into `src/lib/generated/knowledge.json`; retrieval is lexical + hybrid
  (`src/lib/knowledge/retrieve.ts`, `hybrid.ts`) - no embeddings, no network.
- **Transparency** - `src/lib/ai/system-card.ts` + `/api/ai/system-card` + the `/ai-ops`
  page; `audit.ts` + `metrics.ts` record every guarded interaction.

## Stage 1 - Run the evals and read them

1. `npm run test -- ai` (or the full suite) - record groundedness gate, quality gate, and
   retrieval eval scores. These are the baseline; nothing ships that regresses them.
2. If a case fails, decide honestly: model drift, prompt drift, or a bad case. Fix the
   root; never delete a case to go green.

**Gate:** you can state current eval scores and the delta vs the last run.

## Stage 2 - Attack the guardrails

1. Add at least one new adversarial case per loop to the eval sets (injection attempt,
   advice bait, fabricated-number bait) - the red-team set only grows.
2. Verify the output path: `guardProse` must gate every user-facing completion (chat,
   brief, GenUI prose). A new AI surface without the gate is a P0.

**Gate:** `policy-invariants.test.ts`, `guardrails.test.ts`, `prose.test.ts` green; every
AI-emitting route provably passes through the guardrail engine.

## Stage 3 - Cost, resilience, knowledge

1. Budget: confirm hosted-key ceilings still hold on chat + brief; BYOK stays unbudgeted.
2. Breaker: `gateway-breaker.test.ts` green; hosted 429s never retry.
3. Knowledge: if docs moved/renamed, update `SOURCES` in `scripts/build-knowledge.mjs`
   (the build fails loudly when stale) and re-check retrieval eval scores.

## Stage 4 - System card + explainability

Update `system-card.ts` when models, guardrails, budgets, or eval results materially
change - the card is the public claim of how the AI behaves; a stale card is a false
claim. Verify `/ai-ops` renders the current numbers.

## Stage 5 - Verify + ship

`npm run type-check && npm run test && npm run build`, then version bump via `RELEASES`
in `src/lib/version.ts`, `npm run release`, commit, push, `npm run announce`.

**Done means:** eval scores reported with deltas, red-team set grown, every AI surface
guarded, system card current, shipped under a version. Explainability: the session report
states eval numbers before/after - "the AI is fine" without numbers is not a finding.
