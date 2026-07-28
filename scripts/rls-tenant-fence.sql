-- rls-tenant-fence.sql - executable NEGATIVE assertion for the tenant RLS fence.
--
-- The two CVE-class fixes 032_fix_cross_user_read_leak.sql (PERMISSIVE OR-true cross-user
-- SELECT leak) and 047_role_escalation_guard.sql were SQL-only: nothing asserted the negative,
-- so re-introducing an `... using (true)` SELECT policy (the exact 030->032 regression) would
-- pass every gate. This block proves the fence for real: it seeds one row PER USER in the
-- user-keyed tables, then - under user A's JWT as the non-owner `authenticated` role, where RLS
-- actually applies - asserts user A sees ONLY their own row and ZERO of user B's. If any owner-only
-- SELECT policy regresses to permissive, a RAISE EXCEPTION here fails the migrations-from-zero CI
-- job (ON_ERROR_STOP=1). Runs inside the postgres:16 service container migrate-from-zero already
-- spins up, using the request.jwt.claim.sub shim auth.uid() reads - no new infra.
--
-- Fixtures use fixed all-1s / all-2s UUIDs and the throwaway symbol 'RLSA' so they never collide
-- with seeded data. Idempotent (on conflict do nothing) so a re-run is safe.

set client_min_messages = warning;

-- Idempotent: drop any prior fence fixtures so a local re-run is clean (CI runs this once on a
-- throwaway DB; local drills re-run against a persisted scratch DB). Cascades clear child rows.
delete from public.paper_trades where user_id in
  ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222');
delete from public.paper_accounts where user_id in
  ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222');
delete from public.watchlist_items where user_id in
  ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222');
delete from public.portfolio_positions where user_id in
  ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222');

-- --- Seed as the migration superuser (bypasses RLS) --------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'rls-a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'rls-b@example.test')
on conflict (id) do nothing;

insert into public.profiles (id, email, display_name) values
  ('11111111-1111-1111-1111-111111111111', 'rls-a@example.test', 'RLS User A'),
  ('22222222-2222-2222-2222-222222222222', 'rls-b@example.test', 'RLS User B')
on conflict (id) do nothing;

insert into public.stock_tickers (symbol, company_name) values
  ('RLSA', 'RLS Fence Test Ticker')
on conflict (symbol) do nothing;

insert into public.portfolio_positions (user_id, symbol, quantity, average_buy_price) values
  ('11111111-1111-1111-1111-111111111111', 'RLSA', 10, 100),
  ('22222222-2222-2222-2222-222222222222', 'RLSA', 20, 200);

insert into public.watchlist_items (user_id, symbol, target_price) values
  ('11111111-1111-1111-1111-111111111111', 'RLSA', 90),
  ('22222222-2222-2222-2222-222222222222', 'RLSA', 80);

-- paper_trades is the exact table the 032 leak exposed (thesis/signal snapshots). Seed via the
-- required paper_accounts parent so the fence over the CVE-class table is proven too.
insert into public.paper_accounts (id, user_id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'A paper'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'B paper')
on conflict (id) do nothing;

insert into public.paper_trades (user_id, paper_account_id, symbol, quantity, entry_price) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'RLSA', 10, 100),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'RLSA', 20, 200);

-- Supabase grants table DML to `authenticated` by default; vanilla Postgres does not, and without
-- the grant the role would get "permission denied" and mask the row-level test. Grant so this
-- exercises the RLS POLICY (the row filter), which is what 032/047 actually fix.
grant select on public.portfolio_positions, public.watchlist_items, public.paper_trades to authenticated;

-- --- Assert as authenticated user A (RLS applies: non-owner, non-superuser role) ----------------
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
declare
  own_count int;
  other_count int;
begin
  -- auth.uid() must resolve to user A from the JWT shim, or every owner-only policy is a no-op.
  if (select auth.uid()) is distinct from '11111111-1111-1111-1111-111111111111'::uuid then
    raise exception 'RLS test setup broken: auth.uid() resolved to %, expected user A', (select auth.uid());
  end if;

  -- portfolio_positions
  select count(*) into own_count from public.portfolio_positions;
  if own_count <> 1 then
    raise exception 'RLS FENCE BREACH: user A sees % portfolio_positions rows, expected 1 (own only)', own_count;
  end if;
  select count(*) into other_count from public.portfolio_positions
    where user_id = '22222222-2222-2222-2222-222222222222';
  if other_count <> 0 then
    raise exception 'RLS FENCE BREACH: user A read % of user B portfolio_positions rows (must be 0)', other_count;
  end if;

  -- watchlist_items
  select count(*) into own_count from public.watchlist_items;
  if own_count <> 1 then
    raise exception 'RLS FENCE BREACH: user A sees % watchlist_items rows, expected 1 (own only)', own_count;
  end if;
  select count(*) into other_count from public.watchlist_items
    where user_id = '22222222-2222-2222-2222-222222222222';
  if other_count <> 0 then
    raise exception 'RLS FENCE BREACH: user A read % of user B watchlist_items rows (must be 0)', other_count;
  end if;

  -- paper_trades (the 032 CVE-class table)
  select count(*) into own_count from public.paper_trades;
  if own_count <> 1 then
    raise exception 'RLS FENCE BREACH: user A sees % paper_trades rows, expected 1 (own only)', own_count;
  end if;
  select count(*) into other_count from public.paper_trades
    where user_id = '22222222-2222-2222-2222-222222222222';
  if other_count <> 0 then
    raise exception 'RLS FENCE BREACH: user A read % of user B paper_trades rows (must be 0)', other_count;
  end if;

  raise notice 'RLS tenant-fence OK: user A sees only own rows across portfolio_positions, watchlist_items, paper_trades';
end $$;

reset request.jwt.claim.sub;
reset role;
