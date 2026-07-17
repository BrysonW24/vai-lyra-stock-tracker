-- 046: the scout's idea upsert key must not be a PARTIAL index.
--
-- Same 42P10 class migration 044 fixed for company_events/fundamental_snapshots, missed
-- here: 043 created
--     create unique index uq_scout_idea_dedupe on community_ideas(dedupe_key)
--       where dedupe_key is not null;
-- and workers/scout/main.py upserts community_ideas with on_conflict="dedupe_key".
-- Postgres cannot infer a partial unique index as an ON CONFLICT target, so every
-- scout-filed idea was rejected (42P10) while the per-idea except logged and the run
-- stayed green. The predicate was never needed: NULLs are DISTINCT in a unique index,
-- so human-authored rows (null dedupe_key) coexist under a plain unique index.
--
-- The worker now also fails loudly when candidates > 0 and filed = 0, so a regression
-- here goes red instead of green.

drop index if exists public.uq_scout_idea_dedupe;
create unique index if not exists uq_scout_idea_dedupe
  on public.community_ideas(dedupe_key);

comment on index public.uq_scout_idea_dedupe is
  'Upsert key for workers/scout (on_conflict=dedupe_key). MUST stay non-partial: Postgres
   cannot infer a partial unique index as an ON CONFLICT target (42P10) - see migration 044
   for the twin fix on company_events/fundamental_snapshots. NULLs are distinct here, so
   human rows with a null dedupe_key never collide.';
