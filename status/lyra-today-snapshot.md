# Lyra - as it is today (state snapshot)

Grounded facts for the 2026-07-29 whole-app state audit. This is the shared source of truth every
`lyra-<domain>/STATE-AUDIT.md` references - probed from the repo + prod, not asserted. Re-probe and
update when the numbers move.

- **Version:** 0.89.0 (`src/lib/version.ts` RELEASES[0]); HEAD `9e5953c`.
- **Prod:** `https://lyra.vivacityai.com.au` - `/api/health` returns `{ok:true, version:"0.89.0",
  mode:"live", cache:"upstash"}`, last scan fresh. Deploys via **git push** (Vercel; no CLI deploys).
  Solo surface mirrors `main` on the `solo` branch.
- **iOS:** Capacitor 8 remote shell (thin WKWebView -> prod). **TestFlight build 3** uploaded
  2026-07-28 (`MARKETING_VERSION 1.0.0`, `CURRENT_PROJECT_VERSION 3`). Web deploys update the app with
  no resubmission; only shell/icon/plugin changes need a native build.

## What Lyra is

A research-first tech-stock **oversold-recovery scanner**. A deterministic engine scores beaten-down
names showing an early turn (RSI 35-50 reset band, still-negative-but-improving MACD histogram, price
within ~10% of the 60-period low). **The one law: the deterministic engine decides; AI only explains
and never invents a number, never gives advice (research only).**

Three run modes (one pipeline, mode changes inputs/sinks not code paths):
- **demo** - no keys, seeded sample data (`mode:'demo'`).
- **solo** - local-first, no account (`mode:'solo'`).
- **supabase / live** - Supabase-backed, signed in (`mode:'supabase'`).
- **AI** - bring-your-own-key (browser-local) or a hosted key gated by entitlement, layered on top.

## Stack

Next.js 15 (App Router) + React 19 + TypeScript strict + Tailwind 3.4 + Zustand + TanStack Query +
React-Hook-Form/Zod. Supabase (Postgres + RLS) via anon key for reads. Python workers (pandas,
yfinance, ta). Sentry. Capacitor 8 (bundled iOS shell). Upstash Redis (cache + shared rate-limit/budget).
Provider-agnostic AI gateway (Anthropic / OpenAI / OpenRouter / Gemini).

## Scale (probed 2026-07-29)

| Surface | Count |
|---|---|
| App routes (`src/app/**/page.tsx`) | 63 |
| API routes (`src/app/api/**/route.ts`) | ~48 |
| Supabase migrations | 55 (latest `055_ai_included.sql`) |
| Postgres tables | ~83 |
| Python workers | 5 (`stock_scanner`, `events_worker`, `fundamentals_worker`, `intelligence_worker`, `scout`) |
| CI workflows | 6 (`ci`, `deploy-smoke`, `hourly-stock-scanner`, `nightly-maintenance`, `rba-decision-alert`, `sync-solo-branch`) |
| Quality gates | 9 `check:*` (chains, data-economics, deploy, ledgers, migrations, onboarding, onboarding-contract, schema-drift, version) |
| Vitest | 144 test files / ~1070 `it/test` calls |
| Pytest | 32 test files |
| Skill chains (`.claude/commands`) | 17 |
| Top-level governance docs | 20 (ARCHITECTURE, HARNESS, LOOPS, SECURITY, DATA-ECONOMICS, ONBOARDING, ...) |

## Current audit posture (see `lyra-audits/`)

- **2026-07-27 user-readiness audit:** weighted **82.3/100** baseline (16 verticals, 5-dim rubric).
- **Remediation wave v0.83.0 -> v0.89.0:** every vertical to >=90; all P1s closed.
- **2026-07-29 gap-to-95 audit:** weighted **91.7/100**, every vertical 90-94, **0/16 at 95**, 52
  concrete gaps enumerated. Two correctness fixes lead: onboarding gate releases before saves confirm
  (V7/V8); hype-meter fabrication-as-live re-introduced by remediation (V9).

## Enforcement backbone

`HARNESS.md` (a green must be able to go red) + `SKILL-CHAIN.md` (every code section has an owning
chain; `check:chains` = 323 sections / 13 chains / 0 orphans) + `LOOPS.md` (every loop end to end) +
the pre-push version-bump hook + the CI gate suite + the executable RLS tenant-fence in the
migrations-from-zero job. Releases: prepend `RELEASES` -> `npm run release` -> gates -> push main + solo.
