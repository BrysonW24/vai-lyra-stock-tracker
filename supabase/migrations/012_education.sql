-- 012_education.sql
-- Global education modules (shared) + per-user progress (private).

create table if not exists public.education_modules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text,
  level text,
  summary text,
  content jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.user_education_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  module_id uuid not null references public.education_modules(id) on delete cascade,
  status text default 'not_started',
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, module_id)
);
create index if not exists idx_user_education_user on public.user_education_progress(user_id);
