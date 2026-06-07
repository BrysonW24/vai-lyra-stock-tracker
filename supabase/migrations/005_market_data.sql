-- 005_market_data.sql
-- Global, shared candles + indicators. Idempotent; no-op where the legacy schema
-- already created these.

create table if not exists public.stock_candles (
  id uuid primary key default gen_random_uuid(),
  symbol text not null references public.stock_tickers(symbol) on delete cascade,
  timeframe text not null,
  candle_time timestamptz not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric,
  adjusted_close numeric,
  volume numeric,
  source text,
  created_at timestamptz default now(),
  unique(symbol, timeframe, candle_time)
);
create index if not exists idx_stock_candles_symbol_time
  on public.stock_candles(symbol, timeframe, candle_time desc);

create table if not exists public.stock_indicators (
  id uuid primary key default gen_random_uuid(),
  symbol text not null references public.stock_tickers(symbol) on delete cascade,
  timeframe text not null,
  candle_time timestamptz not null,
  close numeric,
  volume numeric,
  rsi_14 numeric,
  rsi_delta_1 numeric,
  rsi_delta_2 numeric,
  rsi_state text,
  macd numeric,
  macd_signal numeric,
  macd_histogram numeric,
  macd_histogram_delta_1 numeric,
  macd_histogram_delta_2 numeric,
  macd_state text,
  sma_20 numeric,
  sma_50 numeric,
  sma_200 numeric,
  ema_12 numeric,
  ema_26 numeric,
  volume_sma_20 numeric,
  volume_ratio numeric,
  volume_state text,
  price_vs_sma_20 numeric,
  price_vs_sma_50 numeric,
  price_vs_sma_200 numeric,
  distance_from_20_period_low numeric,
  distance_from_60_period_low numeric,
  distance_from_120_period_low numeric,
  trend_state text,
  created_at timestamptz default now(),
  unique(symbol, timeframe, candle_time)
);
create index if not exists idx_stock_indicators_symbol_time
  on public.stock_indicators(symbol, timeframe, candle_time desc);
