import Link from 'next/link';
import type { DashboardData, SignalRow } from '@/types/scanner';
import { MiniSparkline } from '@/components/ChartPrimitives';
import { TickerLogo } from '@/components/TickerLogo';
import { PortfolioDonut } from '@/components/charts/PortfolioDonut';
import { ChartsTabs } from '@/components/charts/ChartsTabs';
import { buildScoreHistory } from '@/lib/score-history';
import { formatCurrency, formatSignedPercent, toneClass } from '@/lib/format';

function scoreSeries(signal: SignalRow): number[] {
  return buildScoreHistory({
    symbol: signal.symbol,
    score: signal.score,
    rsi: signal.rsi,
    macdHistogram: signal.macdHistogram,
    scoreDelta: signal.scoreDelta,
    rsiDelta: signal.rsiDelta,
    histDelta: signal.histDelta,
    macdState: signal.macdState,
  }).map((p) => p.score);
}

function SparkCard({ signal }: { signal: SignalRow }) {
  const up = signal.scoreDelta >= 0;
  return (
    <Link
      href={`/tickers/${signal.symbol}`}
      className="flex min-w-0 flex-col gap-1 rounded-md border border-[#1b2530] bg-[#0d141c] p-2 transition hover:border-[#3a4754]"
    >
      <div className="flex items-center gap-1.5">
        <TickerLogo symbol={signal.symbol} companyName={signal.companyName} size={14} />
        <span className="truncate font-mono text-[11px] font-semibold text-[#eef3f8]">{signal.symbol}</span>
        <span className={`ml-auto shrink-0 font-mono text-[10px] ${up ? 'text-[#43d18b]' : 'text-[#ff6b6b]'}`}>{signal.score}</span>
      </div>
      <MiniSparkline values={scoreSeries(signal)} color={up ? '#43d18b' : '#ff6b6b'} height={26} />
    </Link>
  );
}

/**
 * Charts hub - a dedicated, RBA-chart-pack-style visual space. The Portfolio tab condenses
 * everything you own + watch (composition donut, sector exposure, momentum sparkline walls);
 * the Economy / Markets / Commodities tabs give the macro backdrop. This component builds
 * the Portfolio tab from real data and hands the rest to ChartsTabs. Research only.
 */
export function ChartsView({ data }: { data: DashboardData }) {
  const sigBySymbol = new Map(data.signals.map((s) => [s.symbol, s]));

  const bookValue = data.portfolio.reduce((sum, h) => sum + h.marketValue, 0);
  const bookPnl = data.portfolio.reduce((sum, h) => sum + h.unrealisedPnl, 0);
  const bookPnlPct = data.portfolio.reduce((sum, h) => sum + h.unrealisedPnlPercent * (h.portfolioWeight / 100), 0);
  const pnlTone = bookPnl >= 0 ? 'text-[#43d18b]' : 'text-[#ff6b6b]';

  const donutSlices = data.portfolio.map((h) => ({ label: h.symbol, value: h.marketValue }));

  const sectorOf = new Map(data.tickers.map((t) => [t.symbol, t.sector]));
  const sectorTotals = new Map<string, number>();
  for (const h of data.portfolio) {
    const sector = sectorOf.get(h.symbol) ?? 'Other';
    sectorTotals.set(sector, (sectorTotals.get(sector) ?? 0) + h.marketValue);
  }
  const sectors = [...sectorTotals.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const sectorTotal = sectors.reduce((sum, s) => sum + s.value, 0) || 1;

  const holdingSignals = data.portfolio.map((h) => sigBySymbol.get(h.symbol)).filter((s): s is SignalRow => Boolean(s));
  const watchSignals = data.watchlist.map((w) => sigBySymbol.get(w.symbol)).filter((s): s is SignalRow => Boolean(s));

  const portfolio = (
    <div className="space-y-3">
      <section className="terminal-panel space-y-3 rounded-md p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Your picture</p>
          <p className="font-mono text-[11px] text-[#8190a0]">
            Book <span className="text-[#eef3f8]">{formatCurrency(bookValue)}</span> ·{' '}
            <span className={pnlTone}>{formatCurrency(bookPnl)} {formatSignedPercent(bookPnlPct)}</span> · {data.portfolio.length} holdings · {data.watchlist.length} watched
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Composition</p>
            <PortfolioDonut slices={donutSlices} />
          </div>
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Sector exposure</p>
            {sectors.length > 0 ? (
              <div className="space-y-1.5">
                {sectors.map((s) => (
                  <div key={s.label}>
                    <div className="flex justify-between font-mono text-[10px]">
                      <span className="truncate text-[#a8b5c2]">{s.label}</span>
                      <span className="text-[#8190a0]">{Math.round((s.value / sectorTotal) * 100)}%</span>
                    </div>
                    <div className="mt-0.5 h-1.5 overflow-hidden rounded-sm bg-[#17202a]">
                      <div className="h-full rounded-sm bg-gradient-to-r from-[#3b5bdb] to-[#43d18b]" style={{ width: `${(s.value / sectorTotal) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[#8190a0]">Add holdings to see your sector mix.</p>
            )}
          </div>
        </div>
      </section>

      {holdingSignals.length > 0 && (
        <section className="terminal-panel rounded-md p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Holdings momentum</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {holdingSignals.map((s) => (
              <SparkCard key={s.symbol} signal={s} />
            ))}
          </div>
        </section>
      )}

      {watchSignals.length > 0 && (
        <section className="terminal-panel rounded-md p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Watchlist momentum</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {watchSignals.map((s) => (
              <SparkCard key={s.symbol} signal={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );

  return <ChartsTabs portfolio={portfolio} />;
}
