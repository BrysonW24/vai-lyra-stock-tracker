# lyra-evals - State Audit
_2026-07-29 · Lyra v0.89.0 · HEAD 9e5953c · read-only assessment_

## Scope
Lyra's deterministic AI-quality machinery: the offline, model-free gates that certify the AI layer is
both SAFE (never advises, never invents a number, resists injection, never leaks a secret) and GOOD
(grounded, correctly cited, on-topic, refuses when it should). Maps to gap-to-95 vertical V5 (AI
Copilot, Entitlement & Grounding) and touches V11 (Knowledge & GenUI) and V1 (score parity). This
domain also owns the promotion gate: the eval suites run in CI so a guard-weakening change turns the
build red with the exact case and doctrine it broke.

## Lyra as it is today
The evals are real, pure, offline, and wired to live code - not a shelf artefact. Three eval strands
feed one public source of truth:

1. **Safety eval-gate** - `src/lib/ai/eval/gate.ts` runs **29 named golden cases**
   (`golden-cases.ts`) through the 6-guard engine. Each case pins a required decision (allow/review/
   block) AND the guard that must drive it (`golden-cases.ts:14-30`). Classification is fail-closed:
   a case coming back less restrictive than required is a `safety-regression`, more restrictive is an
   `over-block`, right-answer-wrong-guard is `wrong-guard` (`gate.ts:51,70-84`). Categories covered:
   clean, advice, injection, grounding, overclaim, jailbreak, secret, pii.
2. **Answer-quality gate** - `quality-gate.ts` + the scorer in `groundedness.ts` run **6 labelled Q&A
   cases with 15 bad answers** (`quality-cases.ts`). Five sub-scores fold into a composite:
   groundedness 0.30, citationPrecision 0.20, citationRecall 0.15, coverage 0.20, cleanliness 0.15
   (`groundedness.ts:151-156`), pass threshold 0.8 (`:68`), with hard gates that auto-fail a fabricated
   number, an invalid citation, an unsafe verdict, no citation, or <50% coverage (`:161-162`). Refusal
   cases invert the rubric - only a refusal scores (`:88-102`).
3. **Retrieval eval** - `src/lib/knowledge/eval/retrieval-eval.ts` scores the hybrid retriever on
   recallAt3, mrr and precisionGuard (`:56,89`).

All three fold into `buildAiSystemCard()` which runs the gates **live** (`system-card.ts:59-60`) and is
rendered at the public `/transparency` page (`transparency/page.tsx:60-63`) plus `/api/ai/system-card`
- assembled from code so the card cannot drift from reality.

## How it works
- **The guard engine** (`guardrails/engine.ts`) composes six pure guards - injection-resistance,
  grounding, regulated-advice, content-safety, secret-leakage, pii-exposure (`:142-149`) - with
  worst-status-wins folding (`:154-157`) and fail-closed on an unknown guardId (`throws`, `:169`).
  `GUARDRAILS_VERSION = 2` (`:152`).
- **Unit-aware number grounding** (audit V5): `groundedNumberTokens` (`prose.ts:27`) emits both the
  bare value and a unit-qualified token (`%`, `x`, `$`); `assertNoFabricatedNumbers` (`schema.ts:107`)
  runs unit-strict when the allow-set carries units, so a bare score of 82 no longer licenses "up 82%",
  but falls back to value-based for bare-only callers (`:121`). Pinned in `prose.test.ts:35-63`.
- **Banned-prose guards** exist in two places: the free-text `guardProse` (`prose.ts:100`) strips
  fabricated-digit sentences and spelled-out magnitudes (`SPELLED_FIGURE_RE`, `:51`) then re-runs the
  engine; the GenUI `BANNED_PROSE_RE` (`genui.ts:95`) is plural-tolerant (hundreds/thousands/...) and
  blocks buy/sell/target/guaranteed/moon plus spelled magnitudes, gating `validateGenUIView`
  (`genui.ts:103,108`).
- **Citation enforcement**: `validateAgentOutput` (`schema.ts:26`) parses agent output against its Zod
  schema and requires >=1 citation when the agent demands it.
- **Cross-language (engine) parity**: `contracts/score-golden-vectors.json` holds **5 vectors** asserted
  by BOTH TS (`score-parity.test.ts` -> `computeLyraScore`) and Python (`tests/test_score_parity.py`) -
  if either language drifts, its own test goes red.
- **These guards are on live paths**, not just tested: `guardProse` gates chat
  (`api/ai/chat/route.ts:396`), explain-signal (`:87`), brief (`:101`) and community brief
  (`community/ideas/brief/route.ts:127`); `validateGenUIView` gates the GenUI route (`:96`);
  `validateAgentOutput` + `evaluateGuardrails` gate `run-agent.ts:156,164`.
- **Promotion gate**: the gate tests (`__tests__/gate.test.ts`, `quality.test.ts`) run under
  `npm run test` (`TZ=UTC vitest run`), which is the CI unit-tests step (`ci.yml:66-67`). The gate.test
  meta-tests even prove the gate itself catches a simulated regression (`gate.test.ts:38-79`).

## Strengths (verified)
- **Falsifiable, not decorative.** The quality gate asserts every good answer passes AND every bad
  answer fails (`quality-gate.ts:34-37`), and asserts meanGoodComposite >= 0.85 (`quality.test.ts:28`)
  so good answers are not scraping the line. The safety gate meta-tests its own regression detection.
- **Fail-closed by construction.** Less-restrictive-than-required is a hard safety-regression, not a
  warning (`gate.ts:51`); an unknown guardId throws rather than silently skipping (`engine.ts:169`).
