'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { loadLocalHoldings } from '@/lib/local-portfolio';
import {
  DEMO_COMPARISON_DATA,
  buildComparisonTable,
  extractTimeLabels,
  formatPointDateTime,
  normaliseSeriesToBaseline,
  normaliseSeriesToScale,
} from '@/lib/comparison';
import { formatNumber, formatSignedPercent } from '@/lib/format';

type MetricMode = 'return' | 'score' | 'rsi' | 'macd' | 'volume';

export function ComparisonLab() {
  const [selectedTickers, setSelectedTickers] = useState<string[]>(['NVDA', 'AMD', 'AVGO']);
  const [metricMode, setMetricMode] = useState<MetricMode>('return');

  // Get selected series
  const selectedSeries = useMemo(
    () => DEMO_COMPARISON_DATA.filter((s) => selectedTickers.includes(s.ticker)),
    [selectedTickers],
  );

  // Normalise data based on metric mode
  const normalisedData = useMemo(() => {
    if (selectedSeries.length === 0) return [];

    if (metricMode === 'return') {
      return normaliseSeriesToBaseline(selectedSeries, 'returnPercent');
    } else if (metricMode === 'score') {
      return normaliseSeriesToScale(selectedSeries, 'signalScore');
    } else if (metricMode === 'rsi') {
      return normaliseSeriesToBaseline(selectedSeries, 'rsi');
    } else if (metricMode === 'macd') {
      return normaliseSeriesToBaseline(selectedSeries, 'macdHistogram');
    } else {
      return normaliseSeriesToBaseline(selectedSeries, 'volumeRatio');
    }
  }, [selectedSeries, metricMode]);

  // Build chart series for rendering
  const chartSeries = useMemo(
    () =>
      normalisedData.map((norm) => {
        let values: number[] = [];
        if (metricMode === 'return') {
          values = norm.data.map((p) => p.normalisedReturn);
        } else if (metricMode === 'score') {
          values = norm.data.map((p) => p.normalisedScore);
        } else if (metricMode === 'rsi') {
          values = norm.data.map((p) => p.normalisedRsi);
        } else if (metricMode === 'macd') {
          values = norm.data.map((p) => p.normalisedMacd);
        } else {
          values = norm.data.map((p) => p.normalisedVolume);
        }

        return {
          label: norm.label,
          values,
          color: norm.color,
        };
      }),
    [normalisedData, metricMode],
  );

  // Build comparison table
  const comparisonTable = useMemo(() => buildComparisonTable(selectedSeries), [selectedSeries]);

  // Time labels for chart
  const timeLabels = useMemo(
    () =>
      selectedSeries.length > 0
        ? extractTimeLabels(selectedSeries[0].data, selectedSeries[0].data.length)
        : [],
    [selectedSeries],
  );

  // Real timestamps per point, for the hover scrubber tooltip.
  const timestamps = useMemo(
    () => (selectedSeries.length > 0 ? selectedSeries[0].data.map((p) => p.timestamp) : []),
    [selectedSeries],
  );

  const [tickerSearch, setTickerSearch] = useState('');
  const available = useMemo(() => DEMO_COMPARISON_DATA.map((s) => s.ticker), []);

  // Smart default: if the user has a portfolio, compare the names we have data for.
  useEffect(() => {
    const owned = loadLocalHoldings()
      .map((h) => h.symbol)
      .filter((s) => available.includes(s));
    if (owned.length > 0) setSelectedTickers(owned.slice(0, 6));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addTicker = (ticker: string) => {
    setSelectedTickers((prev) => (prev.includes(ticker) ? prev : [...prev, ticker].slice(-6)));
    setTickerSearch('');
  };
  const removeTicker = (ticker: string) => setSelectedTickers((prev) => prev.filter((t) => t !== ticker));
  const usePortfolio = () => {
    const owned = loadLocalHoldings()
      .map((h) => h.symbol)
      .filter((s) => available.includes(s))
      .slice(0, 6);
    if (owned.length > 0) setSelectedTickers(owned);
  };
  const filteredTickers = available.filter(
    (t) => !selectedTickers.includes(t) && t.toLowerCase().includes(tickerSearch.trim().toLowerCase()),
  );

  const metricLabel = {
    return: 'Return %',
    score: 'Signal Score',
    rsi: 'RSI',
    macd: 'MACD Histogram',
    volume: 'Volume Ratio',
  }[metricMode];

  return (
    <div className="space-y-3 pb-20 md:pb-0">
      {/* Ticker Picker - search to add, with a one-tap "use my portfolio" */}
      <section className="terminal-panel overflow-hidden rounded-panel">
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">Ticker selector</p>
            <p className="mt-0.5 text-[10px] text-ink-2">Search to add - up to 6</p>
          </div>
          <button
            type="button"
            onClick={usePortfolio}
            className="shrink-0 rounded-cell border border-accent-border bg-accent-tint px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-accent transition hover:border-accent"
          >
            Use my portfolio
          </button>
        </div>

        <div className="space-y-2 px-3 py-2.5">
          {selectedTickers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedTickers.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => removeTicker(t)}
                  title="Remove"
                  className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-panel-deep px-2 py-0.5 font-mono text-[11px] font-semibold text-ink transition hover:border-negative/50"
                >
                  {t} <span className="text-ink-3">×</span>
                </button>
              ))}
            </div>
          )}

          <div>
            <input
              value={tickerSearch}
              onChange={(e) => setTickerSearch(e.target.value)}
              placeholder="Add a ticker (e.g. MSFT)"
              className="h-8 w-full rounded border border-line-strong bg-panel px-2 font-mono text-xs text-ink-title outline-none placeholder:text-ink-dim focus:border-blue-focus/50"
            />
            {tickerSearch.trim().length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {filteredTickers.length === 0 ? (
                  <span className="font-mono text-[10px] text-ink-3">No match in the comparison set</span>
                ) : (
                  filteredTickers.slice(0, 8).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => addTicker(t)}
                      className="rounded-full border border-line bg-ground px-2 py-0.5 font-mono text-[11px] text-ink-3 transition hover:text-ink-title"
                    >
                      + {t}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {selectedSeries.length === 0 ? (
        <section className="terminal-panel rounded-panel p-6 text-center">
          <p className="text-sm text-ink-3">Select tickers above to begin comparison</p>
        </section>
      ) : (
        <>
          {/* Metric Mode Switcher */}
          <section className="terminal-panel overflow-hidden rounded-panel">
            <div className="border-b border-line px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                Metric
              </p>
            </div>
            <div className="flex flex-wrap gap-2 px-4 py-3">
              {(['return', 'score', 'rsi', 'macd', 'volume'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setMetricMode(mode)}
                  className={`rounded-cell border px-2.5 py-1.5 font-mono text-[11px] font-semibold whitespace-nowrap transition ${
                    metricMode === mode
                      ? 'border-line-strong bg-panel-deep text-accent'
                      : 'border-line bg-ground text-ink-3 hover:text-ink-title'
                  }`}
                >
                  {mode === 'return'
                    ? 'Return'
                    : mode === 'score'
                      ? 'Score'
                      : mode === 'rsi'
                        ? 'RSI'
                        : mode === 'macd'
                          ? 'MACD'
                          : 'Volume'}
                </button>
              ))}
            </div>
            <p className="border-t border-line px-4 py-2 text-[10px] leading-relaxed text-ink-3">
              <span className="text-ink-2">Score</span> = our 0-100 momentum-recovery read ·{' '}
              <span className="text-ink-2">RSI</span> = overbought/oversold gauge ·{' '}
              <span className="text-ink-2">MACD hist</span> = momentum turning up ·{' '}
              <span className="text-ink-2">Volume</span> = participation vs average. Each one feeds the Score.
            </p>
          </section>

          {/* Multi-Series Chart */}
          <ComparisonChart series={chartSeries} timeLabels={timeLabels} timestamps={timestamps} metricLabel={metricLabel} />

          {/* Comparison Table */}
          <ComparisonTable rows={comparisonTable} />
        </>
      )}
    </div>
  );
}

