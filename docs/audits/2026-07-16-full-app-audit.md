# Lyra full app audit - verticals analysis

**Date:** 2026-07-16 (v0.7.0)
**Method:** six parallel scoped audits (backend/data, frontend/UX, onboarding, AI/ML, signals + coaching, developer-agent experience), read-only, synthesized here. Findings reference files as of this date; the AI/knowledge vertical was mid-build by a concurrent session (guardrails engine, budget, eval gate, knowledge layer all landed hours before this audit) - those findings are tagged [IN-FLIGHT].

---

## Executive verdict

Lyra's architecture is honest and its spine is strong: one house pattern per route, a genuinely deterministic scoring engine, RLS on every migrated table, a tested notification router, a golden-set AI eval gate, and repo guardrails (version lockstep, playbooks, doctor) that mostly tell the truth. The dominant failure mode is not bad code - it is **built-but-not-wired**. Across every vertical, finished components sit with zero production callers: outcome labeling, backtesting, the daily digest, three of four workers, the AI budget guard, the contracts directory, activation telemetry, demo-state migration. The second failure mode is **doctrine enforced on the structured paths but aspirational on the busiest ones**: chat/brief return unchecked model text, scores repaint on partial bars, and the root `sql/` schema ships tables with no RLS.

### Vertical scorecard

| Vertical | Grade | One-line verdict |
|---|---|---|
| Backend & data | B | RLS + webhook hardening genuinely good; one real P0 (RLS-less `sql/` tables) plus consistency debt (no Zod on 19 routes, vestigial env.ts, 3 response dialects) |
| Frontend & UX | B | One house pattern, zero orphan routes, honest DEMO badges; but the desktop nav clips a third of its items and there are zero error boundaries |
| Onboarding | C+ | Beautiful keyless demo; but configured deployments show a signup wall (doctrine-breaking), demo watchlist/prefs evaporate, nothing migrates on sign-up |
| AI/ML & knowledge | B- | Agent + GenUI paths enforce "engine owns numbers" for real; chat + brief enforce it with a system-prompt sentence only [IN-FLIGHT] |
| Signals engine | B- | Pure, tested, idempotent scoring; but partial-bar repainting, survivorship universe, no outcome evidence, 3 dormant workers |
| Coaching & notifications | B | Strongest spine in the app (router/dispatch/adapters); loop never closes - no digest, no retry, quiet-hours alerts permanently lost, no outcome follow-up |
| Developer-agent experience | A- | CLAUDE.md accurate to disk, full CI gate stack, coherent release flow; version guard is client-side only and the whole HTTP/UI surface is untested |

---

## Cross-cutting themes

1. **Built-but-not-wired is the #1 pattern.** `outcome_engine.py` + `backtest_engine.py` (tested, zero callers), `daily_digest`/`weekly_report` (types + router rules + default-ON prefs, no emitter), events/fundamentals/intelligence workers (no entrypoint, never scheduled), `evaluateProviderBudget` (inert), `contracts/notifications/` (referenced by nothing), `isolateExternalContent` (no caller), Upstash cache (exists, unused by rate limiter and AI outputs). Each is a short glue job away from being real.
2. **Doctrine holds where it is cheap, bends where it is hot.** "The AI never invents a number" is machine-enforced on agent/GenUI, prompt-enforced on chat/brief. "Numbers are engine-owned" is undermined by scoring the in-progress hourly bar. "Demo always works" is true only when Supabase env is absent.
3. **The guardrails guard the wrong side of the wire.** Version enforcement is a local git hook (CI never checks it); env validation covers 2 of ~33 vars; 28 API routes and 153 components have zero tests, so auth/secret/webhook checks can be deleted green.
4. **Honesty is the brand - keep the indicators honest.** The DEMO/stale/live badges are excellent. The always-on What's New dot, the hardcoded `Alerts: 'Off'` tile, digest preferences for a digest that does not exist, and "Watchlist done" for a watchlist that was dropped all spend the same trust the badges earn.
5. **The feedback loop to the operator is passive.** Scanner death is detectable only via the stale badge; `/api/health` has no last-scan freshness; activation has no telemetry; failed deliveries are terminal. Nothing pages anyone.

---

## Consolidated P0 register

