# lyra-testing - State Audit
_2026-07-29 · Lyra v0.89.0 · HEAD 9e5953c · read-only assessment_

## Scope
The test suite and the deterministic quality gates that keep Lyra shippable: Vitest (frontend/unit),
pytest (Python workers), the 9 `check:*` gates, the gate self-tests, the executable RLS tenant fence,
the migrations-from-zero build proof, and CI wiring. Maps to vertical V15 (Release Engineering & Quality
Gates). Enforcement doctrine lives in `HARNESS.md`; this audit is the on-disk truth behind it.

## Lyra as it is today
The harness is real and mostly wired, not aspirational. Counts probed at HEAD:

- **144 Vitest files / ~1070 `it`/`test` calls** (`status/lyra-today-snapshot.md:47`): 130 colocated under
  `src/**/__tests__/`, 13 in `tests/*.test.ts`, plus two `.mjs` script self-tests in
  `scripts/lib/__tests__/`. Only **one** RTL render test exists (`src/components/landing/__tests__/StackSection.test.tsx`) - the house rule "pure-function extraction over heavy RTL" is genuinely followed, not just stated.
- **32 pytest files** in `tests/` (`test_indicators.py`, `test_score_parity.py`, `test_alert_engine_quiet_hours.py`, `test_worker_honesty.py`, `test_multiuser.py`, ...) - engine logic tested against fixed candle fixtures, repos faked (`FakeRepo`).
- **9 `check:*` gates** (`package.json:19-38`): `version`, `onboarding`, `onboarding-contract`, `migrations`, `schema-drift`, `deploy`, `chains`, `ledgers`, `data-economics`, each backed by a `scripts/check-*.mjs`.
- **`TZ=UTC` is pinned on the suite** (`package.json:14`, `"test": "TZ=UTC vitest run"`) so a local run is byte-identical to the UTC CI runner - the fix for the ~9-hours-red-per-day quiet-hours incident (`HARNESS.md:54-57`).
- Vitest runs `environment: 'node'`, `globals: true`, with `testTimeout`/`hookTimeout` raised to 20000ms to absorb cold-import contention on the heavy content/AI module graph (`vitest.config.ts:14-22`).

The load-bearing safety property is real: **an executable RLS negative assertion runs in CI.**
`scripts/rls-tenant-fence.sql` seeds one row per user in `portfolio_positions`, `watchlist_items` and
`paper_trades`, then under user A's JWT as the non-owner `authenticated` role asserts `own_count = 1` and
`other_count = 0`, raising an exception (against `ON_ERROR_STOP=1`) if any owner-only SELECT policy
regresses to permissive (`rls-tenant-fence.sql:68-116`). It is wired: `migrate-from-zero.sh` applies it
after every migration + the `sql/` reconcile, inside the `migrations-from-zero` CI job against
`postgres:16` (`ci.yml:93-113`). A second, independent layer scans migration SQL text for
`using (true)` on 14 user-keyed tables (`src/lib/__tests__/rls-leak-guard.test.ts:20-24`) - so RLS has
both a static source guard and a live database proof.

## How it works
- **Three deterministic gate tiers.** (1) A `pre-push` hook (`HARNESS.md:80-83`) blocks unversioned
  shippable changes. (2) CI (`ci.yml`) has four jobs: `version-guard` replays the version rule
  server-side against the PR base (`ci.yml:21-39`); `frontend` runs type-check, lint, five gates
  (`onboarding`, `onboarding-contract`, `migrations`, `chains`, `ledgers`), Vitest, then a no-secrets
  build (`ci.yml:52-73`); `worker` runs `pytest tests -q` on Python 3.11 (`ci.yml:85-87`);
  `migrations-from-zero` builds the whole schema from empty Postgres + the RLS fence (`ci.yml:93-113`).
  (3) `schema-drift` + `data-economics` run in a **nightly** job (they need a DB URL, `--require-db`),
  and `deploy` runs post-push against the live site.
- **Gate self-tests ("who watches the watchers").** The three highest-value gates share their detection
  logic in `scripts/lib/gate-logic.mjs` (pure, no I/O) and pin it red/green in
  `scripts/lib/__tests__/gate-logic.test.mjs`: version-bump (`versionFrom`, `semverCmp`,
  `isShippablePath`), migration integrity (`duplicateVersionPrefixes`, `createTableColumns`), and
  schema-drift NOT-NULL/type parsing (`parseMigrationSchema`, `normalizePgType`).
- **Route handlers are direct-invoked** with thenable Supabase fakes (`HARNESS.md:90-95`); evals and
  contracts run inside Vitest as ordinary tests (`HARNESS.md:96-99`).

## Strengths (verified)
- **Executable RLS tenant fence wired into CI** - a negative assertion that fails the build on a
  cross-user read leak, not a comment (`rls-tenant-fence.sql:83-113`, `migrate-from-zero.sh` tail,
  `ci.yml:110-113`). This is the strongest single item in the domain.
- **Whole-schema build proof.** `migrate-from-zero.sh` applies every migration in order + reconcile
  against throwaway Postgres, shimming the Supabase surface (`auth` schema, roles, `auth.uid()`); a
  fresh clone that cannot build goes red (`migrate-from-zero.sh:31-83`).
