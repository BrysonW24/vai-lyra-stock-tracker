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
| Version bump | `npm run check:version` | shippable change => `RELEASES` entry; `package.json`/`version.ts`/`CHANGELOG.md` lockstep; **a moved version must move UP vs origin/main** (two agent sessions share one tree - the version counter has no lock). Judges the version in the COMMITS BEING PUSHED, not the working tree. Test files are exempt (they ship nothing). | pre-push hook + CI `version-guard` |
| Onboarding parity | `npm run check:onboarding` | human + companion + agent onboarding surfaces match the codebase (stack, costs, env, routes, version) | CI |
| Onboarding contract | `npm run check:onboarding-contract` | every onboarding answer is persisted, read back, and reaches the AI prompt; the core profile read never references a column newer than the baseline migration | CI |
| Migration integrity | `npm run check:migrations` | unique version prefixes; no table created twice with different shapes (`create table if not exists` silently NO-OPs the second) | CI |
| **Schema drift** | `npm run check:schema-drift` | **the LIVE database matches the migrations in this repo.** Needs a DB URL; `--require-db` makes a missing one a failure | nightly `schema-drift` job |
| Migrations from zero | `scripts/migrate-from-zero.sh` | **the whole schema BUILDS on an empty database** - every migration in order plus the sql/ reconcile, against throwaway Postgres. Kills the fresh-clone-cannot-build class (0.36.0). First run found one fossil seed + 8 fossil indexes | CI `migrations-from-zero` job |
| Deploy smoke | `npm run check:deploy` | **the LIVE SITE serves the version just pushed** and its surfaces respond (health + content + middleware liveness). CI proves the build; this proves the deployment - six live-only bugs once shipped behind green CI | `deploy-smoke` workflow on every push to main |

Adding a gate: name it `scripts/check-<thing>.mjs`, give it a `check:<thing>` npm
script, wire it into CI, and register it in this table. A gate that only runs when
someone remembers it is not a gate.

### The rule these gates exist to enforce: a green must be able to go red

Every gate above was earned by a failure that a green build actively concealed. Read this before
adding a `|| true`, a silent skip, or a "non-fatal" catch:

- **`|| echo "(non-fatal)"` in the nightly** swallowed the exit code, so the events and fundamentals
  workers failed EVERY night for months under a green tick. Best-effort must never mean invisible:
  record the failure, keep going, fail the run at the end.
- **A check that silently skips is the same lie as a check that always passes.** `check:schema-drift`
  takes `--require-db` so a missing secret fails instead of skipping quietly.
- **The version guard read `version.ts` off disk**, so an unrelated uncommitted bump satisfied the
  hook while CI, which only sees the commit, failed. A gate that disagrees with CI is worse than no
  gate.
- **Tests must not depend on the machine.** Quiet-hours tests built clocks in the runner's timezone
  while the router evaluates in `Australia/Sydney`; they passed in Sydney and failed on UTC runners,
  making CI red ~9 hours of every day - and left the safety-critical bypass tests passing for the
  wrong reason. `npm test` pins `TZ=UTC` so a local run is byte-identical to CI.
- **Prose in a playbook does not hold a line.** `/data-integrity` Stage 1 already instructed agents to
  diff migrations against the live project and call any unapplied one "finding #1". It said the right
  thing and still seven migrations went unapplied back to 018. That instruction is now a script.
- **Two sessions in one tree share the version counter, and it had no lock.** The guard checked that a
  version entry EXISTED but never which DIRECTION it moved, so a session prepended 0.43.1 while
  origin/main already carried 0.44.0 - APP_VERSION went backwards on a green push (landing badge,
  `/whats-new`, and the deploy-smoke floor all regressed). The gate now requires a moved version to
  move UP vs origin/main. Before cutting any release, `git fetch origin` and number ABOVE the remote
  head - a concurrent session may have shipped while you worked.
- **A `limit(N)` over growing data is a future silent truncation.** The scout's 14-day drumbeat window
  read `limit(2000)` unordered: once nightly volume crossed it, clustering would have quietly weakened
  with no error anywhere. The read is now ordered newest-first with a sized-for-3x limit, and FILLING
  it flags `window_saturated` + an ERROR in the nightly log. Any cap you add must be observable when
  it is hit - if nothing can notice the limit, the limit is a lie waiting to happen. (Same family:
  unbounded tables need retention - `scout_items` prunes past 90 days.)

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