| # | Finding | Vertical | Where | Fix |
|---|---|---|---|---|
| 1 | ~10 tables created with **no RLS** - anon key can read AND write `signal_outcomes`, `sentiment_scores`, `hype_scores`, etc.; app reads them back as truth | Backend | `sql/_apply_all_scanner_schema.sql` (015 policies never attach - tables do not exist at migration time) | Ship migration 030: enable RLS + read-only policies for every `sql/` table |
| 2 | Desktop nav rail **clips the bottom ~10 items with no scroll** (Paper Bot, Education, Settings unreachable at 1080p) | Frontend | `src/components/AppShell.tsx:143-167` | `overflow-y-auto` now; grouped rail next |
| 3 | **Zero error boundaries** - any throw = unbranded Next.js white screen | Frontend | no `error.tsx`/`not-found.tsx` anywhere in `src/app/` | Branded root `error.tsx` + `not-found.tsx` |
| 4 | **Signup wall on configured deployments** - demo exists only when Supabase env is absent; hosted visitors never see the product | Onboarding | `src/middleware.ts:52-61`, `src/app/welcome/page.tsx:27-30` | Read-only demo cookie honoured by middleware |
| 5 | **Demo onboarding watchlist silently lost** + no demo-to-account migration on sign-up (holdings/prefs stay in localStorage; user redoes onboarding) | Onboarding | `src/app/onboarding/page.tsx:135-160`; no local watchlist store exists | `local-watchlist.ts` fallback + one-shot migration prompt on first sign-in |
| 6 | **Chat + brief return raw model text** - no fabrication/advice/guardrail check; weak BYOK models can invent numbers [IN-FLIGHT] | AI | `src/app/api/ai/chat/route.ts:193-249`, `brief/route.ts:76-86` | Run `evaluateGuardrails` with grounding-derived allowed numbers (the run-agent.ts:156 pattern) |
| 7 | **3 of 4 workers never run** - events/fundamentals/intelligence have no entrypoint, no schedule, feed stale tables | Signals | `workers/{events,fundamentals,intelligence}_worker/main.py` | Add `__main__` entrypoints + daily workflow job |
| 8 | **Daily digest is vapor** - types, router rules, and default-ON prefs promise it; nothing emits it | Coaching | `types.ts:41,102-103`, `router.ts:285-302` | End-of-session worker step composing digest from the day's events |
| 9 | **Quiet-hours signal alerts permanently lost** - worker gates pre-dispatch, transition-based firing means no re-fire; router hold/release never sees them | Coaching | `workers/stock_scanner/main.py:110-121`, `alert_engine.py:210` | Drop the worker-side quiet gate; let the router hold/release |
| 10 | **Scores computed on the in-progress hourly bar** - published scores repaint; alerts can cite numbers history later contradicts | Signals | `workers/stock_scanner/market_data.py:43-78` | Discard the final bar unless close time <= now |
| 11 | **Version enforcement is client-side only** - `VD_SKIP_VERSION=1`, web edits, and hook-less clones all bypass; CI never checks | DX | `.github/workflows/ci.yml` (no check:version job) | 5-line CI job running `check-version-bump.mjs` vs base ref |
| 12 | **28 API routes, zero tests** - dispatch secret, webhook signatures, auth guards deletable with green CI | DX | `src/app/api/**/route.ts` | Handler tests for the 5 security-critical routes first |

---

## Per-vertical detail

### 1. Backend & data (B)

**Strong:** every migrated table has RLS with owner/global split; RPCs are security-invoker with explicit grants; Telegram/WhatsApp webhooks are genuinely hardened (constant-time compare, HMAC over raw bytes, Zod, closed command grammar, fail-closed pairing); service-role use is narrow (ticker registration + secret-fenced dispatch); demo fallback is uniform.

**P1:** `/api/trading/notifications` is unauthenticated and serves a process-global flags array - cross-user leak on any multi-user deploy (`src/lib/trading/notifications-store.ts:23`). Paper-bot approval gate trusts client-supplied `intent.status` (`paper-bot/route.ts:134,143`) - persist intents server-side (tables from migration 020 already exist). Portfolio PUT deactivate-then-insert is non-atomic - move to a transaction RPC. `src/lib/env.ts` validates 2 of ~33 vars; `NEXT_PUBLIC_LYRA_FREE_AI`, `LYRA_SHARED_GOOGLE_MODEL`, `TELEGRAM_PAPER_CHAT_ID` undocumented. No Zod on any first-party route body (webhooks only). AI chat audit rows record `userId:'local'` even when authenticated (`ai/chat/route.ts:82,233`).

**P2:** dispatch secret compared with `===` not timingSafeEqual; no rate limit on feedback/ticker-lookup/benchmarks (open Yahoo fetch amplifiers); rate-limit identity trusts first `x-forwarded-for` hop; limiter/idempotency state per-instance despite an existing Upstash backend in `src/lib/cache.ts`; three response-shape dialects; two service-role factories with different URL fallback order.

