-- 022_onboarding_ai_context.sql
-- Captures the remaining onboarding answers (strategy + the last capital fields) so the AI
-- copilot can read a user's full constraints and ground personalised insights against them.

alter table public.operator_profiles add column if not exists primary_outcome text;
alter table public.operator_profiles add column if not exists simulation_enabled boolean default false;
alter table public.operator_profiles add column if not exists strategy_id text;
alter table public.operator_profiles add column if not exists strategy_overrides jsonb default '{}'::jsonb;

alter table public.user_alert_preferences add column if not exists digest_time time default '08:00';
