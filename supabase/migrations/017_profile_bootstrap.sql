-- 017_profile_bootstrap.sql
-- When a new Supabase Auth user is created, provision their starter rows so the app
-- never has to special-case a half-set-up account. SECURITY DEFINER so it can write
-- to public.* during the auth signup transaction.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.onboarding_progress (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.operator_profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.user_alert_preferences (user_id) values (new.id) on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
