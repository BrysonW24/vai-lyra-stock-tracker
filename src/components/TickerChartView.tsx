'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { TradingViewChart, DEFAULT_CHART_INDICATORS, type ChartIndicators } from '@/components/TradingViewChart';
import { PineExportButton } from '@/components/PineExportButton';

const ALL_ON: ChartIndicators = { bb: true, rsi: true, macd: true };
const STORE_KEY = 'lyra.chartIndicators.v2';

/**
 * The ticker detail chart with its own BB / RSI / MACD toggles. When reached via the
 * "Full setup" button (?view=setup), all three studies switch on automatically so the
 * trader lands on the complete read. Otherwise it honours the shared chart preference.
 */
export function TickerChartView({
  symbol,
  exchange,
  companyName,
  fullSetup,
}: {
  symbol: string;
  exchange: string;
  companyName: string;
  fullSetup: boolean;
}) {
  const router = useRouter();
  const [indicators, setIndicators] = useState<ChartIndicators>(fullSetup ? ALL_ON : DEFAULT_CHART_INDICATORS);

  // Return to wherever the user came from (Prime Setups, Radar, the drawer, etc.).
  // Falls back to Command if this was a fresh/direct load with no history to pop.
  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/');
  };

  useEffect(() => {
    if (fullSetup) {
      setIndicators(ALL_ON);
      try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify(ALL_ON));
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      const saved = window.localStorage.getItem(STORE_KEY);
      if (saved) setIndicators({ ...DEFAULT_CHART_INDICATORS, ...(JSON.parse(saved) as Partial<ChartIndicators>) });
    } catch {
      /* ignore */
    }
  }, [fullSetup]);

  const toggle = (key: keyof ChartIndicators) =>
    setIndicators((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });

  const allOn = indicators.bb && indicators.rsi && indicators.macd;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-cell border border-line-strong bg-panel px-1.5 py-1 font-mono text-[10px] text-ink-2 sm:min-h-0 transition hover:border-line-hair hover:text-ink"
        >
          <ArrowLeft size={12} /> Back
        </button>
        <span className="mx-0.5 h-3.5 w-px bg-line-strong" />
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">Indicators</span>
        {([
          ['bb', 'BB'],
          ['rsi', 'RSI'],
          ['macd', 'MACD'],
        ] as [keyof ChartIndicators, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            aria-pressed={indicators[key]}
            className={[
              'min-h-[44px] rounded-cell border px-1.5 py-1 font-mono text-[10px] transition sm:min-h-0',
              indicators[key]
                ? 'border-accent bg-accent-tint/80 text-accent'
                : 'border-line-strong bg-panel text-ink-3 hover:text-ink-title',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setIndicators(ALL_ON)}
          className={[
            'min-h-[44px] rounded-cell border px-1.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] transition sm:min-h-0',
            allOn ? 'border-blue-deep bg-blue-tint text-pending' : 'border-line-strong bg-panel text-ink-3 hover:text-ink-title',
          ].join(' ')}
        >
          Full setup
        </button>
        <span className="mx-0.5 h-3.5 w-px bg-line-strong" />
        <PineExportButton symbol={symbol} />
      </div>
      <TradingViewChart symbol={symbol} exchange={exchange} companyName={companyName} indicators={indicators} />
    </div>
  );
}
