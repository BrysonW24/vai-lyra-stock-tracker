-- Backtesting tables for deterministic strategy evaluation and paper trading simulation
-- Research software only. No real orders, no broker integration, no credentials.

create table if not exists backtest_runs (
  id uuid primary key default gen_random_uuid(),
  strategy_name text not null,
  symbol text not null,
  timeframe text not null,
  params jsonb not null,
  started_at timestamptz default now(),
  finished_at timestamptz,
  status text not null default 'running',
  error_message text,
  created_at timestamptz default now()
);

create index if not exists idx_backtest_runs_strategy_symbol
on backtest_runs(strategy_name, symbol);

create index if not exists idx_backtest_runs_created
on backtest_runs(created_at desc);

create table if not exists backtest_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references backtest_runs(id) on delete cascade,
  symbol text not null,
  win_rate numeric not null,
  win_count int not null,
  loss_count int not null,
  avg_return numeric,
  median_return numeric,
  max_return numeric,
  min_return numeric,
  max_drawdown numeric,
  profit_factor numeric,
  expectancy numeric,
  sample_size int not null,
  payload jsonb,
  created_at timestamptz default now(),
  unique(run_id)
);

create index if not exists idx_backtest_results_run_id
on backtest_results(run_id);

create index if not exists idx_backtest_results_win_rate
on backtest_results(win_rate desc);

create table if not exists backtest_trades (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references backtest_runs(id) on delete cascade,
  symbol text not null,
  sequence_num int not null,
  entry_signal_time timestamptz not null,
  entry_time timestamptz not null,
  entry_price numeric not null,
  quantity int not null,
  exit_signal_time timestamptz,
  exit_time timestamptz,
  exit_price numeric,
  exit_reason text,
  realised_pl numeric,
  realised_pl_pct numeric,
  bars_held int,
  payload jsonb,
  created_at timestamptz default now(),
  unique(run_id, sequence_num)
);

create index if not exists idx_backtest_trades_run_id
on backtest_trades(run_id, sequence_num);

create table if not exists paper_trades (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  opened_at timestamptz not null,
  entry_price numeric not null,
  quantity int not null,
  stop_price numeric,
  target_price numeric,
  closed_at timestamptz,
  exit_price numeric,
  exit_reason text,
  realised_pl numeric,
  realised_pl_pct numeric,
  status text not null default 'open',
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_paper_trades_symbol
on paper_trades(symbol);

create index if not exists idx_paper_trades_status
on paper_trades(status);

create index if not exists idx_paper_trades_opened
on paper_trades(opened_at desc);

create table if not exists paper_portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_time timestamptz not null,
  initial_capital numeric not null,
  current_value numeric not null,
  realised_pl numeric not null,
  unrealised_pl numeric not null,
  total_pl numeric not null,
  open_position_count int not null,
  closed_trade_count int not null,
  payload jsonb,
  created_at timestamptz default now(),
  unique(snapshot_time)
);

create index if not exists idx_paper_portfolio_snapshots_time
on paper_portfolio_snapshots(snapshot_time desc);
