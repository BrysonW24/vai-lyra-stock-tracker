# SKILL-CHAIN.md - the skill-chain registry and coverage map

Every section of this codebase is maintained by at least one **skill chain** - a staged
agent playbook in `.claude/commands/` with verification gates and an explainability
contract. This file is the registry: which chains exist, when to run each one, and the
coverage map assigning every code section an owning chain. The map is machine-checked by
`npm run check:chains` (`scripts/check-skill-chains.mjs`, runs in CI) - an unowned
section fails the gate. The enforcement layers around the chains live in
[HARNESS.md](HARNESS.md).

## What a skill chain is

A chain is plain markdown any agent can follow (in Claude Code they run as `/<name>`).
Every chain honours the same contract:

1. **Staged with gates** - each stage ends with an explicit pass condition; a failed
   gate stops the chain until fixed at the root cause.
2. **Execution, not advice** - chains end with verified, shipped work (version bump via
   `RELEASES` in `src/lib/version.ts`, `npm run release`, commit, push, announce), never
   a recommendations list.
3. **Explainability** - the chain's report states what changed and the evidence why, in
   plain language with engine-owned numbers. "It's fine" is not a finding.
4. **Doctrine-carrying** - each chain restates the doctrine for its vertical (engine owns
   numbers, demo always works, fail-closed auth, quiet hours defer never drop, ...) so
   the rule travels with the work.

## The chains

| Chain | Run it when | One-line job |
|---|---|---|
| [/setup](.claude/commands/setup.md) | Fresh clone, new user or agent | Stage-gated end-to-end setup, demo to deployed |
| [/production-keeper](.claude/commands/production-keeper.md) | Scheduled, pre-deploy, "is it healthy?" | Static/test/build/runtime/drift gates -> fix -> ship |
| [/feedback-loop](.claude/commands/feedback-loop.md) | Feedback accumulated, or on a cadence | Pull all channels -> triage -> engineer -> ship -> close loop |
| [/signal-quality](.claude/commands/signal-quality.md) | Outcomes accumulated, scoring change proposed | Measure edge -> evidence-backed tuning -> mirrors in lockstep |
| [/ai-quality](.claude/commands/ai-quality.md) | AI change, model drift suspected, monthly | Evals -> guardrails red-team -> cost/resilience -> system card |
| [/notification-health](.claude/commands/notification-health.md) | Delivery doubts, new notification type | Measure delivery -> template completeness -> root-cause fixes |
| [/onboarding-funnel](.claude/commands/onboarding-funnel.md) | Activation data accumulated, funnel change | Measure drop-offs -> fix worst friction -> demo promise audit |
| [/onboarding-parity](.claude/commands/onboarding-parity.md) | Stack/costs/routes/env/version changed | Sync human + companion + agent onboarding surfaces (`npm run check:onboarding`) |
| [/data-integrity](.claude/commands/data-integrity.md) | Schema change, new data module, RLS doubts | Migrations lockstep -> RLS audit -> demo parity -> ingest wired |
| [/security-sweep](.claude/commands/security-sweep.md) | New route/secret/dependency, quarterly | Secrets -> authz fail-closed -> abuse limits -> deps triage |
| [/ux-surface](.claude/commands/ux-surface.md) | A surface feels rough, after feature work | One surface to premium: demo render, 375px, states, a11y, engine truth |
| [/logs-to-genui](.claude/commands/logs-to-genui.md) | Operational question needs a view | Logs/events -> deterministic metrics -> GenUI (AI does layout only) |

Sub-skills (invoked by chains, not standalone owners):
[/sync-human-onboarding](.claude/commands/sync-human-onboarding.md),
[/sync-companion-onboarding](.claude/commands/sync-companion-onboarding.md),
[/sync-agent-onboarding](.claude/commands/sync-agent-onboarding.md) - the three
per-surface arms of `/onboarding-parity`.

## Coverage map

