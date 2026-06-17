-- 024_multi_channel_push_notifications.sql
-- Multi-channel notification spine: Web Push subscriptions, event audit rows,
-- delivery attempts, and persistent settings/onboarding fields.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  platform text,
  is_active boolean default true,
  failure_count integer default 0,
  last_used_at timestamptz,
  disabled_at timestamptz,
  disabled_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, endpoint)
);

create index if not exists idx_push_subscriptions_user_active
  on public.push_subscriptions(user_id, is_active);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  severity text default 'medium',
  title text not null,
  body text not null,
  trigger_reason text,
  evidence_refs text[] default '{}'::text[],
  symbol text,
  theme text,
  related_entity_type text,
  related_entity_id text,
  relevance_score numeric default 100,
  url text,
  payload jsonb default '{}'::jsonb,
  dedupe_key text,
  idempotency_key text,
  created_at timestamptz default now()
);

create index if not exists idx_notification_events_user_time
  on public.notification_events(user_id, created_at desc);

create unique index if not exists uq_notification_events_user_dedupe
  on public.notification_events(user_id, dedupe_key)
  where dedupe_key is not null;

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.notification_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null,
  destination text,
  status text not null default 'queued',
  provider_message_id text,
  error_message text,
  attempt integer default 1,
  idempotency_key text,
  attempted_at timestamptz default now(),
  delivered_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_notification_deliveries_user_time
  on public.notification_deliveries(user_id, created_at desc);
create index if not exists idx_notification_deliveries_event
  on public.notification_deliveries(event_id);

alter table public.user_alert_preferences add column if not exists push_enabled boolean default false;
alter table public.user_alert_preferences add column if not exists telegram_enabled boolean default false;
alter table public.user_alert_preferences add column if not exists whatsapp_enabled boolean default false;
alter table public.user_alert_preferences add column if not exists min_signal_score integer default 75;
alter table public.user_alert_preferences add column if not exists paper_bot_alerts boolean default true;
alter table public.user_alert_preferences add column if not exists order_approval_alerts boolean default true;
alter table public.user_alert_preferences add column if not exists weekly_digest_enabled boolean default true;
alter table public.user_alert_preferences add column if not exists hourly_digest_enabled boolean default false;
alter table public.user_alert_preferences add column if not exists macro_alerts boolean default false;
alter table public.user_alert_preferences add column if not exists theme_alerts boolean default true;
alter table public.user_alert_preferences add column if not exists watchlist_movement_alerts boolean default true;
alter table public.user_alert_preferences add column if not exists portfolio_movement_alerts boolean default true;
alter table public.user_alert_preferences add column if not exists movement_threshold_step_pct integer default 5;
alter table public.user_alert_preferences add column if not exists movement_threshold_max_abs_pct integer default 50;

alter table public.watchlist_items add column if not exists reference_price numeric;
alter table public.watchlist_items add column if not exists movement_alert_pcts integer[] default array[-15,-10,-5,5,10,15];

alter table public.push_subscriptions enable row level security;
drop policy if exists push_subscriptions_owner_sel on public.push_subscriptions;
create policy push_subscriptions_owner_sel on public.push_subscriptions for select using (auth.uid() = user_id);
drop policy if exists push_subscriptions_owner_ins on public.push_subscriptions;
create policy push_subscriptions_owner_ins on public.push_subscriptions for insert with check (auth.uid() = user_id);
drop policy if exists push_subscriptions_owner_upd on public.push_subscriptions;
create policy push_subscriptions_owner_upd on public.push_subscriptions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists push_subscriptions_owner_del on public.push_subscriptions;
create policy push_subscriptions_owner_del on public.push_subscriptions for delete using (auth.uid() = user_id);

alter table public.notification_events enable row level security;
drop policy if exists notification_events_owner_sel on public.notification_events;
create policy notification_events_owner_sel on public.notification_events for select using (auth.uid() = user_id);
drop policy if exists notification_events_owner_ins on public.notification_events;
create policy notification_events_owner_ins on public.notification_events for insert with check (auth.uid() = user_id);
drop policy if exists notification_events_owner_upd on public.notification_events;
create policy notification_events_owner_upd on public.notification_events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists notification_events_owner_del on public.notification_events;
create policy notification_events_owner_del on public.notification_events for delete using (auth.uid() = user_id);

alter table public.notification_deliveries enable row level security;
drop policy if exists notification_deliveries_owner_sel on public.notification_deliveries;
create policy notification_deliveries_owner_sel on public.notification_deliveries for select using (auth.uid() = user_id);
drop policy if exists notification_deliveries_owner_ins on public.notification_deliveries;
create policy notification_deliveries_owner_ins on public.notification_deliveries for insert with check (auth.uid() = user_id);
drop policy if exists notification_deliveries_owner_upd on public.notification_deliveries;
create policy notification_deliveries_owner_upd on public.notification_deliveries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists notification_deliveries_owner_del on public.notification_deliveries;
create policy notification_deliveries_owner_del on public.notification_deliveries for delete using (auth.uid() = user_id);
