# lyra-ai - State Audit
_2026-07-29 · Lyra v0.89.0 · HEAD 9e5953c · read-only assessment_

## Scope
The AI layer: the provider-agnostic gateway, credential/entitlement resolution (BYOK vs hosted key),
the guardrails stack that enforces the ONE LAW (the deterministic engine decides; AI only explains,
never invents a number, never gives advice), the agent orchestration + audit trail, and every AI
surface (chat, daily brief, signal explainer, agents, operator dashboards). Maps to gap-to-95 V5 (AI
Copilot, Entitlement & Grounding) and touches V11 (Knowledge/GenUI).

## Lyra as it is today
The AI layer is a mature, law-abiding vertical - the gap-to-95 audit independently re-scored it **93/100
-> 96 if closed** (`lyra-audits/2026-07-29-gap-to-95-audit.md:201-226`), with all four residual gaps on
secondary/operator surfaces, not the primary journey.

- **One gateway, five providers.** `src/lib/ai/gateway.ts` exposes a single server-side `complete()`
  (`gateway.ts:353`). `AiProvider` is `anthropic | openai | openrouter | google | xai`
  (`gateway.ts:22`); `DEFAULT_MODELS` at `gateway.ts:72-80` (anthropic `claude-haiku-4-5`, openai
  `gpt-5.5`). Adding a provider or a BYO model never touches a feature.
- **The ONE LAW is enforced mechanically, not just in the prompt.** The system prompt states it
  (`system-prompt.ts:21` "Never invent, estimate, round differently, or change a number";
  `:22` "NOT ADVICE"), and every output surface then re-enforces it in code: free-text via
  `guardProse` (`guardrails/prose.ts:100`) and structured agent output via `run-agent.ts:136-171`.
- **BYOK vs hosted entitlement.** `resolveAiCredentials` (`credentials.ts:56`) hands out the house key
  only to an authenticated AND entitled caller; a user's own key always wins and honours their model
  choice, while the house key is server-pinned (`credentials.ts:63-98`). Entitlement is a 14-day trial
  or a `profiles.ai_included` grant (`entitlement.ts:15,19`; migration `055_ai_included.sql`), resolved
  best-effort in the route guard (`api/ai-guard.ts` `resolveAiIncluded`).
- **Every AI route sits behind one guard.** `guardAiRoute` (`src/lib/api/ai-guard.ts`) resolves the
  session, caps the body at 32 KB (`:33`), rate-limits per identity, and returns the `authenticated` +
  `aiIncluded` flags - closing the anonymous-key-burn hole the security audit flagged.
- **Shared cross-instance budget.** `chargeHostedBudgetShared` (`budget-tracker.ts:66`) meters the
  house key per rolling UTC day via an Upstash `INCRBY` (default 2000/run, 250000/day, env-tunable),
  falling back to the in-memory tracker only when Upstash is unset. chat charges 600, brief 220,
  explain-signal 160, agent 1500 tokens.
- **Audit trail, hash-only.** `recordAiRun` (`audit.ts:189`) writes one row per invocation carrying
  sha256 hashes of input/output, never the raw prompt and never a key (`audit.ts:1-14`). Storage is
  pluggable; `resolveWriter` (`audit.ts:153-160`) auto-selects the Supabase writer (table `ai_runs`,
  migration `019`) when the service-role client exists.

## How it works
- **Resilience is layered in the gateway.** Each attempt runs under a shared 6-concurrent backpressure
  limiter (`gateway.ts:261`), a 30s per-attempt timeout (`gateway.ts:237`), and `withRetry` bounded
  exponential backoff; transient 429/5xx/network errors retry (BYOK retries 429, the house key does not
  - `chat/route.ts:312`). A per-provider circuit breaker opens after 5 consecutive failures and
  fast-fails for a 60s cooldown, with one half-open probe (`gateway.ts:302-387`).
