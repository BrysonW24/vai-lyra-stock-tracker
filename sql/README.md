# sql/ - scanner schema (one file still used; the rest is legacy)

**The canonical schema is [`supabase/migrations/`](../supabase/migrations/)** - apply those in
numeric order first. Setup guide:
[`docs/walkthroughs/03-go-live-supabase.md`](../docs/walkthroughs/03-go-live-supabase.md).

From this directory, only ONE file is part of setup:

- [`_apply_all_scanner_schema.sql`](./_apply_all_scanner_schema.sql) - run once AFTER the app
  migrations. It is an idempotent, non-destructive reconciliation script (no drops, no deletes)
  that brings the database up to the Python worker's expected schema. Safe to re-run.

The numbered files (`001_...` through `009_...`) are the original scanner-only schema, kept for
historical reference. They are a subset missing most of the app's tables (auth, RLS, portfolio,
trades, notifications, findings) - do not use them for setup.
