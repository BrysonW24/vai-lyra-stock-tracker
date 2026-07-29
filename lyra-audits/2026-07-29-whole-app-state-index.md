# Lyra whole-app state audit - index (2026-07-29)

Every operating domain now has a genuine, evidence-grounded **STATE-AUDIT.md** in its own folder: how
that part of Lyra actually works today, its strengths, its honest gaps, and where to find the evidence.
This is the map - go to any folder and read its `STATE-AUDIT.md`; this index tells you the one-line state.

- **Shared facts anchor:** [`../status/lyra-today-snapshot.md`](../status/lyra-today-snapshot.md) - the
  probed numbers (v0.89.0, 63 routes, ~48 API routes, 55 migrations, ~83 tables, 5 workers, 6 CI
  workflows, 9 gates, 144 vitest files/~1070 tests, 32 pytest) every domain audit is anchored to.
- **App-wide readiness:** [`2026-07-29-gap-to-95-audit.md`](2026-07-29-gap-to-95-audit.md) (16 verticals,
  weighted 91.7/100, 52 gaps to 95) + [`AUDIT-LOG.md`](AUDIT-LOG.md) (trend).
- **Method:** read-only, at HEAD `9e5953c`. Code-grounded domains were audited by parallel agents (each
  opening real files, citing file:line); greenfield/business domains were written directly. Nothing is
  fabricated - an honest "greenfield" is recorded as such.

## The map

| Domain | State audit | One-line posture |
|--------|-------------|------------------|
| AI Copilot & the one law | [`lyra-ai/STATE-AUDIT.md`](../lyra-ai/STATE-AUDIT.md) | Strong + wired (93/100); gaps are secondary/operator surfaces (research_analyst dead, AI-Ops reads empty in prod). |
| Architecture | [`lyra-architecture/STATE-AUDIT.md`](../lyra-architecture/STATE-AUDIT.md) | Strong 3-mode single-pipeline topology; residual = ARCHITECTURE.md doc drift + a few failure/state edges. |
| Audits (this system) | [`lyra-audits/STATE-AUDIT.md`](../lyra-audits/STATE-AUDIT.md) | Established + trend-tracked (82.3 -> 91.7); the reference home. |
| Back office | [`lyra-back-office/STATE-AUDIT.md`](../lyra-back-office/STATE-AUDIT.md) | Entitlement primitive + legal disclaimers live; billing/tax/subscriptions greenfield. |
| Bugs | [`lyra-bugs/STATE-AUDIT.md`](../lyra-bugs/STATE-AUDIT.md) | Ledger seeded with the 2 known correctness defects; no screenshot evidence yet. |
| Competitors | [`lyra-competitors/STATE-AUDIT.md`](../lyra-competitors/STATE-AUDIT.md) | Greenfield; positioning exists, no teardowns. |
| Content & knowledge | [`lyra-content/STATE-AUDIT.md`](../lyra-content/STATE-AUDIT.md) | Deterministic, fail-closed knowledge/GenUI/education wired in chat; gaps = discoverability + a missing route test + a knowledge.json CI drift gate. |
| Cyber | [`lyra-cyber/STATE-AUDIT.md`](../lyra-cyber/STATE-AUDIT.md) | Executable RLS fence proven in CI, fail-safe session gate; untested write-side (047 role UPDATE) + fence omits operator_profiles/user_settings. |
| Design | [`lyra-design/STATE-AUDIT.md`](../lyra-design/STATE-AUDIT.md) | One coherent code-defined glass system across ~104 components; thin render tests + 3 S-effort polish stragglers (32px close, h-8/h-9 inputs, flip-card AA). |
| Evals | [`lyra-evals/STATE-AUDIT.md`](../lyra-evals/STATE-AUDIT.md) | Real offline safety/quality/retrieval gates, CI-gated, feeding a public System Card; gaps = small datasets + untested GenUI route ladder. |
| Forecasting | [`lyra-forecasting/STATE-AUDIT.md`](../lyra-forecasting/STATE-AUDIT.md) | Cost-economics + reliability grounded + gate-enforced; demand/retention/revenue greenfield. |
| Marketing | [`lyra-marketing/STATE-AUDIT.md`](../lyra-marketing/STATE-AUDIT.md) | Landing live + tested; campaigns/channels/growth-experiments greenfield. |
| Metrics | [`lyra-metrics/STATE-AUDIT.md`](../lyra-metrics/STATE-AUDIT.md) | Infra self-measurement strong (data-economics gate, /api/health); product-KPI/OKR greenfield + 2 metrics surfaces read empty in prod. |
| Modelling | [`lyra-modelling/STATE-AUDIT.md`](../lyra-modelling/STATE-AUDIT.md) | One deterministic score law, cross-language parity-guarded; thin display-composition seam + unproven raw-indicator parity. NEW: predictive-model track (Emerging Winner Engine) in research. |
| Operations | [`lyra-operations/STATE-AUDIT.md`](../lyra-operations/STATE-AUDIT.md) | TZ/DST-correct scheduling with dropped-slot defenses; gaps = hype fabrication-as-live + a dead nightly write + untested read-side. |
| Reporting | [`lyra-reporting/STATE-AUDIT.md`](../lyra-reporting/STATE-AUDIT.md) | User-facing digest/report loop wired + tested; owner/business reporting greenfield. |
| Research | [`lyra-research/STATE-AUDIT.md`](../lyra-research/STATE-AUDIT.md) | Technical/product research rich (in docs/ + modelling); customer/market research greenfield. |
| Strategy | [`lyra-strategy/STATE-AUDIT.md`](../lyra-strategy/STATE-AUDIT.md) | Thesis clear + a live flagship bet (Emerging Winner Engine); formal strategy/decision registers greenfield. |
| Testing | [`lyra-testing/STATE-AUDIT.md`](../lyra-testing/STATE-AUDIT.md) | Executable RLS fence + from-zero schema build + TZ-pinned suite + self-tested gates - one of the most mature domains; gap is depth, not presence. |
| Modelling research | [`lyra-modelling/`](../lyra-modelling/) | See modelling above - founder's active Emerging Winner Engine WIP. |
| status/ (facts) | [`../status/lyra-today-snapshot.md`](../status/lyra-today-snapshot.md) | The shared grounded snapshot every audit is anchored to. |
| growth/ | [`../growth/STATE-AUDIT.md`](../growth/STATE-AUDIT.md) | Greenfield config home (landing renders from components, not yaml). |
| store-assets/ | [`../store-assets/STATE-AUDIT.md`](../store-assets/STATE-AUDIT.md) | Greenfield; TestFlight-only today, public listing assets are a future wave. |

## The two things to fix first (only genuine correctness defects, from `lyra-bugs`)

1. **Onboarding gate releases before saves confirm** (`src/app/onboarding/page.tsx:270-286`) - a
   401-then-abandon leaves a user past the mandatory gate with an empty book. Effort S, +3 to the score.
2. **Hype-meter fabrication-as-live** (`src/lib/intelligence-live.ts:196`) - hardcoded demo scores render
   under a `source:'live'` label when `hype_scores` is empty. A one-law violation. Effort S, +2.

## Reading the estate at a glance

The code-grounded domains (ai, architecture, content, cyber, design, evals, metrics-infra, modelling,
operations, testing) are **strong and wired** - the product genuinely works, and the gaps are hardening,
test-depth, discoverability, and two small correctness fixes. The business/operating domains (back-office,
competitors, forecasting, marketing, research, strategy, reporting-owner-side) are **largely greenfield** -
homes now exist, ready to fill. The one active net-new build is the **Emerging Winner Engine** (modelling).
