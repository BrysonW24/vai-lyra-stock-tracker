'use client';

import { useEffect, useRef, useState } from 'react';

/** Independently-toggleable studies. BB overlays price; RSI + MACD are sub-panes. */
export interface ChartIndicators {
  bb: boolean;
  rsi: boolean;
  macd: boolean;
}

export const DEFAULT_CHART_INDICATORS: ChartIndicators = { bb: false, rsi: true, macd: true };

// Study ids for the Advanced Chart widget config (the STD; family the widget builder uses).
const STUDY_ID: Record<keyof ChartIndicators, string> = {
  bb: 'STD;Bollinger_Bands',
  rsi: 'STD;RSI',
  macd: 'STD;MACD',
};

interface TradingViewChartProps {
  symbol: string;
  exchange?: string;
  companyName?: string;
  height?: number;
  /**
   * Compact variant for embedding inside an existing panel cell (e.g. the
   * Holdings Momentum board). Drops the large header/footer chrome and the
   * outer panel border, and hides TradingView's own toolbars so our interval
   * pills + indicator toggles drive everything.
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
 * TradingView Advanced Chart, embedded via the official widget script (NOT the
 * raw embed-widget iframe URL, which silently ignores studies + toolbar flags).
 * The script reads a JSON config, so the BB / RSI / MACD studies and the compact
 * toolbar settings actually apply. Re-injected when the symbol, interval or
 * studies change. Live third-party data for visual analysis; the deterministic
 * signal panels remain the source of truth.
 */
function TvWidget({ config, height }: { config: Record<string, unknown>; height: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const configKey = JSON.stringify(config);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    setLoading(true);
    container.innerHTML = '';

    const widget = document.createElement('div');
    widget.className = 'tradingview-widget-container__widget';
    widget.style.height = '100%';
    widget.style.width = '100%';
    container.appendChild(widget);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    // Use a text node rather than innerHTML: innerHTML would not neutralise a "</script>"
    // sequence if a symbol string ever contained one. createTextNode inserts the JSON as
    // inert text, so the config can never break out of the script element.
    script.appendChild(document.createTextNode(configKey));
    script.onload = () => setLoading(false);
    container.appendChild(script);

    // The widget paints into an iframe a moment after the script loads; clear the
    // cover once that iframe appears so a slow embed never reads as "broken".
    const poll = window.setInterval(() => {
      if (container.querySelector('iframe')) {
        setLoading(false);
        window.clearInterval(poll);
      }
    }, 400);
    const stop = window.setTimeout(() => window.clearInterval(poll), 12000);

    return () => {
      window.clearInterval(poll);
      window.clearTimeout(stop);
      container.innerHTML = '';
    };
  }, [configKey]);

  return (
    <div className="relative w-full bg-panel-deep" style={{ height }}>
      <div ref={ref} className="tradingview-widget-container h-full w-full" />
      {loading && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-panel-deep">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-dim">Loading chart...</span>
        </div>
      )}
    </div>
  );
}

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

  const activeStudies = (Object.keys(STUDY_ID) as (keyof ChartIndicators)[]).filter((k) => indicators[k]);
  const studyLabel = activeStudies.length
    ? `candles + ${activeStudies.map((k) => k.toUpperCase()).join(' + ')}`
    : 'candles';

  // RSI + MACD each open a sub-pane below price; grow the frame so they are legible.
  const subPanes = (indicators.rsi ? 1 : 0) + (indicators.macd ? 1 : 0);
  const frameHeight = (height ?? (compact ? 340 : 480)) + subPanes * (compact ? 70 : 96);

  const config: Record<string, unknown> = {
    autosize: false,
    width: '100%',
    height: frameHeight,
    symbol: tvSymbol,
    interval,
    timezone: 'Australia/Sydney',
    theme: 'dark',
    style: '1', // candles
    locale: 'en',
    hide_top_toolbar: compact,
    hide_side_toolbar: compact,
    hide_legend: compact,
    allow_symbol_change: false,
    save_image: false,
    studies: activeStudies.map((k) => STUDY_ID[k]),
    support_host: 'https://www.tradingview.com',
  };

  const intervalButtons = (
    <div className="flex gap-1">
      {INTERVALS.map((iv) => (
        <button
          key={iv.code}
          type="button"
          onClick={() => setInterval(iv.code)}
          className={[
            'rounded-cell border font-mono transition',
            compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
            interval === iv.code
              ? 'border-accent bg-accent-tint/80 text-accent'
              : 'border-line-strong bg-panel text-ink-3 hover:text-ink-title',
          ].join(' ')}
        >
          {iv.label}
        </button>
      ))}
    </div>
  );

  // Compact: lives inside an existing panel cell, so no outer panel chrome.
  if (compact) {
    return (
      <div className="overflow-hidden rounded-cell border border-line bg-panel-deep">
        <div className="flex items-center justify-between gap-2 border-b border-line px-2 py-1.5">
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
            {tvSymbol} · live · {studyLabel}
          </p>
          {intervalButtons}
        </div>
        <TvWidget config={config} height={frameHeight} />
        <p className="border-t border-line px-2 py-1 text-[9px] leading-3 text-ink-dim">
          Live TradingView chart · research only - not financial advice.
        </p>
      </div>
    );
  }

  return (
    <section className="terminal-panel overflow-hidden rounded-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">Price chart</p>
          <p className="mt-1 font-mono text-xs text-ink-2">
            {companyName ? `${companyName} · ` : ''}{tvSymbol} · {studyLabel} · live market data
          </p>
        </div>
        {intervalButtons}
      </div>
      <TvWidget config={config} height={frameHeight} />
      <div className="border-t border-line px-3 py-2">
        <p className="text-[10px] leading-4 text-ink-3">
          Live chart by TradingView for visual analysis. The deterministic signal score, RSI/MACD states and action
          state below are computed by the backend and remain the source of truth. Research only - not financial advice.
        </p>
      </div>
    </section>
  );
}
