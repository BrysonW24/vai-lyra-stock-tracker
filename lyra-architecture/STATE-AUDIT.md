# lyra-architecture - State Audit
_2026-07-29 · Lyra v0.89.0 · HEAD 9e5953c · read-only assessment_

## Scope
The runtime, data, service, scale and failure boundaries of Lyra: the Next.js app + Python
worker fleet + Supabase + Upstash topology, the three run modes (demo / solo / supabase),
the remote-shell iOS app, the deploy path (Vercel git-push, solo mirror), and how the system
degrades when a dependency is absent or erroring. Maps to gap-to-95 V14 (iOS shell) + V2 (data layer).

## Lyra as it is today
Lyra is one web app plus a background write-fleet, wired so the frontend never owns a number.

- **Web tier:** Next.js 15 App Router / React 19, **54 page routes** (`find src/app -name page.tsx`)
  and **47 API routes** (`src/app/api/**/route.ts`). One deployable web unit; middleware + server
  clients enforce auth and RLS.
- **Worker fleet:** **5 Python packages** on disk - `stock_scanner`, `events_worker`,
  `fundamentals_worker`, `intelligence_worker`, `scout` (`workers/`). They are NOT in the web
  image (`Dockerfile:3-5`); they run on GitHub Actions schedules and write to Supabase.
- **Data tier:** Supabase Postgres, **55 ordered migrations** (`supabase/migrations/`, latest
  `055_ai_included.sql`), read from the browser/server via the anon key under RLS; `sql/` is a
  retained older scanner-only path (`ARCHITECTURE.md:162-163`).
- **Cache / shared-state tier:** Upstash Redis over REST, or an in-process TTL map when the env
  pair is absent (`src/lib/cache.ts:30-34, 91-114`). Prod `/api/health` reports `cache:"upstash"`.
- **iOS:** a Capacitor 8 **remote shell** - a thin WKWebView pointed at prod
  (`capacitor.config.ts:14-15`), so every web deploy updates the app with no resubmission;
  only shell/icon/plugin changes need a native build (`capacitor.config.ts:5-8`). TestFlight build 3.
- **Deploy:** Vercel, framework `nextjs`, region `iad1`, one daily cron
  (`vercel.json:2-13`); deploys by **git push** to `main`, with the Solo surface mirrored on the
  `solo` branch (`sync-solo-branch.yml`, one of **6 CI workflows**). The root `Dockerfile` is a
  self-host (Coolify) path Vercel ignores (`Dockerfile:1`).

The **three modes are one pipeline** - the mode changes inputs and sinks, not code paths.
`getDashboardData()` (`src/lib/data.ts:396`) branches on whether a Supabase server client exists:
null -> **solo** (`data.ts:400-405`, `mode:'solo'` set at `local-dashboard.ts:25`); present ->
**supabase** (`data.ts:496-498`, `mode:'supabase'`); the seeded fallback object is **demo**
(`demo-data.ts:24`, `mode:'demo'`). **AI** is a fourth layer (BYOK or hosted-key) laid on top, not
a data-source branch.

## How it works
- **Solo (no DB):** the server computes every signal live on page load - fetches ~1yr of daily
  OHLCV from public Yahoo Finance (`live-signals.ts` `fetchOhlcv`), recomputes the exact TS port of
  the Python score, overlays it, renders. Device-local portfolio/watchlist only
  (`DATA-FLOW.md:34-70`).
- **Prod (Supabase):** a two-part system. Part 1 is the background hourly scanner that sweeps the
  full universe and *stores* signals to Supabase (`hourly-stock-scanner.yml`). Part 2 is the read
  path: `getDashboardData()` reads the latest stored rows in parallel - `stock_tickers` (<=500),
  `stock_signals` (80), `stock_scanner_runs` (1), `stock_alerts` (20) (`data.ts:412-418`) - re-applies
  the *same* live Yahoo overlay once so the on-screen score is current (`data.ts:434`), then layers
  the signed-in user's portfolio/watchlist scoped by both RLS and an explicit `user_id` filter
  (`data.ts:448-470`).
- **Degradation-to-demo is layered, per field:** no client -> solo (`data.ts:400`); a hard read
  error on the core tables -> whole payload falls to `demoDashboardData` (`data.ts:421-423`, and the
  outer `catch` at `:509-510`); the portfolio/watchlist block has its own guarded `try/catch` so a
  missing overlay table never breaks the core dashboard (`data.ts:445-492`).
- **Cache contract:** caching is an optimisation, never a requirement - every backend error degrades
  to a miss (`cache.ts:11-15, 156-163`); `cacheBackendStatus()` is the one place a dead Redis
  surfaces, via a bounded ~800ms PING (`cache.ts:133-148`), consumed by `/api/health`.
- **Health probe:** `/api/health` (`src/app/api/health/route.ts`) is public + unauthenticated,
  reports `version`, `mode` (live/demo from build-time env presence, `:39,44`), verified `cache`
  status (`:47`), and `lastScanAt` so a dead cron is visible (`:14-30, 50`).

