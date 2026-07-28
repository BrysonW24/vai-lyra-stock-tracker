import { Suspense } from 'react';
import { AppShell } from '@/components/AppShell';
import { SignalTable } from '@/components/SignalTable';
import { getDashboardData } from '@/lib/data';
import { formatNumber } from '@/lib/format';
import { pageTitleClass } from '@/lib/ui';
import { SoloWatchCount } from '@/components/radar/SoloWatchCount';

export const metadata = { title: 'Signal Radar' };

export default async function RadarPage() {
  const data = await getDashboardData();
  const soloMode = !(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const strong = data.signals.filter((signal) => signal.status === 'strong_setup').length;
  const weakening = data.signals.filter((signal) => signal.status === 'weakening' || signal.status === 'invalidated' || signal.status === 'overextended').length;

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <section className="terminal-panel rounded-md px-3 py-3">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h1 className={pageTitleClass}>Signal Radar</h1>
              <p className="mt-1 font-mono text-xs text-[#8190a0]">
                {formatNumber(data.signals.length, 0)} symbols | {strong} strong | {weakening} risk | scored on daily bars
              </p>
              {!soloMode && (
                // Audit V1 timeframe disclosure: in full mode the worker stores/alerts on hourly bars
                // while this radar recomputes the score on daily bars, so the two can legitimately differ.
                <p className="mt-0.5 font-mono text-[11px] text-[#68737f]">
                  This is a daily view - an intraday alert can show a different score for the same name.
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 font-mono text-xs">
              <span className="rounded border border-[#1d7f55] bg-[#0d251b] px-2 py-1 text-[#43d18b]">Strong {strong}</span>
              {soloMode ? (
                <SoloWatchCount />
              ) : (
                <span className="rounded border border-[#9a6a1f] bg-[#2a1f0f] px-2 py-1 text-[#f3a33a]">Watch {data.watchlist.length}</span>
              )}
              <span className="rounded border border-[#7f1d1d] bg-[#2b1214] px-2 py-1 text-[#ff6b6b]">Risk {weakening}</span>
            </div>
          </div>
        </section>

        <Suspense fallback={<div className="terminal-panel rounded-md p-4 text-sm text-[#8190a0]">Loading signal radar...</div>}>
          <SignalTable
            signals={data.signals}
            portfolioSymbols={data.portfolio.map((holding) => holding.symbol)}
            watchlistSymbols={data.watchlist.map((item) => item.symbol)}
            soloPersonalize={soloMode}
          />
        </Suspense>
      </div>
    </AppShell>
  );
}
