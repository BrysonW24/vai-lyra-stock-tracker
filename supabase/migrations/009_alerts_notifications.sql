-- 009_alerts_notifications.sql
-- USER-PRIVATE alert preferences, per-ticker overrides, mutes, delivery channels, and
-- the alert log. stock_alerts gains user_id (legacy was single-operator).

create table if not exists public.user_alert_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  alert_mode text default 'balanced',
  alerts_enabled boolean default true,
  frequency text default 'hourly',
  timezone text default 'Australia/Sydney',
  quiet_hours_enabled boolean default true,
  quiet_start time default '22:00',
  quiet_end time default '07:00',
  allow_weekends boolean default false,
  strong_setup_enabled boolean default true,
  watchlist_trigger_enabled boolean default true,
  portfolio_risk_enabled boolean default true,
  invalidation_enabled boolean default true,
  score_jump_enabled boolean default true,
  digest_enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

create table if not exists public.ticker_alert_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  symbol text not null references public.stock_tickers(symbol),
  alerts_enabled boolean default true,
  is_muted boolean default false,
  muted_until timestamptz,
  strong_setup_enabled boolean default true,
  watchlist_trigger_enabled boolean default true,
  portfolio_risk_enabled boolean default true,
  invalidation_enabled boolean default true,
  score_jump_enabled boolean default true,
  min_signal_score numeric,
  min_score_delta numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, symbol)
);

create table if not exists public.alert_mutes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  symbol text references public.stock_tickers(symbol),
  mute_scope text not null,
  muted_until timestamptz,
  reason text,
  created_at timestamptz default now()
);

-- Delivery destinations (Telegram chat_id, email, push later). The chat_id is NOT a
-- secret; the bot TOKEN lives only in the worker's environment.
create table if not exists public.notification_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_type text not null,
  channel_label text,
  destination text,
  is_verified boolean default false,
  is_active boolean default true,
  verification_code text,
  verified_at timestamptz,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, channel_type, destination)
);

create table if not exists public.stock_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  symbol text references public.stock_tickers(symbol),
  signal_id uuid references public.stock_signals(id) on delete set null,
  channel text not null,
  alert_type text not null,
  message text not null,
  sent_status text not null default 'pending',
  sent_at timestamptz,
  error_message text,
  payload jsonb,
  created_at timestamptz default now()
);

alter table public.stock_alerts add column if not exists user_id uuid references public.profiles(id) on delete cascade;
alter table public.stock_alerts add column if not exists signal_id uuid references public.stock_signals(id) on delete set null;
alter table public.stock_alerts add column if not exists sent_status text default 'pending';
alter table public.stock_alerts add column if not exists error_message text;

create index if not exists idx_stock_alerts_user_time on public.stock_alerts(user_id, created_at desc);
