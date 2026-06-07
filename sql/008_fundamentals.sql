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