- **Gate self-tests exist at all.** `gate-logic.test.mjs` asserts each shared rule goes RED on the exact
  incident class (0.43.1 downgrade, 036x2 prefix collision, a NOT-NULL parse that stops matching) and
  GREEN on the clean case (`gate-logic.test.mjs:28-33, 59-63, 103-138`).
- **`TZ=UTC` discipline** removes machine-timezone flakiness estate-wide (`package.json:14`), backed by
  the documented incident (`HARNESS.md:54-57`, `CLAUDE.md` Conventions).
- **Two RLS layers.** The Vitest source-scanner covers 14 user-keyed tables including
  `operator_profiles` and `user_settings` (`rls-leak-guard.test.ts:20-24`), complementing the live fence.
- **Pure-function-first is real, not slogan:** 1 RTL test out of 144, matching the house rule and
  keeping the suite fast and deterministic.

## Gaps, risks, what is missing
Reusing the gap-to-95 audit V15 findings (all verified on disk here), plus the V8 fence residuals:

- **5 of 8 quality gates have no red/green self-test** (V15 #1, coverage, M, +2). Only version-bump,
  migrations and schema-drift are pinned via `gate-logic.mjs`; `onboarding-parity`,
  `onboarding-contract`, `skill-chains`, `ledgers` and `data-economics` have no colocated self-test
  (confirmed: no `check-*.test.mjs` for them). Each runs in CI and could silently regress to always-pass.
- **Migration collision-DECISION logic is unpinned** (V15 #2, coverage, S, +1). `check-migrations.mjs:96-123`
  (column-set disagreement, `KNOWN_COLLISIONS` suppression, `resolvedBy`-file existence) is inline and
  untested; only the `createTableColumns` *parser* it calls is self-tested.
- **`ALTER ADD COLUMN ... NOT NULL` false-negative on comma-bearing types** (V15 #3, correctness, S, +1).
  `gate-logic.mjs:109` captures the ADD COLUMN type with `([^;,]*)`, which truncates
  `numeric(10,2) not null` at the first comma, so `\bnot null\b` never matches and `notNull` resolves
  undefined - a live false-negative in the schema-drift watcher. Fix: consume balanced parens to the
  statement terminator + a `numeric(p,s)` NOT-NULL test case.
- **The RLS fence proves READ isolation only, never the WRITE side** (V8 #1, resilience, M, +1).
  `rls-tenant-fence.sql` runs SELECT-count assertions but never attempts a role UPDATE, so
  `047_role_escalation_guard.sql`'s self-promotion block is reasoned in SQL only. Extend the same
  already-wired do-block: as user A, `update profiles set role='maintainer'` and RAISE if `42501` does
  not fire.
- **The executable fence omits `operator_profiles` + `user_settings`** (V8 #3, coverage, S, +1) - both
  owner-only RLS with no live proof, so a regression to `using(true)` passes the fence (the source
  scanner would still catch a literal `using (true)`, but not a subtler policy regression).
- **`HARNESS.md` never cites the committed self-tests** (V15 #4, polish, S, +1). Layer 3
  (`HARNESS.md:88-99`) still frames red-proof as manual and does not mention `gate-logic.test.mjs` or
  name which gates remain to be pinned.
- **Estate-wide coverage debt (context, not owned here):** the gap-to-95 audit finds ~26 of 52 total
  gaps are untested already-shipped server/orchestration code (account-backed mappers, PUT rollback,
  inbound-webhook parsers, `handleFinish` orchestration). That debt sits in the individual verticals,
  but it is the dominant coverage lever the harness pattern (pure extraction + thin test) is built to
  close.
- **Coverage-config gap:** there is no coverage threshold in `vitest.config.ts` and no `nyc`/`c8` gate -
  the suite measures pass/fail, not coverage percentage, so untested new code lands green.

## Where to find it
- Runners/config: `vitest.config.ts`, `package.json:14` (`TZ=UTC`), `package.json:19-38` (gate scripts).
- Gates: `scripts/check-*.mjs` (9 files), shared logic `scripts/lib/gate-logic.mjs`, self-tests
  `scripts/lib/__tests__/gate-logic.test.mjs` (+ `commission-card.test.mjs`).
- RLS: `scripts/rls-tenant-fence.sql` (executable), `src/lib/__tests__/rls-leak-guard.test.ts` (source scan).
- Schema build proof: `scripts/migrate-from-zero.sh`.
- CI: `.github/workflows/ci.yml` (4 jobs); nightly/deploy gates run in `nightly-maintenance` /
  `deploy-smoke` workflows (`status/lyra-today-snapshot.md:44`).
- Tests: `src/**/__tests__/` (130), `tests/*.test.ts` (13 frontend), `tests/test_*.py` (32 pytest).
- Doctrine: `HARNESS.md`, `SKILL-CHAIN.md`, `harness-incidents.jsonl` (gate-checked incident ledger),
  and the domain findings in `lyra-audits/2026-07-29-gap-to-95-audit.md` (V15 + V8).

## Posture
Strong and wired - an executable RLS fence, a from-zero schema build, TZ-pinned tests and self-tested
gates make it one of the estate's most mature domains; the honest gap is depth (3 of 8 gates self-pinned,
a live schema-drift parser false-negative, and read-only RLS proof).
