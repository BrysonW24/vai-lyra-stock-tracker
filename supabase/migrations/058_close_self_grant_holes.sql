-- 058: two more places where authority lived in a row its subject could write.
--
-- Both are the class 047 named ("authority must never live in a column its subject can write"),
-- found by the 2026-10-05 API audit and confirmed against the live database. Neither had been
-- used (0 granted profiles, 0 forged cards) - this closes them before either is.
--
-- 1. profiles.ai_included (added by 055) decides who gets Lyra's hosted AI key after the free
--    trial. 015's update policy lets a user write ANY column of their own row, and 047's guard
--    only watches `role`. So any signed-in account could PATCH its own profile to
--    ai_included = true (public anon key + their own JWT) and keep the house key forever.
--    047 also only guarded UPDATE: a user with no profile row yet could INSERT one that already
--    carried role = 'maintainer'.
--
--    One guard now covers both authority columns, on INSERT and UPDATE.
--
-- 2. community_ideas' insert policy (038) checked only `auth.uid() = user_id`. 043 then added the
--    scout columns to the same table, so a signed-in user could insert a row that claims to be an
--    AI-scout proposal - origin = 'scout', its own "evidence" links, any confidence, any vote
--    count, any status - and the public board (and the cached "Lyra's read" generated from that
--    evidence) would present it as Lyra's work. Users may only insert a plain, unvoted, open,
--    human idea; scout rows are written by the worker (service role, which bypasses RLS).
--
-- Idempotent. Independent of the Supabase auth.role() helper (reads the JWT claim directly, like
-- 047, so migrate-from-zero's minimal shim also passes).

-- ---------------------------------------------------------------------------------------------
-- 1. profiles: role AND ai_included are server-only, on insert and on update.

create or replace function public.guard_profile_authority_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text;
  touched boolean;
begin
  if tg_op = 'INSERT' then
    -- A new row may only carry the defaults for the authority columns.
    touched := coalesce(new.role, 'operator') <> 'operator' or coalesce(new.ai_included, false);
  else
    touched := new.role is distinct from old.role or new.ai_included is distinct from old.ai_included;
  end if;

  if touched then
    jwt_role := coalesce(
      nullif(current_setting('request.jwt.claim.role', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
    );
    -- null = no JWT in play (direct psql / owner / migration / auth trigger context): already
    -- privileged, allowed. Everything else must be the server's service role.
    if jwt_role is not null and jwt_role <> 'service_role' then
      raise exception 'profiles.role and profiles.ai_included can only be set server-side'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_role on public.profiles;
drop trigger if exists trg_guard_profile_authority on public.profiles;
create trigger trg_guard_profile_authority
  before insert or update of role, ai_included on public.profiles
  for each row
  execute function public.guard_profile_authority_change();

comment on trigger trg_guard_profile_authority on public.profiles is
  'Blocks self-service authority: profiles.role (043 keys maintainer moderation off it) and
   profiles.ai_included (055 keys the hosted AI key off it) may only be set by service-role/server
   contexts. Removing this trigger re-opens: any user -> maintainer, and any user -> free hosted AI.';

-- The 047 function is superseded by the one above; nothing else references it.
drop function if exists public.guard_profile_role_change();

-- ---------------------------------------------------------------------------------------------
-- 2. community_ideas: a user may insert only a plain human idea.

drop policy if exists "community_ideas_insert_own" on public.community_ideas;
create policy "community_ideas_insert_own" on public.community_ideas
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and origin = 'human'
    and kind = 'feature'
    and status = 'open'
    and vote_count = 0
    and evidence = '[]'::jsonb
    and confidence is null
    and dedupe_key is null
    and stamped_at is null
  );

comment on policy "community_ideas_insert_own" on public.community_ideas is
  'A signed-in user may post a plain, unvoted, open, human idea - nothing else. Scout proposals
   (origin = scout, evidence, confidence, dedupe_key) are written by the worker with the service
   role. Loosening this lets a user publish a forged "AI scout" card with their own evidence links.';