### 2. Frontend & UX (B)

**Strong:** ~40 routes, one pattern (thin server page -> `getDashboardData()` -> `AppShell` + one client view), zero orphans, zero code duplication (`/paper` is a deliberate redirect; `/trades` log vs `/trading` readiness is real separation). Hand-rolled SVG charts keep deps lean. Honest DEMO/stale/live badges. 44px touch floor met; `prefers-reduced-motion` handled.

**P1:** flat 32-item nav - the 6 groups exist only as code comments (`AppShell.tsx:55-98`); mobile is a 32-item horizontal scroll. Only 3/40 pages export `metadata`; `tickers/[symbol]` has no `generateMetadata`. `SignalTable.tsx:226-268` has no empty state on the flagship surface. Loading states are mostly dead code - per-page Suspense wraps already-resolved data; zero skeletons. What's New dot hardcoded always-on (`AppShell.tsx:259`). Watchlist tile hardcodes `Alerts: 'Off'` (`watchlist/page.tsx:27`).

**P2:** hover-only rail tooltips (no focus reveal); no OpenGraph/Twitter metadata anywhere; icon-only sort select without aria-label; title-style drift; 9-10px microcopy at the legibility floor. Also: `AppShell` re-mounts per navigation (pages render it individually rather than via a shared layout - they even wrote a scroll-restore workaround at `AppShell.tsx:133-139`).

### 3. Onboarding & first-run (C+)

**Strong:** keyless demo genuinely works; onboarding has 4 paths and captures real preferences; walkthroughs closely match reality; `/whats-new` is fresh.

Journey grades: landing B+, demo B, auth C+, onboarding A-, activation C, settings B-, walkthroughs A-, re-engagement C.

**P1 beyond the P0 register:** demo alert prefs go nowhere (`onboarding/page.tsx:164-175` only syncs when Supabase configured; never writes `src/lib/alert-prefs.ts`). Onboarding sells digest options the product cannot deliver. Auth callback swallows exchange errors (`auth/callback/route.ts:12-15`). Post-confirm dead end - manual re-sign-in required (`AuthForm.tsx:64`). Activation layer is unmeasured theatre - 5 scenes of copy, zero events. No lifecycle email; a user who bounces pre-channel-setup is unrecoverable.

**P2:** contradictory privacy copy ("Nothing is uploaded" beside account-sync panels, `AccountSettings.tsx:506-510`); demo auth copy misleads self-hosters; `/settings` is read-only with no threshold/universe editing; walkthrough sample outputs still say 0.6.0.

### 4. AI/ML & knowledge (B-) [vertical mid-build by concurrent session]

**Strong:** agent + GenUI paths derive numeral allow-sets from grounding, strip/refuse violating sentences, validate schema + citations. BYOK never logged or persisted (hash-only audit); hosted key auth-gated and model-pinned. Golden eval gate pins content behavior (advice blocks, injection blocks, fabricated numerals, wrong-guard detection). Demo degrades honestly (`no_key` -> deterministic fallback).

**P1:** budget guard has zero callers - hosted spend capped only by 30 req/min. Knowledge retrieval precision regressed as corpus grew (3/10 tests red; `MIN_SCORE = 4` floor in `retrieve.ts:85` now too low) [IN-FLIGHT]. Fabrication guard is digits-only outside GenUI - spelled-out figures pass; lift GenUI's `BANNED_PROSE_RE` into the engine. No circuit breaker - a down provider costs 3x30s per request and 6 hung calls stall every AI surface; 429s retried even on the hosted key.

**P2:** BYOK key in plaintext localStorage resent per request (acceptable but undocumented); `/api/ai/status` unauthenticated (key-presence recon); no AI output caching despite deterministic inputs; `isolateExternalContent` unwired (must land before live news/filings ingest); prompts versioned as code but never snapshot-tested.

### 5. Signals engine & coaching (B- / B)

**Strong (signals):** pure additive 0-100 rule score (RSI reset 25, MACD-improving 30, price-vs-low 15, trend 15, volume 15), no randomness, pure-function tests, idempotent upserts. **Strong (coaching):** tested router (relevance floor, mutes, day-scoped dedupe, safety-critical overrides, tz-aware quiet hours), held/release deferral, per-attempt idempotency, honest demo_logged states, template-gated WhatsApp. Education Hub binds live signals into lessons - a real coaching seed.

