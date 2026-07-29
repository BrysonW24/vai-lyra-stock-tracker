# lyra-metrics - State Audit
_2026-07-29 · Lyra v0.89.0 · HEAD 9e5953c · read-only assessment_

## Scope
KPI / economics / claim + event contracts: what Lyra actually measures about itself today - the
data-economics budgets and benefit-horizons enforced by the nightly gate, the `/api/health`
version + scan-freshness probe, the notification-engagement behavioural ledger, the AI operational
metrics surface - plus the typed event/claim contracts that keep the numbers honest, and the honest
absence of any product-KPI/OKR registry or business-metrics dashboard.

## Lyra as it is today
The measurement that exists is **infra + engine self-observation**, not product analytics.

- **Data-economics gate (the one real standing KPI system).** `scripts/check-data-economics.mjs`
  carries a manifest of **15 monitored tables** (`:58-98`), each with a steady-state MB budget, an
  audited benefit-horizon (age past which no reader benefits), a `prunedBy` enforcer, and a `feeds`
  string naming the value it serves. It measures whole-DB size against tripwires (warn 250 MB / fail
  300 MB, `:52-53`), per-table budget breaches (`:199`), sunk rows past each horizon
  (`:201-202`, WARN past 50%), and 7-day write rates. It runs nightly with `--require-db`
  (`.github/workflows/nightly-maintenance.yml:52`) - NOT in `ci.yml`. Doctrine lives in
  `DATA-ECONOMICS.md`; the file itself says "change horizons HERE first, then the manifest"
  (`DATA-ECONOMICS.md:172-173`). Last **measured 2026-07-17**: 87 MB / 500 MB (17%), ~1.1 MB/day
  (`DATA-ECONOMICS.md:8,90`).
- **`/api/health` liveness + build-identity probe** (`src/app/api/health/route.ts`). Public,
  unauthenticated, returns `{ok, version, versionDate, mode, cache, lastScanAt}` (`:40-51`).
  `lastScanAt` reads the newest `stock_scanner_runs.finished_at` (`:14-30`) so a dead scanner cron
  is visible - "older than ~2h during market hours means the cron is dead" (`:49-50`). `cache` is a
  real ~800ms PING, not env-derived (`:46-47`).
- **Notification-engagement ledger** (`src/app/api/notifications/engaged/route.ts`). A client beacon
  on tagged deep links (`?nid=&ch=`) writes one `notification_engagements` row per first
  (event, channel) - "the first behavioral signal the alert layer has ever accumulated" (`:6-9`),
  validated against a real `notification_events` row before insert (`:44-50`), migration
  `050_learning_ledgers.sql`.
- **AI operational metrics** (`src/lib/ai/metrics.ts` `aggregateAiRuns`, pure + tested in
  `__tests__/metrics.test.ts`) computes throughput, latency p50/p95, and refusal / guard-block /
  error rates per agent + provider from `AiRunRecord`s. Surfaced at `/api/ai/metrics`,
  `/api/ai/insights`, and the `/ai-ops` page.
- **Claim + event contracts** (`contracts/`): `notifications/notification-contracts.schema.json`
  types `ChangeSnapshot` / `AlertEvent` / `NotificationMessage` / `HourlyDigest` with the load-bearing
  rule `facts_used` MUST be a subset of the event's verbatim `facts` (`:103-104,131` - "no invented
  numbers"); `notifications/test-register.json` pins golden cases with `no_invented_numbers`
  (`:14,52`); `score-golden-vectors.json` is the cross-language TS/Python score-parity contract.

## How it works
`DATA-ECONOMICS.md` is prose doctrine; `check-data-economics.mjs` is its executable mirror - one
`psql` round trip (`:169-184`) returns per-table rows, bytes, `past_horizon` count and `rows_7d`,
then a pure judge (`:192-207`) emits WARN/FAIL. It also runs a **manifest-drift check** first
(`:156-165`): a monitored table or age-column missing from the live schema FAILS, so "a manifest
that names a ghost is the same lie as a check that always passes". The gate **only measures - it
never deletes** (`:14-15`); pruning jobs are founder-ratified and separately shipped
(`DATA-ECONOMICS.md:175-181`). Horizons are set by each table's *binding reader* (the deepest
lookback), traced in a 2026-07-18 adversarially-verified read-path audit (`DATA-ECONOMICS.md:134-198`).
The notification-engagement ledger is the accumulate-half of Loop 4; routing does **not** yet read it
back - a deliberately open half-loop (`LOOPS.md:174-177`). The event/claim contracts sit between the
deterministic engine (fills `AlertEvent.facts` verbatim) and the AI composer (may only cite those
fact keys), enforced by the golden test-register.

