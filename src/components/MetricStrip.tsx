'use client';

import { Activity, BellRing, BriefcaseBusiness, Radar, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { DashboardData } from '@/types/scanner';
import { RotatingFaces } from '@/components/RotatingFaces';
import { useAlertPrefs, ALERT_MODES } from '@/lib/alert-prefs';
import { formatCompactCurrency, formatCurrency, formatNumber, formatSignedNumber, formatSignedPercent, relativeTime } from '@/lib/format';

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

const ORDER_KEY = 'lyra.metricStripOrder.v1';

// Hourly cadence; flag the scan tile amber/red once the last scan failed/skipped or is
// older than ~2x the cadence, so a dead cron never reads as a healthy scan. Local to
// MetricStrip on purpose - format.ts is owned by another process.
const STALE_AFTER_HOURS = 2;

function scanHoursAgo(finishedAt: string): number {
  const finished = new Date(finishedAt).getTime();
  if (!Number.isFinite(finished)) return Infinity;
  return (Date.now() - finished) / 3_600_000;
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
 * Command metric strip - six rotating tiles, each a "3-sided box" rolling through related
 * reads. Labels are single words so nothing overflows into an ellipsis. Long-press a tile
 * to lift it, then drag to reorder; the order persists per device. Failure mode is benign:
 * if a long-press never activates, the tiles just render and rotate as normal.
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

  // Scan health: demo data is always treated as fresh; a live run is stale once it
  // failed/skipped or has aged past the freshness window. Drives the scan tile colour
  // and detail so a dead cron is visible at a glance rather than reading as healthy.
  const runStatus = data.latestRun.status;
  const runFailed = runStatus === 'failed' || runStatus === 'skipped';
  const hoursAgo = scanHoursAgo(data.latestRun.finishedAt);
  const scanStale = data.generatedFrom !== 'demo' && (runFailed || hoursAgo > STALE_AFTER_HOURS);
  const scanTone = scanStale ? (runFailed ? 'text-[#ff6b6b]' : 'text-[#f3a33a]') : 'text-[#a8b5c2]';
  const scanDetail = runFailed
    ? `Scan ${runStatus} · ${formatNumber(data.latestRun.tickersScanned, 0)} tickers`
    : scanStale
      ? `Stale · expected hourly`
      : `${formatNumber(data.latestRun.tickersScanned, 0)} · ${data.latestRun.timeframe.toUpperCase()}`;

  const tiles: { key: string; icon: LucideIcon; faces: Face[] }[] = [
    {
      key: 'signals',
      icon: TrendingUp,
      faces: [
        { label: 'Strong', value: strong.toString(), detail: `${watchlistCount} watch / ${invalidations} risk`, tone: 'text-[#43d18b]' },
        nearTrigger
          ? { label: 'Near', value: nearTrigger.symbol, detail: `score ${nearTrigger.signalScore} ${formatSignedNumber(nearTrigger.scoreDelta, 0)}`, tone: 'text-[#f3a33a]' }
          : { label: 'Near', value: '-', detail: 'None close', tone: 'text-[#8190a0]' },
        { label: 'Risk', value: invalidations.toString(), detail: highestRisk ? `${highestRisk.symbol} ${formatSignedNumber(highestRisk.scoreDelta, 0)}` : 'None', tone: invalidations > 0 ? 'text-[#ff6b6b]' : 'text-[#43d18b]' },
      ],
    },
    {
      key: 'portfolio',
      icon: BriefcaseBusiness,
      faces: [
        { label: 'Portfolio', value: formatCurrency(portfolioValue), detail: `${formatCurrency(portfolioPnl)} ${formatSignedPercent(portfolioPnlPct)}`, tone: pnlTone, detailTone: pnlTone },
        topHolding
          ? { label: 'Largest', value: topHolding.symbol, detail: `${formatNumber(topHolding.portfolioWeight, 1)}% · ${formatCompactCurrency(topHolding.marketValue)}`, tone: 'text-[#dbe5ee]' }
          : { label: 'Largest', value: '-', detail: 'No holdings', tone: 'text-[#8190a0]' },
        bestPerformer
          ? { label: 'Winner', value: bestPerformer.symbol, detail: `${formatSignedPercent(bestPerformer.unrealisedPnlPercent)} P/L`, tone: bestPerformer.unrealisedPnlPercent >= 0 ? 'text-[#43d18b]' : 'text-[#ff6b6b]' }
          : { label: 'Winner', value: '-', detail: 'No holdings', tone: 'text-[#8190a0]' },
      ],
    },
    {
      key: 'best-setup',
      icon: Radar,
      faces: [
        bestSetup
          ? { label: 'Setup', value: `${bestSetup.symbol} ${bestSetup.score}`, detail: `${bestSetup.actionState.replaceAll('_', ' ')} ${formatSignedNumber(bestSetup.scoreDelta, 0)}`, tone: 'text-[#f3a33a]' }
          : { label: 'Setup', value: 'N/A', detail: 'No signal', tone: 'text-[#8190a0]' },
        bestSetup
          ? { label: 'Read', value: `RSI ${formatNumber(bestSetup.rsi, 0)}`, detail: `hist ${formatSignedNumber(bestSetup.macdHistogram, 2)}`, tone: 'text-[#7fb0ff]' }
          : { label: 'Read', value: '-', detail: 'No signal', tone: 'text-[#8190a0]' },
        runnerUp
          ? { label: 'Runner-up', value: `${runnerUp.symbol} ${runnerUp.score}`, detail: runnerUp.actionState.replaceAll('_', ' '), tone: 'text-[#a8b5c2]' }
          : { label: 'Runner-up', value: '-', detail: 'One name', tone: 'text-[#8190a0]' },
      ],
    },
    {
      key: 'risk',
      icon: TrendingDown,
      faces: [
        highestRisk
          ? { label: 'Worst', value: highestRisk.symbol, detail: `${highestRisk.status.replaceAll('_', ' ')} ${formatSignedNumber(highestRisk.scoreDelta, 0)}`, tone: highestRisk.scoreDelta < 0 ? 'text-[#ff6b6b]' : 'text-[#8190a0]' }
          : { label: 'Worst', value: 'N/A', detail: 'No risk', tone: 'text-[#8190a0]' },
        highestRisk
          ? { label: 'Read', value: `RSI ${formatNumber(highestRisk.rsi, 0)}`, detail: `hist Δ ${formatSignedNumber(highestRisk.histDelta, 2)}`, tone: 'text-[#f0758a]' }
          : { label: 'Read', value: '-', detail: 'No risk', tone: 'text-[#8190a0]' },
        secondRisk
          ? { label: 'Watch', value: secondRisk.symbol, detail: `${secondRisk.status.replaceAll('_', ' ')} ${formatSignedNumber(secondRisk.scoreDelta, 0)}`, tone: 'text-[#a8b5c2]' }
          : { label: 'Watch', value: '-', detail: 'Nothing', tone: 'text-[#8190a0]' },
      ],
    },
    {
      key: 'scan',
      icon: Activity,
      faces: [
        { label: scanStale ? (runFailed ? 'Scan failed' : 'Scan stale') : 'Scan', value: relativeTime(data.latestRun.finishedAt), detail: scanDetail, tone: scanTone, detailTone: scanStale ? scanTone : undefined },
        { label: 'Cadence', value: data.latestRun.timeframe.toUpperCase(), detail: 'Hourly · market hrs', tone: 'text-[#7fb0ff]' },
        { label: 'Coverage', value: formatNumber(data.latestRun.tickersScanned, 0), detail: 'US tech universe', tone: 'text-[#dbe5ee]' },
      ],
    },
    {
      key: 'alerts',
      icon: BellRing,
      faces: [
        { label: 'Alerts', value: formatNumber(data.latestRun.alertsSent, 0), detail: `Overlay ${data.latestRun.portfolioOverlaysCreated}/${data.latestRun.watchlistOverlaysCreated}`, tone: 'text-[#60a5fa]' },
        { label: 'Mode', value: statusLabel, detail: 'Tap avatar', tone: modeMeta.tone.split(' ').find((c) => c.startsWith('text-')) ?? 'text-[#a8b5c2]' },
        { label: 'Delivery', value: 'Telegram', detail: 'Backend bot', tone: 'text-[#a8b5c2]' },
      ],
    },
  ];

  const defaultKeys = tiles.map((t) => t.key);
  const tilesByKey = new Map(tiles.map((t) => [t.key, t]));

  const [order, setOrder] = useState<string[]>(defaultKeys);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const pressTimer = useRef<number | null>(null);
  const startPt = useRef<{ x: number; y: number } | null>(null);

  // Load saved order (merge: keep known saved keys, append any new tiles).
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(ORDER_KEY) || 'null');
      if (Array.isArray(saved)) {
        const known = new Set(defaultKeys);
        const merged = saved.filter((k: unknown): k is string => typeof k === 'string' && known.has(k));
        for (const k of defaultKeys) if (!merged.includes(k)) merged.push(k);
        setOrder(merged);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultKeys.join(',')]);

  // While dragging, track the pointer globally, reorder live, and block scroll.
  useEffect(() => {
    if (!dragKey) return;
    const onMove = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const overKey = el?.closest('[data-tile-key]')?.getAttribute('data-tile-key');
      if (!overKey || overKey === dragKey) return;
      setOrder((prev) => {
        const from = prev.indexOf(dragKey);
        const to = prev.indexOf(overKey);
        if (from < 0 || to < 0 || from === to) return prev;
        const next = [...prev];
        next.splice(from, 1);
        next.splice(to, 0, dragKey);
        return next;
      });
    };
    const onUp = () => {
      setDragKey(null);
      setOrder((prev) => {
        try {
          window.localStorage.setItem(ORDER_KEY, JSON.stringify(prev));
        } catch {
          /* ignore */
        }
        return prev;
      });
    };
    const blockScroll = (e: TouchEvent) => e.preventDefault();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    document.addEventListener('touchmove', blockScroll, { passive: false });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.removeEventListener('touchmove', blockScroll);
    };
  }, [dragKey]);

  const clearPress = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };
  const startPress = (e: React.PointerEvent, key: string) => {
    startPt.current = { x: e.clientX, y: e.clientY };
    clearPress();
    pressTimer.current = window.setTimeout(() => setDragKey(key), 300);
  };
  // Cancel the long-press if the finger moves first (that is a scroll, not a hold).
  const maybeCancelPress = (e: React.PointerEvent) => {
    if (dragKey || !pressTimer.current || !startPt.current) return;
    if (Math.abs(e.clientX - startPt.current.x) > 8 || Math.abs(e.clientY - startPt.current.y) > 8) clearPress();
  };

  const ordered = order.map((k) => tilesByKey.get(k)).filter((t): t is (typeof tiles)[number] => Boolean(t));

  return (
    <section className="grid grid-cols-3 gap-1.5 xl:grid-cols-6">
      {ordered.map((tile) => {
        const offsetIndex = defaultKeys.indexOf(tile.key);
        const isDragging = dragKey === tile.key;
        return (
          <div
            key={tile.key}
            data-tile-key={tile.key}
            onPointerDown={(e) => startPress(e, tile.key)}
            onPointerMove={maybeCancelPress}
            onPointerUp={clearPress}
            onPointerCancel={clearPress}
            style={{ touchAction: dragKey ? 'none' : 'auto' }}
            className={`terminal-panel select-none rounded-md p-2 transition ${
              isDragging ? 'z-10 scale-105 opacity-95 shadow-xl ring-1 ring-[#f3a33a]/60' : dragKey ? 'opacity-60' : ''
            }`}
          >
            <RotatingFaces
              faces={tile.faces.map((face, fi) => (
                <FaceBlock key={fi} face={face} icon={tile.icon} />
              ))}
              intervalMs={5000}
              offsetMs={offsetIndex * 120}
            />
          </div>
        );
      })}
    </section>
  );
}
