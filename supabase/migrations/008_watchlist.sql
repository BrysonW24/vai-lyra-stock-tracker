-- 008_watchlist.sql
-- USER-PRIVATE. Adds user_id to watchlist tables and resolves the legacy
-- `watchlist_items.symbol UNIQUE` conflict (multi-user requires two users to watch the
-- same symbol) by dropping the single-column unique and replacing it with (user_id, symbol).

create table if not exists public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  symbol text not null references public.stock_tickers(symbol),
  target_price numeric,
  target_signal_score numeric default 75,
  rsi_min numeric default 35,
  rsi_max numeric default 50,
  require_macd_histogram_rising boolean default true,
  require_volume_ratio numeric default 0.8,
  notes text,
  alert_enabled boolean default true,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.watchlist_items add column if not exists user_id uuid references public.profiles(id) on delete cascade;
alter table public.watchlist_items add column if not exists alert_enabled boolean default true;

-- Remove the legacy single-operator unique(symbol) if present, then enforce per-user.
alter table public.watchlist_items drop constraint if exists watchlist_items_symbol_key;
create unique index if not exists uq_watchlist_items_user_symbol
  on public.watchlist_items(user_id, symbol);
create index if not exists idx_watchlist_user
  on public.watchlist_items(user_id, is_active);

create table if not exists public.watchlist_signal_overlay (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  watchlist_item_id uuid not null references public.watchlist_items(id) on delete cascade,
  symbol text not null references public.stock_tickers(symbol),
  candle_time timestamptz not null,
  current_price numeric,
  distance_to_target_price_pct numeric,
  signal_score numeric,
  signal_status text,
  watchlist_trigger_state text,
  explanation jsonb,
  created_at timestamptz default now()
);

alter table public.watchlist_signal_overlay add column if not exists user_id uuid references public.profiles(id) on delete cascade;

create unique index if not exists uq_watchlist_overlay
  on public.watchlist_signal_overlay(watchlist_item_id, candle_time);
create index if not exists idx_watchlist_overlay_user_time
  on public.watchlist_signal_overlay(user_id, candle_time desc);
