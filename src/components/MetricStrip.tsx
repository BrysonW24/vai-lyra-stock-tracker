import { Activity, BellRing, BriefcaseBusiness, Radar, TrendingDown, TrendingUp } from 'lucide-react';
import type { DashboardData } from '@/types/scanner';
import { formatCurrency, formatNumber, formatSignedNumber, formatSignedPercent, relativeTime, toneClass } from '@/lib/format';

interface MetricStripProps {
  data: DashboardData;
}

export function MetricStrip({ data }: MetricStripProps) {
  const strong = data.signals.filter((signal) => signal.status === 'strong_setup').length;
  const watchlist = data.signals.filter((signal) => signal.status === 'watchlist_setup').length;
  const invalidations = data.signals.filter((signal) => signal.status === 'invalidated' || signal.status === 'weakening').length;
  const bestSetup = data.signals[0];
  const highestRisk = [...data.signals].sort((a, b) => a.scoreDelta - b.scoreDelta)[0];
  const portfolioValue = data.portfolio.reduce((sum, holding) => sum + holding.marketValue, 0);
  const portfolioPnl = data.portfolio.reduce((sum, holding) => sum + holding.unrealisedPnl, 0);

  const metrics = [
    {
      label: 'Strong signals',
      value: strong.toString(),
      detail: `${watchlist} watchlist / ${invalidations} risk`,
      icon: TrendingUp,
      tone: 'text-[#43d18b]',
    },
    {
      label: 'Portfolio value',
      value: formatCurrency(portfolioValue),
      detail: `${formatCurrency(portfolioPnl)} ${formatSignedPercent(data.portfolio.reduce((sum, holding) => sum + holding.unrealisedPnlPercent * (holding.portfolioWeight / 100), 0))}`,
      icon: BriefcaseBusiness,
      tone: portfolioPnl >= 0 ? 'text-[#43d18b]' : 'text-[#ff6b6b]',
    },
    {
      label: 'Best setup',
      value: bestSetup ? `${bestSetup.symbol} ${bestSetup.score}` : 'N/A',
      detail: bestSetup ? `${bestSetup.actionState.replaceAll('_', ' ')} ${formatSignedNumber(bestSetup.scoreDelta, 0)}` : 'No scored signal',
      icon: Radar,
      tone: 'text-[#f3a33a]',
    },
    {
      label: 'Highest risk',
      value: highestRisk ? highestRisk.symbol : 'N/A',
      detail: highestRisk ? `${highestRisk.status.replaceAll('_', ' ')} ${formatSignedNumber(highestRisk.scoreDelta, 0)}` : 'No risk state',
      icon: TrendingDown,
      tone: highestRisk && highestRisk.scoreDelta < 0 ? 'text-[#ff6b6b]' : 'text-[#8190a0]',
    },
    {
      label: 'Last scan',
      value: relativeTime(data.latestRun.finishedAt),
      detail: `${formatNumber(data.latestRun.tickersScanned, 0)} tickers / ${data.latestRun.timeframe.toUpperCase()}`,
      icon: Activity,
      tone: 'text-[#a8b5c2]',
    },
    {
      label: 'Alerts',
      value: formatNumber(data.latestRun.alertsSent, 0),
      detail: `Overlay ${data.latestRun.portfolioOverlaysCreated}/${data.latestRun.watchlistOverlaysCreated}`,
      icon: BellRing,
      tone: 'text-[#60a5fa]',
    },
  ];

  return (
    <section className="grid grid-cols-3 gap-1.5 xl:grid-cols-6">
      {metrics.map((metric) => (
        <div className="terminal-panel rounded-md p-2" key={metric.label}>
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8190a0] md:text-[10px] md:tracking-[0.15em]">{metric.label}</p>
            <metric.icon className={`${metric.tone} shrink-0`} size={13} />
          </div>
          <p className={`numeric mt-1 truncate font-mono text-sm font-semibold md:text-base ${metric.tone}`}>{metric.value}</p>
          <p className={`numeric mt-0.5 truncate text-[10px] ${metric.label === 'Portfolio value' ? toneClass(portfolioPnl) : 'text-[#8190a0]'}`}>
            {metric.detail}
          </p>
        </div>
      ))}
    </section>
  );
}
