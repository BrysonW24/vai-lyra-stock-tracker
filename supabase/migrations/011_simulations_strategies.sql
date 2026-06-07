-- 011_simulations_strategies.sql
-- USER-PRIVATE simulation runs + saved strategies.

create table if not exists public.simulation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  symbol text references public.stock_tickers(symbol),
  trade_amount numeric,
  entry_price numeric,
  stop_loss_pct numeric,
  take_profit_pct numeric,
  expected_return_pct numeric,
  holding_period_days int,
  scenario_payload jsonb,
  result_payload jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_simulation_runs_user on public.simulation_runs(user_id, created_at desc);

create table if not exists public.user_strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  strategy_code text,
  rules jsonb,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_user_strategies_user on public.user_strategies(user_id, is_active);