## Strengths (verified)
- **One pipeline, three modes, no branching duplication** - inputs/sinks change but the score math
  is a single TS port shared by solo and prod (`DATA-FLOW.md:3-11`), enforced by the mode literals at
  three distinct call sites (`data.ts:498`, `local-dashboard.ts:25`, `demo-data.ts:24`).
- **Clean tier separation** - workers are physically excluded from the web image
  (`Dockerfile:3-5`); the deterministic engine owns every number and the frontend only renders it
  (`CLAUDE.md` Conventions).
- **Fail-soft everywhere on the read path** - client-null, core-table-error, overlay-error and outer
  exception all have explicit fallbacks (`data.ts:400,421,490,509`); cache errors read as a miss
  (`cache.ts:156-163`).
- **Remote-shell iOS invariants are pinned** - `errorPath` and `contentInset:'never'` carry QA-finding
  rationale inline (`capacitor.config.ts:16-26`); web deploys update the binary with no resubmission.
- **Deploy identity is provable** - `/api/health` exposes version + verified cache + scan freshness,
  so a deploy can be checked to have actually shipped (`health/route.ts:32-51`).
- **Env access is Zod-validated and optional-by-design** - `src/lib/env.ts` makes the Supabase pair
  optional so a keyless clone boots straight into demo/solo (`env.ts:5-8`).

## Gaps, risks, what is missing
- **The `lyra-architecture` operating folder is otherwise greenfield** - only `README.md` exists on
  disk (`find lyra-architecture`); this STATE-AUDIT is its first real artifact. No ROADMAP,
  decision-register or risk-register yet.
- **The canonical `ARCHITECTURE.md` is drifted/stale** (dated 16 July 2026). It claims "43 page
  routes, 28 application API routes, four worker packages, 28 Supabase migrations"
  (`ARCHITECTURE.md:10-12`) against the current **54 / 47 / 5 / 55** on disk, still calls Lyra a
  "Momentum Radar" in its title (it is an oversold-recovery scanner), and its "Known Technical Debt"
  still lists `/api/health` as returning 404 in prod (`:170-171`) - now false. DATA-FLOW.md line
  numbers have also drifted a few lines (self-disclaimed at `:153`).
- **Degradation-to-demo can leak a seeded book (V2 resilience gap).** `data.ts:422` and the outer
  catch `:510` return raw `demoDashboardData`, which carries a seeded portfolio/watchlist; on a
  *configured-but-erroring* deploy `mode` resolves to `'demo'` (not solo), so the view renders the
  fabricated book to a signed-out user. Fix: strip portfolio/watchlist/alerts on the error fallbacks
  (gap-to-95 V2.2).
- **Cross-instance state is still in-memory on secondary paths (V6/V5/V12 resilience).** The
  Upstash-backed shared store (`cache.ts`) was adopted for the AI budget but never for the webhook
  token-bucket + telegram sender dedupe (`new Map` in module memory), the community scout-brief
  budget, or the anonymous rate limiter - each resets per serverless cold start (gap-to-95 patterns 3,
  V6.3/V5.3/V12.5). Same substrate, same fix, not yet applied.
- **iOS shell carries an inert plugin + ungated offline copy (V14).** `@capacitor/push-notifications`
  is bundled with zero callers and no `aps-environment` entitlement - built-but-unwired dead weight
  (gap-to-95 V14.1). And nothing asserts the `native/shell/index.html` offline page (Retry + prod URL)
  or byte-identity with the manually-copied `ios/App/App/public/index.html`, so drift ships silently
  (V14.2).
- **Account-backed read mappers are untested** - `mapPortfolio`/`mapWatchlist`/`deriveSignalChanges`/
  `latestSignals` hold real precedence logic but have zero test references while the Solo builders are
  pinned (gap-to-95 V2.1). This is the data layer's biggest coverage lever.

## Where to find it
- **Structure / motion / enforcement docs:** `ARCHITECTURE.md` (stale - verify against disk),
  `DATA-FLOW.md` (mode topology), `LOOPS.md` (12 loops end to end), `HARNESS.md`, `SKILL-CHAIN.md`.
- **Mode branching + degradation:** `src/lib/data.ts:396-512`; solo assembly
  `src/lib/local-dashboard.ts`; demo seed `src/lib/demo-data.ts`; live recompute `src/lib/live-signals.ts`.
- **Boundaries / config:** `src/lib/env.ts`, `src/lib/cache.ts`, `src/app/api/health/route.ts`,
  `src/lib/supabase/server.ts:28,64` (null-client path).
- **Deploy / shell:** `vercel.json`, `Dockerfile`, `capacitor.config.ts`, `native/shell/`,
  `.github/workflows/` (6 workflows incl. `sync-solo-branch.yml`, `deploy-smoke.yml`).
- **Data / workers:** `supabase/migrations/` (55), `workers/` (5 packages), `sql/` (legacy path).
- **Gap detail:** `lyra-audits/2026-07-29-gap-to-95-audit.md` sections V2 (93/100) + V14 (93/100).

## Posture
Strong and wired - a clean three-mode single-pipeline topology with fail-soft read paths and a
provable deploy identity; the residual risk is doc drift in `ARCHITECTURE.md`, a seeded-book leak on
the error fallback, and un-ported serverless in-memory state on secondary paths.
