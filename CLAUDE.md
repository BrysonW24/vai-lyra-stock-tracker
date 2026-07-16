# CLAUDE.md - Lyra Stock Oversold-Recovery Radar

## What is this?

Lyra is a research-first tech stock oversold-recovery scanner. It looks for beaten-down names showing an early turn - the score rewards an RSI in the 35-50 reset band, a still-negative-but-improving MACD histogram, and price sitting within ~10% of its 60-period low. It tracks hourly OHLCV data, calculates RSI, MACD, moving averages, volume ratios, deterministic score components, signal lifecycle states, portfolio overlays, watchlist overlays, and alert payloads before presenting them in a dense dashboard. Note: it is a dip/early-turn (mean-reversion) strategy, not a buy-strength momentum strategy - a high score means "beaten-down name turning up," not "stock breaking out to new highs."

It runs in three modes: **demo** (no keys, built-in sample data), **live** (Supabase + a market-data source), and **AI** (bring your own key + model for plain-English explanations). Run `npm run doctor` to see which mode you're in.

> ## ⚠️ Versioning is crucial - never skip it
>
> **Every session that changes shippable code (`src` / `supabase` / `workers` / `public`) MUST bump the version and keep the changelog current before it ends.** This is not optional and not a "nice to have" - the version badge and the in-app `/whats-new` changelog are how the founder (and users) know what actually shipped. A code change without a matching `RELEASES` entry is treated as a bug.
>
> The one move: prepend an entry to `RELEASES` in [`src/lib/version.ts`](src/lib/version.ts), run `npm run release`, then commit + push. A pre-push hook blocks any push that breaks this rule. Full details in [Releasing](#releasing-every-shipped-change-bumps-the-version---enforced) below.

## Tech Stack

- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS.
- Data access: Supabase anon key for read-only dashboard queries.
- Worker: Python with pandas, yfinance, ta, Supabase Python client, requests, pytest.
- AI: provider/model-agnostic gateway (`src/lib/ai/gateway.ts`) - Anthropic, OpenAI, OpenRouter, Gemini. Bring your own key + model.
- Scheduler: GitHub Actions - `.github/workflows/hourly-stock-scanner.yml` (hourly scan, failure alert + cron keepalive) and `.github/workflows/nightly-maintenance.yml` (post-close: horizon-2 workers, outcome labeling + coaching follow-ups, daily digest / Friday weekly report, notification delivery sweep). `.github/workflows/ci.yml` gates every push/PR (version-guard, type-check, lint, vitest, build, pytest).
- Notifications: multi-channel dispatch (`src/lib/notifications/`) - Web Push, Telegram Bot API, Slack incoming webhooks (per-user, SSRF-fenced to hooks.slack.com), WhatsApp Cloud API (template-gated). Worker credentials stay server-side; the Slack webhook is the user's own secret.

## Project Structure

- `src/app/` - Next.js App Router pages for overview, radar, ticker detail, alerts, and settings. `/api/health` is the public liveness + version probe used by hosting healthchecks.
- `src/components/` - dashboard layout and analytics display components.
- `src/lib/` - Supabase fetch helpers, demo fallback data, env validation, formatting helpers, the AI gateway (`src/lib/ai/`), and the Pine strategy export (`src/lib/pine/` - drift-guarded mirror of the Python score).
- `workers/stock_scanner/` - Python scanner package for universe loading, market data, indicators, derived features, scoring, overlays, alerts, Supabase persistence, Telegram, and scheduler guard.
- `contracts/notifications/` - JSON contracts for the AI notification layer (schema, templates, test register).
- `sql/` - Supabase schema and seed SQL.
- `tests/` - focused Python worker tests.
- `docs/walkthroughs/` - the clone-to-live replication path (6 walkthroughs + index). These are share-the-repo-link collateral: keep them true when commands, env vars, or schema change.
- `docs/runbooks/coolify-deploy.md` - self-hosting runbook for the root `Dockerfile` (Coolify/Docker; Vercel ignores it). `NEXT_PUBLIC_*` are BUILD-time args - see the runbook before touching the Dockerfile.
- `.claude/commands/` - agent playbooks (skill chains). **Every code section has an owning chain - the registry + coverage map is [`SKILL-CHAIN.md`](SKILL-CHAIN.md), enforced by `npm run check:chains` in CI; the enforcement layers around them are [`HARNESS.md`](HARNESS.md).** The chains: `/setup`, `/production-keeper`, `/feedback-loop`, `/signal-quality`, `/ai-quality`, `/notification-health`, `/onboarding-funnel`, `/onboarding-parity` (+ per-surface skills `/sync-human-onboarding`, `/sync-companion-onboarding`, `/sync-agent-onboarding`), `/data-integrity`, `/security-sweep`, `/ux-surface`, `/logs-to-genui`. Update them when the steps they encode change.
- `COSTS.md` - fully-itemised stack costs. Update when a new paid service enters the stack.
- `ONBOARDING.md` - the ledger of every onboarding asset/spec/experience (Setup Companion, `/setup`, walkthroughs, landing goal/stack sections). Update it whenever an onboarding surface changes. `AGENT-ONBOARDING.md` is the agent-facing front door for fresh clones. Parity across the human/html/agent surfaces is gated by `npm run check:onboarding` (CI) and restored by the `/onboarding-parity` skill chain - run it after any change to the stack, costs, routes, env vars, walkthroughs, or version.

## Key Commands

- `npm run dev` - run the dashboard locally.
- `npm run build` - build the Next.js frontend.
- `npm run type-check` - run TypeScript checks.
- `npm run test` - run frontend unit tests (Vitest).
- `npm run doctor` - report which mode you're in and what's configured.
- `npm run lint` - run ESLint (CI fails on lint errors, so run it before pushing).
- `npm run worker:scan` - run the scanner worker locally.
- `npm run worker:outcomes` - label signal outcomes + send coaching follow-ups (nightly job, runnable locally).
- `npm run worker:digest` - compose + send the daily digest (weekly report on Fridays).
- `npm run worker:test` - run worker tests.
- `npm run check:chains` - skill-chain coverage gate: every code section must have an owning chain in `SKILL-CHAIN.md` (runs in CI).
- `npm run check:onboarding` - onboarding-surface parity gate (runs in CI).

## Conventions

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend.
- Backend/middleware owns RSI, MACD, score, action state, lifecycle state, portfolio risk state, watchlist trigger state, and alert payload truth.
- Frontend may format, sort, and color values, but must not recalculate core trading logic.
- The dashboard must gracefully fall back to demo data when Supabase env vars are not configured.
- The worker should be provider-abstracted so yfinance can be replaced later.
- AI explains; the deterministic engine decides. The AI never invents a number and never gives advice - research only.
- Use a plain hyphen `-` in copy, never an em dash.
- **Bump the version and keep `CHANGELOG.md` current on every shippable change** - see [Releasing](#releasing-every-shipped-change-bumps-the-version---enforced). Do not end a session with unshipped code and a stale changelog.
- Caching (`src/lib/cache.ts`) is an optimisation, never a requirement: Upstash REST when the env pair is set, in-process TTL map otherwise, and every backend error degrades to a miss. Never cache secrets or unscoped per-user data; only cache valid results (a transient failure must not get pinned).
- The knowledge layer is deterministic: `scripts/build-knowledge.mjs` compiles the reference docs into `src/lib/generated/knowledge.json` (runs with the content pipeline on every dev/build/type-check), and `src/lib/knowledge/retrieve.ts` does lexical retrieval - no embeddings, no network. When docs move or get renamed, update `SOURCES` in the builder or the build fails loudly.

## Releasing (every shipped change bumps the version - enforced)

The app version is the single source of truth in `src/lib/version.ts`: `APP_VERSION` derives from
`RELEASES[0]`, which also drives the landing-page badge and the in-app changelog (`/whats-new`).

To ship a user-visible change:

1. Prepend a new entry to `RELEASES` at the top of `src/lib/version.ts` (version, date, title, highlights).
2. Run `npm run release` - syncs `package.json` and inserts the `CHANGELOG.md` section from that entry.
3. Commit + push.
4. `npm run announce` - posts the release (version, title, highlights) to every configured chat
   channel: Slack (`SLACK_UPDATES_WEBHOOK_URL`, falls back to the feedback webhook), Telegram
   (`TELEGRAM_UPDATES_CHAT_ID`, falls back to `TELEGRAM_CHAT_ID`), WhatsApp (`WHATSAPP_UPDATES_TO`,
   template-gated by Meta). Always announce AFTER the push, never before; `--dry-run` to preview.

This is **enforced**: a `pre-push` git hook (`.githooks/pre-push` -> `scripts/check-version-bump.mjs`)
BLOCKS a push that changes shippable code (`src` / `supabase` / `workers` / `public`) without a version
bump, and fails if `package.json` and `version.ts` have drifted. The hook is wired by `npm install`
(the `prepare` script sets `core.hooksPath .githooks`). Emergency bypass: `VD_SKIP_VERSION=1 git push`.

Do not bump the version by hand-editing `package.json` or `CHANGELOG.md` - edit `RELEASES` and run
`npm run release` so all three stay in lockstep.

## Environment Variables

See `.env.example`. Frontend variables are `NEXT_PUBLIC_*`; worker-only secrets are unprefixed and must stay backend-only.
