-- 020_trading_foundations.sql
-- Trading foundations: notification channels + two-way messaging, paper trading,
-- strategy/backtest catalog, future order intents, and fundamentals.
--
-- WHAT THIS LAYER IS: the trading-bot-READY substrate. NO live broker execution
-- exists in this codebase and nothing here implies it does. Deterministic strategy
-- code drafts an order_intent, the deterministic pre-trade risk engine
-- (src/lib/trading/risk-engine.ts) evaluates it against trading_settings and kill
-- switches, a human approves it where required (order_approvals), and the terminal
-- state today is at most paper_executed against a paper_account. LLMs never generate
-- orders - the ai_explanation column is a post-hoc explanation of a decision that
-- deterministic code already made. Every step lands in execution_audit_logs.
--
-- MESSAGING: notification_channels (created in 009, converged here) hold delivery
-- destinations; channel_pairing_codes store only a HASH of the pairing code;
-- inbound_messages/outbound_messages are the two-way Telegram/WhatsApp transcript
-- with dedupe + idempotency keys so delivery is exactly-once. Provider tokens live
-- only in server-side env - never in these tables, never in the frontend.
--
-- ACCESS MODEL: user-owned tables are owner-only via auth.uid() = user_id. Shared
-- catalog tables (strategy_definitions, backtest_*, company_fundamentals,
-- fundamental_events) are read-only to authenticated users. Backend workers write
-- with the SERVICE ROLE key, which bypasses RLS.
--
-- Idempotent: create table if not exists, add column if not exists,
-- drop-policy-then-create, guarded do-blocks.

-- ---------------------------------------------------------------------------
-- Notification channels - converge the 009 table to the unified contract in
-- src/lib/notifications/types.ts. 009 already created this table, so here we only
-- add the missing columns and constrain channel_type for new rows.
-- ---------------------------------------------------------------------------
create table if not exists public.notification_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_type text not null check (channel_type in ('telegram', 'whatsapp')),
  destination text,
  display_name text,
  is_active boolean default true,
  verified_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz default now()
);

alter table public.notification_channels add column if not exists display_name text;
alter table public.notification_channels add column if not exists revoked_at timestamptz;

-- Constrain channel_type to the supported adapters. Added NOT VALID so any legacy
-- rows are grandfathered while all new writes are checked.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'notification_channels_channel_type_check'
      and conrelid = 'public.notification_channels'::regclass
  ) then
    alter table public.notification_channels
      add constraint notification_channels_channel_type_check
      check (channel_type in ('telegram', 'whatsapp')) not valid;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Channel pairing codes: short-lived codes that bind a chat to a user. Only the
-- HASH is stored - the raw code is shown once in the app and never persisted.
-- ---------------------------------------------------------------------------
create table if not exists public.channel_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_type text not null check (channel_type in ('telegram', 'whatsapp')),
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_channel_pairing_codes_hash
  on public.channel_pairing_codes(code_hash);
create index if not exists idx_channel_pairing_codes_user
  on public.channel_pairing_codes(user_id, channel_type);

-- ---------------------------------------------------------------------------
-- Inbound messages: raw webhook payloads from Telegram/WhatsApp. user_id stays
-- null until the sender is paired; unpaired rows are visible only to the backend
-- (service role) - clients can read only their own paired messages.
-- ---------------------------------------------------------------------------
create table if not exists public.inbound_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  channel_type text not null check (channel_type in ('telegram', 'whatsapp')),
  provider_message_id text,
  raw_payload jsonb,
  message_text text,
  -- Parsed deterministic command (status/portfolio/approve/reject/...), never free-form
  -- execution - see src/lib/notifications/types.ts InboundCommand.
  command text,
  status text not null default 'received',
  created_at timestamptz default now()
);

create index if not exists idx_inbound_messages_provider
  on public.inbound_messages(channel_type, provider_message_id);
