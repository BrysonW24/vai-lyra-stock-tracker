-- 045_scout_runs.sql
-- The scout's run ledger: one row per nightly run so the PRODUCT can show what the scout
-- saw (per-theme counts, near-promotion drumbeats, saturation) instead of burying it in
-- CI logs. Drumbeats are computed by the SAME Python code that promotes ideas - the
-- frontend never re-implements clustering, so the two can never drift.
-- Idempotent + additive (safe to re-run).

create table if not exists public.scout_runs (
  id bigint generated always as identity primary key,
  run_at timestamptz not null default now(),
  items_fetched integer not null default 0,
  items_persisted integer not null default 0,
  items_unmapped integer not null default 0,
  ideas_filed integer not null default 0,
  sources_active integer not null default 0,
  sources_gated integer not null default 0,
  window_saturated boolean not null default false,
  -- {"agi-infrastructure": 96, "critical-minerals": 91, ...} - tonight's attach counts.
  theme_counts jsonb not null default '{}'::jsonb,
  -- Below-bar building clusters: [{entity, items, sources, needItems, needSources, latest:{title,url}}]
  drumbeats jsonb not null default '[]'::jsonb
);

create index if not exists idx_scout_runs_run_at on public.scout_runs(run_at desc);

alter table public.scout_runs enable row level security;

-- Same visibility contract as scout_items: anyone reads, only the service role writes.
drop policy if exists "scout_runs_select_all" on public.scout_runs;
create policy "scout_runs_select_all" on public.scout_runs for select to anon, authenticated using (true);
