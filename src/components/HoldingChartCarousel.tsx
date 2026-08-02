'use client';

import { useState } from 'react';
import type { ScorePoint } from '@/types/scanner';
import type { Candle } from '@/lib/candle-series';
import { CandleChart } from '@/components/CandleChart';
import { DenseLineChart, MacdHistogramChart } from '@/components/ChartPrimitives';

/**
 * Per-holding chart carousel: a 3-tab deck for deeper analysis. Candles is the default
 * view; RSI and MACD are always available as the other two tabs.
 */
type Tab = 'candles' | 'rsi' | 'macd';

const TABS: { key: Tab; label: string }[] = [
  { key: 'candles', label: 'Candles' },
  { key: 'rsi', label: 'RSI' },
  { key: 'macd', label: 'MACD' },
];

export function HoldingChartCarousel({ candles, points }: { candles: Candle[]; points: ScorePoint[] }) {
  const [tab, setTab] = useState<Tab>('candles');
  const labels = points.map((point) => point.label);

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            aria-pressed={tab === entry.key}
            className={`rounded-cell border px-2.5 py-1 font-mono text-[11px] transition ${
              tab === entry.key
                ? 'border-accent bg-accent-tint/80 text-accent'
                : 'border-line-strong bg-panel text-ink-2 hover:border-line-hair'
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'candles' && <CandleChart candles={candles} height={150} />}

      {tab === 'rsi' && (
        <DenseLineChart
          title="RSI · momentum"
          subtitle="Relative Strength Index. Below 30 is oversold, above 70 overbought; recovering off a low is an early momentum signal."
          labels={labels}
          series={[{ label: 'RSI', values: points.map((point) => point.rsi), color: '#60a5fa' /* = --lyra-blue-focus; chart series paint, SVG attr */ }]}
          height={150}
        />
      )}

      {tab === 'macd' && (
        <MacdHistogramChart
          points={points}
          title="Momentum (MACD)"
          subtitle="Zero-centred - bars below the line are bearish, shrinking toward zero = pressure easing."
          reconstructed
        />
      )}
    </div>
  );
}
