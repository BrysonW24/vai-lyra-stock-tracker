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
