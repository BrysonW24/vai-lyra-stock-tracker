-- 047: profiles.role must not be self-service.
--
-- The hole: 015's profiles_upd policy allows a user to update their OWN row with no
-- column restriction, and profiles carries `role text default 'operator'`. 043 then
-- granted community_ideas UPDATE to anyone whose profiles.role = 'maintainer'. Chain:
-- any signed-up user PATCHes their own profile to role='maintainer' via PostgREST
-- (public anon key + their JWT), and can then rewrite every user's community ideas.
--
-- Authority must never live in a column its subject can write. 043's intent (maintainer
-- moderation from the UI) stays - what changes is WHO can mint maintainers: only the
-- server (service role) or a direct owner session, never an end-user JWT.
--
-- Idempotent, and independent of the Supabase auth.role() helper (inlines the JWT
-- claim read so migrate-from-zero's minimal shim also passes).

create or replace function public.guard_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text;
begin
  if new.role is distinct from old.role then
    jwt_role := coalesce(
      nullif(current_setting('request.jwt.claim.role', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
    );
    -- null = no JWT in play (direct psql / owner / migration context): already
    -- privileged, allowed. Everything else must be the server's service role.
    if jwt_role is not null and jwt_role <> 'service_role' then
      raise exception 'profiles.role can only be changed server-side'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_role on public.profiles;
create trigger trg_guard_profile_role
  before update of role on public.profiles
  for each row
  execute function public.guard_profile_role_change();

comment on trigger trg_guard_profile_role on public.profiles is
  'Blocks role self-promotion: profiles.role is an authority column (043 keys maintainer
   moderation off it), so only service-role/server contexts may change it. Removing this
   trigger re-opens: any user -> maintainer -> rewrite every community idea.';
