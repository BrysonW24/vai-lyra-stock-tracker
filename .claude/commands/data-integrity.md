# /data-integrity - keep schema, RLS, read paths and demo parity true

You are Claude Code running in the Lyra repo. Run the data upkeep loop: schema and live
database in lockstep, RLS posture verified, every read path degrading cleanly to demo
data, and the horizon-2 ingest workers actually landing rows. This chain owns
`supabase/migrations/`, `sql/`, `src/lib/supabase/`, the data-access libs in `src/lib/`
(market/intel modules: fundamentals, filings, catalysts, smart-money, ipos, world-radar,
etc.), `src/lib/demo-data.ts`, `src/lib/cache.ts`, the data API routes
(`src/app/api/portfolio|trades|trading|watchlist|small-caps|ticker-lookup|ingestion/`),
and the ingest workers (`workers/events_worker/`, `workers/fundamentals_worker/`,
`workers/intelligence_worker/`). Doctrine: **demo fallback is a contract - a data module
that errors instead of degrading breaks the zero-key promise.**

## What already exists (build WITH it)

- **Canonical schema** - `supabase/migrations/` applied in numeric order, then
  `sql/_apply_all_scanner_schema.sql` ONCE (idempotent reconciliation for worker columns).
  Other numbered `sql/` files are legacy - never point users at them.
- **RLS posture** - migration `030_rls_scanner_tables.sql`: all 24 scanner tables RLS-on,
  read-only to anon+authenticated, service-role writes bypass. User tables owner-scoped
  (`test_multiuser.py` pins it). `031_activation_events.sql`: owner-only.
- **Repo layers** - `workers/stock_scanner/supabase_repo.py` (server writes),
  `src/lib/supabase/{client,server,admin,ticker}.ts` (admin = service-role, NEVER
  imported by client components).
- **Cache** - `src/lib/cache.ts`: Upstash when configured, in-process TTL otherwise;
  every backend error degrades to a miss; never caches secrets or transient failures.
- **Generated data** - `scripts/build-content.mjs` compiles `content/` + curated sets
  into `src/lib/generated/*.json` on every dev/build/type-check.

## Stage 1 - Schema vs reality

1. Diff `supabase/migrations/` against the live project (or the local shadow): any
   migration authored but not applied is finding #1. New tables MUST have an RLS stanza
   in the same migration - RLS-later is how 030 became necessary.
2. `sql/_apply_all_scanner_schema.sql` must stay idempotent - re-running it twice locally
   must be a no-op.

**Gate:** you can state which migrations are applied where (local/live), or explicitly
that live state is unreachable this session.

## Stage 2 - RLS + tenancy audit

1. For every table touched this session: who can select, insert, update, delete, as anon
   / authenticated / service role? Verify against intent (scanner tables read-only,
   user tables owner-only).
2. `npm run worker:test` - `test_multiuser.py` and friends must stay green.

## Stage 3 - Read-path + demo parity

1. Any changed data lib must handle: configured-and-healthy, configured-but-erroring
   (degrade, log, never throw to the page), and unconfigured (demo data from
   `demo-data.ts` or the module's own fixtures).
2. Demo fixtures must match live shapes - a field added to a live query gets added to the
   demo shape in the same change.

**Gate:** `npm run dev` with no env renders the touched surfaces on demo data.

## Stage 4 - Ingest workers

Run any touched horizon-2 worker locally (they have `main()` entrypoints), confirm rows
land, and confirm `nightly-maintenance.yml` still invokes it. A worker that exists but is
not scheduled is "built-but-not-wired" - the audit's #1 systemic failure. Never scrape;
API-first only.

## Stage 5 - Verify + ship

`npm run worker:test && npm run test && npm run type-check && npm run build`, version
bump via `RELEASES`, `npm run release`, commit, push, `npm run announce`.

**Done means:** migrations reconciled, RLS verified per table, demo parity proven by a
keyless render, ingest scheduled, shipped under a version. Explainability: the report
lists each table touched and its verified access matrix - "RLS is fine" is not evidence.
