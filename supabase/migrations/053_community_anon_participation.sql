-- 053_community_anon_participation.sql
-- The Ideas board becomes a public community board: anyone can post and vote without an
-- account. Anonymous participation is keyed by a per-device voter key: a SERVER-ISSUED,
-- HMAC-signed key (lib/community-key.ts) the client obtains once from the rate-limited
-- /api/community/key endpoint and keeps in localStorage - client-minted keys verify to
-- nothing, which is what keeps vote counts honest. The API writes those rows through the
-- service role, so RLS stays exactly as strict as 038 left it for direct client access.
--
-- Also seeds the two standing example ideas (fixed UUIDs, so re-runs never duplicate):
-- deliberately "things we may never build" - they show visitors what an idea looks like
-- without reading as roadmap commitments.
--
-- Idempotent + additive (safe to re-run).

-- Votes may now belong to a device instead of a user. Exactly one of the two identities
-- must be present - a vote with neither would be untraceable and uncountable for dedupe.
alter table public.community_idea_votes alter column user_id drop not null;
alter table public.community_idea_votes add column if not exists voter_key text;

alter table public.community_idea_votes drop constraint if exists chk_vote_identity;
alter table public.community_idea_votes add constraint chk_vote_identity
  check ((user_id is null) <> (voter_key is null));

-- One vote per device per idea - the anonymous twin of uq_idea_vote_once. Partial index:
-- signed-in votes keep the original guard.
create unique index if not exists uq_idea_vote_once_anon
  on public.community_idea_votes(idea_id, voter_key) where voter_key is not null;

-- Anonymous ideas have no author row; community_ideas.user_id was already nullable
-- (on delete set null) so inserts through the service role need no schema change.

-- Standing example ideas ------------------------------------------------------
-- Fixed UUIDs so this seed is idempotent and the API/tests can reference them.
insert into public.community_ideas (id, title, description, status, origin, kind)
values
  (
    'a0000000-0000-4000-8000-000000000001',
    'Let Lyra place the trades for me',
    'Example idea - and one we may never build: Lyra is research-only by design, it never touches your broker. Posted here to show how the board works: add what you want built, vote on what you agree with.',
    'declined', 'human', 'feature'
  ),
  (
    'a0000000-0000-4000-8000-000000000002',
    'Lyra rings your phone like an old-school broker',
    'Example idea - probably never, but who knows: when a strong setup fires, Lyra calls you and talks through the score in plain English. This is the kind of thing to post here - what do you want Lyra to do?',
    'open', 'human', 'feature'
  )
on conflict (id) do nothing;