- **Guardrails engine - one verdict surface.** `evaluateGuardrails` (`guardrails/engine.ts:164`) runs
  six named guards (injection-resistance, grounding, regulated-advice, content-safety, secret-leakage,
  pii-exposure), worst-status-wins, and THROWS on an unknown guard id (fail-closed, `:169`).
  `safeForLiveAction` is a locked `false` type (`:26`) - the layer can never authorise an action.
- **Unit-aware number grounding.** `assertNoFabricatedNumbers` (`guardrails/schema.ts:107`) holds a
  `%`/`x`/`$` numeral to its own unit via `UNIT_NUMERAL_RE` (`:78`), so a bare score of 82 no longer
  licenses a fabricated "82%" claim - the audit-V5 value-collision fix, tested in
  `guardrails.test.ts`. `groundedNumberTokens` (`prose.ts:27`) emits both bare and unit-qualified
  forms of each grounding numeral.
- **Free-text path (chat/brief/explain-signal).** `guardProse` derives the allow-set from the exact
  grounding the model saw, strips any sentence carrying a fabricated figure (digit via
  `assertNoFabricatedNumbers`, spelled-out via `SPELLED_FIGURE_RE` `prose.ts:51`), then runs the full
  engine; the caller refuses on a block or an empty-after-strip result (`chat/route.ts:396-418`).
- **Structured/agent path.** `run-agent.ts` gathers evidence through the fail-closed tool runtime,
  prompts for strict-Zod JSON, strips fabricated numerals from every string field
  (`run-agent.ts:136-147`), runs the engine over the collected strings (a `block` is a hard refusal,
  `:158-162`), then `validateAgentOutput` (strict schema + `>=1` citation, `guardrails/schema.ts:26`),
  then audits. Output schemas are `.strict()`, so an injected order-shaped field is rejected at
  validation - the `trade_readiness` schema can only emit one of three verdicts
  (`agents/registry.ts:289-297`), never an order.
- **Chat is grounded and injection-screened.** `chat/route.ts` assembles the deterministic dashboard +
  market + user constraints + hybrid knowledge into a CONTEXT block (`:271-289`), screens every history
  turn for injection (`:159-161`), and proposes (never performs) reversible actions the user confirms
  in `ChatWidget.tsx` (`runAction` `:338`).

## Strengths (verified)
- **The law holds on every live path.** No `complete()` call sits on a decision path; chat, brief and
  explain-signal all fall back to the deterministic render on any AI failure (`brief/route.ts:102`,
  `explain-signal/route.ts:88`), and the deterministic engine always renders.
- **Provider-agnostic and BYO-model by construction** - five adapters behind one `complete()`, free-text
  model resolution (`gateway.ts:85`), and the house key server-pinned so a client cannot select an
  expensive model on Lyra's spend (`credentials.ts:77-83`).
- **Defence in depth on untrusted input** - 14 injection patterns + fence-spoof detection
  (`guardrails/injection.ts:26-50`), secret-shape and PII guards in the engine
  (`guardrails/engine.ts:98-127`), and Solo device context sanitised as hostile input
  (`chat/route.ts:70-122`).
- **Well tested for a copilot** - 24 AI test files, ~226 `it/test` calls across `src/lib/ai` +
  `src/app/api/ai`, including a guardrails golden-set eval gate (`eval/gate.ts`) that fails the build on
  a safety regression, plus `policy-invariants`, `run-agent-guardrails`, `budget-tracker-shared` and
  `entitlement` suites.
- **Entitlement is pure + timezone-agnostic** (`entitlement.ts:19` takes `now`), and the ChatWidget
  gates on the per-user `hostedAvailable` so a lapsed-trial user sees a calm "connect a model" state,
  not a chat that only errors on send (`ChatWidget.tsx:271-281`, the 2026-07-27 V5 fix).

## Gaps, risks, what is missing
All four map to gap-to-95 V5; each is verified on disk.