**P1 beyond the P0 register:** scanner workflow has no on-failure notification and no keepalive against GitHub's 60-day cron auto-disable - silent pipeline death. Failed deliveries are terminal (no retry, no dead-letter sweep). Held events strand if no new event arrives to trigger release (`dispatch.ts:441-449`). Outcome labeling unwired - `signal_outcomes` empty, StrategyLab/OutcomeHistoryPanel render placeholders, edge unproven. yfinance sole provider, no retry/backoff, empty frames silently skip tickers; Finnhub key already provisioned in the workflow but unused as fallback. No Python-to-TS e2e test of the dispatch bridge - field-name drift ships green. Duplicate quiet-hours logic drifts (hour-precision worker vs minute-precision router; dual pref key names).

**P2:** portfolio/watchlist dispatches default relevance to 100, bypassing the user floor; synthetic `DEMO_OUTCOMES` win rates linger in `src/lib/outcomes.ts:41`; universe duplicated in `universe.py` + seed; 50-ticker hand-picked mega-cap universe is survivorship by construction.

**Most valuable missing capability:** the nightly **outcome-labeling job** - engines, schema, and UI slots all exist; it unlocks both edge-evidence and the coaching follow-up loop ("NVDA setup from Jul 9 is +8%; median for this setup is +3.2%").

### 6. Developer-agent experience (A-)

**Strong:** CLAUDE.md verified accurate to disk (all claimed files/commands/playbook refs real - 15/15 paths in the 4 `.claude/commands` playbooks check out); CI runs type-check + lint + 421 vitest + no-secrets build + 183 pytest on every PR; release flow keeps version.ts/package.json/CHANGELOG/whats-new/health in lockstep; `py.mjs` makes worker scripts work from a clean clone; worker env reads 100% documented.

**Agent trap list (ways to break prod that no gate catches):** (1) version guard client-side only - `VD_SKIP_VERSION=1` is advertised in CLAUDE.md and the hook's own error text; (2) `content/*.jsonl` edits ship gate-free (shippable regex excludes `content/`; prebuild regenerates behavior at deploy); (3) zero route tests; (4) `sql/` + workflows outside the version guard; (5) migrations apply-by-hand, no CI step; (6) worker deps range-pinned with no lockfile; (7) 153 components, zero component tests.

**P1/P2:** hook ignores pushed refs (always diffs `origin/main...HEAD`; silently skips if base absent - fail closed instead); `contracts/` decorative; `doctor` checks env only (add hooksPath, Python interpreter, and a `select 1` schema probe); `/api/health` has no last-scan freshness; `release.mjs` parses TS with single-quote-only regexes; `.env.example` line-ordering bug ("trio above" is below).

---

## Ranked roadmap

### Same-day fixes (each under ~1 hour)
1. `overflow-y-auto` on the nav rail (P0 #2)
2. Discard the incomplete last candle in `market_data.py` (P0 #10)
3. CI version-guard job (P0 #11)
4. Scanner workflow failure-alert step + cron keepalive (silent-death class)
5. Widen the shippable-path regex (`content|sql|contracts` + config files)
6. Branded `error.tsx` + `not-found.tsx` (P0 #3)
7. `timingSafeEqual` on the dispatch secret; auth on `/api/trading/notifications`

### This-week (each a half-day to two days)
8. Migration 030: RLS for every `sql/` table + a CI lint that diffs `create table` vs `enable row level security` (P0 #1)
9. `local-watchlist.ts` + local alert-prefs seeding in demo onboarding (P0 #5a)
10. Route-handler tests for the 5 security-critical routes (P0 #12)
11. Chat/brief guardrail wiring - coordinate with the in-flight guardrails-engine session (P0 #6)
12. Quiet-hours drop-to-defer + scheduled held-release tick (P0 #9)
13. Grouped nav rail + mobile "More" sheet; per-route `metadata` exports
14. Auth callback error handling + auto-sign-in after confirm
15. Worker entrypoints + daily schedule for the 3 dormant workers (P0 #7)

### This-month (strategic)
16. Nightly outcome-labeling job -> light up OutcomeHistoryPanel/StrategyLab -> post-signal follow-up notifications (the single highest-value build in the app)
17. Daily digest emitter (composes day's events + top setups + outcome stats) (P0 #8)
18. Demo-to-account migration prompt + read-only demo for configured deployments (P0 #4, #5b)
19. One `guardRoute({auth, schema, scope})` route kit + full-schema `env.ts` with an ESLint ban on raw `process.env`
20. Activation telemetry (step events + first-alert milestone) so the funnel becomes measurable
21. Contracts enforcement test; retrieval golden set; per-provider circuit breaker; AI output caching

---

*Audit artifacts: six agent reports synthesized 2026-07-16. Re-run pattern: spawn one scoped read-only auditor per vertical, then reconcile into this register. Suggested cadence: after each minor-version release.*
