-- 036: bring the horizon-2 events + IPO tables into the canonical migration path.
--
-- These four tables were created only by sql/009_events_ipos.sql (via
-- sql/_apply_all_scanner_schema.sql, which the setup docs run AFTER migrations). A
-- migrations-only bootstrap therefore never created them, so the nightly events worker's
-- upserts (workers/events_worker/main.py) silently no-oped and the /ipos live read had no
-- table. Mirrors sql/009 exactly (idempotent), then re-asserts the 030 read-only RLS
-- posture for just these tables so they are safe regardless of apply order.

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

create index if not exists idx_company_events_ticker on company_events(ticker);
create index if not exists idx_company_events_event_date on company_events(event_date);
create index if not exists idx_company_events_type on company_events(event_type);

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

create index if not exists idx_market_calendar_event_date on market_calendar_events(event_date);
create index if not exists idx_market_calendar_type on market_calendar_events(event_type);

-- Column names mirror src/lib/ipos.ts IpoCompany fields (snake_case); the worker upserts
-- on symbol and the frontend read lives in src/lib/ipos-live.ts.
create table if not exists ipos (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  company_name text not null,
  ipo_date text not null, -- ISO date (YYYY-MM-DD)
  exchange text not null,
  category text not null,
  status text not null, -- 'upcoming', 'priced', 'recent'
  offer_price numeric not null,
  shares_offered_m numeric not null,
  proceeds_usd_m numeric not null,
  valuation_usd_m numeric not null,
  revenue_ttm_usd_m numeric,
  revenue_growth_pct numeric,
  gross_margin_pct numeric,
  net_income_usd_m numeric,
  profitable boolean default false,
  employees integer,
  products jsonb,
  notable_projects jsonb,
  key_people jsonb,
  description text,
  domain text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_ipos_symbol on ipos(symbol);
create index if not exists idx_ipos_ipo_date on ipos(ipo_date);
create index if not exists idx_ipos_status on ipos(status);
create index if not exists idx_ipos_category on ipos(category);

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

create index if not exists idx_event_risks_symbol on event_risks(symbol);
create index if not exists idx_event_risks_risk_date on event_risks(risk_date);
create index if not exists idx_event_risks_event_risk on event_risks(event_risk);
create index if not exists idx_event_risks_symbol_date on event_risks(symbol, risk_date desc);

-- Same posture as 030: worker-owned research data - RLS on, read-only for anon +
-- authenticated, writes only via the service role (which bypasses RLS).
do $$
declare
  t text;
begin
  foreach t in array array['company_events','market_calendar_events','ipos','event_risks'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I on public.%I;', t || '_read', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true);', t || '_read', t);
  end loop;
end $$;
