-- 048_scout_outcomes.sql
-- v3 of the scout loop: verdicts stop evaporating. A nightly stamping pass reads decided
-- scout cards and turns them into three deterministic feedback surfaces:
--   1. scout_source_scores  - accepted cards CREDIT the sources whose evidence backed
--      them, declined cards DEBIT them: an earned leaderboard that drives registry
--      curation (a source that only ever feeds noise shows up as one).
--   2. scout_stoplist       - entities from declined cards can never re-file: the junk
--      filter stops being hand-curated and becomes accumulated human verdicts.
--   3. community_ideas.stamped_at - each card's verdict is counted exactly once.
-- All counts and ratios - no model opinion anywhere. Idempotent + additive.

alter table public.community_ideas add column if not exists stamped_at timestamptz;

create table if not exists public.scout_source_scores (
  source_id text primary key,              -- registry id from content/scout-sources.jsonl
  accepted integer not null default 0,     -- evidence appearances in accepted cards
  declined integer not null default 0,     -- evidence appearances in declined cards
  updated_at timestamptz not null default now()
);

create table if not exists public.scout_stoplist (
  slug text primary key,                   -- slugified entity (matches cluster slugify)
  entity text not null,                    -- the display entity, for the audit trail
  dedupe_key text,                         -- the declined card's dedupe_key
  declined_at timestamptz not null default now()
);

alter table public.scout_source_scores enable row level security;
alter table public.scout_stoplist enable row level security;

-- Same visibility contract as the rest of the scout: anyone reads, service role writes.
drop policy if exists "scout_source_scores_select_all" on public.scout_source_scores;
create policy "scout_source_scores_select_all" on public.scout_source_scores for select to anon, authenticated using (true);
drop policy if exists "scout_stoplist_select_all" on public.scout_stoplist;
create policy "scout_stoplist_select_all" on public.scout_stoplist for select to anon, authenticated using (true);
