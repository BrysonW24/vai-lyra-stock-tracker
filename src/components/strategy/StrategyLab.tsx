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
  type Strategy,
} from '@/lib/strategy';
import { formatNumber, formatPercent, formatSignedNumber, toneClass } from '@/lib/format';
import { StatusBadge } from '@/components/StatusBadge';

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
    return <div className="text-[#8190a0]">Strategy not found</div>;
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
      <section className="terminal-panel rounded-md px-3 py-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-[#60a5fa]" size={18} />
          <div>
            <h1 className="text-base font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Strategy Lab</h1>
            <p className="mt-1 font-mono text-xs text-[#8190a0]">
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
              className={`w-full rounded-md p-3 text-left transition-colors ${
                selectedStrategyId === strat.id ? 'terminal-panel border border-[#60a5fa] bg-[#0d1520]' : 'terminal-panel border border-transparent hover:border-[#1b2530]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#eef3f8]">{strat.name}</p>
                  <p className="mt-1 text-xs text-[#a8b5c2]">{strat.description}</p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 font-mono text-xs">
                <span className="text-[#f3a33a]">{strat.winRate}% win</span>
                <span
                  className={`rounded px-1.5 py-0.5 ${
                    strat.riskLevel === 'low'
                      ? 'bg-[#0d251b] text-[#43d18b]'
                      : strat.riskLevel === 'medium'
                        ? 'bg-[#2a1f0f] text-[#f3a33a]'
                        : 'bg-[#2b1214] text-[#ff6b6b]'
                  }`}
                >
                  {strat.riskLevel}
                </span>
              </div>
            </button>
          ))}
          <div className="rounded-md border border-[#263241] bg-[#0b1016] p-2 text-center text-[10px] text-[#8190a0]">
            7 preset strategies. Backtest stats demo only.
          </div>
        </aside>

        {/* Rules, backtest, and matches */}
        <div className="space-y-3">
          {/* Rule set + threshold tweaks */}
          <section className="terminal-panel rounded-md p-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Rule set</h2>
            <div className="mt-3 space-y-2">
              {selectedStrategy.rules.map((rule, idx) => (
                <div key={idx} className="rounded border border-[#1b2530] bg-[#0b1016] px-2 py-2 font-mono text-xs text-[#a8b5c2]">
                  {describeRule(rule)}
                </div>
              ))}
            </div>

            {/* Threshold tweaker for Momentum Recovery */}
            {selectedStrategyId === 'momentum-recovery' && (
              <div className="mt-4 space-y-2 border-t border-[#1b2530] pt-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[#8190a0]">Quick adjust RSI range</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-[#8190a0]">Min</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={thresholds.rsiMin ?? 30}
                      onChange={(e) => setThresholds((prev) => ({ ...prev, rsiMin: parseInt(e.target.value, 10) || 0 }))}
                      className="mt-1 w-full rounded border border-[#263241] bg-[#080a0d] px-2 py-1 font-mono text-xs text-[#eef3f8] placeholder-[#8190a0] focus:border-[#60a5fa] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#8190a0]">Max</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={thresholds.rsiMax ?? 50}
                      onChange={(e) => setThresholds((prev) => ({ ...prev, rsiMax: parseInt(e.target.value, 10) || 100 }))}
                      className="mt-1 w-full rounded border border-[#263241] bg-[#080a0d] px-2 py-1 font-mono text-xs text-[#eef3f8] placeholder-[#8190a0] focus:border-[#60a5fa] focus:outline-none"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-[#8190a0]">Live re-match: {matches.length} signals</p>
              </div>
            )}
          </section>

          {/* Backtest stats */}
          <section className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
            {([
              ['Win Rate', `${selectedStrategy.backtestStats.winRate}%`, 'text-[#43d18b]', 'Share of backtested trades that ended in profit.'],
              ['Avg Return', `${formatNumber(selectedStrategy.backtestStats.avgReturn, 1)}%`, toneClass(selectedStrategy.backtestStats.avgReturn), 'Average % move per trade across the backtest.'],
              ['Median Return', `${formatNumber(selectedStrategy.backtestStats.medianReturn, 1)}%`, toneClass(selectedStrategy.backtestStats.medianReturn), 'The middle trade outcome - less skewed by outliers.'],
              ['Max Drawdown', `${selectedStrategy.backtestStats.maxDrawdown}%`, 'text-[#ff6b6b]', 'Worst peak-to-trough drop along the way.'],
              ['Best Sector', selectedStrategy.backtestStats.bestSector, 'text-[#60a5fa]', 'Where this strategy worked best historically.'],
              ['Sample Size', selectedStrategy.backtestStats.sampleSize.toString(), 'text-[#a8b5c2]', 'How many trades the stats are based on.'],
            ] as const).map(([label, value, tone, help]) => (
              <div className="terminal-panel rounded-md p-2" key={label}>
                <div className="flex items-center justify-between">
                  <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">{label}</p>
                  <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[#5e6b78]">demo</span>
                </div>
                <p className={`numeric mt-0.5 font-mono text-sm font-semibold md:text-base ${tone}`}>{value}</p>
                <p className="mt-1 text-[10px] leading-snug text-[#8190a0]">{help}</p>
              </div>
            ))}
          </section>

          {/* Current matches table */}
          <section className="terminal-panel overflow-hidden rounded-md">
            <div className="border-b border-[#1b2530] px-3 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Current matches ({matches.length})</h2>
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-[1100px] text-left text-xs">
                <thead className="bg-[#0b1016] font-mono uppercase text-[#8190a0]">
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
                <tbody className="divide-y divide-[#1b2530]">
                  {matches.length > 0 ? (
                    matches.map((signal) => (
                      <tr className="font-mono text-[#dbe5ee] hover:bg-[#101720]" key={signal.symbol}>
                        <td className="px-3 py-2 font-semibold text-[#eef3f8]">
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
                        <td className="px-3 py-2 text-[#60a5fa]">{signal.actionState.replaceAll('_', ' ')}</td>
                      </tr>
                    ))
                  ) : (
                    <tr className="font-mono text-[#8190a0]">
                      <td colSpan={7} className="px-3 py-4 text-center text-sm">
                        No signals match this strategy yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile card view */}
            <div className="divide-y divide-[#1b2530] md:hidden">
              {matches.length > 0 ? (
                matches.map((signal) => (
                  <Link href={`/tickers/${signal.symbol}`} className="block px-3 py-3" key={signal.symbol}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-lg font-semibold">{signal.symbol}</p>
                        <p className="font-mono text-xs text-[#8190a0]">
                          Score {signal.score} | RSI {formatNumber(signal.rsi)}
                        </p>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={signal.status} />
                      </div>
                    </div>
                    <p className="mt-2 font-mono text-xs text-[#a8b5c2]">
                      Hist Δ {formatNumber(signal.histDelta, 2)} | Vol {formatNumber(signal.volumeRatio, 2)}x
                    </p>
                  </Link>
                ))
              ) : (
                <div className="px-3 py-4 text-center font-mono text-xs text-[#8190a0]">No signals match this strategy.</div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Footer note */}
      <div className="rounded-md border border-[#263241] bg-[#0b1016] p-3 text-center font-mono text-xs text-[#8190a0]">
        Backtest stats illustrative. Not financial advice. Use for research only.
      </div>
    </div>
  );
}
