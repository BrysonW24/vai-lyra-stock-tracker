'use client';

import { useEffect, useState } from 'react';
import {
  ANIMATION_TIMING,
  prefersReducedMotion,
} from '@/lib/activation/animationTiming';
import {
  ACTIVATION_SCENES,
  SIGNAL_TABLE_ROWS,
  SAMPLE_ALERT,
} from '@/lib/activation/activationSteps';
import { TickerLogo } from '@/components/TickerLogo';
import { IntelligenceTicker } from '@/components/IntelligenceTicker';

interface CommandCentreAnimationProps {
  onComplete?: () => void;
}

// Global market snapshot shown in the console preview (sample values for the primer).
const GLOBAL_MARKETS = [
  { label: 'S&P 500', value: '5,998', pct: 0.42 },
  { label: 'ASX 200', value: '8,214', pct: 0.18 },
  { label: 'Nikkei 225', value: '39,420', pct: -0.31 },
  { label: 'STOXX 50', value: '4,975', pct: 0.22 },
];

const fmtPct = (p: number) => `${p >= 0 ? '+' : ''}${p.toFixed(2)}%`;
const toneClass = (p: number) => (p >= 0 ? 'text-positive' : 'text-negative');

/**
 * Scene 3: Act from the console - a one-screen preview of the real command centre:
 * KPI tiles, a global markets strip (S&P / ASX / Nikkei / Europe), the strongest-signals
 * table, the always-on intelligence carousel, and a Telegram-style alert. Staged reveal.
 */
export function CommandCentreAnimation({
  onComplete,
}: CommandCentreAnimationProps) {
  const reduced = prefersReducedMotion();
  const scene = ACTIVATION_SCENES.actConsole;
  const [panelsVisible, setPanelsVisible] = useState(reduced);
  const [tableVisible, setTableVisible] = useState(reduced);
  const [alertVisible, setAlertVisible] = useState(reduced);

  useEffect(() => {
    if (reduced) return;

    const panelsTimer = setTimeout(() => setPanelsVisible(true), ANIMATION_TIMING.scene3.panelsGlideDelay);
    const tableTimer = setTimeout(() => setTableVisible(true), ANIMATION_TIMING.scene3.tableSlideDelay);
    const alertTimer = setTimeout(() => setAlertVisible(true), ANIMATION_TIMING.scene3.alertSlideDelay);
    const completeTimer = onComplete
      ? setTimeout(onComplete, ANIMATION_TIMING.scene3.totalDuration)
      : undefined;

    return () => {
      clearTimeout(panelsTimer);
      clearTimeout(tableTimer);
      clearTimeout(alertTimer);
      if (completeTimer) clearTimeout(completeTimer);
    };
  }, [onComplete, reduced]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Header */}
      <div className="mb-2.5 text-center">
        <h2 className="mb-0.5 text-xl font-semibold text-ink md:text-2xl">{scene.title}</h2>
        <p className="text-xs text-ink-2 md:text-sm">{scene.description}</p>
      </div>

      {/* KPI tiles - one compact row */}
      <div className="mb-2 grid grid-cols-3 gap-2">
        {[
          { title: 'Signal Radar', value: '8', metric: 'Active setups' },
          { title: 'Portfolio Risk', value: '$94K', metric: 'Exposure' },
          { title: 'Watchlist', value: '3', metric: 'Near target' },
        ].map((panel, i) => (
          <div
            key={panel.title}
            className={`terminal-panel rounded-cell px-2.5 py-2 transition-all duration-500 ${panelsVisible ? 'opacity-100' : 'opacity-0'}`}
            style={{ transform: panelsVisible ? 'translateY(0)' : 'translateY(10px)', transitionDelay: `${i * 70}ms` }}
          >
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-3">{panel.title}</p>
            <p className="mt-0.5 font-mono text-lg font-semibold text-ink">{panel.value}</p>
            <p className="text-[9px] text-ink-3">{panel.metric}</p>
          </div>
        ))}
      </div>

      {/* Global markets strip */}
      <div
        className={`terminal-panel mb-2 grid grid-cols-4 gap-px overflow-hidden rounded-cell bg-line transition-all duration-500 ${panelsVisible ? 'opacity-100' : 'opacity-0'}`}
        style={{ transform: panelsVisible ? 'translateY(0)' : 'translateY(10px)', transitionDelay: '240ms' }}
      >
        {GLOBAL_MARKETS.map((m) => (
          <div key={m.label} className="bg-panel-deep px-2 py-1.5 text-center">
            <p className="font-mono text-[8px] uppercase tracking-[0.1em] text-ink-3">{m.label}</p>
            <p className="mt-0.5 font-mono text-[11px] font-semibold text-ink-title">{m.value}</p>
            <p className={`font-mono text-[9px] ${toneClass(m.pct)}`}>{fmtPct(m.pct)}</p>
          </div>
        ))}
      </div>

      {/* Signal table */}
      <div
        className={`terminal-panel mb-2 overflow-hidden rounded-panel transition-all duration-500 ${tableVisible ? 'opacity-100' : 'opacity-0'}`}
        style={{ transform: tableVisible ? 'translateY(0)' : 'translateY(12px)' }}
      >
        <table className="min-w-full text-left text-xs">
          <thead className="bg-chrome font-mono uppercase text-ink-3">
            <tr>
              <th className="px-3 py-1.5">Strongest signals</th>
              <th className="px-3 py-1.5 text-right">Score</th>
              <th className="px-3 py-1.5 text-right">Δ</th>
              <th className="px-3 py-1.5 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {SIGNAL_TABLE_ROWS.slice(0, 3).map((row, i) => (
              <tr key={row.ticker} style={{ animation: tableVisible ? `tableRowSlide ${200 + i * 90}ms ease-out forwards` : 'none' }}>
                <td className="flex items-center gap-2 px-3 py-1.5 font-semibold text-ink">
                  <TickerLogo symbol={row.ticker} size={15} />
                  {row.ticker}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-ink">{row.score}</td>
                <td className={`px-3 py-1.5 text-right font-mono ${row.delta > 0 ? 'text-positive' : 'text-negative'}`}>
                  {row.delta > 0 ? '+' : ''}{row.delta}
                </td>
                <td className="px-3 py-1.5 text-right text-ink-2">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Always-on intelligence carousel (the real component, non-interactive here) */}
      <div
        className={`pointer-events-none mb-2 transition-all duration-500 ${alertVisible ? 'opacity-100' : 'opacity-0'}`}
        style={{ transform: alertVisible ? 'translateY(0)' : 'translateY(12px)' }}
      >
        <IntelligenceTicker />
      </div>

      {/* Telegram-style alert */}
      <div
        className={`terminal-panel flex items-center gap-2.5 rounded-cell border-l-2 border-positive px-3 py-2 transition-all duration-500 ${alertVisible ? 'opacity-100' : 'opacity-0'}`}
        style={{ transform: alertVisible ? 'translateY(0)' : 'translateY(12px)', transitionDelay: '120ms' }}
      >
        <TickerLogo symbol={SAMPLE_ALERT.ticker} size={18} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-ink">{SAMPLE_ALERT.ticker}</span>
            <span className="font-mono text-[11px] text-positive">Score {SAMPLE_ALERT.score} +{SAMPLE_ALERT.scoreDelta}</span>
          </div>
          <p className="truncate text-[10px] text-ink-2">{SAMPLE_ALERT.rsiStatus} • {SAMPLE_ALERT.macdStatus}</p>
        </div>
        <span className="text-[10px] text-ink-3">now</span>
      </div>

      <style jsx>{`
        @keyframes tableRowSlide {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