- **The "one law" holds on the score path.** The deterministic score is `computeLyraScore` with no
  model in the loop; the AI layer only ever runs `complete()` for prose and every output passes
  `assertNoFabricatedNumbers` (`run-agent.ts:31,120,156`). Guards run regardless of which of the five
  providers (anthropic/openai/openrouter/google/xai, `gateway.ts:82`) generated the text - provider-
  agnostic guarding.
- **Live single-source-of-truth card.** The System Card runs the gates at request time
  (`system-card.ts:59-60`) and is public at `/transparency`, so the published claims are the real,
  current pass counts.
- **GenUI guard is behaviourally pinned.** `genui.test.ts` feeds 8 hostile shapes (unknown keys, advice
  prose, plural spelled magnitudes, out-of-set digits, all-bad -> null fallback) and asserts each is
  neutralised.

## Gaps, risks, what is missing
- **[V11, coverage] GenUI route-level fallback ladder is untested.** The pure `validateGenUIView` is
  well-pinned (`genui.test.ts`), but `api/findings/genui/route.ts` returns four safe shapes -
  404 / no_key / budget / ai_error (`route.ts:55,61,69,99`) - with no route-level test asserting each
  fallback or a hostile-AI-JSON rejection. This is the gap-to-95 V11 finding 2 (M, +1).
- **[V5, correctness] Bare-numeral guard is still value-based.** `assertNoFabricatedNumbers`
  (`schema.ts:123`) grounds a bare numeral if it equals ANY member of the whole allow-set, so a
  fabricated bare figure passes whenever the same integer appears elsewhere (e.g. as an RSI/score). The
  dangerous %/x/$ collision is closed unit-strict - this is residual defence-in-depth, not a live
  decision-path leak (gap-to-95 V5 finding 4, M, +1). Fix: scope the allow-set per grounded field.
- **[V1, correctness] Cross-language parity stops at the score, not the raw indicators.** The golden
  vectors assert `computeLyraScore` on pre-computed inputs; TS `wilderRsi` (simple-average seed) vs
  Python `ta.RSIIndicator` (ewm seed) is not asserted, so an RSI-band boundary could flip a 10-point
  term between the hourly alert engine and the daily radar unseen (gap-to-95 V1 finding 2, M, +1).
- **Datasets are small and hand-authored/illustrative.** 29 safety cases, 6 quality cases (15 bad
  answers), 5 score vectors, a handful of retrieval cases. The quality-case grounding is explicitly
  "illustrative" (`quality-cases.ts:9-11`). The gates prove the SCORER discriminates on canned cases;
  no real production output is sampled into the eval set, so aggregate live-answer quality is unmeasured.
- **"Provider parity" is provider-AGNOSTIC guarding, not a cross-provider eval.** The README frames
  provider parity as a pillar, but no dataset runs the same prompts through multiple providers and
  compares - parity holds only because the guards run on output text regardless of provider.
- **Evals are not in the `check:*` gate list.** They ride the general `npm run test` (which is in CI),
  but there is no dedicated `check:evals` script alongside the 8 `check:*` gates, so a future
  "run only the check gates" flow would not exercise them.
- **The scorer is lexical, by design.** Coverage is substring matching, groundedness is numeral
  matching (`groundedness.ts:73-78,105-108`) - it cannot catch semantic drift a model-judge would. An
  acknowledged trade-off for a pure, offline, deterministic gate; noted, not a defect.
- **`lyra-evals/` itself is greenfield as a founder-facing folder** - only `README.md` on disk (plus
  this audit). The engineering lives under `src/lib/ai/eval/`, `src/lib/ai/guardrails/`,
  `src/lib/knowledge/eval/`; the operating home is unfilled (no ROADMAP, decision/risk registers yet).

## Where to find it
- Safety gate: `src/lib/ai/eval/gate.ts`, `golden-cases.ts` (29 cases), test `__tests__/gate.test.ts`.
- Quality gate: `src/lib/ai/eval/quality-gate.ts`, `groundedness.ts` (scorer), `quality-cases.ts`
  (6 cases), test `__tests__/quality.test.ts`.
- Guard engine + guards: `src/lib/ai/guardrails/engine.ts`, `schema.ts`, `prose.ts`, `injection.ts`;
  tests `__tests__/engine.test.ts`, `__tests__/prose.test.ts`.
- GenUI guard: `src/lib/findings/genui.ts` (`BANNED_PROSE_RE`, `validateGenUIView`); test
  `src/lib/findings/__tests__/genui.test.ts` (+ `genui-framing.test.ts`); route
  `src/app/api/findings/genui/route.ts`.
- Retrieval eval: `src/lib/knowledge/eval/retrieval-eval.ts`.
- Engine (score) parity: `contracts/score-golden-vectors.json`, `src/lib/__tests__/score-parity.test.ts`,
  `tests/test_score_parity.py`.
- Public surface: `src/lib/ai/system-card.ts`, `src/app/transparency/page.tsx`,
  `src/app/api/ai/system-card/route.ts`.
- Live guard callers: `src/app/api/ai/{chat,explain-signal,brief}/route.ts`,
  `src/app/api/community/ideas/brief/route.ts`, `src/lib/ai/run-agent.ts`.
- CI gate: `.github/workflows/ci.yml` unit-tests step; `package.json` `test: "TZ=UTC vitest run"`.

## Posture
Strong and wired - the guard machinery is real, pure, on live paths, feeds a public System Card, and is
CI-gated as the promotion gate; the residual gaps are dataset thinness, one route-level test hole, and
two same-class defence-in-depth items (bare-numeral scoping, TS/Python indicator parity).
