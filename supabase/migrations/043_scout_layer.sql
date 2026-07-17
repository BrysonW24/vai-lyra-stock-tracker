-- 043_scout_layer.sql
-- The AI scout layer: broad news items land in scout_items (service-role writes only),
-- and the scout files its evidence-linked ideas onto the SAME community_ideas board humans
-- use - "like humans submitting ideas, but AI". New columns are additive with human-safe
-- defaults, so every existing row reads as a human feature idea.
-- Status moderation: profiles.role = 'maintainer' may update idea status from the UI
-- (flip your own row once: update public.profiles set role = 'maintainer' where id = '<you>').
-- Idempotent + additive (safe to re-run).

-- Broad scout items: everything the scout read this cycle, normalized.
create table if not exists public.scout_items (
  id text primary key,                       -- deterministic hash of (url|title)
  source_id text not null,                   -- registry id from content/scout-sources.jsonl
  source_kind text not null,                 -- api | rss | x | crawl
  url text,
  title text not null,
  summary text not null default '',
  published_at timestamptz,
  symbols text[] not null default '{}',      -- tickers detected in the text
  matched_themes text[] not null default '{}', -- theme slugs the item attached to
  unmapped boolean not null default false,   -- true = strong signal, no home vertical
  created_at timestamptz not null default now()
);

create index if not exists idx_scout_items_published on public.scout_items(published_at desc);
create index if not exists idx_scout_items_unmapped on public.scout_items(unmapped) where unmapped;

alter table public.scout_items enable row level security;

-- Read-only surface: anyone can read what the scout saw; only the service role writes.
drop policy if exists "scout_items_select_all" on public.scout_items;
create policy "scout_items_select_all" on public.scout_items for select to anon, authenticated using (true);

-- The AI joins the ideas board -------------------------------------------------
-- origin: who raised it. kind: what it proposes. evidence: the receipts (scout item refs).
alter table public.community_ideas add column if not exists origin text not null default 'human';
alter table public.community_ideas add column if not exists kind text not null default 'feature';
alter table public.community_ideas add column if not exists evidence jsonb not null default '[]'::jsonb;
alter table public.community_ideas add column if not exists confidence integer;

-- Dedupe guard for scout-raised ideas: the scout files one idea per emerging cluster slug,
-- stored in dedupe_key; humans keep null and are unaffected.
alter table public.community_ideas add column if not exists dedupe_key text;
create unique index if not exists uq_scout_idea_dedupe on public.community_ideas(dedupe_key) where dedupe_key is not null;

-- Maintainer status moderation from the UI (previously service-role only).
drop policy if exists "community_ideas_update_maintainer" on public.community_ideas;
create policy "community_ideas_update_maintainer" on public.community_ideas
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'maintainer'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'maintainer'));
