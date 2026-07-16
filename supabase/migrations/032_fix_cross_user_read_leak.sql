-- 032: fix the cross-user READ leak introduced by 030_rls_scanner_tables.sql.
--
-- 030 blanket-added `for select to anon, authenticated using (true)` to a list of
-- "scanner/research" tables ON THE ASSUMPTION they carry no user_id (worker-owned data).
-- That assumption is WRONG for two of them: paper_trades and trade_day_snapshots are
-- deployed as the USER-KEYED tables from 020_trading_foundations.sql / 010_trade_snapshots.sql
-- (user_id NOT NULL + owner-only RLS), and the live app reads/writes them per user via the
-- RLS-enforced client (src/lib/trading/paper-account-repo.ts). Postgres combines PERMISSIVE
-- policies with OR, so the effective SELECT predicate became:
--     (auth.uid() = user_id)  OR  (true)   =   true
-- i.e. any anon/authenticated caller (the public anon key ships to the browser) could read
-- EVERY user's paper trades, including the thesis_snapshot / signal_snapshot JSON. That breaks
-- the RLS-private doctrine ("never read another user's data"). Blast radius is simulated
-- paper-trading behaviour (no real money, brokers, or PII), but it is still a cross-user leak.
--
-- Root cause is a table-name COLLISION: paper_trades / trade_day_snapshots are each defined in
-- BOTH sql/ (no user_id, worker) and supabase/migrations/ (user_id, per-user), both with
-- `create table if not exists`, so whichever applies first wins - and 020/010 win on order.
--
-- FIX (defensive against that ambiguity): for every table 030 blanketed, key off the REAL
-- schema - if the deployed table actually has a user_id column, drop 030's permissive read and
-- restore owner-only SELECT. Genuine worker tables (no user_id) keep their intended global read.
-- Idempotent and existence-guarded, exactly like 030. This block also belongs at the END of
-- sql/_apply_all_scanner_schema.sql (after 030's block) so fresh installs are safe on any order.

do $$
declare
  t text;
  -- Same universe 030 touched. We only tighten the ones that turn out to be user-keyed.
  scanner_tables text[] := array[
    'stock_tickers','stock_candles','stock_indicators','stock_signal_scores','stock_signals',
    'stock_scanner_runs','market_context_snapshots','signal_outcomes',
    'backtest_runs','backtest_results','backtest_trades','paper_trades','paper_portfolio_snapshots',
    'trade_day_snapshots','news_items','ticker_news_map','hype_scores','sentiment_scores',
    'fundamental_snapshots','valuation_metrics','company_events','market_calendar_events','ipos','event_risks'
  ];
  has_user_id boolean;
begin
  foreach t in array scanner_tables loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = t and column_name = 'user_id'
      ) into has_user_id;

      if has_user_id then
        -- 1. Remove 030's permissive global-read policy (the OR-with-true leak).
        execute format('drop policy if exists %I on public.%I;', t || '_read', t);
        -- 2. Re-assert RLS + owner-only SELECT so the table is readable only by its owner.
        execute format('alter table public.%I enable row level security;', t);
        execute format('drop policy if exists %I on public.%I;', t || '_owner_sel', t);
        execute format(
          'create policy %I on public.%I for select using (auth.uid() = user_id);',
          t || '_owner_sel', t
        );
      end if;
    end if;
  end loop;
end $$;
