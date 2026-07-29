# lyra-content - State Audit
_2026-07-29 · Lyra v0.89.0 · HEAD 9e5953c · read-only assessment_

## Scope
The knowledge layer and content pipeline: the deterministic doc-knowledge build that grounds the
in-app AI (`content/` editorial data, `scripts/build-knowledge.mjs`, `src/lib/knowledge/`), the
GenUI-in-drawer view model (`src/lib/findings/genui`), the education modules (`/education`), and the
public `/transparency` System Card. Maps to gap-to-95 V11 (Knowledge Layer & GenUI, 93/100) and touches
V10 (Scout/Intel, which consumes the same `content/` JSONL data).

## Lyra as it is today
Two separate deterministic content systems ship, both compiled at build time, both offline:

1. **Doc-knowledge for the AI copilot.** `scripts/build-knowledge.mjs` compiles 15 curated reference
   docs (`build-knowledge.mjs:22-42`) into `src/lib/generated/knowledge.json` - **169 chunks**, one per
   markdown heading section (README 25, walkthroughs ~77, COSTS/SECURITY/ONBOARDING/etc). Retrieval is
   pure lexical idf-weighted scoring with a fail-closed market/ticker gate (`retrieve.ts:142-186`),
   wrapped by a deterministic char-trigram cosine reranker (`hybrid.ts:49-65`) - **no embeddings, no
   network, no model**. It is wired live into chat at `api/ai/chat/route.ts:269`
   (`buildHybridKnowledgeBlock`).
2. **Editorial JSONL data.** `content/` holds **11 JSONL files** (themes, investors, IPOs, commodities,
   smart-money, capital-events, supply-chain-nodes, theme-companies, scout-sources, finance-facts -
   `finance-facts.jsonl` alone is 132 lines) as the single source of truth for stale-able reference
   data, compiled by `scripts/build-content.mjs` into `src/lib/generated/<domain>.json`. The knowledge
   build rides the same hook (`build-content.mjs:72` imports `build-knowledge.mjs`); both run on
   `predev`/`prebuild`/`pretype-check` (`package.json:29-31`).

On top of these: **GenUI** (`findings/genui.ts`) - the AI composes only the layout, the engine owns
every number - served by `api/findings/genui/route.ts` (104 lines, 4 honest fallbacks); the **education
hub** - 22 modules (11 Technical, 7 Fundamental, 3 Risk) in `src/lib/education.ts` rendered at
`/education` and deep-linked from metric help/nav; and the **public `/transparency` System Card**
(`transparency/page.tsx`, 136 lines) that assembles the AI System Card from code and runs the eval gates
live on load (`force-dynamic`, `:11`).

## How it works
- **Chunking is deterministic** (`build-knowledge.mjs:87-102`): split on `## `/`### ` headings, drop
  sections under 80 chars, split long sections on paragraph boundaries at 1800 chars, stable ids/order -
  so the generated file only changes when the docs change. A missing source **fails the build loudly**
  (`:78-81`, `process.exitCode = 1`).
- **Retrieval fails closed for money questions** (`retrieve.ts:143-146,58-61`): any MARKET_INTENT token
  (buy/sell/hold/position...) or ticker-shaped ALL-CAPS word returns `[]`, so doc examples with invented
  numbers never sit in a prompt next to a real holding. Scoring is idf-weighted with heading/slug bonuses
  and a coverage floor; hybrid pulls a wider candidate pool then reranks by fused `0.6*lexical +
  0.4*cosine` (`hybrid.ts:39-64`), inheriting the lexical gate so it can never add noise.
- **GenUI enforces the one law** (`genui.ts`): `buildAllowedMetrics` restricts the AI to keys the engine
  computed; `validateGenUIView` (`:103-149`) drops unknown metric keys, runs prose through
  `assertNoFabricatedNumbers` + `BANNED_PROSE_RE` (advice + spelled-out figures, plural-tolerant
  `:95-96`), and returns `null` -> deterministic `buildDefaultGenUIView` when nothing survives. The route
  degrades to that default view on no-key/budget/ai_error, never to an error (`route.ts:60-100`), and the
  hosted key rides the shared cross-instance budget (`chargeHostedBudgetShared`, `:68`).
- **The System Card is assembled from code** (`system-card.ts`) and reports live eval numbers (safety
  gate, quality gate, retrieval recall@3/MRR/precisionGuard from `compareRetrievers`) so it "cannot report
  green while a gate is red" (`transparency/page.tsx:70`).

## Strengths (verified)
- **Genuinely deterministic and offline.** No embeddings/network in the knowledge path (`retrieve.ts:1-15`,
  `hybrid.ts:6-7`); identical output in demo, tests, and prod. The eval is folded into the System Card
  (`system-card.ts:22,74`) and gated in `hybrid.test.ts:62-64` (hybrid never regresses lexical recall/MRR).
