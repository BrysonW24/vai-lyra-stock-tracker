-- 037: the user's OWN money goal - a target amount they are working toward.
--
-- The goal cockpit tracks progress toward a target. Without an explicit number it climbs a milestone
-- ladder ($1k -> $2.5k -> $5k ...), which is honest but generic. This lets a user set THEIR number
-- (e.g. "$50,000") so the whole cockpit - the progress bar, the "to go", the pace - is anchored to
-- the goal they actually stated, not a default. Nullable: no target simply falls back to the ladder.
--
-- operator_profiles already carries the user's capital context (cash_available, monthly_contribution)
-- under the existing owner-scoped RLS (auth.uid() = user_id), so this column inherits that fence.

alter table public.operator_profiles add column if not exists goal_target_amount numeric;

comment on column public.operator_profiles.goal_target_amount is
  'The user''s own money goal - the account value they are working toward, in their base currency. Null falls back to the milestone ladder. Read by the goal cockpit; owner-scoped by the table RLS.';
