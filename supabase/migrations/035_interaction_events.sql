-- 035: attention capture for the digital trading twin (Phase 0).
--
-- activation_events (031) captures only the onboarding funnel. This is the twin's ATTENTION store:
-- which tickers/themes/convergences a user opens, which drawers they expand, which buy-reviews they
-- see. Typed + tenant-scoped + owner-only RLS, exactly like activation_events - just wider. NO free
-- text and NO PII: event_type is a short slug set, entity_id is a symbol/slug, meta is small typed
-- extras (signal kinds, lifecycle stage). Writes are gated by user_settings.twin_capture_enabled
-- (opt-in, migration 033) at the API layer.

create table if not exists public.interaction_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- ticker_open | theme_open | convergence_expand | drawer_open | buy_review_shown | notification_open
  event_type text not null,
  -- ticker | theme | convergence | signal | notification
  entity_type text,
  entity_id text,
  path text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_interaction_events_user_time
  on public.interaction_events(user_id, created_at desc);
create index if not exists idx_interaction_events_user_entity
  on public.interaction_events(user_id, entity_type, entity_id);

alter table public.interaction_events enable row level security;

drop policy if exists interaction_events_owner_ins on public.interaction_events;
create policy interaction_events_owner_ins on public.interaction_events
  for insert with check (auth.uid() = user_id);

drop policy if exists interaction_events_owner_sel on public.interaction_events;
create policy interaction_events_owner_sel on public.interaction_events
  for select using (auth.uid() = user_id);
