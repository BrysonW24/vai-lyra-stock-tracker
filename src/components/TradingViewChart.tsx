'use client';

import { useMemo, useState } from 'react';

interface TradingViewChartProps {
  symbol: string;
  exchange?: string;
  companyName?: string;
  height?: number;
  /**
   * Compact variant for embedding inside an existing panel cell (e.g. the
   * Holdings Momentum board). Drops the large header/footer chrome and the
   * outer panel border so the live candle view fits in a tight slot while
   * keeping the same charting premise (candles + RSI + MACD + range selector).
   */
  compact?: boolean;
  /**
   * Overlay the RSI + MACD momentum studies. Defaults on so momentum is always
   * visible; the board exposes a toggle so the user can switch to clean candles.
   */
  showIndicators?: boolean;
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
  showIndicators = true,
}: TradingViewChartProps) {
  const [interval, setInterval] = useState<string>('D');

  const tvSymbol = `${exchange}:${symbol}`.toUpperCase();
  const frameHeight = height ?? (compact ? 340 : 480);

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
    if (showIndicators) {
      params.set('studies', JSON.stringify(['RSI@tv-basicstudies', 'MACD@tv-basicstudies']));
    }
    return `https://www.tradingview.com/embed-widget/advanced-chart/?${params.toString()}`;
  }, [tvSymbol, interval, showIndicators, compact]);

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

  const frame = (
    <div style={{ height: frameHeight }} className="w-full bg-[#0d1117]">
      <iframe
        key={src}
        src={src}
        title={`${tvSymbol} price chart`}
        loading="lazy"
        className="h-full w-full border-0"
        allow="clipboard-write"
      />
    </div>
  );

  // Compact: lives inside an existing panel cell, so no outer panel chrome.
  if (compact) {
    return (
      <div className="overflow-hidden rounded border border-[#1b2530] bg-[#0d1117]">
        <div className="flex items-center justify-between gap-2 border-b border-[#1b2530] px-2 py-1.5">
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">
            {tvSymbol} · live · {showIndicators ? 'candles + RSI + MACD' : 'candles'}
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
            {companyName ? `${companyName} · ` : ''}{tvSymbol} · candles + RSI + MACD · live market data
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
