-- 039: reconcile company_events to the ONE shape the app and the worker actually use.
--
-- THE BUG (silent, nightly, since the events worker shipped):
-- Two migrations define public.company_events with incompatible shapes:
--   014_future_intelligence.sql -> symbol / event_title / event_time / impact_level / payload
--   036_events_ipos_tables.sql  -> event_id / event_date / ticker / title / importance
-- 014 ran first and created the table, so 036's `create table if not exists` was a silent NO-OP.
-- Prod therefore has 014's shape, while BOTH real consumers speak 036's:
--   * workers/events_worker/main.py upserts event_id/event_date/ticker/title/importance
--     -> failed every night with PGRST204 "Could not find the 'event_date' column"
--   * src/lib/calendar-live.ts queries .gte('event_date', ...) -> the live calendar read is broken
-- `create table if not exists` masked a genuine schema collision. This migration ends it by making
-- the 036 shape canonical, additively, so it is safe whether or not 036 ever applied.
--
-- Additive by design: the legacy 014 columns are kept (nullable) rather than dropped, so any old
-- rows survive and this can be applied to a database in either state.

-- 1. The canonical columns the app + worker use.
alter table public.company_events add column if not exists event_id text;
alter table public.company_events add column if not exists event_date text;
alter table public.company_events add column if not exists ticker text;
alter table public.company_events add column if not exists title text;
alter table public.company_events add column if not exists importance text;
alter table public.company_events add column if not exists updated_at timestamptz default now();

-- 2. Legacy 014 columns must not block a canonical insert.
--    symbol was `not null references stock_tickers` - but a MACRO event has no ticker at all, and the
--    worker writes `ticker`, never `symbol`. Drop the NOT NULL so canonical rows can land.
alter table public.company_events alter column symbol drop not null;
alter table public.company_events alter column event_type drop not null;

-- 3. The worker upserts on event_id, so it needs a unique constraint to conflict against.
--    Partial: legacy rows have a null event_id and must not collide with each other.
create unique index if not exists ux_company_events_event_id
  on public.company_events(event_id);

-- 4. Read paths: the calendar filters and orders by event_date; the ticker index serves per-symbol reads.
create index if not exists idx_company_events_event_date on public.company_events(event_date);
create index if not exists idx_company_events_ticker on public.company_events(ticker);
create index if not exists idx_company_events_type on public.company_events(event_type);

comment on table public.company_events is
  'Calendar events. Canonical shape = event_id / event_date / ticker / title / importance (written by
   workers/events_worker, read by src/lib/calendar-live.ts). The symbol / event_title / event_time /
   impact_level / payload columns are LEGACY from migration 014 and are unused - do not write them.';
