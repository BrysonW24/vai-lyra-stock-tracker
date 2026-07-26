-- 054_community_idea_surface.sql
-- Provenance: record which deployment each idea was submitted from - 'solo' (the accountless
-- Solo build), 'community' (production), or 'other' (a self-host / unknown origin). The board
-- lives on production; Solo and other deployments post cross-origin, so the API classifies the
-- request's Origin header (lib/community-contract.ts classifySurface) and stamps it here.
--
-- This is an analytics signal, not a security control. Nullable on purpose: rows created before
-- this migration have genuinely unknown provenance and stay NULL rather than being back-labelled.
--
-- The POST route writes `surface` best-effort with a column-missing fallback, so the code is
-- safe to deploy before OR after this runs. Idempotent + additive (safe to re-run).

alter table public.community_ideas add column if not exists surface text;

-- Analytics reads are "group by surface" over the whole board - a small btree keeps that cheap
-- as the table grows, and stays out of the way of the hot vote_count/created_at ordering.
create index if not exists idx_community_ideas_surface
  on public.community_ideas(surface) where surface is not null;

-- Example (founder analytics): how much of the board comes from Solo vs Community?
--   select coalesce(surface, 'unknown') as surface, count(*)
--   from public.community_ideas group by 1 order by 2 desc;
