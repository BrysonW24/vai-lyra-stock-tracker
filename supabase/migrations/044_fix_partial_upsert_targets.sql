-- 044: the ON CONFLICT targets must not be PARTIAL indexes.
--
-- My own bug, introduced by 039 + 042 and caught only by watching a real nightly run persist nothing.
--
-- 039 and 042 created the upsert keys as partial unique indexes:
--     create unique index ux_company_events_event_id on company_events(event_id)
--       where event_id is not null;
-- The intent was to let legacy rows (which have a null event_id) coexist without colliding. But
-- Postgres CANNOT infer a partial unique index as an ON CONFLICT target, so every upsert was
-- rejected outright:
--     42P10 - there is no unique or exclusion constraint matching the ON CONFLICT specification
-- The workers still exited 0 (they catch and log), the workflow steps went green, and
-- company_events + fundamental_snapshots stayed at ZERO rows. A green step that writes nothing.
--
-- The predicate was never needed: NULLs are DISTINCT in a unique index, so any number of legacy
-- rows with a null key coexist happily under a plain unique index. Dropping the predicate is both
-- the fix and a simplification.
--
-- Conflict targets these must satisfy:
--   workers/events_worker/main.py       -> upsert(company_events, on_conflict="event_id")
--   workers/fundamentals_worker/main.py -> upsert(fundamental_snapshots, on_conflict="symbol,snapshot_date")

drop index if exists public.ux_company_events_event_id;
create unique index if not exists ux_company_events_event_id
  on public.company_events(event_id);

drop index if exists public.ux_fundamental_snapshots_symbol_date;
create unique index if not exists ux_fundamental_snapshots_symbol_date
  on public.fundamental_snapshots(symbol, snapshot_date);

comment on index public.ux_company_events_event_id is
  'Upsert key for workers/events_worker (on_conflict=event_id). MUST stay non-partial: Postgres cannot
   infer a partial unique index as an ON CONFLICT target (42P10). NULLs are distinct here, so legacy
   rows with a null event_id do not collide.';

comment on index public.ux_fundamental_snapshots_symbol_date is
  'Upsert key for workers/fundamentals_worker (on_conflict=symbol,snapshot_date). MUST stay
   non-partial - see ux_company_events_event_id.';