/**
 * Multi-series line chart with custom SVG rendering
 */
interface ChartSeries {
  label: string;
  values: number[];
  color: string;
}

function ComparisonChart({
  series,
  timeLabels,
  timestamps,
  metricLabel,
}: {
  series: ChartSeries[];
  timeLabels: string[];
  timestamps: string[];
  metricLabel: string;
}) {
  const chartWidth = 720;
  const chartHeight = 260;
  const pad = 12;

  const plotRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const pointCount = series[0]?.values.length ?? 0;

  // Calculate bounds across all series
  const allValues = series.flatMap((s) => s.values);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  const step = pointCount > 1 ? (chartWidth - pad * 2) / (pointCount - 1) : 0;
  const xAt = (index: number) => pad + step * index;
  const yAt = (value: number) => chartHeight - pad - ((value - min) / range) * (chartHeight - pad * 2);

  // Map a pointer position to the nearest data index (account for the plot padding).
  const handlePointer = (clientX: number) => {
    const el = plotRef.current;
    if (!el || pointCount === 0) return;
    const rect = el.getBoundingClientRect();
    const padFrac = pad / chartWidth;
    const f = (clientX - rect.left) / rect.width;
    const dataF = (f - padFrac) / (1 - padFrac * 2);
    const idx = Math.round(Math.min(1, Math.max(0, dataF)) * (pointCount - 1));
    setHover(idx);
  };

  // Generate path for a series
  const pathFor = (values: number[]) =>
    values.map((value, index) => `${index === 0 ? 'M' : 'L'} ${xAt(index).toFixed(2)} ${yAt(value).toFixed(2)}`).join(' ');

  // Grid lines
  const gridLines = [0, 1, 2, 3, 4];

  const hoverTs = hover !== null ? timestamps[hover] : undefined;
  const hoverLeftPct = hover !== null ? (xAt(hover) / chartWidth) * 100 : 0;

  return (
    <section className="terminal-panel overflow-hidden rounded-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            {metricLabel} Comparison
          </p>
          <p className="mt-1 text-xs text-ink-2">Overlay of selected tickers over time</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {series.map((item) => (
            <span className="flex items-center gap-1.5 font-mono text-xs text-ink-2" key={item.label}>
              <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div
        ref={plotRef}
        className="relative cursor-crosshair overflow-hidden"
        style={{ height: `${chartHeight}px`, touchAction: 'pan-y' }}
        onPointerMove={(e) => handlePointer(e.clientX)}
        onPointerDown={(e) => handlePointer(e.clientX)}
        onPointerLeave={() => setHover(null)}
        onPointerUp={() => setHover(null)}
        onPointerCancel={() => setHover(null)}
      >
        {/* SVG paint attributes below stay literal hexes, byte-equal to the token table
            (grid = line #1b2530, hover guide = ink-dim #5e6b78) - var() does not resolve
            in fill=/stroke= attributes; see lyra-ux/notes/2026-08-02-p0.md. Series colours
            come from lib/comparison series data, not this file. */}
        <svg
          className="h-full w-full"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={metricLabel}
        >
          {/* Grid lines */}
          {gridLines.map((line) => {
            const y = pad + ((chartHeight - pad * 2) / (gridLines.length - 1)) * line;
            return (
              <line
                key={line}
                x1="0"
                x2={chartWidth}
                y1={y}
                y2={y}
                stroke="#1b2530"
                strokeWidth="1"
              />
            );
          })}

          {/* Series paths */}
          {series.map((item) => (
            <path
              key={item.label}
              d={pathFor(item.values)}
              fill="none"
              stroke={item.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Hover guide line */}
          {hover !== null && (
            <line
              x1={xAt(hover)}
              x2={xAt(hover)}
              y1={pad}
              y2={chartHeight - pad}
              stroke="#5e6b78"
              strokeWidth="1"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* Hover dots (HTML so they stay circular under the non-uniform svg scale) */}
        {hover !== null &&
          series.map((item) => (
            <div
              key={item.label}
              className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-chrome"
              style={{ left: `${hoverLeftPct}%`, top: `${(yAt(item.values[hover]) / chartHeight) * 100}%`, background: item.color }}
            />
          ))}

        {/* Time labels */}
        <div className="absolute bottom-2 left-3 right-3 flex justify-between font-mono text-[10px] text-ink-dim">
          {timeLabels.map((label, idx) => (
            <span key={idx}>{label}</span>
          ))}
        </div>

        {/* Scrubber readout while hovering, else the static min/max bounds */}
        {hover !== null && hoverTs ? (
          <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-cell border border-line-strong bg-panel/95 px-2 py-1.5 font-mono shadow-lg">
            <p className="text-[10px] font-semibold text-ink-title">{formatPointDateTime(hoverTs)}</p>
            <div className="mt-1 space-y-0.5">
              {series.map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-[10px]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: item.color }} />
                  <span className="text-ink-3">{item.label}</span>
                  <span className="ml-auto text-ink">{formatNumber(item.values[hover], 2)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="absolute right-3 top-3 rounded-cell border border-line-strong bg-panel/90 px-2 py-1 font-mono text-[11px] text-ink-2">
            {formatNumber(max, 2)} / {formatNumber(min, 2)}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Comparison table: latest values + ranking
 */
interface TableRow {
  ticker: string;
  label: string;
  color: string;
  latestReturn: number;
  latestScore: number;
  latestRsi: number;
  latestMacd: number;
  latestVolume: number;
  returnRank: number;
  scoreRank: number;
  relativeStrength: number;
}

function ComparisonTable({
  rows,
}: {
  rows: TableRow[];
}) {
  // Desktop version
  return (
    <section className="terminal-panel overflow-hidden rounded-panel">
      <div className="border-b border-line px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
          Comparison Table
        </p>
        <p className="mt-1 text-xs text-ink-2">Latest metrics and relative strength ranking</p>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-chrome font-mono uppercase text-ink-3">
            <tr>
              <th className="px-3 py-2">Ticker</th>
              <th className="px-3 py-2">Return %</th>
              <th className="px-3 py-2">Score</th>
              <th className="px-3 py-2">RSI</th>
              <th className="px-3 py-2">MACD Hist</th>
              <th className="px-3 py-2">Vol Ratio</th>
              <th className="px-3 py-2">Return Rank</th>
              <th className="px-3 py-2">Score Rank</th>
              <th className="px-3 py-2">Strength %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr className="font-mono text-ink-title hover:bg-line/30" key={row.ticker}>
                <td className="px-3 py-2 font-semibold text-ink">{row.ticker}</td>
                <td className={`px-3 py-2 ${row.latestReturn > 0 ? 'text-positive' : 'text-negative'}`}>
                  {formatSignedPercent(row.latestReturn, 2)}
                </td>
                <td className="px-3 py-2">{row.latestScore}</td>
                <td className="px-3 py-2">{formatNumber(row.latestRsi)}</td>
                <td
                  className={`px-3 py-2 ${row.latestMacd > 0 ? 'text-positive' : 'text-negative'}`}
                >
                  {formatNumber(row.latestMacd, 3)}
                </td>
                <td className="px-3 py-2">{formatNumber(row.latestVolume, 2)}x</td>
                <td className="px-3 py-2 text-accent">{row.returnRank}</td>
                <td className="px-3 py-2 text-blue-focus">{row.scoreRank}</td>
                <td className="px-3 py-2 text-positive">{row.relativeStrength}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="divide-y divide-line md:hidden">
        {rows.map((row) => (
          <div className="grid grid-cols-[48px_1fr] gap-3 px-3 py-3" key={row.ticker}>
            <div>
              <p className="font-mono text-lg font-semibold text-ink">{row.ticker}</p>
              <div
                className="mt-1 h-2 w-full rounded"
                style={{ background: row.color, opacity: 0.6 }}
              />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="flex justify-between font-mono text-xs text-ink-title">
                <span>Return</span>
                <span
                  className={row.latestReturn > 0 ? 'text-positive' : 'text-negative'}
                >
                  {formatSignedPercent(row.latestReturn, 1)}
                </span>
              </p>
              <p className="flex justify-between font-mono text-xs text-ink-title">
                <span>Score</span>
                <span>{row.latestScore}</span>
              </p>
              <p className="flex justify-between font-mono text-xs text-ink-2">
                <span>Strength</span>
                <span className="text-positive">{row.relativeStrength}%</span>
              </p>
              <p className="flex justify-between font-mono text-xs text-ink-3">
                <span>RSI / Hist</span>
                <span>
                  {formatNumber(row.latestRsi)} / {formatNumber(row.latestMacd, 2)}
                </span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
