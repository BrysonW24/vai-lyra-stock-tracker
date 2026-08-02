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
        <section className="terminal-panel rounded-panel px-3 py-3">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h1 className={pageTitleClass}>Signal Radar</h1>
              <p className="mt-1 font-mono text-xs text-ink-3">
                {formatNumber(data.signals.length, 0)} symbols | {strong} strong | {weakening} risk | scored on daily bars
              </p>
              {!soloMode && (
                // Audit V1 timeframe disclosure: in full mode the worker stores/alerts on hourly bars
                // while this radar recomputes the score on daily bars, so the two can legitimately differ.
                <p className="mt-0.5 font-mono text-[11px] text-ink-dim">
                  This is a daily view - an intraday alert can show a different score for the same name.
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 font-mono text-xs">
              <span className="rounded border border-positive/50 bg-positive-tint px-2 py-1 text-positive">Strong {strong}</span>
              {soloMode ? (
                <SoloWatchCount />
              ) : (
                <span className="rounded border border-accent-border bg-accent-tint px-2 py-1 text-accent">Watch {data.watchlist.length}</span>
              )}
              <span className="rounded border border-negative/50 bg-negative/10 px-2 py-1 text-negative">Risk {weakening}</span>
            </div>
          </div>
        </section>

        <Suspense fallback={<div className="terminal-panel rounded-panel p-4 text-sm text-ink-3">Loading signal radar...</div>}>
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
