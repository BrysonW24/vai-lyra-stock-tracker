-- Trade Day Snapshots table.
-- Stores reconstructed entry context and forward performance for completed trades.
-- SINGLE-OPERATOR mode: no user_id, no auth.

create table if not exists trade_day_snapshots (
  id uuid primary key default gen_random_uuid(),
  position_id uuid references portfolio_positions(id) on delete set null,
  symbol text not null,
  purchase_date date not null,
  entry_price numeric not null,
  -- Entry-day technical indicators
  rsi_on_entry numeric,
  macd_state_on_entry text,
  macd_histogram_on_entry numeric,
  volume_ratio_on_entry numeric,
  price_vs_sma_20_on_entry numeric,
  price_vs_sma_50_on_entry numeric,
  price_vs_sma_200_on_entry numeric,
  distance_from_20_period_low_on_entry numeric,
  signal_score_on_entry numeric,
  market_regime_on_entry text,
  -- Forward performance
  return_5d numeric,
  return_20d numeric,
  return_60d numeric,
  return_120d numeric,
  max_drawdown_after_entry numeric,
  max_upside_after_entry numeric,
  -- Learning summary: deterministic observations (JSONB array of strings)
  learning_summary jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_trade_snapshots_symbol
on trade_day_snapshots(symbol);

create index if not exists idx_trade_snapshots_position
on trade_day_snapshots(position_id);

create index if not exists idx_trade_snapshots_date
on trade_day_snapshots(purchase_date desc);
