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
