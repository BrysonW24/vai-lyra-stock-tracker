'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, TrendingUp } from 'lucide-react';
import type { SignalRow } from '@/types/scanner';
import {
  PRESET_STRATEGIES,
  getStrategyById,
  getStrategyList,
  matchStrategy,
  describeRule,
} from '@/lib/strategy';
import { formatNumber, formatSignedNumber, toneClass } from '@/lib/format';
import { StatusBadge } from '@/components/StatusBadge';
import { pageTitleClass } from '@/lib/ui';

interface StrategyLabProps {
  signals: SignalRow[];
}

interface ThresholdOverride {
  rsiMin?: number;
  rsiMax?: number;
}

export function StrategyLab({ signals }: StrategyLabProps) {
  const [selectedStrategyId, setSelectedStrategyId] = useState(PRESET_STRATEGIES[0].id);
  const [thresholds, setThresholds] = useState<ThresholdOverride>({});

  const selectedStrategy = getStrategyById(selectedStrategyId);
  if (!selectedStrategy) {
    return <div className="text-ink-3">Strategy not found</div>;
  }

  // Apply threshold overrides to rules for live matching
  let activeStrategy = selectedStrategy;
  if ((thresholds.rsiMin !== undefined || thresholds.rsiMax !== undefined) && selectedStrategyId === 'momentum-recovery') {
    const rsiRule = selectedStrategy.rules.find((r) => r.field === 'rsi');
    if (rsiRule && rsiRule.operator === 'between' && Array.isArray(rsiRule.value)) {
      const rsiBounds: number[] = rsiRule.value;
      activeStrategy = {
        ...selectedStrategy,
        rules: selectedStrategy.rules.map((r) =>
          r.field === 'rsi'
            ? {
                ...r,
                value: [thresholds.rsiMin ?? rsiBounds[0], thresholds.rsiMax ?? rsiBounds[1]],
              }
            : r,
        ),
      };
    }
  }

  const matches = matchStrategy(activeStrategy, signals);

  return (
    <div className="space-y-3 pb-20 md:pb-0">
      {/* Header */}
      <section className="terminal-panel rounded-panel px-3 py-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-blue-focus" size={18} />
          <div>
            <h1 className={pageTitleClass}>Strategy Lab</h1>
            <p className="mt-1 font-mono text-xs text-ink-3">
              Define rule-based strategies | {matches.length} current matches | demo backtest stats are illustrative
            </p>
          </div>
        </div>
      </section>

      {/* Main content: left selector, right rules + matches */}
      <div className="grid gap-3 lg:grid-cols-[300px_1fr]">
        {/* Strategy selector */}
        <aside className="space-y-2">
          {getStrategyList().map((strat) => (
            <button
              key={strat.id}
              onClick={() => {
                setSelectedStrategyId(strat.id);
                setThresholds({}); // Reset overrides on strategy change
              }}
              className={`w-full rounded-panel p-3 text-left transition-colors ${
                selectedStrategyId === strat.id ? 'terminal-panel border border-blue-focus bg-panel' : 'terminal-panel border border-transparent hover:border-line'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-ink">{strat.name}</p>
                  <p className="mt-1 text-xs text-ink-2">{strat.description}</p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 font-mono text-xs">
                <span className="text-ink-3">{getStrategyById(strat.id)?.rules.length ?? 0} rules</span>
                <span
                  className={`rounded px-1.5 py-0.5 ${
                    strat.riskLevel === 'low'
                      ? 'bg-positive-tint text-positive'
                      : strat.riskLevel === 'medium'
                        ? 'bg-accent-tint text-accent'
                        : 'bg-negative/10 text-negative'
                  }`}
                >
                  {strat.riskLevel}
                </span>
              </div>
            </button>
          ))}
          <div className="rounded-cell border border-line-strong bg-chrome p-2 text-center text-[10px] text-ink-3">
            {getStrategyList().length} preset strategies. No live backtest yet - stats are illustrative.
          </div>
        </aside>

        {/* Rules, backtest, and matches */}
        <div className="space-y-3">
          {/* Rule set + threshold tweaks */}
          <section className="terminal-panel rounded-panel p-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-title">Rule set</h2>
            <div className="mt-3 space-y-2">
              {selectedStrategy.rules.map((rule, idx) => (
                <div key={idx} className="rounded-cell border border-line bg-chrome px-2 py-2 font-mono text-xs text-ink-2">
                  {describeRule(rule)}
                </div>
              ))}
            </div>

            {/* Threshold tweaker for Momentum Recovery */}
            {selectedStrategyId === 'momentum-recovery' && (
              <div className="mt-4 space-y-2 border-t border-line pt-3">
                <p className="text-xs uppercase tracking-[0.14em] text-ink-3">Quick adjust RSI range</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-ink-3">Min</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={thresholds.rsiMin ?? 30}
                      onChange={(e) => setThresholds((prev) => ({ ...prev, rsiMin: parseInt(e.target.value, 10) || 0 }))}
                      className="mt-1 w-full rounded-cell border border-line-strong bg-well px-2 py-1 font-mono text-xs text-ink placeholder:text-ink-3 focus:border-blue-focus focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-ink-3">Max</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={thresholds.rsiMax ?? 50}
                      onChange={(e) => setThresholds((prev) => ({ ...prev, rsiMax: parseInt(e.target.value, 10) || 100 }))}
                      className="mt-1 w-full rounded-cell border border-line-strong bg-well px-2 py-1 font-mono text-xs text-ink placeholder:text-ink-3 focus:border-blue-focus focus:outline-none"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-ink-3">Live re-match: {matches.length} signals</p>
              </div>
            )}
          </section>

          {/* Backtest stats - no live backtest engine yet, so these are presented as
              an illustrative empty state. The layout and metric definitions stay so
              the slots are ready when real signal_outcomes data lands; the concrete
              numbers are deliberately withheld rather than faked. */}
          <section className="space-y-1.5">
            <div className="rounded-cell border border-dashed border-line-strong bg-chrome px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-title">Backtest stats</p>
                <span className="rounded border border-line-hair px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-ink-3">Illustrative</span>
              </div>
              <p className="mt-1 text-[10px] leading-snug text-ink-3">
                Illustrative - no live backtest yet. These slots fill in once historical signal outcomes are recorded; Lyra never shows a fabricated win rate or trade count.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
              {([
                ['Win Rate', 'Share of backtested trades that ended in profit.'],
                ['Avg Return', 'Average % move per trade across the backtest.'],
                ['Median Return', 'The middle trade outcome - less skewed by outliers.'],
                ['Max Drawdown', 'Worst peak-to-trough drop along the way.'],
                ['Best Sector', 'Where this strategy worked best historically.'],
                ['Sample Size', 'How many trades the stats are based on.'],
              ] as const).map(([label, help]) => (
                <div className="terminal-panel rounded-cell p-2" key={label}>
                  <div className="flex items-center justify-between">
                    <p className="truncate text-[9px] uppercase tracking-[0.12em] text-ink-3">{label}</p>
                    <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-ink-dim">pending</span>
                  </div>
                  <p className="numeric mt-0.5 font-mono text-sm font-semibold text-ink-dim md:text-base">-</p>
                  <p className="mt-1 text-[10px] leading-snug text-ink-3">{help}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Current matches table */}
          <section className="terminal-panel overflow-hidden rounded-panel">
            <div className="border-b border-line px-3 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-title">Current matches ({matches.length})</h2>
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-[1100px] text-left text-xs">
                <thead className="bg-chrome font-mono uppercase text-ink-3">
                  <tr>
                    <th className="px-3 py-2">Ticker</th>
                    <th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2">RSI</th>
                    <th className="px-3 py-2">Hist Δ</th>
                    <th className="px-3 py-2">Vol</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {matches.length > 0 ? (
                    matches.map((signal) => (
                      <tr className="font-mono text-ink-title hover:bg-line/30" key={signal.symbol}>
                        <td className="px-3 py-2 font-semibold text-ink">
                          <Link href={`/tickers/${signal.symbol}`} className="inline-flex items-center gap-1">
                            {signal.symbol} <ArrowUpRight size={11} />
                          </Link>
                        </td>
                        <td className="px-3 py-2">{signal.score} <span className={toneClass(signal.scoreDelta)}>{formatSignedNumber(signal.scoreDelta, 0)}</span></td>
                        <td className="px-3 py-2">{formatNumber(signal.rsi)}</td>
                        <td className="px-3 py-2">{formatNumber(signal.histDelta, 2)}</td>
                        <td className="px-3 py-2">{formatNumber(signal.volumeRatio, 2)}x</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={signal.status} />
                        </td>
                        <td className="px-3 py-2 text-blue-focus">{signal.actionState.replaceAll('_', ' ')}</td>
                      </tr>
                    ))
                  ) : (
                    <tr className="font-mono text-ink-3">
                      <td colSpan={7} className="px-3 py-4 text-center text-sm">
                        No signals match this strategy yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile card view */}
            <div className="divide-y divide-line md:hidden">
              {matches.length > 0 ? (
                matches.map((signal) => (
                  <Link href={`/tickers/${signal.symbol}`} className="block px-3 py-3" key={signal.symbol}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-lg font-semibold">{signal.symbol}</p>
                        <p className="font-mono text-xs text-ink-3">
                          Score {signal.score} | RSI {formatNumber(signal.rsi)}
                        </p>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={signal.status} />
                      </div>
                    </div>
                    <p className="mt-2 font-mono text-xs text-ink-2">
                      Hist Δ {formatNumber(signal.histDelta, 2)} | Vol {formatNumber(signal.volumeRatio, 2)}x
                    </p>
                  </Link>
                ))
              ) : (
                <div className="px-3 py-4 text-center font-mono text-xs text-ink-3">No signals match this strategy.</div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Footer note */}
      <div className="rounded-cell border border-line-strong bg-chrome p-3 text-center font-mono text-xs text-ink-3">
        Backtest stats illustrative. Not financial advice. Use for research only.
      </div>
    </div>
  );
}
