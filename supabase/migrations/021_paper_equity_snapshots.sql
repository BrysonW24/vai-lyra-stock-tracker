-- ---------------------------------------------------------------------------
-- 021: Paper equity snapshots - a durable, per-user equity time series so the
-- paper-bot equity curve survives restarts (migration 020 has positions/trades
-- but no equity time series). Owner-scoped RLS, same shape as 020.
-- ---------------------------------------------------------------------------
create table if not exists public.paper_equity_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  paper_account_id uuid not null references public.paper_accounts(id) on delete cascade,
  equity numeric not null,
  unrealised_pnl numeric,
  captured_at timestamptz not null default now()
);

create index if not exists idx_paper_equity_snapshots_account_time
  on public.paper_equity_snapshots(paper_account_id, captured_at desc);

alter table public.paper_equity_snapshots enable row level security;

create policy paper_equity_snapshots_owner_sel on public.paper_equity_snapshots
  for select using (auth.uid() = user_id);
create policy paper_equity_snapshots_owner_ins on public.paper_equity_snapshots
  for insert with check (auth.uid() = user_id);
create policy paper_equity_snapshots_owner_del on public.paper_equity_snapshots
  for delete using (auth.uid() = user_id);
