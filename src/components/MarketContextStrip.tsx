'use client';

import { useMemo } from 'react';
import type { MarketContextSnapshot } from '@/lib/market-context';
import { formatNumber, formatPercent } from '@/lib/format';

export interface MarketContextStripProps {
  data: MarketContextSnapshot;
}

/**
 * Dense horizontal market context strip.
 * Renders: regime badge, index chips, VIX, 10Y, commodities, BTC, Fear & Greed.
 * Mobile: horizontal scroll.
 */
export function MarketContextStrip({ data }: MarketContextStripProps) {
  const regimeColor = useMemo(() => {
    switch (data.regime) {
      case 'risk_on':
        return 'bg-[#1a3a2a] text-[#43d18b] border-[#43d18b]';
      case 'risk_off':
        return 'bg-[#3a1a1a] text-[#ff6b6b] border-[#ff6b6b]';
      case 'neutral':
      default:
        return 'bg-[#1a2a3a] text-[#60a5fa] border-[#60a5fa]';
    }
  }, [data.regime]);

  const fearGreedColor = useMemo(() => {
    if (!data.fearGreedIndex) return 'text-[#a8b5c2]';
    if (data.fearGreedIndex <= 25) return 'text-[#ff6b6b]';
    if (data.fearGreedIndex < 45) return 'text-[#f3a33a]';
    if (data.fearGreedIndex <= 55) return 'text-[#60a5fa]';
    if (data.fearGreedIndex < 75) return 'text-[#f3a33a]';
    return 'text-[#43d18b]';
  }, [data.fearGreedIndex]);

  const toneClass = (pct: number | null) => {
    if (pct === null) return 'text-[#a8b5c2]';
    if (pct >= 0) return 'text-[#43d18b]';
    return 'text-[#ff6b6b]';
  };

  const formatPct = (val: number | null) => {
    if (val === null) return '-';
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  };

  return (
    <div className="terminal-panel glass-hero rounded-md p-2.5 overflow-hidden">
      <div className="flex items-center gap-3 overflow-x-auto pb-2 md:pb-0">
        {/* Regime badge */}
        <div className={`shrink-0 rounded border ${regimeColor} px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em]`}>
          {data.regime.replace('_', ' ')}
        </div>

        {/* S&P 500 */}
        {data.sp500Price !== null && (
          <div className="shrink-0 flex flex-col items-start gap-0.5 text-xs font-mono">
            <span className="text-[#8190a0] uppercase tracking-[0.14em]">S&P 500</span>
            <div className="flex items-baseline gap-1">
              <span className="text-[#dbe5ee] font-semibold">{formatNumber(data.sp500Price)}</span>
              <span className={toneClass(data.sp500ChangePct)}>{formatPct(data.sp500ChangePct)}</span>
            </div>
          </div>
        )}

        {/* Nasdaq */}
        {data.nasdaqPrice !== null && (
          <div className="shrink-0 flex flex-col items-start gap-0.5 text-xs font-mono">
            <span className="text-[#8190a0] uppercase tracking-[0.14em]">Nasdaq</span>
            <div className="flex items-baseline gap-1">
              <span className="text-[#dbe5ee] font-semibold">{formatNumber(data.nasdaqPrice)}</span>
              <span className={toneClass(data.nasdaqChangePct)}>{formatPct(data.nasdaqChangePct)}</span>
            </div>
          </div>
        )}

        {/* Dow */}
        {data.dowPrice !== null && (
          <div className="shrink-0 flex flex-col items-start gap-0.5 text-xs font-mono">
            <span className="text-[#8190a0] uppercase tracking-[0.14em]">Dow</span>
            <div className="flex items-baseline gap-1">
              <span className="text-[#dbe5ee] font-semibold">{formatNumber(data.dowPrice)}</span>
              <span className={toneClass(data.dowChangePct)}>{formatPct(data.dowChangePct)}</span>
            </div>
          </div>
        )}

        {/* VIX */}
        {data.vixPrice !== null && (
          <div className="shrink-0 flex flex-col items-start gap-0.5 text-xs font-mono">
            <span className="text-[#8190a0] uppercase tracking-[0.14em]">VIX</span>
            <div className="flex items-baseline gap-1">
              <span className="text-[#dbe5ee] font-semibold">{formatNumber(data.vixPrice, 2)}</span>
              <span className={toneClass(data.vixChangePct)}>{formatPct(data.vixChangePct)}</span>
            </div>
          </div>
        )}

        {/* 10Y Yield */}
        {data.yield10y !== null && (
          <div className="shrink-0 flex flex-col items-start gap-0.5 text-xs font-mono">
            <span className="text-[#8190a0] uppercase tracking-[0.14em]">10Y Yield</span>
            <div className="flex items-baseline gap-1">
              <span className="text-[#dbe5ee] font-semibold">{data.yield10y.toFixed(2)}%</span>
              <span className={toneClass(data.yield10yChangePct)}>{formatPct(data.yield10yChangePct)}</span>
            </div>
          </div>
        )}

        {/* Gold */}
        {data.goldPrice !== null && (
          <div className="shrink-0 flex flex-col items-start gap-0.5 text-xs font-mono">
            <span className="text-[#8190a0] uppercase tracking-[0.14em]">Gold</span>
            <div className="flex items-baseline gap-1">
              <span className="text-[#dbe5ee] font-semibold">${formatNumber(data.goldPrice)}</span>
              <span className={toneClass(data.goldChangePct)}>{formatPct(data.goldChangePct)}</span>
            </div>
          </div>
        )}

        {/* Oil */}
        {data.oilPrice !== null && (
          <div className="shrink-0 flex flex-col items-start gap-0.5 text-xs font-mono">
            <span className="text-[#8190a0] uppercase tracking-[0.14em]">Oil</span>
            <div className="flex items-baseline gap-1">
              <span className="text-[#dbe5ee] font-semibold">${formatNumber(data.oilPrice, 2)}</span>
              <span className={toneClass(data.oilChangePct)}>{formatPct(data.oilChangePct)}</span>
            </div>
          </div>
        )}

        {/* BTC */}
        {data.btcPrice !== null && (
          <div className="shrink-0 flex flex-col items-start gap-0.5 text-xs font-mono">
            <span className="text-[#8190a0] uppercase tracking-[0.14em]">BTC</span>
            <div className="flex items-baseline gap-1">
              <span className="text-[#dbe5ee] font-semibold">${formatNumber(data.btcPrice)}</span>
              <span className={toneClass(data.btcChangePct)}>{formatPct(data.btcChangePct)}</span>
            </div>
          </div>
        )}

        {/* Fear & Greed */}
        {data.fearGreedIndex !== null && (
          <div className="shrink-0 flex flex-col items-start gap-0.5 text-xs font-mono">
            <span className="text-[#8190a0] uppercase tracking-[0.14em]">F&G</span>
            <div className="flex items-baseline gap-1">
              <span className={`font-semibold ${fearGreedColor}`}>{data.fearGreedIndex}</span>
              <span className="text-[#8190a0]">{data.fearGreedLabel || '-'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
