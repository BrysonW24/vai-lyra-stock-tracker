-- 039: align fundamental_snapshots with what the fundamentals worker actually writes.
--
-- THE BUG (silent, nightly, for every ticker):
-- 014_future_intelligence.sql created fundamental_snapshots with one shape (period / revenue_growth /
-- pe_ratio / price_sales / ev_ebitda / payload), but workers/fundamentals_worker/main.py writes a
-- different, richer one and upserts on (symbol, snapshot_date). Neither the columns nor the conflict
-- target existed, so EVERY snapshot write failed with PGRST204 "Could not find the 'cash' column" and
-- the whole fundamentals layer has been persisting nothing.
--
-- Additive: the legacy 014 columns are left in place (unused, nullable) so this applies cleanly to a
-- database in either state and no existing row is lost.

-- 1. Identity + classification (worker: company_name / sector / industry).
alter table public.fundamental_snapshots add column if not exists company_name text;
alter table public.fundamental_snapshots add column if not exists sector text;
alter table public.fundamental_snapshots add column if not exists industry text;

-- 2. The financial fields the worker fetches that the table never defined.
alter table public.fundamental_snapshots add column if not exists revenue_growth_yoy numeric; -- 014 named it revenue_growth
alter table public.fundamental_snapshots add column if not exists net_income numeric;
alter table public.fundamental_snapshots add column if not exists cash numeric;
alter table public.fundamental_snapshots add column if not exists debt numeric;
alter table public.fundamental_snapshots add column if not exists pe numeric;            -- 014 named it pe_ratio
alter table public.fundamental_snapshots add column if not exists forward_pe numeric;
alter table public.fundamental_snapshots add column if not exists price_to_sales numeric; -- 014 named it price_sales
alter table public.fundamental_snapshots add column if not exists ev_to_ebitda numeric;   -- 014 named it ev_ebitda
alter table public.fundamental_snapshots add column if not exists ev_to_revenue numeric;
alter table public.fundamental_snapshots add column if not exists eps_growth numeric;

-- 3. The upsert key. The worker calls .upsert(..., on_conflict="symbol,snapshot_date"), which requires
--    a matching unique constraint or the write is rejected outright.
alter table public.fundamental_snapshots add column if not exists snapshot_date date;
create unique index if not exists ux_fundamental_snapshots_symbol_date
  on public.fundamental_snapshots(symbol, snapshot_date)
  where snapshot_date is not null;

-- 4. Serve the common read: latest snapshot per symbol.
create index if not exists idx_fundamental_snapshots_symbol_date
  on public.fundamental_snapshots(symbol, snapshot_date desc);

comment on table public.fundamental_snapshots is
  'Per-symbol fundamentals, one row per (symbol, snapshot_date), written by workers/fundamentals_worker.
   The period / revenue_growth / pe_ratio / price_sales / ev_ebitda / payload columns are LEGACY from
   migration 014 and are unused - write revenue_growth_yoy / pe / price_to_sales / ev_to_ebitda instead.';
