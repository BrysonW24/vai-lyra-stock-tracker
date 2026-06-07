-- 007_portfolio.sql
-- USER-PRIVATE. Adds user_id to portfolio tables. On a fresh DB the create runs; on
-- the legacy single-operator DB the `alter … add column if not exists` upgrades it.
-- Uniqueness is enforced via unique INDEXES (which support `if not exists`, unlike
-- table constraints) so this is safely idempotent.

create table if not exists public.portfolio_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  symbol text not null references public.stock_tickers(symbol),
  quantity numeric,
  average_buy_price numeric,
  brokerage_fee numeric default 0,
  purchase_date date,
  target_allocation_pct numeric,
  stop_loss_price numeric,
  take_profit_price numeric,
  notes text,
  is_active boolean default true,
  is_enriched boolean default false,
  needs_snapshot boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Upgrade path for the legacy (no user_id) table.
alter table public.portfolio_positions add column if not exists user_id uuid references public.profiles(id) on delete cascade;
alter table public.portfolio_positions add column if not exists is_enriched boolean default false;
alter table public.portfolio_positions add column if not exists needs_snapshot boolean default false;

create unique index if not exists uq_portfolio_positions_lot
  on public.portfolio_positions(user_id, symbol, purchase_date, average_buy_price);
create index if not exists idx_portfolio_positions_user
  on public.portfolio_positions(user_id, is_active);

create table if not exists public.portfolio_signal_overlay (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  position_id uuid not null references public.portfolio_positions(id) on delete cascade,
  symbol text not null references public.stock_tickers(symbol),
  candle_time timestamptz not null,
  current_price numeric,
  market_value numeric,
  unrealised_pl numeric,
  unrealised_pl_pct numeric,
  portfolio_weight_pct numeric,
  signal_score numeric,
  signal_status text,
  action_state text,
  risk_state text,
  explanation jsonb,
  created_at timestamptz default now()
);

alter table public.portfolio_signal_overlay add column if not exists user_id uuid references public.profiles(id) on delete cascade;

create unique index if not exists uq_portfolio_overlay
  on public.portfolio_signal_overlay(position_id, candle_time);
create index if not exists idx_portfolio_overlay_user_time
  on public.portfolio_signal_overlay(user_id, candle_time desc);
