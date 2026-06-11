'use client';

import { Activity, BellRing, BriefcaseBusiness, Radar, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import type { DashboardData } from '@/types/scanner';
import { RotatingFaces } from '@/components/RotatingFaces';
import { useAlertPrefs, ALERT_MODES } from '@/lib/alert-prefs';
import { formatCurrency, formatNumber, formatSignedNumber, formatSignedPercent, relativeTime } from '@/lib/format';

interface MetricStripProps {
  data: DashboardData;
}

interface Face {
  label: string;
  value: string;
  detail: string;
  tone: string;
  detailTone?: string;
}

function FaceBlock({ face, icon: Icon }: { face: Face; icon: LucideIcon }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8190a0] md:text-[10px] md:tracking-[0.15em]">{face.label}</p>
        <Icon className={`${face.tone} shrink-0`} size={13} />
      </div>
      <p className={`numeric mt-1 truncate font-mono text-sm font-semibold md:text-base ${face.tone}`}>{face.value}</p>
      <p className={`numeric mt-0.5 truncate text-[10px] ${face.detailTone ?? 'text-[#8190a0]'}`}>{face.detail}</p>
    </div>
  );
}

/**
 * Command metric strip - six rotating tiles. Each tile is a "3-sided box" that
 * rolls through related reads (e.g. Strong signals -> Near trigger -> Risk states)
 * so one screen carries three screens' worth of state. Rolls are staggered so the
 * grid ripples instead of flipping in unison; hover pauses a tile.
 */
