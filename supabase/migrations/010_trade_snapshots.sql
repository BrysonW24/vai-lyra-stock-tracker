-- 010_trade_snapshots.sql
-- USER-PRIVATE entry snapshots + trade journal. trade_day_snapshots exists in the
-- legacy schema without user_id; upgraded here.

create table if not exists public.trade_day_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  position_id uuid references public.portfolio_positions(id) on delete set null,
  symbol text not null references public.stock_tickers(symbol),
  purchase_date date,
  entry_price numeric,
  rsi_on_entry numeric,
  macd_state_on_entry text,
  macd_histogram_on_entry numeric,
  volume_ratio_on_entry numeric,
  price_vs_sma_20_on_entry numeric,
  price_vs_sma_50_on_entry numeric,
  price_vs_sma_200_on_entry numeric,
  signal_score_on_entry numeric,
  signal_status_on_entry text,
  market_regime_on_entry text,
  sector_state_on_entry text,
  news_context jsonb,
  event_context jsonb,
  return_5d numeric,
  return_20d numeric,
  return_60d numeric,
  return_120d numeric,
  max_drawdown_after_entry numeric,
  max_upside_after_entry numeric,
  learning_summary jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.trade_day_snapshots add column if not exists user_id uuid references public.profiles(id) on delete cascade;
create index if not exists idx_trade_snapshots_user
  on public.trade_day_snapshots(user_id, symbol, purchase_date desc);

create table if not exists public.trade_journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  symbol text references public.stock_tickers(symbol),
  position_id uuid references public.portfolio_positions(id) on delete set null,
  trade_type text,
  thesis text,
  emotion_state text,
  reason_tags text[],
  entry_price numeric,
  exit_price numeric,
  quantity numeric,
  opened_at timestamptz,
  closed_at timestamptz,
  realised_pl numeric,
  realised_pl_pct numeric,
  notes text,
  attachments jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_trade_journal_user on public.trade_journal_entries(user_id, created_at desc);
