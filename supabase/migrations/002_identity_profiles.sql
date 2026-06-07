-- 002_identity_profiles.sql
-- Identity layer. One profile row per Supabase Auth user; app preferences live here,
-- never directly on auth.users.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,

  account_type text default 'free',
  role text default 'operator',

  timezone text default 'Australia/Sydney',
  base_currency text default 'USD',

  onboarding_completed boolean default false,
  activation_seen boolean default false,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,

  dashboard_density text default 'compact',
  theme text default 'dark',
  learn_mode_enabled boolean default true,
  default_timeframe text default '1h',
  default_market_universe text default 'us_tech_100',

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id)
);

create index if not exists idx_user_settings_user on public.user_settings(user_id);
