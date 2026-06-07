-- 014_future_intelligence.sql
-- Global, shared intelligence/fundamentals/events. Several of these exist in the legacy
-- schema (sql/007-009); idempotent creates make this a no-op there. Architecture is
-- reserved now so the platform can grow without another migration churn.

create table if not exists public.news_items (
  id uuid primary key default gen_random_uuid(),
  source text,
  title text not null,
  url text,
  published_at timestamptz,
  sentiment text,
  relevance_score numeric,
  payload jsonb,
  created_at timestamptz default now()
);

create table if not exists public.ticker_news_map (
  id uuid primary key default gen_random_uuid(),
  news_id uuid not null references public.news_items(id) on delete cascade,
  symbol text not null references public.stock_tickers(symbol),
  relevance_score numeric,
  created_at timestamptz default now(),
  unique(news_id, symbol)
);

create table if not exists public.fundamental_snapshots (
  id uuid primary key default gen_random_uuid(),
  symbol text not null references public.stock_tickers(symbol),
  period text,
  revenue numeric,
  revenue_growth numeric,
  ebitda numeric,
  gross_margin numeric,
  operating_margin numeric,
  free_cash_flow numeric,
  market_cap numeric,
  enterprise_value numeric,
  ev_ebitda numeric,
  price_sales numeric,
  pe_ratio numeric,
  payload jsonb,
  created_at timestamptz default now()
);

create table if not exists public.company_events (
  id uuid primary key default gen_random_uuid(),
  symbol text not null references public.stock_tickers(symbol),
  event_type text,
  event_title text,
  event_time timestamptz,
  impact_level text,
  payload jsonb,
  created_at timestamptz default now()
);
