-- 006_signals.sql
-- Global, shared signal scores + signals. Computed once per ticker, personalised per
-- user via overlays (007/008). Idempotent.

create table if not exists public.stock_signal_scores (
  id uuid primary key default gen_random_uuid(),
  symbol text not null references public.stock_tickers(symbol) on delete cascade,
  timeframe text not null,
  candle_time timestamptz not null,
  strategy_code text not null default 'momentum_recovery_v1',
  final_score numeric not null,
  rsi_score numeric default 0,
  macd_score numeric default 0,
  price_location_score numeric default 0,
  trend_score numeric default 0,
  volume_score numeric default 0,
  rsi_reason text,
  macd_reason text,
  price_location_reason text,
  trend_reason text,
  volume_reason text,
  score_payload jsonb,
  created_at timestamptz default now(),
  unique(symbol, timeframe, candle_time, strategy_code)
);

create table if not exists public.stock_signals (
  id uuid primary key default gen_random_uuid(),
  symbol text not null references public.stock_tickers(symbol) on delete cascade,
  timeframe text not null,
  candle_time timestamptz not null,
  strategy_code text not null default 'momentum_recovery_v1',
  signal_type text not null,
  signal_status text not null,
  signal_score numeric not null,
  previous_signal_score numeric,
  signal_score_delta numeric,
  action_state text,
  lifecycle_state text,
  explanation jsonb,
  raw_payload jsonb,
  created_at timestamptz default now(),
  unique(symbol, timeframe, candle_time, strategy_code)
);
create index if not exists idx_stock_signals_symbol_time
  on public.stock_signals(symbol, timeframe, candle_time desc);
create index if not exists idx_stock_signals_score
  on public.stock_signals(signal_score desc);
