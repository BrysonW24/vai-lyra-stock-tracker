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
          className="inline-flex items-center gap-1 rounded border border-[#263241] bg-[#0d141c] px-1.5 py-1 font-mono text-[10px] text-[#a8b5c2] transition hover:border-[#3a4754] hover:text-[#eef3f8]"
        >
          <ArrowLeft size={12} /> Back
        </button>
        <span className="mx-0.5 h-3.5 w-px bg-[#263241]" />
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#8190a0]">Indicators</span>
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
              'rounded border px-1.5 py-1 font-mono text-[10px] transition',
              indicators[key]
                ? 'border-[#f3a33a] bg-[#23180b] text-[#f3a33a]'
                : 'border-[#263241] bg-[#0d141c] text-[#8190a0] hover:text-[#dbe5ee]',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setIndicators(ALL_ON)}
          className={[
            'rounded border px-1.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] transition',
            allOn ? 'border-[#3b5bdb] bg-[#0d1530] text-[#8aa2ff]' : 'border-[#263241] bg-[#0d141c] text-[#8190a0] hover:text-[#dbe5ee]',
          ].join(' ')}
        >
          Full setup
        </button>
        <span className="mx-0.5 h-3.5 w-px bg-[#263241]" />
        <PineExportButton symbol={symbol} />
      </div>
      <TradingViewChart symbol={symbol} exchange={exchange} companyName={companyName} indicators={indicators} />
    </div>
  );
}
