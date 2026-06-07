-- 013_jobs_usage.sql
-- Global worker run log (exists in legacy; idempotent) + optional AI/API usage log
-- for cost control.

create table if not exists public.stock_scanner_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  timeframe text not null,
  started_at timestamptz default now(),
  finished_at timestamptz,
  status text not null default 'running',
  tickers_scanned int default 0,
  candles_saved int default 0,
  indicators_saved int default 0,
  signals_created int default 0,
  portfolio_overlays_created int default 0,
  watchlist_overlays_created int default 0,
  alerts_sent int default 0,
  error_message text,
  payload jsonb,
  created_at timestamptz default now()
);

create table if not exists public.api_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  provider text not null,
  endpoint text,
  usage_type text,
  tokens_in int,
  tokens_out int,
  estimated_cost numeric,
  metadata jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_api_usage_user_time on public.api_usage_logs(user_id, created_at desc);
