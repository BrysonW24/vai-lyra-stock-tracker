-- 056_emerging_winner.sql
-- The Emerging Winner Engine's shadow-live storage (Production v1, spec line 2064: "immutable
-- shadow-live prediction ledger").
--
-- Three worker-owned research tables (no user_id - single-operator research data, exactly like
-- signal_outcomes). RLS on, read-only for anon + authenticated, writes only via the service-role key.
--
--   emerging_winner_runs         - one row per scoring run (header + counts)
--   emerging_winner_predictions  - the IMMUTABLE ledger: one row per (run, symbol). Append-only,
--                                  enforced by a trigger that blocks UPDATE/DELETE, so a prediction
--                                  logged today can never be quietly rewritten - the track record can
--                                  only be earned, not edited.
--   emerging_winner_outcomes     - the maturation side: when the 12-month horizon completes, the
--                                  realised forward return + first-touch barrier are written once.
--
-- Shadow-live means: predictions are computed and logged, but NOT surfaced to users as truth until
-- historical walk-forward + live calibration earn it. Idempotent + additive (safe to re-run).

create table if not exists public.emerging_winner_runs (
  id             uuid primary key default gen_random_uuid(),
  started_at     timestamptz not null default now(),
  engine_version text not null,
  candidate_count integer not null default 0,
  surfaced_count  integer not null default 0,
  blocked_count   integer not null default 0,
  note            text
);

create table if not exists public.emerging_winner_predictions (
  id                   uuid primary key default gen_random_uuid(),
  run_id               uuid not null references public.emerging_winner_runs(id) on delete cascade,
  symbol               text not null,
  predicted_at         timestamptz not null default now(),
  engine_version       text not null,
  winner_similarity    numeric not null,
  probability          numeric not null,
  ordinal_stage        integer not null,
  stage_label          text not null,
  archetype            text,
  archetype_confidence text,
  confidence           text,
  completeness         numeric,
  domain_composite     numeric,
  risk_verdict         text not null,
  risk_penalty         numeric not null,
  priority_score       numeric not null,
  action               text not null,
  surfaced             boolean not null default true,
  timing_state         text,
  payload              jsonb not null,   -- full EmergingWinnerResult (domains, contributions, analogues, distribution, risk gates, risks)
  created_at           timestamptz not null default now()
);

create index if not exists emerging_winner_predictions_run_idx on public.emerging_winner_predictions (run_id);
create index if not exists emerging_winner_predictions_symbol_idx on public.emerging_winner_predictions (symbol, predicted_at desc);

create table if not exists public.emerging_winner_outcomes (
  id                 uuid primary key default gen_random_uuid(),
  prediction_id      uuid not null references public.emerging_winner_predictions(id) on delete cascade,
  symbol             text not null,
  horizon_days       integer not null,
  entry_price        numeric,
  forward_return_pct numeric,
  barrier_hit        text,   -- 'up_100' | 'down_80' | 'neither'
  matured_at         timestamptz not null default now(),
  unique (prediction_id, horizon_days)
);

-- Append-only enforcement: the ledger of predictions can never be updated or deleted (immutable).
create or replace function public.emerging_winner_predictions_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'emerging_winner_predictions is append-only (immutable shadow-live ledger)';
end;
$$;

drop trigger if exists emerging_winner_predictions_no_mutate on public.emerging_winner_predictions;
create trigger emerging_winner_predictions_no_mutate
  before update or delete on public.emerging_winner_predictions
  for each row execute function public.emerging_winner_predictions_immutable();

-- RLS: worker-owned research data. Read-only for anon + authenticated; service role bypasses RLS to write.
do $$
declare
  t text;
  ew_tables text[] := array[
    'emerging_winner_runs', 'emerging_winner_predictions', 'emerging_winner_outcomes'
  ];
begin
  foreach t in array ew_tables loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format('alter table public.%I enable row level security;', t);
      execute format('drop policy if exists %I on public.%I;', t || '_read', t);
      execute format('create policy %I on public.%I for select to anon, authenticated using (true);', t || '_read', t);
    end if;
  end loop;
end $$;
