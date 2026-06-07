-- Signal outcomes table: forward return tracking for backtesting and live feedback.
-- Stores computed returns at horizons (1d, 5d, 20d, 60d) plus max upside/drawdown
-- for each historical signal, grouped by signal_type and signal_status.

create table if not exists signal_outcomes (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  signal_candle_time timestamptz not null,
  signal_type text not null,
  signal_status text not null,
  signal_score numeric not null,
  return_1d numeric,
  return_5d numeric,
  return_20d numeric,
  return_60d numeric,
  max_upside_pct numeric,
  max_drawdown_pct numeric,
  sample_horizon_bars jsonb,
  created_at timestamptz default now(),
  unique(symbol, signal_candle_time, signal_type, signal_status)
);

create index if not exists idx_signal_outcomes_symbol_time
on signal_outcomes(symbol, signal_candle_time desc);

create index if not exists idx_signal_outcomes_type_status
on signal_outcomes(signal_type, signal_status);

create index if not exists idx_signal_outcomes_score
on signal_outcomes(signal_score desc);
