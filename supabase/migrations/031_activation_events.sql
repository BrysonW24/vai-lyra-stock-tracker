-- 031: activation telemetry. The activation layer was unmeasured theatre - five scenes of
-- animation with zero events, so nobody could see where the onboarding funnel leaks. One
-- narrow table: which step a user reached and when. No content, no free-text PII; the
-- event vocabulary is a short slug set emitted by the onboarding flow.

create table if not exists public.activation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null,
  step int,
  path text,
  created_at timestamptz not null default now()
);

create index if not exists idx_activation_events_user_time
  on public.activation_events(user_id, created_at desc);

alter table public.activation_events enable row level security;

drop policy if exists activation_events_owner_ins on public.activation_events;
create policy activation_events_owner_ins on public.activation_events
  for insert with check (auth.uid() = user_id);

drop policy if exists activation_events_owner_sel on public.activation_events;
create policy activation_events_owner_sel on public.activation_events
  for select using (auth.uid() = user_id);
