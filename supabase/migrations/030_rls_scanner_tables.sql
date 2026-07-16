-- 030: close the RLS gap on scanner/research tables created by sql/_apply_all_scanner_schema.sql.
--
-- Those tables are created AFTER the migrations run (sql/README.md orders them last), so the
-- if-exists-guarded loops in 015 never saw them. On Supabase, default grants meant the public
-- anon key could READ AND WRITE signal_outcomes, sentiment/hype scores, backtest results, and
-- friends - and the app reads that data back as deterministic truth (poisonable by anyone with
-- the anon key). None of these tables carries user_id: they are worker-owned research data.
-- Correct posture: RLS on, read-only for anon + authenticated, writes only via the service
-- role key (which bypasses RLS). Idempotent and existence-guarded, exactly like 015, and the
-- same block now also runs at the END of sql/_apply_all_scanner_schema.sql so fresh installs
-- are safe regardless of apply order.

do $$
declare
  t text;
  scanner_tables text[] := array[
    -- sql/001 core (re-asserted idempotently in case sql/ ran after 015)
    'stock_tickers','stock_candles','stock_indicators','stock_signal_scores','stock_signals',
    'stock_scanner_runs',
    -- sql/002 + sql/003
    'market_context_snapshots','signal_outcomes',
    -- sql/004 backtesting + paper engine (single-operator research simulation, no user_id)
    'backtest_runs','backtest_results','backtest_trades','paper_trades','paper_portfolio_snapshots',
    -- sql/005 (no user_id column despite 015 listing it as user-keyed - global read-only is
    -- the correct achievable posture until the column exists)
    'trade_day_snapshots',
    -- sql/007 intelligence
    'news_items','ticker_news_map','hype_scores','sentiment_scores',
    -- sql/008 fundamentals
    'fundamental_snapshots','valuation_metrics',
    -- sql/009 events + IPOs
    'company_events','market_calendar_events','ipos','event_risks'
  ];
begin
  foreach t in array scanner_tables loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format('alter table public.%I enable row level security;', t);
      execute format('drop policy if exists %I on public.%I;', t || '_read', t);
      execute format('create policy %I on public.%I for select to anon, authenticated using (true);', t || '_read', t);
    end if;
  end loop;
end $$;
