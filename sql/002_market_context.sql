-- Market context snapshots table for storing daily market regime, volatility, and sentiment data.

create table if not exists market_context_snapshots (
  id uuid primary key default gen_random_uuid(),
  captured_at timestamptz not null,
  payload jsonb not null,
  regime text,
  fear_greed int,
  vix numeric,
  created_at timestamptz default now()
);

alter table market_context_snapshots add column if not exists regime text;
alter table market_context_snapshots add column if not exists fear_greed int;
alter table market_context_snapshots add column if not exists vix numeric;

create index if not exists idx_market_context_captured_at
on market_context_snapshots(captured_at desc);

create index if not exists idx_market_context_regime
on market_context_snapshots(regime, captured_at desc);
