import { KeyRound, SlidersHorizontal } from 'lucide-react';
import { pageTitleClass } from '@/lib/ui';
import type { DashboardData } from '@/types/scanner';
import { TickerLogo } from '@/components/TickerLogo';

interface SettingsPanelProps {
  data: DashboardData;
}

export function SettingsPanel({ data }: SettingsPanelProps) {
  const rules = [
    ['Strong setup threshold', data.thresholds.alert],
    ['Watchlist threshold', data.thresholds.watchlist],
    ['Signal change threshold', data.thresholds.signalChange],
    ['Default timeframe', data.latestRun.timeframe.toUpperCase()],
    ['RSI period', 14],
    ['MACD', '12 / 26 / 9'],
    ['SMA stack', '20 / 50 / 200'],
    ['Volume minimum', '0.8x'],
  ];

  return (
    <section className="grid gap-3 lg:grid-cols-[1fr_360px]">
      <div className="terminal-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <h1 className={pageTitleClass}>Ticker universe</h1>
          <SlidersHorizontal size={16} className="text-ink-3" />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-chrome font-mono uppercase text-ink-3">
              <tr>
                <th className="px-3 py-2">Ticker</th>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Sector</th>
                <th className="px-3 py-2">Industry</th>
                <th className="px-3 py-2">Exchange</th>
                <th className="px-3 py-2">Scan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.tickers.map((ticker) => (
                <tr className="font-mono text-ink-title hover:bg-panel" key={ticker.symbol}>
                  <td className="px-3 py-2 font-semibold text-ink">
                    <span className="inline-flex items-center gap-1.5">
                      <TickerLogo symbol={ticker.symbol} companyName={ticker.companyName} size={16} />
                      {ticker.symbol}
                    </span>
                  </td>
                  <td className="px-3 py-2">{ticker.companyName}</td>
                  <td className="px-3 py-2">{ticker.sector}</td>
                  <td className="px-3 py-2">{ticker.industry}</td>
                  <td className="px-3 py-2">{ticker.exchange}</td>
                  <td className={`px-3 py-2 ${ticker.isActive ? 'text-positive' : 'text-ink-3'}`}>{ticker.isActive ? 'enabled' : 'paused'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="space-y-3">
        <div className="terminal-panel p-3">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-accent" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-title">Backend truth</h2>
          </div>
          <p className="mt-3 text-xs leading-5 text-ink-3">
            RSI, MACD, scores, action states, portfolio risk, watchlist triggers, and alerts are produced by the worker and stored in Supabase.
          </p>
        </div>

        <div className="terminal-panel overflow-hidden">
          <div className="border-b border-line px-3 py-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-title">Strategy rules</h2>
          </div>
          <div className="divide-y divide-line">
            {rules.map(([label, value]) => (
              <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs" key={label}>
                <span className="text-ink-3">{label}</span>
                <span className="font-mono text-ink">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </section>
  );
}
