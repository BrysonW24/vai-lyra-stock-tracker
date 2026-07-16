# HARNESS.md - the agent harness

This repo is built to be worked on by AI agents without losing correctness, honesty, or
explainability. The **harness** is the system that makes that true: deterministic gates
that fail loudly, skill chains that encode how each vertical is maintained, runtime
guards inside the product itself, and a scheduler that keeps the loops running. An agent
that follows this page cannot silently ship drift.

> An interactive version of this whole map - the chains, the coverage map, the gates, and
> these layers - is generated from this file plus [SKILL-CHAIN.md](SKILL-CHAIN.md) and served
> at `/harness-map.html` (built by `scripts/build-harness-map.mjs` on the content pipeline).

Two conventions carry the whole design:

- **`.claude/commands/*.md` are the skill chains** - staged, gate-checked playbooks for
  maintaining each vertical. Registry + coverage map: [SKILL-CHAIN.md](SKILL-CHAIN.md).
- **`scripts/check-*.mjs` are the deterministic gates** - plain Node scripts that exit
  non-zero on drift. No AI judgement, no flakiness; a red gate is a fact.

## Layer 1 - Deterministic gates (`scripts/check-*.mjs`)

| Gate | Command | Enforces | Runs in |
|---|---|---|---|
| Version bump | `npm run check:version` | shippable change => `RELEASES` entry; `package.json`/`version.ts`/`CHANGELOG.md` lockstep | pre-push hook + CI `version-guard` |
| Onboarding parity | `npm run check:onboarding` | human + companion + agent onboarding surfaces match the codebase (stack, costs, env, routes, version) | CI |
| Chain coverage | `npm run check:chains` | every code section has an owning skill chain; no dead paths or orphan chains in the map | CI |

Adding a gate: name it `scripts/check-<thing>.mjs`, give it a `check:<thing>` npm
script, wire it into CI, and register it in this table. A gate that only runs when
someone remembers it is not a gate.

`npm run doctor` (`scripts/doctor.mjs`) is the advisory layer on top: reports mode
(demo/live/AI), missing wiring, hook integrity, and the Python interpreter - run it
first in every session.

## Layer 2 - Git hooks + CI

- **Pre-push hook** (`.githooks/pre-push`, wired by `npm install` via the `prepare`
  script): blocks any push that changes shippable code (`src`/`supabase`/`workers`/
  `public`/`content`/`sql`/`contracts`) without a version bump. Emergency bypass
  `VD_SKIP_VERSION=1` exists; normal flow never uses it.
- **CI** (`.github/workflows/ci.yml`) on every push/PR: version-guard (server-side, so
  the local hook cannot be dodged), type-check (strict TS, no `any`), lint, Vitest,
  production build, pytest, and the parity/coverage gates.

## Layer 3 - The test harness

- **Frontend/unit:** Vitest - `npm run test` (`tests/*.test.ts` + colocated
  `src/**/__tests__/`). Route handlers get direct-invocation tests; Supabase is faked
  with thenable query fakes (see `dispatch-sweep.test.ts` for the pattern).
- **Worker:** pytest - `npm run worker:test` (via `scripts/py.mjs`, venv-aware). Engine
  logic is tested against fixed candle fixtures; repos are faked (`FakeRepo` pattern in
  `test_outcome_job.py`).
- **Evals as tests:** AI groundedness/quality gates and knowledge retrieval evals run
  inside the Vitest suite - eval regressions fail CI like any other red test.
- **Contracts as tests:** `contracts/notifications/` is pinned by a test, so a template
  or type added without its counterparts fails immediately.

## Layer 4 - Runtime guards (the product protects itself)

- **Fabrication guard** - `guardProse` (`src/lib/ai/guardrails/prose.ts`) + the
  guardrails engine gate every AI completion; GenUI layouts are validated and fall back
  to deterministic views. The AI never invents a number and never gives advice.
- **Spend guard** - hosted-key token budget (`src/lib/ai/budget-tracker.ts`) and a
  circuit breaker in the gateway; hosted 429s never retry.
- **Access guards** - RLS on every table, fail-closed founder gating, timing-safe secret
  checks, SSRF-fenced webhooks, rate limits on open routes.
- **Delivery guards** - quiet-hours hold/release, idempotency keys, retry-once sweep.

## Layer 5 - Scheduled loops (GitHub Actions)

- `hourly-stock-scanner.yml` - the scan, plus failure alerts (Telegram/Slack) and a cron
  keepalive (GitHub disables idle schedules after 60 days).
- `nightly-maintenance.yml` - horizon-2 workers, outcome labeling + coaching follow-ups,
  digest/weekly report, notification sweep.

A worker or job that exists but is not scheduled here is "built-but-not-wired" - the
top systemic failure of the 2026-07-16 audit. Do not add one without wiring it.

## The agent operating contract

1. **Start:** `npm run doctor`, `git status --short` (another agent may share this live
   tree - never sweep files you did not author into your commit; re-read any file you
   are about to edit if mtimes look concurrent).
2. **Work through the owning chain:** find your section in
   [SKILL-CHAIN.md](SKILL-CHAIN.md)'s coverage map and follow that chain's stages and
   gates. New section => claim it in the map (the gate enforces this).
3. **Execute, don't advise:** chains end with shipped, verified work. Placeholder copy,
   TODO scaffolds, and "recommendations" endings are failures.
4. **Explain:** every ship carries a `RELEASES` entry a user can understand, and a
   session report stating what changed and the evidence why - with engine-owned numbers.
5. **Never bypass:** no `VD_SKIP_VERSION`, no `--no-verify`, no deleted eval case to go
   green, no suppressed error. Read the actual failure; fix the root cause.
6. **Finish:** all gates green, version bumped (`RELEASES` -> `npm run release` ->
   commit -> push -> `npm run announce`), no uncommitted shippable code, remaining known
   issues filed - not tribal memory.

New here? [AGENT-ONBOARDING.md](AGENT-ONBOARDING.md) is the front door;
[CLAUDE.md](CLAUDE.md) holds the full conventions; `/setup` runs the guided setup.