export function MetricStrip({ data }: MetricStripProps) {
  const { activeMode, statusLabel } = useAlertPrefs();
  const modeMeta = ALERT_MODES.find((m) => m.value === activeMode) ?? ALERT_MODES[0];

  const strong = data.signals.filter((s) => s.status === 'strong_setup').length;
  const watchlistCount = data.signals.filter((s) => s.status === 'watchlist_setup').length;
  const invalidations = data.signals.filter((s) => s.status === 'invalidated' || s.status === 'weakening').length;

  const bySignal = [...data.signals].sort((a, b) => b.score - a.score);
  const bestSetup = bySignal[0];
  const runnerUp = bySignal[1];
  const byDelta = [...data.signals].sort((a, b) => a.scoreDelta - b.scoreDelta);
  const highestRisk = byDelta[0];
  const secondRisk = byDelta[1];

  const nearTrigger = [...data.watchlist].sort((a, b) => b.scoreDelta - a.scoreDelta)[0];

  const portfolioValue = data.portfolio.reduce((sum, h) => sum + h.marketValue, 0);
  const portfolioPnl = data.portfolio.reduce((sum, h) => sum + h.unrealisedPnl, 0);
  const portfolioPnlPct = data.portfolio.reduce((sum, h) => sum + h.unrealisedPnlPercent * (h.portfolioWeight / 100), 0);
  const topHolding = [...data.portfolio].sort((a, b) => b.marketValue - a.marketValue)[0];
  const bestPerformer = [...data.portfolio].sort((a, b) => b.unrealisedPnlPercent - a.unrealisedPnlPercent)[0];

  const pnlTone = portfolioPnl >= 0 ? 'text-[#43d18b]' : 'text-[#ff6b6b]';

  const tiles: { key: string; icon: LucideIcon; faces: Face[] }[] = [
    {
      key: 'signals',
      icon: TrendingUp,
      faces: [
        { label: 'Strong signals', value: strong.toString(), detail: `${watchlistCount} watchlist / ${invalidations} risk`, tone: 'text-[#43d18b]' },
        nearTrigger
          ? { label: 'Near trigger', value: nearTrigger.symbol, detail: `score ${nearTrigger.signalScore} ${formatSignedNumber(nearTrigger.scoreDelta, 0)}`, tone: 'text-[#f3a33a]' }
          : { label: 'Near trigger', value: '-', detail: 'No watchlist names close', tone: 'text-[#8190a0]' },
        { label: 'Risk states', value: invalidations.toString(), detail: highestRisk ? `worst ${highestRisk.symbol} ${formatSignedNumber(highestRisk.scoreDelta, 0)}` : 'None flagged', tone: invalidations > 0 ? 'text-[#ff6b6b]' : 'text-[#43d18b]' },
      ],
    },
    {
      key: 'portfolio',
      icon: BriefcaseBusiness,
      faces: [
        { label: 'Portfolio value', value: formatCurrency(portfolioValue), detail: `${formatCurrency(portfolioPnl)} ${formatSignedPercent(portfolioPnlPct)}`, tone: pnlTone, detailTone: pnlTone },
        topHolding
          ? { label: 'Top holding', value: topHolding.symbol, detail: `${formatNumber(topHolding.portfolioWeight, 1)}% of book / ${formatCurrency(topHolding.marketValue)}`, tone: 'text-[#dbe5ee]' }
          : { label: 'Top holding', value: '-', detail: 'No holdings yet', tone: 'text-[#8190a0]' },
        bestPerformer
          ? { label: 'Best performer', value: bestPerformer.symbol, detail: `${formatSignedPercent(bestPerformer.unrealisedPnlPercent)} unrealised`, tone: bestPerformer.unrealisedPnlPercent >= 0 ? 'text-[#43d18b]' : 'text-[#ff6b6b]' }
          : { label: 'Best performer', value: '-', detail: 'No holdings yet', tone: 'text-[#8190a0]' },
      ],
    },
    {
      key: 'best-setup',
      icon: Radar,
      faces: [
        bestSetup
          ? { label: 'Best setup', value: `${bestSetup.symbol} ${bestSetup.score}`, detail: `${bestSetup.actionState.replaceAll('_', ' ')} ${formatSignedNumber(bestSetup.scoreDelta, 0)}`, tone: 'text-[#f3a33a]' }
          : { label: 'Best setup', value: 'N/A', detail: 'No scored signal', tone: 'text-[#8190a0]' },
        bestSetup
          ? { label: 'Setup read', value: `RSI ${formatNumber(bestSetup.rsi, 0)}`, detail: `MACD hist ${formatSignedNumber(bestSetup.macdHistogram, 2)}`, tone: 'text-[#7fb0ff]' }
          : { label: 'Setup read', value: '-', detail: 'No scored signal', tone: 'text-[#8190a0]' },
        runnerUp
          ? { label: 'Runner-up', value: `${runnerUp.symbol} ${runnerUp.score}`, detail: runnerUp.actionState.replaceAll('_', ' '), tone: 'text-[#a8b5c2]' }
          : { label: 'Runner-up', value: '-', detail: 'Only one scored name', tone: 'text-[#8190a0]' },
      ],
    },
    {
      key: 'risk',
      icon: TrendingDown,
      faces: [
        highestRisk
          ? { label: 'Highest risk', value: highestRisk.symbol, detail: `${highestRisk.status.replaceAll('_', ' ')} ${formatSignedNumber(highestRisk.scoreDelta, 0)}`, tone: highestRisk.scoreDelta < 0 ? 'text-[#ff6b6b]' : 'text-[#8190a0]' }
          : { label: 'Highest risk', value: 'N/A', detail: 'No risk state', tone: 'text-[#8190a0]' },
        highestRisk
          ? { label: 'Risk read', value: `RSI ${formatNumber(highestRisk.rsi, 0)}`, detail: `hist Δ ${formatSignedNumber(highestRisk.histDelta, 2)}`, tone: 'text-[#f0758a]' }
          : { label: 'Risk read', value: '-', detail: 'No risk state', tone: 'text-[#8190a0]' },
        secondRisk
          ? { label: 'Also watch', value: secondRisk.symbol, detail: `${secondRisk.status.replaceAll('_', ' ')} ${formatSignedNumber(secondRisk.scoreDelta, 0)}`, tone: 'text-[#a8b5c2]' }
          : { label: 'Also watch', value: '-', detail: 'Nothing else flagged', tone: 'text-[#8190a0]' },
      ],
    },
    {
      key: 'scan',
      icon: Activity,
      faces: [
        { label: 'Last scan', value: relativeTime(data.latestRun.finishedAt), detail: `${formatNumber(data.latestRun.tickersScanned, 0)} tickers / ${data.latestRun.timeframe.toUpperCase()}`, tone: 'text-[#a8b5c2]' },
        { label: 'Cadence', value: data.latestRun.timeframe.toUpperCase(), detail: 'Hourly scans during market hours', tone: 'text-[#7fb0ff]' },
        { label: 'Coverage', value: formatNumber(data.latestRun.tickersScanned, 0), detail: 'US tech momentum universe', tone: 'text-[#dbe5ee]' },
      ],
    },
    {
      key: 'alerts',
      icon: BellRing,
      faces: [
        { label: 'Alerts', value: formatNumber(data.latestRun.alertsSent, 0), detail: `Overlay ${data.latestRun.portfolioOverlaysCreated}/${data.latestRun.watchlistOverlaysCreated}`, tone: 'text-[#60a5fa]' },
        { label: 'Alert mode', value: statusLabel, detail: 'Tap your avatar to change', tone: modeMeta.tone.split(' ').find((c) => c.startsWith('text-')) ?? 'text-[#a8b5c2]' },
        { label: 'Delivery', value: 'Telegram', detail: 'Backend-only bot delivery', tone: 'text-[#a8b5c2]' },
      ],
    },
  ];

  return (
    <section className="grid grid-cols-3 gap-1.5 xl:grid-cols-6">
      {tiles.map((tile, i) => (
        <div className="terminal-panel rounded-md p-2" key={tile.key}>
          <RotatingFaces
            faces={tile.faces.map((face, fi) => (
              <FaceBlock key={fi} face={face} icon={tile.icon} />
            ))}
            intervalMs={5000} offsetMs={i * 120}
          />
        </div>
      ))}
    </section>
  );
}