Machine-checked: `scripts/check-skill-chains.mjs` parses the table between the markers,
verifies every path exists, every named chain exists, no chain file is orphaned, and
every enumerated code section is claimed by at least one row. Multiple paths per row and
multiple owning chains per row are allowed; a parent path claims everything under it.

<!-- chain-coverage:begin -->
| Section | Paths | Owning chains |
|---|---|---|
| Scanner + scoring engine | `workers/stock_scanner/` | signal-quality |
| Signal + scoring libs | `src/lib/candle-series.ts` `src/lib/live-signals.ts` `src/lib/outcomes.ts` `src/lib/paper-trading.ts` `src/lib/prime-setups.ts` `src/lib/score-breakdown.ts` `src/lib/score-history.ts` `src/lib/signal-events.ts` `src/lib/signal-intelligence.ts` `src/lib/simulation.ts` `src/lib/strategy.ts` `src/lib/trade-snapshots.ts` `src/lib/universe.ts` `src/lib/twin/` | signal-quality |
| Pine mirror + recovery model + paper spine + edge/plan math | `src/lib/pine/` `src/lib/ml/` `src/lib/trading/` `src/lib/edge/` | signal-quality |
| Worker dispatch seam | `workers/stock_scanner/notification_dispatch.py` `workers/stock_scanner/digest_job.py` | notification-health, signal-quality |
| AI layer | `src/lib/ai/` `src/lib/knowledge/` `src/lib/api/` `src/lib/daily-brief.ts` `src/lib/saved-prompts.ts` `content/` | ai-quality |
| AI routes + founder ops surface | `src/app/api/ai/` `src/app/ai-ops/` | ai-quality |
| Notification spine + channels | `src/lib/notifications/` `src/lib/push/` `src/lib/alert-prefs.ts` `contracts/` | notification-health |
| Notification routes | `src/app/api/notifications/` `src/app/api/push/` `src/app/api/webhooks/` | notification-health |
| Onboarding + activation libs | `src/lib/onboarding.ts` `src/lib/onboarding-progress.ts` `src/lib/onboarding-summary.ts` `src/lib/sync-onboarding.ts` `src/lib/setup-status.ts` `src/lib/local-watchlist.ts` `src/lib/local-portfolio.ts` `src/lib/activation/` | onboarding-funnel |
| Funnel pages + routes | `src/app/welcome/` `src/app/onboarding/` `src/app/auth/` `src/app/api/activation/` `src/app/api/onboarding/` `src/app/api/demo/` `src/middleware.ts` | onboarding-funnel |
| Onboarding docs + companion | `docs/walkthroughs/` `docs/onboarding/` `ONBOARDING.md` `AGENT-ONBOARDING.md` `QUICKSTART.md` `public/setup-companion.html` | onboarding-parity, setup |
| Schema + SQL | `supabase/` `sql/` | data-integrity |
| Supabase access layers | `src/lib/supabase/` `src/lib/cache.ts` `src/lib/data.ts` `src/lib/demo-data.ts` `src/lib/ingestion/` `src/lib/market/` `src/lib/generated/` | data-integrity |
| Market-intel data libs | `src/lib/calendar.ts` `src/lib/calendar-live.ts` `src/lib/capex-events.ts` `src/lib/catalysts.ts` `src/lib/commodities.ts` `src/lib/feed.ts` `src/lib/filings.ts` `src/lib/finance-facts.ts` `src/lib/fundamentals.ts` `src/lib/gov-awards.ts` `src/lib/insider-flow.ts` `src/lib/intelligence.ts` `src/lib/interest.ts` `src/lib/ipos.ts` `src/lib/ipos-live.ts` `src/lib/macro-context.ts` `src/lib/market-board.ts` `src/lib/market-context.ts` `src/lib/small-cap-lifecycle.ts` `src/lib/small-cap-research.ts` `src/lib/smart-money.ts` `src/lib/smart-money-live.ts` `src/lib/transcripts.ts` `src/lib/value-chain.ts` `src/lib/world-radar.ts` | data-integrity |
| Data API routes | `src/app/api/portfolio/` `src/app/api/trades/` `src/app/api/trading/` `src/app/api/watchlist/` `src/app/api/small-caps/` `src/app/api/ticker-lookup/` `src/app/api/ingestion/` `src/app/api/interaction/` | data-integrity |
| Signal engine route | `src/app/api/signals/` | signal-quality |
| Ingest workers (horizon 2) | `workers/events_worker/` `workers/fundamentals_worker/` `workers/intelligence_worker/` | data-integrity |
| Auth, env, abuse, account | `src/lib/auth/` `src/lib/env.ts` `src/lib/ratelimit.ts` `src/lib/account.ts` `src/app/api/account/` `SECURITY.md` `PRIVACY.md` `docs/security/` | security-sweep |
| Findings + GenUI | `src/lib/findings/` `src/lib/next-best-actions.ts` `src/lib/goal.ts` `src/lib/portfolio-actions.ts` `src/lib/orientation.ts` `src/app/findings/` `src/app/api/findings/` | logs-to-genui |
| Feedback intake | `src/lib/feedback.ts` `src/app/api/feedback/` `src/app/api/community/` | feedback-loop |
| Release + health plumbing | `src/lib/version.ts` `src/app/whats-new/` `src/app/api/health/` `scripts/` `tests/` `src/lib/__tests__/` `.githooks/` `.github/` `CHANGELOG.md` | production-keeper |
| Harness self-maintenance | `.claude/commands/` `SKILL-CHAIN.md` `HARNESS.md` `CLAUDE.md` | production-keeper |
| Feature pages | `src/app/account/` `src/app/awards/` `src/app/calculators/` `src/app/calendar/` `src/app/charts/` `src/app/commodities/` `src/app/comparison/` `src/app/education/` `src/app/filings/` `src/app/flows/` `src/app/fundamentals/` `src/app/graph/` `src/app/intelligence/` `src/app/investors/` `src/app/ipos/` `src/app/paper/` `src/app/paper-bot/` `src/app/plan/` `src/app/portfolio/` `src/app/privacy/` `src/app/radar/` `src/app/saved/` `src/app/settings/` `src/app/simulation/` `src/app/small-caps/` `src/app/smart-money/` `src/app/strategy-lab/` `src/app/supply-chain/` `src/app/themes/` `src/app/tickers/` `src/app/trades/` `src/app/trading/` `src/app/twin/` `src/app/usage/` `src/app/watchlist/` `src/app/wire/` | ux-surface |
| Component estate + shared UI libs | `src/components/` `src/lib/brand.ts` `src/lib/calculators.ts` `src/lib/chart-pack.ts` `src/lib/command-layout.ts` `src/lib/comparison.ts` `src/lib/education.ts` `src/lib/focus-trap.ts` `src/lib/format.ts` `src/lib/gradient.ts` `src/lib/nav-prefs.ts` `src/lib/research-queue.ts` `src/lib/surfaces.ts` `src/lib/ticker-logos.ts` `src/lib/ui.ts` `src/lib/usage.ts` `src/lib/usage-store.ts` `public/` | ux-surface |
| Docs estate | `docs/` `README.md` `COSTS.md` | production-keeper |
<!-- chain-coverage:end -->

Shared verticals worth knowing: **coaching** is `/signal-quality` (the follow-up numbers)
meeting `/notification-health` (the delivery); **onboarding** is `/onboarding-funnel`
(in-app journey) meeting `/onboarding-parity` (doc/companion surfaces).

## Adding or changing a section

1. New directory or lib module? Add it to the coverage map row of the chain that owns
   its vertical (or author a new chain if none fits) - `npm run check:chains` fails CI
   until you do.
2. New chain? Follow the contract above (stages, gates, execution, explainability), add
   it to the table of chains AND the coverage map, and list it in `CLAUDE.md`'s
   `.claude/commands/` bullet.
3. Retiring a chain? Reassign every row it owned first; the gate blocks orphaned
   sections and orphaned chain files alike.