1. **[functionality] `research_analyst` is built + tested but has no UI caller.** `runResearchAnalyst`
   is invoked only by `api/ai/agent/route.ts:44`; a grep for `api/ai/agent` outside that route returns
   nothing. Green but dead - it should be wired to a "Deep research" action or explicitly interned.
   (V5 finding 1.) Note `trade_readiness` is NOT dead - it is wired into the paper bot
   (`src/lib/trading/paper-bot.ts:133`).
2. **[functionality] AI Ops + `/api/ai/metrics` + `/api/ai/insights` render "0 runs" in production.**
   All three read `inMemoryAiRunStore.list()` directly (`ai-ops/page.tsx:39`, `metrics/route.ts:25`,
   `insights/route.ts:40`), but `resolveWriter` (`audit.ts:153-160`) auto-selects the Supabase writer in
   prod and never dual-writes to memory - so the operator views are always empty on the live deploy.
   `/ai-ops` is also an orphan page (no nav link; only referenced from `version.ts`, `system-card.ts`,
   `harness-map.json`). (V5 finding 2.)
3. **[resilience] Community scout-brief is the last hosted route on the per-lambda in-memory budget.**
   `api/community/ideas/brief/route.ts:105` calls the synchronous in-memory `chargeHostedBudget` while
   chat/brief/explain-signal/agent all use `chargeHostedBudgetShared`. Same class, same one-line fix.
   (V5 finding 3.)
4. **[correctness, defence-in-depth] The fabrication guard is still value-based for BARE numerals.**
   `guardrails/schema.ts:122-124` grounds a bare numeral if it equals any member of the whole allow-set,
   so a fabricated bare figure passes when the same integer appears elsewhere. The dangerous `%`/`x`/`$`
   case is closed (unit-strict); this is residual hardening, not a live decision-path leak. (V5 finding
   4.)

Not a defect, but load-bearing to remember: **`alert_composer` + `compose_alert_text` are declared in
the policy/registry but intentionally NOT wired** (`gateway.ts:8-12`, `policy.ts:55-67,86-102`) -
notifications are deterministic by design. Do not describe AI alert phrasing as a shipped capability.

## Where to find it
- **Gateway + resilience:** `src/lib/ai/gateway.ts` (providers, breaker, limiter), `src/lib/ai/resilience.ts`, `src/lib/ai/cost.ts`.
- **Entitlement + credentials + budget:** `src/lib/ai/entitlement.ts`, `src/lib/ai/credentials.ts`, `src/lib/ai/budget-tracker.ts`, `src/lib/api/ai-guard.ts`.
- **Guardrails:** `src/lib/ai/guardrails/engine.ts`, `schema.ts`, `prose.ts`, `injection.ts`; eval gate at `src/lib/ai/eval/gate.ts` + `golden-cases.ts`.
- **Agents:** `src/lib/ai/run-agent.ts`, `src/lib/ai/agents/registry.ts`, `src/lib/ai/policy.ts`, `src/lib/ai/tools/runtime.ts`.
- **Audit + metrics:** `src/lib/ai/audit.ts`, `src/lib/ai/metrics.ts`; operator views `src/app/ai-ops/page.tsx`, `src/app/api/ai/{metrics,insights}/route.ts`.
- **Routes:** `src/app/api/ai/{chat,brief,explain-signal,agent,status,system-card}/route.ts`.
- **UI:** `src/components/chat/ChatWidget.tsx`; settings `src/app/account/ai/page.tsx` -> `AccountSettings`.
- **Tables/migrations:** `ai_runs` (`supabase/migrations/019_ai_native_evidence.sql`), `profiles.ai_included` (`055_ai_included.sql`).
- **Tests:** `src/lib/ai/__tests__/*` (24 files), `src/lib/ai/guardrails/__tests__/*`, `src/lib/ai/eval/__tests__/*`, `src/app/api/ai/status/__tests__/route.test.ts`.

## Posture
Strong and wired on every primary journey, law-abiding and well-tested; the only open items are four
secondary/operator-surface gaps (one dead endpoint, empty prod operator dashboards, one in-memory
budget port, one defence-in-depth hardening).
