-- 025_small_cap_research_backend.sql
-- Durable backend tables for small-cap research: official source events,
-- computed research scores, and user-owned paper-bot research candidates.

create table if not exists public.small_cap_source_events (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_name text not null,
  source_url text,
  published_at timestamptz,
  symbol text,
  company_name text,
  theme text,
  vertical text,
  event_type text not null,
  title text not null,
  summary text,
  amount numeric,
  currency text,
  score_impact numeric default 0,
  payload jsonb default '{}'::jsonb,
  checksum text,
  created_at timestamptz default now()
);

create index if not exists idx_small_cap_events_symbol_time
  on public.small_cap_source_events(symbol, published_at desc);
create index if not exists idx_small_cap_events_theme_time
  on public.small_cap_source_events(theme, published_at desc);
create unique index if not exists uq_small_cap_events_checksum
  on public.small_cap_source_events(checksum)
  where checksum is not null;

create table if not exists public.small_cap_research_scores (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  company_name text,
  theme text,
  vertical text,
  as_of timestamptz default now(),
  total_score numeric not null,
  technical_score numeric default 0,
  buyer_volume_score numeric default 0,
  government_score numeric default 0,
  evidence_score numeric default 0,
  vertical_score numeric default 0,
  risk_penalty numeric default 0,
  paper_bot_eligible boolean default false,
  research_state text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_small_cap_scores_symbol_time
  on public.small_cap_research_scores(symbol, as_of desc);
create index if not exists idx_small_cap_scores_total
  on public.small_cap_research_scores(total_score desc, as_of desc);

create table if not exists public.paper_bot_research_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  symbol text not null,
  company_name text,
  theme text,
  thesis text,
  score numeric not null,
  status text not null default 'queued',
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, symbol)
);

create index if not exists idx_paper_bot_research_candidates_user_status
  on public.paper_bot_research_candidates(user_id, status, score desc);

alter table public.small_cap_source_events enable row level security;
drop policy if exists small_cap_source_events_read on public.small_cap_source_events;
create policy small_cap_source_events_read on public.small_cap_source_events
  for select to anon, authenticated using (true);

alter table public.small_cap_research_scores enable row level security;
drop policy if exists small_cap_research_scores_read on public.small_cap_research_scores;
create policy small_cap_research_scores_read on public.small_cap_research_scores
  for select to anon, authenticated using (true);

alter table public.paper_bot_research_candidates enable row level security;
drop policy if exists paper_bot_research_candidates_owner_sel on public.paper_bot_research_candidates;
create policy paper_bot_research_candidates_owner_sel on public.paper_bot_research_candidates
  for select using (auth.uid() = user_id);
drop policy if exists paper_bot_research_candidates_owner_ins on public.paper_bot_research_candidates;
create policy paper_bot_research_candidates_owner_ins on public.paper_bot_research_candidates
  for insert with check (auth.uid() = user_id);
drop policy if exists paper_bot_research_candidates_owner_upd on public.paper_bot_research_candidates;
create policy paper_bot_research_candidates_owner_upd on public.paper_bot_research_candidates
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists paper_bot_research_candidates_owner_del on public.paper_bot_research_candidates;
create policy paper_bot_research_candidates_owner_del on public.paper_bot_research_candidates
  for delete using (auth.uid() = user_id);
