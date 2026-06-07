-- 003_onboarding.sql
-- Onboarding progress + operator profile (how the user trades/invests).

create table if not exists public.onboarding_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,

  welcome_completed boolean default false,
  operator_profile_completed boolean default false,
  market_universe_completed boolean default false,
  watchlist_completed boolean default false,
  portfolio_completed boolean default false,
  trade_snapshots_completed boolean default false,
  alert_preferences_completed boolean default false,
  activation_seen boolean default false,

  completion_pct numeric default 0,

  started_at timestamptz default now(),
  completed_at timestamptz,
  updated_at timestamptz default now(),

  unique(user_id)
);

create table if not exists public.operator_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,

  -- experienced branch
  experience_level text,
  investing_style text,
  preferred_timeframe text,
  risk_comfort text,
  primary_goal text,

  -- beginner branch (zero-jargon insight capture)
  beginner_motivation text,
  beginner_knowledge text,
  beginner_involvement text,
  beginner_learning_style text,
  beginner_horizon text,
  traded_before text,

  default_trade_amount numeric,
  cash_available numeric,
  max_position_size_pct numeric,
  monthly_contribution numeric,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id)
);

create index if not exists idx_onboarding_user on public.onboarding_progress(user_id);
create index if not exists idx_operator_profiles_user on public.operator_profiles(user_id);