- **Fail-closed grounding is tested with hostile inputs.** `retrieve.test.ts` (12 tests) and `hybrid.test.ts`
  (10 tests) pin the market/ticker/empty-query gate; `RETRIEVAL_CASES` includes explicit `expectEmpty`
  precision-guard cases (`retrieval-eval.ts:33-34`).
- **GenUI is well covered for a generated-UI surface.** `genui.test.ts` (9) + `genui-framing.test.ts` (2)
  feed hostile views and assert fabricated numbers/advice are dropped and personalisation never hides risk.
- **Content editing needs no code change** (`content/README.md`): one JSONL line per fact, codegen bridges
  to importable JSON; the em-dash and field-name rules are documented.
- **Transparency is real and public.** `/transparency` renders the live card (not a static blurb) and is
  in `middleware.ts:29` `PUBLIC_PREFIXES`.

## Gaps, risks, what is missing
Vertical 11 sits at 93/100; three gap-to-95 findings all confirmed on disk, plus one disclosed limitation:

1. **[polish, S, +1] The `/transparency` System Card has no user-facing entry point.** Its only inbound
   link is the un-navigated orphan `/ai-ops` page (`ai-ops/page.tsx:176`) - grep finds no link from
   `HowLyraWorks`, the welcome footer, or any nav. Built-tested-green-never-wired applied to a governance
   surface advertised as a headline feature. _Fix:_ link it from `HowLyraWorks` and the welcome footer.
2. **[coverage, M, +1] The GenUI route fallback ladder is untested at the route level.**
   `api/findings/genui/route.ts` returns four safe shapes (404 / no_key / budget / ai_error) but no test
   file exists under `src/app/api/findings/genui/`. Only the pure `validateGenUIView` is pinned. _Fix:_ a
   focused route test mocking the gateway + budget, asserting each fallback + hostile-JSON rejection.
3. **[coverage, S, +1] Committed generated `knowledge.json` has no CI drift gate.** `ci.yml:57-65` runs
   only onboarding/onboarding-contract/migrations/chains/ledgers - there is no `check:knowledge` script in
   `package.json` and the ledgers gate does not cover `src/lib/generated/`. A doc edit that is not rebuilt
   leaves the retrieval eval asserting against a stale corpus and still green. _Fix:_ a `check:knowledge`
   script (rebuild + `git diff --exit-code`) wired into CI.
4. **[disclosed limitation, not scored] The knowledge corpus is frozen below full coverage.**
   `build-knowledge.mjs:28-31` documents that DATA-ECONOMICS.md + LOOPS.md are deliberately excluded
   because adding them flips one eval query's top-1 (recall@1 0.917 -> 0.833) and reds the hybrid>=lexical
   gate - corpus and eval set must move together. So the copilot cannot yet answer cost/loop questions.
   Honest and gated, but a real coverage ceiling.

No fabrication defect was found in this domain: the V9 hype-meter fabrication-as-live lives in the worker
fleet (`intelligence-live.ts`), not here, and the `content/` demo literals feed the intel feed through
V10's disclosed `sample:` flag (`feed.ts`), which is a V10 concern.

## Where to find it
- **Knowledge build:** `scripts/build-knowledge.mjs` (SOURCES at `:22-42`), `scripts/build-content.mjs:72`
  (chains the knowledge build), output `src/lib/generated/knowledge.json` (169 chunks).
- **Retrieval:** `src/lib/knowledge/retrieve.ts` (lexical + fail-closed gate), `hybrid.ts` (cosine rerank),
  `vectorize.ts` (char-trigram vectors), `eval/retrieval-eval.ts` (labelled IR eval). Wired at
  `src/app/api/ai/chat/route.ts:269`.
- **Content data:** `content/*.jsonl` (11 files) + `content/README.md`; generated JSON in
  `src/lib/generated/<domain>.json`.
- **GenUI:** `src/lib/findings/genui.ts`, route `src/app/api/findings/genui/route.ts`.
- **Education:** `src/lib/education.ts` (22 modules), `src/app/education/page.tsx`,
  `src/components/education/` (EducationHub, LearningPath, MetricHelp, HelpDrawer, EducationCarousel).
- **Transparency:** `src/app/transparency/page.tsx`, `src/lib/ai/system-card.ts`,
  `src/app/api/ai/system-card/route.ts` (JSON), public via `src/middleware.ts:29`.
- **Tests:** `src/lib/knowledge/__tests__/retrieve.test.ts` (12), `hybrid.test.ts` (10),
  `src/lib/findings/__tests__/genui.test.ts` (9), `genui-framing.test.ts` (2), `graph.test.ts` (6),
  `from-events.test.ts` (9).
- **Gap detail:** `lyra-audits/2026-07-29-gap-to-95-audit.md` V11 (lines 347-365).

## Posture
Strong and wired - deterministic, fail-closed, law-abiding and live in chat; held below 95 by one
discoverability gap (unlinked System Card), a missing GenUI route test, and no CI drift gate on the
generated corpus.
