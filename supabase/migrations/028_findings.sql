-- 028_findings.sql
-- Investigation findings lifecycle store. [Phase 4a]
-- Live findings are PROJECTED from notification_events (see src/lib/findings/from-events.ts), so this
-- table does not duplicate the event; it stores only the per-user LIFECYCLE overlay - dismissals and
-- state promotions (Monitor -> Watchlist candidate -> ... -> Review risk) that accrete as evidence
-- stacks. finding_key is the notification_events.id the finding was projected from. RLS-scoped to the
-- owner. Idempotent + additive.

create table if not exists public.findings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- The source id the finding was projected from (notification_events.id), unique per user.
  finding_key text not null,
  type text,
  symbol text,
  theme text,
  -- Lifecycle state; null means "use the projected default".
  state text,
  score numeric,
  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  promoted_at timestamptz,
  dismissed_at timestamptz,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists uq_findings_user_key on public.findings(user_id, finding_key);
create index if not exists idx_findings_user_time on public.findings(user_id, last_seen_at desc);

alter table public.findings enable row level security;

drop policy if exists "findings_select_own" on public.findings;
create policy "findings_select_own" on public.findings for select to authenticated using (auth.uid() = user_id);

drop policy if exists "findings_insert_own" on public.findings;
create policy "findings_insert_own" on public.findings for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "findings_update_own" on public.findings;
create policy "findings_update_own" on public.findings for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Promote / dismiss a finding in one round-trip. Upserts the lifecycle row keyed by the projected
-- finding_key. p_state null + p_dismiss false is a no-op touch (refreshes last_seen_at).
create or replace function public.set_finding_lifecycle(
  p_finding_key text,
  p_state text default null,
  p_dismiss boolean default false,
  p_type text default null,
  p_symbol text default null,
  p_theme text default null,
  p_score numeric default null
)
returns public.findings
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.findings;
begin
  if v_user is null then
    raise exception 'Sign in to update findings.';
  end if;
  if p_finding_key is null or length(trim(p_finding_key)) = 0 then
    raise exception 'A finding key is required.';
  end if;

  insert into public.findings (user_id, finding_key, type, symbol, theme, state, score, promoted_at, dismissed_at)
  values (
    v_user, p_finding_key, p_type, p_symbol, p_theme, p_state, p_score,
    case when p_state is not null then now() else null end,
    case when p_dismiss then now() else null end
  )
  on conflict (user_id, finding_key) do update
    set state = coalesce(excluded.state, public.findings.state),
        type = coalesce(excluded.type, public.findings.type),
        symbol = coalesce(excluded.symbol, public.findings.symbol),
        theme = coalesce(excluded.theme, public.findings.theme),
        score = coalesce(excluded.score, public.findings.score),
        promoted_at = case when p_state is not null then now() else public.findings.promoted_at end,
        -- Dismiss is reversible: an explicit dismiss sets it; ANY promote (p_state) clears it, so a
        -- dismissed finding can be brought back instead of being silently dropped forever.
        dismissed_at = case when p_dismiss then now() when p_state is not null then null else public.findings.dismissed_at end,
        last_seen_at = now(),
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.set_finding_lifecycle(text, text, boolean, text, text, text, numeric) to authenticated;
