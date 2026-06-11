'use client';

import { useEffect, useMemo, useState } from 'react';

/** Independently-toggleable studies. BB overlays price; RSI + MACD are sub-panes. */
export interface ChartIndicators {
  bb: boolean;
  rsi: boolean;
  macd: boolean;
}

export const DEFAULT_CHART_INDICATORS: ChartIndicators = { bb: false, rsi: true, macd: true };

const STUDY_ID: Record<keyof ChartIndicators, string> = {
  bb: 'BB@tv-basicstudies',
  rsi: 'RSI@tv-basicstudies',
  macd: 'MACD@tv-basicstudies',
};

interface TradingViewChartProps {
  symbol: string;
  exchange?: string;
  companyName?: string;
  height?: number;
  /**
   * Compact variant for embedding inside an existing panel cell (e.g. the
   * Holdings Momentum board). Drops the large header/footer chrome and the
   * outer panel border so the live candle view fits in a tight slot while
   * keeping the same charting premise (candles + indicators + range selector).
   */
  compact?: boolean;
  /**
   * Which studies to overlay - Bollinger Bands, RSI, MACD - each toggled
   * independently by the board. Defaults to RSI + MACD on, Bollinger off.
   */
  indicators?: ChartIndicators;
}

type Interval = { code: string; label: string };

const INTERVALS: Interval[] = [
  { code: '60', label: '1H' },
  { code: 'D', label: '1D' },
  { code: 'W', label: '1W' },
  { code: 'M', label: '1M' },
];

/**
 * Dark-mode TradingView advanced-chart embed for a single stock - the same
 * "charting premise" as the gekkos economic-charts page (candles, crosshair,
 * range selectors, drawing tools), themed dark to match the console.
 *
 * Note: this is live third-party market data for visual analysis. The app's own
 * deterministic signal panels remain the source of truth below this chart.
 */
export function TradingViewChart({
  symbol,
  exchange = 'NASDAQ',
  companyName,
  height,
  compact = false,
  indicators = DEFAULT_CHART_INDICATORS,
}: TradingViewChartProps) {
  const [interval, setInterval] = useState<string>('D');

  const tvSymbol = `${exchange}:${symbol}`.toUpperCase();
  // RSI and MACD each open a sub-pane below the price; give the frame real room for
  // them so a multi-study chart is legible instead of squeezed (BB overlays price).
  const subPanes = (indicators.rsi ? 1 : 0) + (indicators.macd ? 1 : 0);
  const frameHeight = (height ?? (compact ? 340 : 480)) + subPanes * (compact ? 70 : 96);

  const activeStudies = (Object.keys(STUDY_ID) as (keyof ChartIndicators)[]).filter((k) => indicators[k]);
  const studyLabel = activeStudies.length
    ? `candles + ${activeStudies.map((k) => k.toUpperCase()).join(' + ')}`
    : 'candles';

  const src = useMemo(() => {
    const params = new URLSearchParams({
      symbol: tvSymbol,
      interval,
      theme: 'dark',
      style: '1', // candles
      timezone: 'Australia/Sydney',
      // Compact (mobile / showcase) hides the side drawing toolbar + date ranges so the
      // chart fits a narrow viewport instead of overflowing.
      withdateranges: compact ? 'false' : 'true',
      hide_side_toolbar: compact ? 'true' : 'false',
      // Compact also drops the heavy top toolbar (drawing tools / Fib / brush nobody uses
      // here) so the chart breathes - our own interval pills cover navigation.
      hide_top_toolbar: compact ? 'true' : 'false',
      hide_legend: compact ? 'true' : 'false',
      allow_symbol_change: 'false',
      save_image: 'false',
      show_popup_button: 'true',
      popup_width: '1000',
      popup_height: '650',
      locale: 'en',
    });
    const studies = activeStudies.map((k) => STUDY_ID[k]);
    if (studies.length) {
      params.set('studies', JSON.stringify(studies));
    }
    return `https://www.tradingview.com/embed-widget/advanced-chart/?${params.toString()}`;
  }, [tvSymbol, interval, indicators.bb, indicators.rsi, indicators.macd, compact, activeStudies]);

  const intervalButtons = (
    <div className="flex gap-1">
      {INTERVALS.map((iv) => (
        <button
          key={iv.code}
          type="button"
          onClick={() => setInterval(iv.code)}
          className={[
            'rounded border font-mono transition',
            compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
            interval === iv.code
              ? 'border-[#f3a33a] bg-[#23180b] text-[#f3a33a]'
              : 'border-[#263241] bg-[#0d141c] text-[#8190a0] hover:text-[#dbe5ee]',
          ].join(' ')}
        >
          {iv.label}
        </button>
      ))}
    </div>
  );

  // TradingView studies can only change by reloading the embed, so the iframe
  // remounts on every toggle (its src changes). Cover the reload with a loading
  // state so a momentarily-blank chart never reads as "broken".
  const [loaded, setLoaded] = useState(false);
  useEffect(() => setLoaded(false), [src]);

  const frame = (
    <div style={{ height: frameHeight }} className="relative w-full bg-[#0d1117]">
      <iframe
        key={src}
        src={src}
        title={`${tvSymbol} price chart`}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className="h-full w-full border-0"
        allow="clipboard-write"
      />
      {!loaded && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[#0d1117]">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#5f6b78]">Loading {studyLabel}...</span>
        </div>
      )}
    </div>
  );

  // Compact: lives inside an existing panel cell, so no outer panel chrome.
  if (compact) {
    return (
      <div className="overflow-hidden rounded border border-[#1b2530] bg-[#0d1117]">
        <div className="flex items-center justify-between gap-2 border-b border-[#1b2530] px-2 py-1.5">
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">
            {tvSymbol} · live · {studyLabel}
          </p>
          {intervalButtons}
        </div>
        {frame}
        <p className="border-t border-[#1b2530] px-2 py-1 text-[9px] leading-3 text-[#5f6b78]">
          Live TradingView chart · research only - not financial advice.
        </p>
      </div>
    );
  }

  return (
    <section className="terminal-panel overflow-hidden rounded-md">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1b2530] px-3 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Price chart</p>
          <p className="mt-1 font-mono text-xs text-[#a8b5c2]">
            {companyName ? `${companyName} · ` : ''}{tvSymbol} · {studyLabel} · live market data
          </p>
        </div>
        {intervalButtons}
      </div>
      {frame}
      <div className="border-t border-[#1b2530] px-3 py-2">
        <p className="text-[10px] leading-4 text-[#8190a0]">
          Live chart by TradingView for visual analysis. The deterministic signal score, RSI/MACD states and action
          state below are computed by the backend and remain the source of truth. Research only - not financial advice.
        </p>
      </div>
    </section>
  );
}
