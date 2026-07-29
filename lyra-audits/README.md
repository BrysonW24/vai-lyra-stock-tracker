# lyra-audits

> **Current state:** [`STATE-AUDIT.md`](STATE-AUDIT.md) - how this part of Lyra works today (2026-07-29).

Recurring user-readiness audits of the Lyra codebase, modelled on Podium's `podium-audits`.
Each audit scores every product vertical out of 100 against the fixed rubric below, so scores
are comparable release over release. One dated report per audit run lives in this folder.

## Report convention

- Filename: `YYYY-MM-DD-user-readiness-audit.md` (date prefix, sorts chronologically).
- Every report records: the git SHA + app version audited, per-vertical score /100 with the
  five-dimension breakdown, gap list (P1/P2/P3 with file:line evidence), next steps (S/M/L
  effort), calibration adjustments, and one overall weighted score for the app.
- Never edit a past report to "fix" a score. New evidence = new dated report.

## How an audit runs

Sixteen independent auditors (one per vertical, run as parallel agents) score their vertical
against the shared rubric, citing file:line evidence for every claim. A seventeenth calibration
judge then spot-checks the most suspicious scores against the actual files, normalizes drift
between hard and easy graders, extracts cross-cutting defect patterns, and produces the overall
score weighted by user exposure (the scan, the data, the command centre, portfolio/watchlist,
the AI copilot, notifications, onboarding and auth are core; scout, knowledge, community, paper,
iOS, release and landing are peripheral).

Rules of engagement:

- Audit `origin/main` (or the clean working tree at HEAD) - read-only, never mutate.
- Read-only: no edits, no package scripts. grep / find / read only.
- Verify reachability before crediting a feature: grep for callers and imports. "Built, tested,
  green, and never wired" is this codebase's most recurrent historical defect class (the whole
  knowledge layer, and the `lyra_demo` cookie loop fixed in v0.81.0, are prior examples).
- Verify absence before reporting a gap: grep to confirm it is not handled elsewhere.
- Judge tests on whether assertions pin behavior, not shape. TZ-safe is mandatory (`TZ=UTC`).
- The one law to check everywhere AI appears: the deterministic engine decides, the AI only
  explains, and the AI never invents a number. A raw-AI route on the decision path is a defect.

## Scoring rubric (fixed - do not tweak between runs)

Score /100 = sum of five weighted dimensions:

| Dimension | Max | Question it answers |
| --- | --- | --- |
| functionality | 25 | Do this vertical's advertised user journeys work end-to-end in the shipped build? |
| correctness | 25 | Are user-facing outputs TRUE? Scores, signals, valuations, and AI claims measured, not guessed. Dead controls and unreachable "features" cost points here. |
| resilience | 20 | Offline / demo fallback, transport failures, Supabase absence, empty states, rate limits, data-loss protection, RLS/tenant fencing. |
| coverage | 15 | Do tests and gates pin the user-critical behaviors with behavioral assertions? |
| polish | 15 | UX consistency, loading/empty states, copy quality, accessibility (labels, 44px targets), glassmorphism/AA scrims, fit with the app shell. |

Bands: 90-100 ship-ready without reservation; 80-89 ready, minor polish owed; 70-79 usable with
visible rough edges; 50-69 functional core with significant gaps; below 50 not user-ready.

## The 16 verticals (fixed set - append new ones, never rename silently)

