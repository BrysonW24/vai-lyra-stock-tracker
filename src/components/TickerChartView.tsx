'use client';

import { useEffect, useState } from 'react';
import { TradingViewChart, DEFAULT_CHART_INDICATORS, type ChartIndicators } from '@/components/TradingViewChart';

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
  const [indicators, setIndicators] = useState<ChartIndicators>(fullSetup ? ALL_ON : DEFAULT_CHART_INDICATORS);

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
      </div>
      <TradingViewChart symbol={symbol} exchange={exchange} companyName={companyName} indicators={indicators} />
    </div>
  );
}