create index if not exists idx_inbound_messages_user_time
  on public.inbound_messages(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Outbound messages: everything we send, with dedupe (same-content collapse) and
-- idempotency (exactly-once delivery) keys. Composed by the deterministic router;
-- AI may only phrase a payload the router already approved.
-- ---------------------------------------------------------------------------
create table if not exists public.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_type text not null check (channel_type in ('telegram', 'whatsapp')),
  destination text not null,
  message_type text,
  message_text text not null,
  related_entity_type text,
  related_entity_id uuid,
  provider_message_id text,
  status text not null default 'queued',
  error_message text,
  dedupe_key text,
  idempotency_key text unique,
  created_at timestamptz default now()
);

create index if not exists idx_outbound_messages_user_time
  on public.outbound_messages(user_id, created_at desc);
create index if not exists idx_outbound_messages_dedupe
  on public.outbound_messages(dedupe_key);

-- ---------------------------------------------------------------------------
-- Trading settings: per-user deterministic risk limits read by the pre-trade
-- engine (src/lib/trading/risk-engine.ts). One row per user.
-- ---------------------------------------------------------------------------
create table if not exists public.trading_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  -- live_limited / live_full are INTENTIONALLY absent from this check constraint.
  -- Live broker execution does not exist in this codebase. Widening this constraint
  -- is gated on the future-execution review gates passing first (see
  -- docs/architecture/future-trading-bot.md and src/lib/trading/types.ts) - the
  -- constraint is a deliberate schema-level kill switch.
  trading_mode text not null default 'disabled'
    check (trading_mode in ('disabled', 'paper_only', 'approval_required')),
  -- 0 means "no orders" - fail-closed defaults everywhere.
  max_order_notional numeric not null default 0,
  max_position_pct numeric not null default 5,
  max_daily_loss numeric not null default 0,
  max_total_drawdown_pct numeric not null default 10,
  require_manual_approval boolean not null default true,
  allowed_strategies jsonb not null default '[]',
  blocked_symbols jsonb not null default '[]',
  blocked_themes jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Strategy definitions: versioned, declarative strategy catalog. Rules are data,
-- not code - the deterministic engine interprets them; the LLM never does.
-- ---------------------------------------------------------------------------
create table if not exists public.strategy_definitions (
  id uuid primary key default gen_random_uuid(),
  strategy_name text not null,
  strategy_version text not null,
  description text,
  entry_rules jsonb,
  exit_rules jsonb,
  risk_rules jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(strategy_name, strategy_version)
);

-- ---------------------------------------------------------------------------
-- Order intents: drafted by deterministic strategy code, never by an LLM. Frozen
-- signal/risk/evidence snapshots make every decision auditable forever.
-- ---------------------------------------------------------------------------
create table if not exists public.order_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  strategy_id uuid references public.strategy_definitions(id) on delete set null,
  strategy_version text,
  symbol text not null,
  side text not null check (side in ('buy', 'sell')),
  order_type text not null check (order_type in ('market', 'limit', 'stop', 'stop_limit')),
  quantity numeric,
  notional_value numeric,
  limit_price numeric,
  stop_price numeric,
  time_in_force text not null default 'day' check (time_in_force in ('day', 'gtc', 'ioc')),
  -- Deterministic reason code from the strategy, e.g. 'momentum_recovery_entry'.
  reason_code text not null,
  signal_snapshot jsonb,
  risk_snapshot jsonb,
  evidence_snapshot jsonb,
  -- AI may EXPLAIN an intent after the fact - it never creates or mutates one.
  ai_explanation text,
  -- 'live_executed' exists in the TypeScript type for the future but is INTENTIONALLY
  -- not allowed here - the schema cannot record a live execution that must not happen.
  status text not null default 'drafted' check (status in (
    'drafted', 'pending_approval', 'approved', 'rejected', 'blocked',
    'expired', 'paper_executed'
  )),
  -- Deterministic duplicate-prevention key.
  idempotency_key text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, idempotency_key)
);

create index if not exists idx_order_intents_user_status
  on public.order_intents(user_id, status);
create index if not exists idx_order_intents_symbol_time
  on public.order_intents(symbol, created_at desc);