## Strengths (verified)
- **Weight is always read next to worth.** Every one of the 15 monitored tables names what it
  `feeds` (`check-data-economics.mjs:63-97`) - the gate answers "does this megabyte earn its keep",
  not just "is it small".
- **The economics gate cannot silently skip where it matters.** `--require-db` turns a missing DB
  URL into a FAIL (`:120-128`), and manifest drift FAILS before any measurement (`:161-165`).
- **Horizons are evidence-grounded, not guessed.** Each is pinned to a named binding reader with
  file evidence (e.g. candles = 380d yearly-review baseline, `DATA-ECONOMICS.md:144`); one adversarial
  refutation actually landed and is reflected (notifications kept-forever, `:150,198`).
- **Health probe surfaces a dead cron.** `lastScanAt` made an auto-disabled scanner visible from the
  probe where it "previously ... still looked perfectly healthy" (`health/route.ts:9-12`).
- **Numbers cannot be invented in any claim.** `facts_used ⊆ facts` is schema-enforced and golden-
  tested (`test-register.json` `no_invented_numbers`), and the AI-metrics aggregator is a pinned pure
  function.

## Gaps, risks, what is missing
- **No product-KPI / OKR / business-metrics layer - largely greenfield.** `lyra-metrics/` holds only
  a stub `README.md` ("fill as the work appears"); the advertised `ROADMAP.md`,
  `decision-register.json`, `risk-register.json`, `skill-chains.md` do **not** exist on disk. A
  repo-wide search finds no north-star metric, no activation/retention/conversion funnel, no
  KPI/OKR registry. The only user-behaviour signal captured anywhere is the notification-engagement
  ledger - and nothing reads it back yet.
- **AI Ops metrics render "0 runs" in production.** `/ai-ops` and `/api/ai/metrics` aggregate
  `inMemoryAiRunStore.list()` (`ai-ops/page.tsx:39`, `ai/metrics/route.ts:25`), but `resolveWriter`
  auto-selects the Supabase `ai_runs` store when service-role env exists and never dual-writes memory
  (`audit.ts:153-160`), so the operator surface reads an empty process store in prod. This is the
  gap-to-95 **V5 finding 2** (built-tested-green-never-wired to the durable store).
- **The economics gate has no red/green self-test.** It is one of the five gates the gap-to-95
  **V15 finding 1** flags as un-self-tested - it runs nightly and could silently regress to
  always-pass; its budget/horizon judge logic is inline, not extracted to a tested `gate-logic.mjs`.
- **The measured numbers are ~12 days stale.** `DATA-ECONOMICS.md` is stamped 2026-07-17 (87 MB,
  89 tables) against a v0.89.0 build the snapshot puts at ~83 tables; the file's own contract is
  "the measurement wins and this file gets corrected" (`:219`) - a re-measure is owed.
- **Engagement -> routing half-loop is open by design** (`LOOPS.md:174-177`): the behavioural ledger
  accumulates but relevance tuning does not consume it, so there is no closed feedback metric yet.

## Where to find it
- Gate + manifest: `scripts/check-data-economics.mjs` (tables `:58-98`; judge `:192-207`); wired
  `.github/workflows/nightly-maintenance.yml:52`; `package.json` `check:data-economics`.
- Doctrine: `DATA-ECONOMICS.md` (TL;DR, table economics §3, runway/tripwires §4, audited horizons §6).
- Health probe: `src/app/api/health/route.ts`.
- Engagement ledger: `src/app/api/notifications/engaged/route.ts`; migration `supabase/migrations/050_learning_ledgers.sql`.
- AI metrics: `src/lib/ai/metrics.ts` (+ `__tests__/metrics.test.ts`), `src/app/api/ai/metrics/route.ts`, `src/app/api/ai/insights/route.ts`, `src/app/ai-ops/page.tsx`, `src/lib/ai/audit.ts`.
- Contracts: `contracts/notifications/notification-contracts.schema.json`, `contracts/notifications/message-templates.json`, `contracts/notifications/test-register.json`, `contracts/score-golden-vectors.json`.
- Motion map: `LOOPS.md` (Loop 4 notifications, Loop 10 data-economics).
- Domain home: `lyra-metrics/README.md` (stub only).

## Posture
Infra + engine self-measurement is strong and wired (a genuinely enforced data-economics gate,
honest health probe, no-invented-numbers claim contracts); the product-KPI / OKR / business-metrics
side is greenfield, and the two shipped metrics surfaces read stores that are empty in prod.
