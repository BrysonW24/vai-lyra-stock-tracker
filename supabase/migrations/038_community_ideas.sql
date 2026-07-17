-- 038_community_ideas.sql
-- Community Ideas board: users submit feature ideas and upvote what they want built next.
-- The board is community-visible (everyone reads every idea); one vote per user per idea.
-- vote_count is denormalized on community_ideas and kept exact by a security-definer trigger,
-- so ranking by votes is a single index scan. RLS: read all, write only your own rows.
-- Idempotent + additive (safe to re-run).

create table if not exists public.community_ideas (
  id uuid primary key default gen_random_uuid(),
  -- Author. on delete set null: an idea outlives the account that raised it (it belongs to the board).
  user_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text not null default '',
  -- open | planned | in_progress | shipped | declined  (moderated by the maintainer via service role).
  status text not null default 'open',
  -- Denormalized tally, maintained by trg_bump_idea_vote_count below.
  vote_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ranking index: most-voted first, newest as the tiebreak.
create index if not exists idx_community_ideas_rank on public.community_ideas(vote_count desc, created_at desc);

create table if not exists public.community_idea_votes (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.community_ideas(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- One vote per user per idea - the hard guard against double-voting (also races: the unique
-- index rejects the second concurrent insert).
create unique index if not exists uq_idea_vote_once on public.community_idea_votes(idea_id, user_id);
create index if not exists idx_idea_votes_user on public.community_idea_votes(user_id);

-- RLS ------------------------------------------------------------------------
alter table public.community_ideas enable row level security;
alter table public.community_idea_votes enable row level security;

-- Ideas: the board is public - anon and signed-in can read every idea (title/description/votes
-- only; author identity is never surfaced by the API). You can insert only your own idea.
drop policy if exists "community_ideas_select_all" on public.community_ideas;
create policy "community_ideas_select_all" on public.community_ideas for select to anon, authenticated using (true);

drop policy if exists "community_ideas_insert_own" on public.community_ideas;
create policy "community_ideas_insert_own" on public.community_ideas for insert to authenticated with check (auth.uid() = user_id);

-- Votes: you can see only your own votes (to render the "you voted" state) and add/remove them.
drop policy if exists "community_votes_select_own" on public.community_idea_votes;
create policy "community_votes_select_own" on public.community_idea_votes for select to authenticated using (auth.uid() = user_id);

drop policy if exists "community_votes_insert_own" on public.community_idea_votes;
create policy "community_votes_insert_own" on public.community_idea_votes for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "community_votes_delete_own" on public.community_idea_votes;
create policy "community_votes_delete_own" on public.community_idea_votes for delete to authenticated using (auth.uid() = user_id);

-- vote_count maintenance -----------------------------------------------------
-- A voter cannot UPDATE someone else's idea row under RLS, so the count bump runs security definer.
-- greatest(0, ...) keeps the tally from ever going negative if a delete arrives without its insert.
create or replace function public.bump_idea_vote_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.community_ideas set vote_count = vote_count + 1, updated_at = now() where id = new.idea_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.community_ideas set vote_count = greatest(0, vote_count - 1), updated_at = now() where id = old.idea_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_bump_idea_vote_count on public.community_idea_votes;
create trigger trg_bump_idea_vote_count
  after insert or delete on public.community_idea_votes
  for each row execute function public.bump_idea_vote_count();