-- ---------------------------------------------------------------------------
-- Order approvals: the explicit human decision on an intent, with the channel and
-- request context captured for the audit trail.
-- ---------------------------------------------------------------------------
create table if not exists public.order_approvals (
  id uuid primary key default gen_random_uuid(),
  order_intent_id uuid not null references public.order_intents(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  approval_status text not null,
  approved_via text check (approved_via in ('web', 'telegram', 'whatsapp')),
  -- Provider message id when approval came over a messaging channel - it must match
  -- an exact pending-approval prompt, never a free-form message.
  approval_message_id text,
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

create index if not exists idx_order_approvals_intent
  on public.order_approvals(order_intent_id);

-- ---------------------------------------------------------------------------
-- Execution audit logs: append-only event stream across the whole intent
-- lifecycle (drafted, risk-checked, blocked, approved, paper-filled, ...).
-- ---------------------------------------------------------------------------
create table if not exists public.execution_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  order_intent_id uuid references public.order_intents(id) on delete set null,
  strategy_id uuid references public.strategy_definitions(id) on delete set null,
  symbol text,
  payload jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_execution_audit_logs_user_time
  on public.execution_audit_logs(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Paper trading: simulated accounts, orders, positions, closed trades, journal.
-- ---------------------------------------------------------------------------
create table if not exists public.paper_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  starting_cash numeric not null default 100000,
  current_cash numeric not null default 100000,
  currency text not null default 'USD',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_paper_accounts_user
  on public.paper_accounts(user_id);

create table if not exists public.paper_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  paper_account_id uuid not null references public.paper_accounts(id) on delete cascade,
  strategy_id uuid references public.strategy_definitions(id) on delete set null,
  symbol text not null,
  side text not null check (side in ('buy', 'sell')),
  order_type text not null check (order_type in ('market', 'limit', 'stop', 'stop_limit')),
  quantity numeric,
  limit_price numeric,
  stop_price numeric,
  status text not null default 'open',
  reason_code text,
  filled_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_paper_orders_account_status
  on public.paper_orders(paper_account_id, status);

create table if not exists public.paper_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  paper_account_id uuid not null references public.paper_accounts(id) on delete cascade,
  symbol text not null,
  quantity numeric not null default 0,
  average_price numeric,
  market_value numeric,
  unrealised_pnl numeric,
  realised_pnl numeric,
  opened_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(paper_account_id, symbol)
);

create table if not exists public.paper_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  paper_account_id uuid not null references public.paper_accounts(id) on delete cascade,
  symbol text not null,
  strategy_id uuid references public.strategy_definitions(id) on delete set null,
  entry_time timestamptz,
  exit_time timestamptz,
  entry_price numeric,
  exit_price numeric,
  quantity numeric,
  fees numeric,
  slippage numeric,
  realised_pnl numeric,
  exit_reason text,
  -- Frozen context at entry so post-trade review sees what the system saw.
  thesis_snapshot jsonb,
  signal_snapshot jsonb,
  risk_snapshot jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_paper_trades_account_time
  on public.paper_trades(paper_account_id, entry_time desc);

create table if not exists public.paper_trade_journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  paper_trade_id uuid not null references public.paper_trades(id) on delete cascade,
  note text,
  mistake_tags jsonb default '[]',
  lesson text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_paper_trade_journal_trade
  on public.paper_trade_journal(paper_trade_id);

-- ---------------------------------------------------------------------------
-- Backtesting: runs and per-trade results against a strategy definition.
-- ---------------------------------------------------------------------------
create table if not exists public.backtest_runs (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.strategy_definitions(id) on delete cascade,
  run_name text,
  universe jsonb,
  timeframe text,
  start_date date,
  end_date date,
  -- Fees, slippage model, fill assumptions - frozen so results are reproducible.
  assumptions jsonb,
  metrics jsonb,
  status text not null default 'pending',
  created_at timestamptz default now()
);

create index if not exists idx_backtest_runs_strategy
  on public.backtest_runs(strategy_id);

create table if not exists public.backtest_trades (
  id uuid primary key default gen_random_uuid(),
  backtest_run_id uuid not null references public.backtest_runs(id) on delete cascade,
  symbol text not null,
  entry_time timestamptz,
  exit_time timestamptz,
  entry_price numeric,
  exit_price numeric,
  side text check (side in ('buy', 'sell')),
  quantity numeric,
  gross_pnl numeric,
  net_pnl numeric,
  fees numeric,
  slippage numeric,
  max_adverse_excursion numeric,
  max_favourable_excursion numeric,
  exit_reason text,
  created_at timestamptz default now()
);

create index if not exists idx_backtest_trades_run
  on public.backtest_trades(backtest_run_id);

-- ---------------------------------------------------------------------------
-- Fundamentals: structured financials and discrete events per symbol. symbol is
-- intentionally NOT foreign-keyed to stock_tickers so small-cap discovery can land
-- fundamentals for names before they join the scanned universe. Distinct from the
-- legacy fundamental_snapshots/company_events tables in 014 - these rows carry
-- evidence provenance via source_document_id.
-- ---------------------------------------------------------------------------
create table if not exists public.company_fundamentals (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  fiscal_period text,
  fiscal_year int,
  revenue numeric,
  revenue_growth_yoy numeric,
  gross_margin numeric,
  operating_margin numeric,
  net_margin numeric,
  free_cash_flow numeric,
  cash numeric,
  debt numeric,
  net_debt numeric,
  shares_outstanding numeric,
  share_count_growth_yoy numeric,
  market_cap numeric,
  enterprise_value numeric,
  ev_to_sales numeric,
  pe_ratio numeric,
  price_to_book numeric,
  cash_runway_months numeric,
  capex numeric,
  r_and_d numeric,
  source_document_id uuid references public.source_documents(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_company_fundamentals_symbol
  on public.company_fundamentals(symbol, fiscal_year desc);

create table if not exists public.fundamental_events (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  event_type text,
  event_date date,
  source_document_id uuid references public.source_documents(id) on delete set null,
  summary text,
  impact_score numeric,
  created_at timestamptz default now()
);

create index if not exists idx_fundamental_events_symbol_date
  on public.fundamental_events(symbol, event_date desc);

-- ---------------------------------------------------------------------------
-- RLS - owner-only CRUD for every user-owned table (auth.uid() = user_id).
-- notification_channels already received identical policies in 015; re-applying
-- the same names here is an idempotent no-op that keeps this layer self-contained.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  user_tables text[] := array[
    'notification_channels', 'channel_pairing_codes', 'outbound_messages',
    'trading_settings', 'order_intents', 'order_approvals', 'execution_audit_logs',
    'paper_accounts', 'paper_orders', 'paper_positions', 'paper_trades',
    'paper_trade_journal'
  ];
begin
  foreach t in array user_tables loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format('alter table public.%I enable row level security;', t);
      execute format('drop policy if exists %I on public.%I;', t || '_owner_sel', t);
      execute format('create policy %I on public.%I for select using (auth.uid() = user_id);', t || '_owner_sel', t);
      execute format('drop policy if exists %I on public.%I;', t || '_owner_ins', t);
      execute format('create policy %I on public.%I for insert with check (auth.uid() = user_id);', t || '_owner_ins', t);
      execute format('drop policy if exists %I on public.%I;', t || '_owner_upd', t);
      execute format('create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);', t || '_owner_upd', t);
      execute format('drop policy if exists %I on public.%I;', t || '_owner_del', t);
      execute format('create policy %I on public.%I for delete using (auth.uid() = user_id);', t || '_owner_del', t);
    end if;
  end loop;
end $$;

-- inbound_messages: owner read only. Rows arrive via provider webhooks through the
-- backend (service role); user_id is null until pairing, and unpaired rows must stay
-- invisible to every client. No client insert/update/delete.
alter table public.inbound_messages enable row level security;
drop policy if exists inbound_messages_owner_sel on public.inbound_messages;
create policy inbound_messages_owner_sel on public.inbound_messages
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- RLS - shared catalog tables: authenticated read-only. Writes happen only through
-- backend workers using the SERVICE ROLE key (bypasses RLS).
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  shared_tables text[] := array[
    'strategy_definitions', 'backtest_runs', 'backtest_trades',
    'company_fundamentals', 'fundamental_events'
  ];
begin
  foreach t in array shared_tables loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format('alter table public.%I enable row level security;', t);
      execute format('drop policy if exists %I on public.%I;', t || '_read', t);
      execute format('create policy %I on public.%I for select to authenticated using (true);', t || '_read', t);
    end if;
  end loop;
end $$;
