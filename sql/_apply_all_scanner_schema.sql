-- ==============================================================
-- Lyra scanner schema reconciliation (idempotent, non-destructive)
-- Generated 2026-06-16T04:34:40Z — paste into Supabase SQL Editor and Run.
-- Brings an existing app-migration DB up to the worker's expected schema.
-- Safe to run multiple times. No drops, no truncates, no deletes.
-- ==============================================================


-- ============================================================
-- sql/001_create_stock_scanner_tables.sql
-- ============================================================
create extension if not exists pgcrypto;

create table if not exists stock_tickers (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  provider_symbol text,
  company_name text,
  sector text,
  industry text,
  category text,
  exchange text,
  country text default 'US',
  currency text default 'USD',
  scan_timeframe text default '1h',
  is_active boolean default true,
  scan_enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table stock_tickers add column if not exists provider_symbol text;
alter table stock_tickers add column if not exists category text;
alter table stock_tickers add column if not exists country text default 'US';
alter table stock_tickers add column if not exists currency text default 'USD';
alter table stock_tickers add column if not exists scan_timeframe text default '1h';
alter table stock_tickers add column if not exists scan_enabled boolean default true;

create table if not exists stock_candles (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
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
on stock_candles(symbol, timeframe, candle_time desc);

create table if not exists stock_indicators (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
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

alter table stock_indicators add column if not exists rsi_delta_1 numeric;
alter table stock_indicators add column if not exists rsi_delta_2 numeric;
alter table stock_indicators add column if not exists rsi_state text;
alter table stock_indicators add column if not exists macd_histogram_delta_1 numeric;
alter table stock_indicators add column if not exists macd_histogram_delta_2 numeric;
alter table stock_indicators add column if not exists macd_state text;
alter table stock_indicators add column if not exists volume_state text;
alter table stock_indicators add column if not exists distance_from_20_period_low numeric;
alter table stock_indicators add column if not exists distance_from_120_period_low numeric;
alter table stock_indicators add column if not exists trend_state text;

create index if not exists idx_stock_indicators_symbol_time
on stock_indicators(symbol, timeframe, candle_time desc);

create table if not exists stock_signal_scores (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  timeframe text not null,
  candle_time timestamptz not null,
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
  unique(symbol, timeframe, candle_time)
);

create table if not exists stock_signals (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  timeframe text not null,
  candle_time timestamptz not null,
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
  unique(symbol, timeframe, candle_time, signal_type)
);

alter table stock_signals add column if not exists previous_signal_score numeric;
alter table stock_signals add column if not exists signal_score_delta numeric;
alter table stock_signals add column if not exists action_state text;
alter table stock_signals add column if not exists lifecycle_state text;

create index if not exists idx_stock_signals_score
on stock_signals(signal_score desc);

create index if not exists idx_stock_signals_symbol_time
on stock_signals(symbol, timeframe, candle_time desc);

create table if not exists portfolio_positions (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  quantity numeric not null,
  average_buy_price numeric not null,
  brokerage_fee numeric default 0,
  purchase_date date,
  target_allocation_pct numeric,
  stop_loss_price numeric,
  take_profit_price numeric,
  notes text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_portfolio_positions_symbol
on portfolio_positions(symbol);

create table if not exists portfolio_signal_overlay (
  id uuid primary key default gen_random_uuid(),
  position_id uuid references portfolio_positions(id) on delete cascade,
  symbol text not null,
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
  created_at timestamptz default now(),
  unique(position_id, candle_time)
);

create table if not exists watchlist_items (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  target_price numeric,
  target_signal_score numeric default 75,
  rsi_min numeric default 35,
  rsi_max numeric default 50,
  require_macd_histogram_rising boolean default true,
  require_volume_ratio numeric default 0.8,
  notes text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists watchlist_signal_overlay (
  id uuid primary key default gen_random_uuid(),
  watchlist_item_id uuid references watchlist_items(id) on delete cascade,
  symbol text not null,
  candle_time timestamptz not null,
  current_price numeric,
  distance_to_target_price_pct numeric,
  signal_score numeric,
  signal_status text,
  watchlist_trigger_state text,
  explanation jsonb,
  created_at timestamptz default now(),
  unique(watchlist_item_id, candle_time)
);

create table if not exists stock_alerts (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  signal_id uuid references stock_signals(id) on delete set null,
  channel text not null,
  alert_type text not null,
  message text not null,
  sent_status text not null default 'pending',
  sent_at timestamptz,
  error_message text,
  payload jsonb,
  created_at timestamptz default now()
);

alter table stock_alerts add column if not exists payload jsonb;

create index if not exists idx_stock_alerts_symbol
on stock_alerts(symbol, created_at desc);

create index if not exists idx_stock_alerts_channel_type
on stock_alerts(channel, alert_type, created_at desc);

create table if not exists stock_scanner_runs (
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

alter table stock_scanner_runs add column if not exists portfolio_overlays_created int default 0;
alter table stock_scanner_runs add column if not exists watchlist_overlays_created int default 0;
alter table stock_scanner_runs add column if not exists payload jsonb;

insert into stock_tickers (symbol, provider_symbol, company_name, sector, industry, category, exchange, country, currency, scan_timeframe, is_active, scan_enabled)
values
('ADBE','ADBE','Adobe','Technology','Software','software','NASDAQ','US','USD','1h',true,true),
('AMD','AMD','Advanced Micro Devices','Technology','Semiconductors','semiconductor','NASDAQ','US','USD','1h',true,true),
('GOOGL','GOOGL','Alphabet Class A','Technology','Internet','mega_cap_platform','NASDAQ','US','USD','1h',true,true),
('GOOG','GOOG','Alphabet Class C','Technology','Internet','mega_cap_platform','NASDAQ','US','USD','1h',true,true),
('ADI','ADI','Analog Devices','Technology','Semiconductors','semiconductor','NASDAQ','US','USD','1h',true,true),
('AAPL','AAPL','Apple','Technology','Consumer Electronics','mega_cap_platform','NASDAQ','US','USD','1h',true,true),
('AMAT','AMAT','Applied Materials','Technology','Semiconductor Equipment','semiconductor','NASDAQ','US','USD','1h',true,true),
('APP','APP','AppLovin','Technology','Software','software','NASDAQ','US','USD','1h',true,true),
('ARM','ARM','Arm Holdings','Technology','Semiconductors','semiconductor','NASDAQ','US','USD','1h',true,true),
('ASML','ASML','ASML Holding','Technology','Semiconductor Equipment','semiconductor','NASDAQ','US','USD','1h',true,true),
('AVGO','AVGO','Broadcom','Technology','Semiconductors','ai_infrastructure','NASDAQ','US','USD','1h',true,true),
('CDNS','CDNS','Cadence Design Systems','Technology','Design Software','software','NASDAQ','US','USD','1h',true,true),
('CSCO','CSCO','Cisco Systems','Technology','Networking','enterprise_software','NASDAQ','US','USD','1h',true,true),
('CTSH','CTSH','Cognizant','Technology','IT Services','enterprise_software','NASDAQ','US','USD','1h',true,true),
('DDOG','DDOG','Datadog','Technology','Observability','cloud_data','NASDAQ','US','USD','1h',true,true),
('FTNT','FTNT','Fortinet','Technology','Cybersecurity','cybersecurity','NASDAQ','US','USD','1h',true,true),
('INTC','INTC','Intel','Technology','Semiconductors','semiconductor','NASDAQ','US','USD','1h',true,true),
('INTU','INTU','Intuit','Technology','Software','enterprise_software','NASDAQ','US','USD','1h',true,true),
('KLAC','KLAC','KLA','Technology','Semiconductor Equipment','semiconductor','NASDAQ','US','USD','1h',true,true),
('LRCX','LRCX','Lam Research','Technology','Semiconductor Equipment','semiconductor','NASDAQ','US','USD','1h',true,true),
('MAR','MAR','Marriott International','Consumer','Travel Platform','consumer_internet','NASDAQ','US','USD','1h',true,true),
('MCHP','MCHP','Microchip Technology','Technology','Semiconductors','semiconductor','NASDAQ','US','USD','1h',true,true),
('MDB','MDB','MongoDB','Technology','Database','cloud_data','NASDAQ','US','USD','1h',true,true),
('META','META','Meta Platforms','Technology','Internet','consumer_internet','NASDAQ','US','USD','1h',true,true),
('MRVL','MRVL','Marvell Technology','Technology','Semiconductors','ai_infrastructure','NASDAQ','US','USD','1h',true,true),
('MSFT','MSFT','Microsoft','Technology','Software / Cloud','mega_cap_platform','NASDAQ','US','USD','1h',true,true),
('MU','MU','Micron Technology','Technology','Memory','semiconductor','NASDAQ','US','USD','1h',true,true),
('NFLX','NFLX','Netflix','Communication Services','Streaming','consumer_internet','NASDAQ','US','USD','1h',true,true),
('NVDA','NVDA','Nvidia','Technology','Semiconductors','ai_infrastructure','NASDAQ','US','USD','1h',true,true),
('NXPI','NXPI','NXP Semiconductors','Technology','Semiconductors','semiconductor','NASDAQ','US','USD','1h',true,true),
('ON','ON','ON Semiconductor','Technology','Semiconductors','semiconductor','NASDAQ','US','USD','1h',true,true),
('ORCL','ORCL','Oracle','Technology','Cloud Software','enterprise_software','NYSE','US','USD','1h',true,true),
('PANW','PANW','Palo Alto Networks','Technology','Cybersecurity','cybersecurity','NASDAQ','US','USD','1h',true,true),
('PYPL','PYPL','PayPal','Technology','Payments','software','NASDAQ','US','USD','1h',true,true),
('QCOM','QCOM','Qualcomm','Technology','Semiconductors','semiconductor','NASDAQ','US','USD','1h',true,true),
('ROP','ROP','Roper Technologies','Technology','Vertical Software','enterprise_software','NASDAQ','US','USD','1h',true,true),
('SNPS','SNPS','Synopsys','Technology','Design Software','software','NASDAQ','US','USD','1h',true,true),
('TEAM','TEAM','Atlassian','Technology','Collaboration Software','enterprise_software','NASDAQ','US','USD','1h',true,true),
('TSLA','TSLA','Tesla','Consumer','EV / AI','consumer_internet','NASDAQ','US','USD','1h',true,true),
('TXN','TXN','Texas Instruments','Technology','Semiconductors','semiconductor','NASDAQ','US','USD','1h',true,true),
('WDAY','WDAY','Workday','Technology','Enterprise Software','enterprise_software','NASDAQ','US','USD','1h',true,true),
('WDC','WDC','Western Digital','Technology','Storage','semiconductor','NASDAQ','US','USD','1h',true,true),
('ZS','ZS','Zscaler','Technology','Cybersecurity','cybersecurity','NASDAQ','US','USD','1h',true,true),
('CRWD','CRWD','CrowdStrike','Technology','Cybersecurity','cybersecurity','NASDAQ','US','USD','1h',true,true),
('SNOW','SNOW','Snowflake','Technology','Data Cloud','cloud_data','NYSE','US','USD','1h',true,true),
('NOW','NOW','ServiceNow','Technology','Workflow Software','enterprise_software','NYSE','US','USD','1h',true,true),
('CRM','CRM','Salesforce','Technology','CRM Software','enterprise_software','NYSE','US','USD','1h',true,true),
('SHOP','SHOP','Shopify','Technology','Commerce Platform','software','NYSE','US','USD','1h',true,true),
('UBER','UBER','Uber','Technology','Mobility Platform','consumer_internet','NYSE','US','USD','1h',true,true)
on conflict (symbol) do update
set
  provider_symbol = excluded.provider_symbol,
  company_name = excluded.company_name,
  sector = excluded.sector,
  industry = excluded.industry,
  category = excluded.category,
  exchange = excluded.exchange,
  country = excluded.country,
  currency = excluded.currency,
  scan_timeframe = excluded.scan_timeframe,
  is_active = excluded.is_active,
  scan_enabled = excluded.scan_enabled,
  updated_at = now();

insert into portfolio_positions (symbol, quantity, average_buy_price, brokerage_fee, purchase_date, target_allocation_pct, notes)
values
('NVDA', 120, 104.10, 9.95, '2026-04-15', 35, 'Demo holding for portfolio signal overlay.'),
('AMD', 80, 169.70, 9.95, '2026-05-08', 30, 'Demo holding for recovery setup tracking.'),
('CRM', 35, 271.50, 9.95, '2026-05-20', 20, 'Demo holding for SaaS exposure.')
on conflict do nothing;

insert into watchlist_items (symbol, target_price, target_signal_score, notes)
values
('SNOW', 128, 75, 'Notify if score clears 75 and price returns below 130.'),
('PANW', 285, 75, 'Watch histogram recovery and volume above 1.0x.'),
('CRWD', 335, 75, 'Wait for RSI reset below 50.')
on conflict (symbol) do update
set
  target_price = excluded.target_price,
  target_signal_score = excluded.target_signal_score,
  notes = excluded.notes,
  is_active = true,
  updated_at = now();


-- ============================================================
-- sql/002_market_context.sql
-- ============================================================
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


-- ============================================================
-- sql/003_signal_outcomes.sql
-- ============================================================
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


-- ============================================================
-- sql/004_backtesting.sql
-- ============================================================
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


-- ============================================================
-- sql/005_trade_snapshots.sql
-- ============================================================
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


-- ============================================================
-- sql/006_universe_expansion.sql
-- ============================================================
-- 006_universe_expansion.sql
-- Expand the scan universe toward the vision's "first 100 US technology stocks".
-- Adds 54 major US-listed tech / AI names on top of the 49 seeded in 001 (=> ~103).
-- Idempotent: re-running is safe (existing symbols are left untouched).

insert into stock_tickers (symbol, provider_symbol, company_name, sector, industry, category, exchange, country, currency, scan_timeframe, is_active, scan_enabled)
values
-- Mega-cap platforms
('AMZN','AMZN','Amazon','Technology','Consumer Internet','mega_cap_platform','NASDAQ','US','USD','1h',true,true),
-- AI infrastructure / compute / networking / data-centre
('TSM','TSM','Taiwan Semiconductor','Technology','Semiconductors','ai_infrastructure','NYSE','US','USD','1h',true,true),
('PLTR','PLTR','Palantir Technologies','Technology','AI Software','ai_infrastructure','NASDAQ','US','USD','1h',true,true),
('SMCI','SMCI','Super Micro Computer','Technology','Hardware','ai_infrastructure','NASDAQ','US','USD','1h',true,true),
('DELL','DELL','Dell Technologies','Technology','Hardware','ai_infrastructure','NYSE','US','USD','1h',true,true),
('ANET','ANET','Arista Networks','Technology','Networking','ai_infrastructure','NYSE','US','USD','1h',true,true),
('CRWV','CRWV','CoreWeave','Technology','Cloud GPU','ai_infrastructure','NASDAQ','US','USD','1h',true,true),
('NBIS','NBIS','Nebius Group','Technology','Cloud GPU','ai_infrastructure','NASDAQ','US','USD','1h',true,true),
('VRT','VRT','Vertiv Holdings','Technology','Data Center Infrastructure','ai_infrastructure','NYSE','US','USD','1h',true,true),
-- Semiconductors / equipment
('QRVO','QRVO','Qorvo','Technology','Semiconductors','semiconductor','NASDAQ','US','USD','1h',true,true),
('SWKS','SWKS','Skyworks Solutions','Technology','Semiconductors','semiconductor','NASDAQ','US','USD','1h',true,true),
('GFS','GFS','GlobalFoundries','Technology','Semiconductors','semiconductor','NASDAQ','US','USD','1h',true,true),
('WOLF','WOLF','Wolfspeed','Technology','Semiconductors','semiconductor','NYSE','US','USD','1h',true,true),
('ENTG','ENTG','Entegris','Technology','Semiconductor Equipment','semiconductor','NASDAQ','US','USD','1h',true,true),
('TER','TER','Teradyne','Technology','Semiconductor Equipment','semiconductor','NASDAQ','US','USD','1h',true,true),
('COHR','COHR','Coherent','Technology','Photonics','semiconductor','NYSE','US','USD','1h',true,true),
-- Enterprise / design / application software
('IBM','IBM','IBM','Technology','IT Services','software','NYSE','US','USD','1h',true,true),
('ADSK','ADSK','Autodesk','Technology','Design Software','software','NASDAQ','US','USD','1h',true,true),
('ANSS','ANSS','Ansys','Technology','Simulation Software','software','NASDAQ','US','USD','1h',true,true),
('PTC','PTC','PTC','Technology','Industrial Software','software','NASDAQ','US','USD','1h',true,true),
('HUBS','HUBS','HubSpot','Technology','Software','software','NYSE','US','USD','1h',true,true),
('DOCU','DOCU','DocuSign','Technology','Software','software','NASDAQ','US','USD','1h',true,true),
('GTLB','GTLB','GitLab','Technology','DevOps Software','software','NASDAQ','US','USD','1h',true,true),
('PATH','PATH','UiPath','Technology','Automation Software','software','NYSE','US','USD','1h',true,true),
('AI','AI','C3.ai','Technology','AI Software','software','NYSE','US','USD','1h',true,true),
('TWLO','TWLO','Twilio','Technology','Communications Software','software','NYSE','US','USD','1h',true,true),
('ZM','ZM','Zoom Communications','Technology','Communications Software','software','NASDAQ','US','USD','1h',true,true),
('DBX','DBX','Dropbox','Technology','Cloud Software','software','NASDAQ','US','USD','1h',true,true),
-- Cloud / data infrastructure
('NET','NET','Cloudflare','Technology','Cloud Infrastructure','cloud_data','NYSE','US','USD','1h',true,true),
('ESTC','ESTC','Elastic','Technology','Search & Data','cloud_data','NYSE','US','USD','1h',true,true),
('PSTG','PSTG','Pure Storage','Technology','Data Storage','cloud_data','NYSE','US','USD','1h',true,true),
('NTAP','NTAP','NetApp','Technology','Data Storage','cloud_data','NASDAQ','US','USD','1h',true,true),
('DOCN','DOCN','DigitalOcean','Technology','Cloud Infrastructure','cloud_data','NYSE','US','USD','1h',true,true),
('CFLT','CFLT','Confluent','Technology','Data Streaming','cloud_data','NASDAQ','US','USD','1h',true,true),
-- Cybersecurity
('S','S','SentinelOne','Technology','Cybersecurity','cybersecurity','NYSE','US','USD','1h',true,true),
('OKTA','OKTA','Okta','Technology','Identity Security','cybersecurity','NASDAQ','US','USD','1h',true,true),
('CYBR','CYBR','CyberArk Software','Technology','Cybersecurity','cybersecurity','NASDAQ','US','USD','1h',true,true),
('QLYS','QLYS','Qualys','Technology','Cybersecurity','cybersecurity','NASDAQ','US','USD','1h',true,true),
('TENB','TENB','Tenable Holdings','Technology','Cybersecurity','cybersecurity','NASDAQ','US','USD','1h',true,true),
('RPD','RPD','Rapid7','Technology','Cybersecurity','cybersecurity','NASDAQ','US','USD','1h',true,true),
('VRNS','VRNS','Varonis Systems','Technology','Cybersecurity','cybersecurity','NASDAQ','US','USD','1h',true,true),
('AKAM','AKAM','Akamai Technologies','Technology','Security & CDN','cybersecurity','NASDAQ','US','USD','1h',true,true),
-- Consumer internet / platforms
('DASH','DASH','DoorDash','Technology','Consumer Internet','consumer_internet','NASDAQ','US','USD','1h',true,true),
('ABNB','ABNB','Airbnb','Technology','Consumer Internet','consumer_internet','NASDAQ','US','USD','1h',true,true),
('RBLX','RBLX','Roblox','Technology','Gaming','consumer_internet','NYSE','US','USD','1h',true,true),
('SPOT','SPOT','Spotify Technology','Technology','Streaming','consumer_internet','NYSE','US','USD','1h',true,true),
('PINS','PINS','Pinterest','Technology','Social','consumer_internet','NYSE','US','USD','1h',true,true),
('SNAP','SNAP','Snap','Technology','Social','consumer_internet','NYSE','US','USD','1h',true,true),
('RDDT','RDDT','Reddit','Technology','Social','consumer_internet','NYSE','US','USD','1h',true,true),
-- Fintech technology
('COIN','COIN','Coinbase Global','Technology','Fintech','fintech_tech','NASDAQ','US','USD','1h',true,true),
('HOOD','HOOD','Robinhood Markets','Technology','Fintech','fintech_tech','NASDAQ','US','USD','1h',true,true),
('XYZ','XYZ','Block','Technology','Fintech','fintech_tech','NYSE','US','USD','1h',true,true),
('AFRM','AFRM','Affirm Holdings','Technology','Fintech','fintech_tech','NASDAQ','US','USD','1h',true,true),
('SOFI','SOFI','SoFi Technologies','Technology','Fintech','fintech_tech','NASDAQ','US','USD','1h',true,true)
on conflict (symbol) do nothing;


-- ============================================================
-- sql/007_intelligence.sql
-- ============================================================
-- Horizon-2 NEWS INTELLIGENCE tables
-- No user_id: single-operator system
-- Demo-safe schema matching frontend shape (src/lib/intelligence.ts)

create table if not exists news_items (
  id uuid primary key default gen_random_uuid(),
  headline text not null,
  summary text,
  source text not null,
  source_domain text,
  category text,
  published_at timestamptz not null,
  sentiment text, -- 'positive' | 'neutral' | 'negative'
  relevance text, -- 'high' | 'medium' | 'low'
  url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(headline, source)
);

create index if not exists idx_news_items_published
  on news_items(published_at desc);

create index if not exists idx_news_items_sentiment
  on news_items(sentiment);

create index if not exists idx_news_items_category
  on news_items(category);

-- Ticker-to-news mapping with relevance and sentiment scores
create table if not exists ticker_news_map (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  headline text not null,
  source text not null,
  relevance text, -- 'high' | 'medium' | 'low'
  relevance_score numeric, -- 0-100
  sentiment text, -- 'positive' | 'neutral' | 'negative'
  sentiment_score numeric, -- -1..1
  published_at timestamptz,
  created_at timestamptz default now(),
  unique(ticker, headline, source)
);

create index if not exists idx_ticker_news_map_ticker
  on ticker_news_map(ticker);

create index if not exists idx_ticker_news_map_published
  on ticker_news_map(published_at desc);

create index if not exists idx_ticker_news_map_relevance
  on ticker_news_map(ticker, relevance);

-- Per-ticker hype scores
-- Hype is CONTEXT: buzz intensity, not a trade signal
-- Computed deterministically from recent news volume, sentiment, and acceleration
create table if not exists hype_scores (
  id uuid primary key default gen_random_uuid(),
  ticker text not null unique,
  hype_score numeric, -- 0-100
  recent_count numeric, -- Count of high-relevance items in last 7 days
  positive_pct numeric, -- % of recent items that are positive (0-100)
  trend text, -- 'rising' | 'steady' | 'cooling'
  computed_at timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_hype_scores_ticker
  on hype_scores(ticker);

create index if not exists idx_hype_scores_computed
  on hype_scores(computed_at desc);

-- Sentiment score history (optional: for hype acceleration tracking)
create table if not exists sentiment_scores (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  sentiment text, -- 'positive' | 'neutral' | 'negative'
  sentiment_score numeric, -- -1..1
  window_start timestamptz,
  window_end timestamptz,
  count numeric,
  created_at timestamptz default now()
);

create index if not exists idx_sentiment_scores_ticker_window
  on sentiment_scores(ticker, window_start desc);


-- ============================================================
-- sql/008_fundamentals.sql
-- ============================================================
-- Horizon-2 FUNDAMENTALS tables
-- No user_id: single-operator system
-- Demo-safe schema matching frontend shape (src/lib/fundamentals.ts)

create table if not exists fundamental_snapshots (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  company_name text,
  sector text,
  industry text,
  market_cap numeric, -- billions USD
  enterprise_value numeric, -- billions USD
  revenue numeric, -- USD millions
  revenue_growth_yoy numeric, -- percent
  gross_margin numeric, -- percent
  operating_margin numeric, -- percent
  net_income numeric, -- USD millions
  free_cash_flow numeric, -- USD millions
  ebitda numeric, -- USD millions
  cash numeric, -- USD millions
  debt numeric, -- USD millions
  pe numeric, -- trailing P/E
  forward_pe numeric,
  price_to_sales numeric,
  ev_to_ebitda numeric,
  ev_to_revenue numeric,
  eps_growth numeric, -- percent YoY
  snapshot_date timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(symbol, snapshot_date)
);

create index if not exists idx_fundamental_snapshots_symbol
  on fundamental_snapshots(symbol);

create index if not exists idx_fundamental_snapshots_snapshot_date
  on fundamental_snapshots(snapshot_date desc);

create index if not exists idx_fundamental_snapshots_symbol_date
  on fundamental_snapshots(symbol, snapshot_date desc);

-- Deterministic valuation metrics derived from fundamentals
create table if not exists valuation_metrics (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  snapshot_date timestamptz not null,
  ev_to_ebitda numeric,
  price_to_sales numeric,
  pe_ratio numeric,
  ev_to_revenue numeric,
  fcf_margin numeric, -- percent
  rule_of_40 numeric, -- revenue growth % + fcf margin %
  valuation_flag text, -- 'rich' | 'fair' | 'cheap'
  growth_durability_flag text, -- 'growth_durable' | 'challenged' | 'unsustainable'
  quality_score numeric, -- 0-100: (revGrowth*0.4) + (grossMargin*0.3) + (fcfMargin*0.3)
  computed_at timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(symbol, snapshot_date)
);

create index if not exists idx_valuation_metrics_symbol
  on valuation_metrics(symbol);

create index if not exists idx_valuation_metrics_computed_at
  on valuation_metrics(computed_at desc);

create index if not exists idx_valuation_metrics_valuation_flag
  on valuation_metrics(valuation_flag);

create index if not exists idx_valuation_metrics_growth_durability
  on valuation_metrics(growth_durability_flag);


-- ============================================================
-- sql/009_events_ipos.sql
-- ============================================================
-- Horizon-2 EVENTS + IPO tables
-- No user_id: single-operator system
-- Demo-safe schema matching frontend shapes (src/lib/calendar.ts, src/lib/ipos.ts)

-- Calendar events (earnings, macro, product, conference, etc.)
create table if not exists company_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_date text not null, -- ISO date (YYYY-MM-DD)
  event_type text not null, -- 'earnings', 'macro', 'product_launch', 'investor_day', 'conference', 'options_expiry'
  ticker text, -- null for MACRO events
  title text not null,
  importance text not null, -- 'high', 'medium', 'low'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_company_events_ticker
  on company_events(ticker);

create index if not exists idx_company_events_event_date
  on company_events(event_date);

create index if not exists idx_company_events_type
  on company_events(event_type);

-- Market-wide macro events (FOMC, CPI, NFP, options expiry, etc.)
create table if not exists market_calendar_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_date text not null, -- ISO date (YYYY-MM-DD)
  event_type text not null, -- 'macro', 'options_expiry', 'economic_release'
  title text not null,
  description text,
  importance text not null, -- 'high', 'medium', 'low'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_market_calendar_event_date
  on market_calendar_events(event_date);

create index if not exists idx_market_calendar_type
  on market_calendar_events(event_type);

-- IPO calendar + company fundamentals
-- Column names mirror src/lib/ipos.ts IpoCompany fields (snake_case)
create table if not exists ipos (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  company_name text not null,
  ipo_date text not null, -- ISO date (YYYY-MM-DD)
  exchange text not null, -- NASDAQ, NYSE, etc.
  category text not null, -- 'ai_infrastructure', 'semiconductor', 'software', etc.
  status text not null, -- 'upcoming', 'priced', 'recent'
  offer_price numeric not null,
  shares_offered_m numeric not null, -- millions
  proceeds_usd_m numeric not null, -- capital raised, $M
  valuation_usd_m numeric not null, -- implied market cap, $M
  revenue_ttm_usd_m numeric,
  revenue_growth_pct numeric,
  gross_margin_pct numeric,
  net_income_usd_m numeric,
  profitable boolean default false,
  employees integer,
  products jsonb, -- array of strings
  notable_projects jsonb, -- array of strings
  key_people jsonb, -- array of {name, role}
  description text,
  domain text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_ipos_symbol
  on ipos(symbol);

create index if not exists idx_ipos_ipo_date
  on ipos(ipo_date);

create index if not exists idx_ipos_status
  on ipos(status);

create index if not exists idx_ipos_category
  on ipos(category);

-- Event risk scores per ticker
-- Computed deterministically by event_risk_engine.py
create table if not exists event_risks (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  risk_date text not null, -- ISO date (YYYY-MM-DD)
  event_risk text not null, -- 'elevated', 'moderate', 'low'
  computed_at timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(symbol, risk_date)
);

create index if not exists idx_event_risks_symbol
  on event_risks(symbol);

create index if not exists idx_event_risks_risk_date
  on event_risks(risk_date);

create index if not exists idx_event_risks_event_risk
  on event_risks(event_risk);

create index if not exists idx_event_risks_symbol_date
  on event_risks(symbol, risk_date desc);

