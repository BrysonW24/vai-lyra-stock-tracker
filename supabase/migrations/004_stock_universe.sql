-- 004_stock_universe.sql
-- Global, shared stock universe. `stock_tickers` may already exist from the legacy
-- sql/ schema; `create … if not exists` makes this a no-op there. Universe grouping
-- tables are new.

create table if not exists public.stock_tickers (
  id uuid primary key default gen_random_uuid(),

  symbol text not null unique,
  provider_symbol text,
  company_name text,
  sector text,
  industry text,
  category text,
  exchange text,
  country text default 'US',
  currency text default 'USD',

  is_active boolean default true,
  scan_enabled boolean default true,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.stock_universes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_default boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.stock_universe_members (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.stock_universes(id) on delete cascade,
  ticker_id uuid not null references public.stock_tickers(id) on delete cascade,
  created_at timestamptz default now(),
  unique(universe_id, ticker_id)
);