| # | Vertical | Scope (start here, follow imports/callers wherever they lead) | Weight |
| --- | --- | --- | --- |
| 1 | Scanner & Signal Engine | `src/lib/live-signals.ts`, `src/lib/score-model.ts`, `src/lib/pine/`; `workers/stock_scanner/{indicators,signal_engine}.py`; `/api/signals/[symbol]`; `src/app/radar`, `src/components/radar/`. RSI/MACD/score truth, thresholds (75/60/8), Python↔TS parity, `applyLiveSignals`. | core |
| 2 | Data Layer & Persistence | `src/lib/data.ts`, `src/lib/supabase/`, `src/lib/demo-data.ts`, `src/lib/local-dashboard.ts`; `supabase/migrations/`; `src/lib/local-portfolio.ts`, `local-watchlist.ts`, `local-trades.ts`. Supabase reads, RLS scoping, demo/Solo fallback duality, migration safety, data-loss protection. | core |
| 3 | Command Centre & Dashboard Shell | `src/app/page.tsx`, `src/components/AppShell.tsx`, `SoloCommandLayout.tsx`, `command-layout.ts`, `nav-prefs.ts`; overview/tickers pages; global nav (side rail + mobile bottom nav). Layout, KPI tiles, route reachability, empty states. | core |
| 4 | Portfolio & Watchlist Overlays | `src/lib/portfolio-actions.ts`, `local-portfolio.ts`, `local-watchlist.ts`, `cgt.ts`; `/api/portfolio`, `/api/watchlist`; `src/app/portfolio`, `watchlist`; `src/components/portfolio/`, `watchlist/`. Valuation, overlays, alert thresholds, add/edit flows. | core |
| 5 | AI Copilot, Entitlement & Grounding | `src/lib/ai/` (gateway, credentials, entitlement, budget-tracker); `/api/ai/*` (chat/brief/explain-signal/agent/insights/status/system-card); `src/lib/api/ai-guard.ts`; `src/components/chat/`. Grounding, BYOK, 14-day trial gating, the AI-never-decides law, breaker/fallback. | core |
| 6 | Notifications & Multi-Channel Delivery | `src/lib/notifications/`, `src/lib/push/`; `/api/notifications*`, `/api/push/*`, `/api/webhooks/{telegram,whatsapp}`; `contracts/notifications/`; `src/lib/alert-prefs.ts`. `routeNotification` (quiet hours, relevance floor, cap, safety bypass), channel dispatch. | core |
| 7 | Onboarding & Demo->Account Journey | `src/app/onboarding/`, `src/lib/onboarding*.ts`, `demo-carryover.ts`, `product-tour.ts`; `src/app/welcome/`; `/api/demo`, `/api/onboarding`; `src/components/onboarding/`, `AiTrialSplash.tsx`, `DemoConversionCta.tsx`. First-run, full-setup carryover, splash, capture->persist->AI contract. | core |
| 8 | Auth, Accounts & Middleware | `src/middleware.ts`, `src/app/auth/`, `src/lib/auth/`, `src/lib/account.ts`, `src/lib/ai/entitlement.ts`; `/api/account*`. Session gating, RLS belt-and-braces, mandatory-onboarding gate, `lyra_demo` handling, trial/grant. | core |
| 9 | Worker Fleet & Scheduler | `workers/{stock_scanner,intelligence_worker,events_worker,fundamentals_worker,scout}/`; `.github/workflows/*.yml`. Hourly scan, nightly maintenance (outcomes, digest, delivery sweep), scheduler guard, no-hosted-AI-in-workers invariant. | peripheral |
| 10 | Scout, Findings & Intelligence Feed | `src/lib/findings/`, `src/lib/intelligence.ts`, `research-queue.ts`, `insider-flow.ts`, `catalysts.ts`, `gov-awards.ts`, `smart-money*`; `/api/scout/*`, `/api/findings/*`, `/api/ingestion/*`; intelligence/wire/small-caps pages. Promotion bar, news, provenance. | peripheral |
| 11 | Knowledge Layer & GenUI | `src/lib/knowledge/`, `src/lib/generated/knowledge.json`, `scripts/build-knowledge.mjs`; `/api/findings/genui`, `/api/ai/system-card`. Deterministic lexical retrieval (no embeddings), GenUI typed cards, SOURCES integrity. | peripheral |
| 12 | Solo & Community Surface | Solo deployment mode; `community-contract.ts`, `community.ts`, `community-key.ts`; `/api/community/*`; `src/components/community/`; `SoloUpgradeCta.tsx`; `flags.ts`. Cross-origin classification, idea provenance, upgrade path, env-scoped flags. | peripheral |
| 13 | Paper Trading & Track Record | `src/lib/paper-trading.ts`; `/api/trading/*` (paper-account, paper-bot, benchmarks, notifications); `src/app/paper`, `paper-bot`, `track-record`, `trades`; `/api/track-record`, `/api/trades`. Paper account honesty, bot commands, benchmark truth. | peripheral |
| 14 | iOS Native Shell | `ios/App/`, `capacitor.config.ts`, `native/shell/`; safe-area / keyboard / scroll handling; offline fallback page. WKWebView remote-shell model (loads prod, so web deploys update the app), install flow. | peripheral |
| 15 | Release Engineering & Quality Gates | `src/lib/version.ts` ritual; `scripts/` gates (`check:version/chains/onboarding/onboarding-contract/migrations/schema-drift/deploy/data-economics/ledgers`); `.githooks/pre-push`; `HARNESS.md`, `SKILL-CHAIN.md`, `LOOPS.md`; CI. Do the gates detect the failure classes they claim; any gate theater. | peripheral |
| 16 | Landing & Acquisition Surfaces | `src/app/welcome/page.tsx`, `src/components/landing/`; `README.md`, `SHARE.md`, `DATA-FLOW.md`, `HOW-LYRA-WORKS.md`; the two-link Solo/Full share model. Copy truth vs shipped features/counts, CTA correctness, honest no-signup path. | peripheral |

## Movement log

[`AUDIT-LOG.md`](AUDIT-LOG.md) is the standing trend view over all runs - overall + per-vertical
movement as ASCII, with the *why* behind each move. Append a column each audit; the dated reports
stay the evidence.

## Audit history

| Date | Report | Version audited | Overall |
| --- | --- | --- | --- |
| 2026-07-27 | [2026-07-27-user-readiness-audit.md](2026-07-27-user-readiness-audit.md) | v0.82.0 @ 85f779d (working tree) | 82.3/100 |
