-- 015_rls_policies.sql
-- Row Level Security. User-private tables: owner-only (auth.uid() = user_id). Global
-- market tables: read-only to anon + authenticated (so public/demo mode keeps working
-- with the anon key, and logged-in users read the same shared data). Backend workers
-- use the SERVICE ROLE key, which bypasses RLS, so they can write everything.
--
-- Idempotent: policies are dropped-if-exists then recreated; table existence is guarded.

-- profiles is keyed on id (= auth.uid()), not user_id — handle explicitly.
alter table public.profiles enable row level security;
drop policy if exists profiles_sel on public.profiles;
create policy profiles_sel on public.profiles for select using (auth.uid() = id);
drop policy if exists profiles_ins on public.profiles;
create policy profiles_ins on public.profiles for insert with check (auth.uid() = id);
drop policy if exists profiles_upd on public.profiles;
create policy profiles_upd on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Owner-only CRUD for every user-private table (keyed on user_id).
do $$
declare
  t text;
  user_tables text[] := array[
    'user_settings','onboarding_progress','operator_profiles',
    'portfolio_positions','portfolio_signal_overlay',
    'watchlist_items','watchlist_signal_overlay',
    'user_alert_preferences','ticker_alert_preferences','alert_mutes',
    'notification_channels','stock_alerts',
    'trade_day_snapshots','trade_journal_entries',
    'simulation_runs','user_strategies','user_education_progress','api_usage_logs'
  ];
begin
  foreach t in array user_tables loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format('alter table public.%I enable row level security;', t);
      execute format('drop policy if exists %I on public.%I;', t || '_owner_sel', t);
      execute format('create policy %I on public.%I for select using (auth.uid() = user_id);', t || '_owner_sel', t);
      execute format('drop policy if exists %I on public.%I;', t || '_owner_ins', t);
      execute format('create policy %I on public.%I for insert with check (auth.uid() = user_id);', t || '_owner_ins', t);
      execute format('drop policy if exists %I on public.%I;', t || '_owner_upd', t);
      execute format('create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);', t || '_owner_upd', t);
      execute format('drop policy if exists %I on public.%I;', t || '_owner_del', t);
      execute format('create policy %I on public.%I for delete using (auth.uid() = user_id);', t || '_owner_del', t);
    end if;
  end loop;
end $$;

-- Read-only access to shared global market data for anon + authenticated.
do $$
declare
  t text;
  global_tables text[] := array[
    'stock_tickers','stock_universes','stock_universe_members',
    'stock_candles','stock_indicators','stock_signal_scores','stock_signals',
    'education_modules','news_items','ticker_news_map',
    'fundamental_snapshots','company_events','stock_scanner_runs','market_context_snapshots'
  ];
begin
  foreach t in array global_tables loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format('alter table public.%I enable row level security;', t);
      execute format('drop policy if exists %I on public.%I;', t || '_read', t);
      execute format('create policy %I on public.%I for select to anon, authenticated using (true);', t || '_read', t);
    end if;
  end loop;
end $$;
