-- 018_gekko_member.sql
-- Community membership (Gordon's Gekko investing group) captured at sign-up so members
-- can be segmented. The value is collected on the sign-up form (stored in auth metadata)
-- and mirrored onto the profile by the bootstrap trigger. Idempotent.

alter table public.profiles add column if not exists gekko_member boolean default false;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, gekko_member)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'gekko_member')::boolean, false)
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.onboarding_progress (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.operator_profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.user_alert_preferences (user_id) values (new.id) on conflict (user_id) do nothing;

  return new;
end;
$$;
