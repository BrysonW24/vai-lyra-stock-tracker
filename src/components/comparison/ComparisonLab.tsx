'use client';

import { useState, useEffect, useMemo, CSSProperties } from 'react';
import { loadLocalHoldings } from '@/lib/local-portfolio';
import {
  DEMO_COMPARISON_DATA,
  buildComparisonTable,
  extractTimeLabels,
  normaliseSeriesToBaseline,
  normaliseSeriesToScale,
  type ComparisonSeries,
} from '@/lib/comparison';
import { formatNumber, formatPercent, formatSignedPercent } from '@/lib/format';

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
      <section className="terminal-panel overflow-hidden rounded-md">
        <div className="flex items-center justify-between gap-2 border-b border-[#1b2530] px-3 py-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Ticker selector</p>
            <p className="mt-0.5 text-[10px] text-[#a8b5c2]">Search to add - up to 6</p>
          </div>
          <button
            type="button"
            onClick={usePortfolio}
            className="shrink-0 rounded border border-[#f3a33a] bg-[#23180b] px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[#f3a33a] transition hover:bg-[#2a1f0f]"
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
                  className="inline-flex items-center gap-1 rounded border border-[#263241] bg-[#0d1117] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#eef3f8] transition hover:border-[#ff6b6b]/50"
                >
                  {t} <span className="text-[#8190a0]">×</span>
                </button>
              ))}
            </div>
          )}

          <div>
            <input
              value={tickerSearch}
              onChange={(e) => setTickerSearch(e.target.value)}
              placeholder="Add a ticker (e.g. MSFT)"
              className="h-8 w-full rounded border border-[#263241] bg-[#0d141c] px-2 font-mono text-xs text-[#dbe5ee] outline-none placeholder:text-[#5d6b79] focus:border-[#f3a33a]/50"
            />
            {tickerSearch.trim().length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {filteredTickers.length === 0 ? (
                  <span className="font-mono text-[10px] text-[#8190a0]">No match in the comparison set</span>
                ) : (
                  filteredTickers.slice(0, 8).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => addTicker(t)}
                      className="rounded border border-[#1b2530] bg-[#080a0d] px-2 py-0.5 font-mono text-[11px] text-[#8190a0] transition hover:text-[#dbe5ee]"
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
        <section className="terminal-panel rounded-md p-6 text-center">
          <p className="text-sm text-[#8190a0]">Select tickers above to begin comparison</p>
        </section>
      ) : (
        <>
          {/* Metric Mode Switcher */}
          <section className="terminal-panel overflow-hidden rounded-md">
            <div className="border-b border-[#1b2530] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">
                Metric
              </p>
            </div>
            <div className="flex flex-wrap gap-2 px-4 py-3">
              {(['return', 'score', 'rsi', 'macd', 'volume'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setMetricMode(mode)}
                  className={`rounded border px-2.5 py-1.5 font-mono text-[11px] font-semibold whitespace-nowrap transition ${
                    metricMode === mode
                      ? 'border-[#263241] bg-[#0d1117] text-[#f3a33a]'
                      : 'border-[#1b2530] bg-[#080a0d] text-[#8190a0] hover:text-[#dbe5ee]'
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
            <p className="border-t border-[#1b2530] px-4 py-2 text-[10px] leading-relaxed text-[#8190a0]">
              <span className="text-[#a8b5c2]">Score</span> = our 0-100 momentum-recovery read ·{' '}
              <span className="text-[#a8b5c2]">RSI</span> = overbought/oversold gauge ·{' '}
              <span className="text-[#a8b5c2]">MACD hist</span> = momentum turning up ·{' '}
              <span className="text-[#a8b5c2]">Volume</span> = participation vs average. Each one feeds the Score.
            </p>
          </section>

          {/* Multi-Series Chart */}
          <ComparisonChart series={chartSeries} timeLabels={timeLabels} metricLabel={metricLabel} />

          {/* Comparison Table */}
          <ComparisonTable rows={comparisonTable} metricMode={metricMode} />
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
  metricLabel,
}: {
  series: ChartSeries[];
  timeLabels: string[];
  metricLabel: string;
}) {
  const chartWidth = 720;
  const chartHeight = 260;
  const pad = 12;

  // Calculate bounds across all series
  const allValues = series.flatMap((s) => s.values);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  // Generate path for a series
  const pathFor = (values: number[]) => {
    const step = values.length > 1 ? (chartWidth - pad * 2) / (values.length - 1) : 0;
    return values
      .map((value, index) => {
        const x = pad + step * index;
        const y = chartHeight - pad - ((value - min) / range) * (chartHeight - pad * 2);
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');
  };

  // Grid lines
  const gridLines = [0, 1, 2, 3, 4];

  return (
    <section className="terminal-panel overflow-hidden rounded-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1b2530] px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">
            {metricLabel} Comparison
          </p>
          <p className="mt-1 text-xs text-[#a8b5c2]">Overlay of selected tickers over time</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {series.map((item) => (
            <span className="flex items-center gap-1.5 font-mono text-xs text-[#a8b5c2]" key={item.label}>
              <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="relative overflow-hidden" style={{ height: `${chartHeight}px` }}>
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
                stroke="#17202a"
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
        </svg>

        {/* Time labels */}
        <div className="absolute bottom-2 left-3 right-3 flex justify-between font-mono text-[10px] text-[#5d6b79]">
          {timeLabels.map((label, idx) => (
            <span key={idx}>{label}</span>
          ))}
        </div>

        {/* Min/Max bounds */}
        <div className="absolute right-3 top-3 rounded border border-[#263241] bg-[#0d141c]/90 px-2 py-1 font-mono text-[11px] text-[#a8b5c2]">
          {formatNumber(max, 2)} / {formatNumber(min, 2)}
        </div>
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
  metricMode,
}: {
  rows: TableRow[];
  metricMode: MetricMode;
}) {
  // Desktop version
  return (
    <section className="terminal-panel overflow-hidden rounded-md">
      <div className="border-b border-[#1b2530] px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">
          Comparison Table
        </p>
        <p className="mt-1 text-xs text-[#a8b5c2]">Latest metrics and relative strength ranking</p>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-[#0b1016] font-mono uppercase text-[#8190a0]">
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
          <tbody className="divide-y divide-[#1b2530]">
            {rows.map((row) => (
              <tr className="font-mono text-[#dbe5ee] hover:bg-[#101720]" key={row.ticker}>
                <td className="px-3 py-2 font-semibold text-[#eef3f8]">{row.ticker}</td>
                <td className={`px-3 py-2 ${row.latestReturn > 0 ? 'text-[#43d18b]' : 'text-[#ff6b6b]'}`}>
                  {formatSignedPercent(row.latestReturn, 2)}
                </td>
                <td className="px-3 py-2">{row.latestScore}</td>
                <td className="px-3 py-2">{formatNumber(row.latestRsi)}</td>
                <td
                  className={`px-3 py-2 ${row.latestMacd > 0 ? 'text-[#43d18b]' : 'text-[#ff6b6b]'}`}
                >
                  {formatNumber(row.latestMacd, 3)}
                </td>
                <td className="px-3 py-2">{formatNumber(row.latestVolume, 2)}x</td>
                <td className="px-3 py-2 text-[#f3a33a]">{row.returnRank}</td>
                <td className="px-3 py-2 text-[#60a5fa]">{row.scoreRank}</td>
                <td className="px-3 py-2 text-[#43d18b]">{row.relativeStrength}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="divide-y divide-[#1b2530] md:hidden">
        {rows.map((row) => (
          <div className="grid grid-cols-[48px_1fr] gap-3 px-3 py-3" key={row.ticker}>
            <div>
              <p className="font-mono text-lg font-semibold text-[#eef3f8]">{row.ticker}</p>
              <div
                className="mt-1 h-2 w-full rounded"
                style={{ background: row.color, opacity: 0.6 }}
              />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="flex justify-between font-mono text-xs text-[#dbe5ee]">
                <span>Return</span>
                <span
                  className={row.latestReturn > 0 ? 'text-[#43d18b]' : 'text-[#ff6b6b]'}
                >
                  {formatSignedPercent(row.latestReturn, 1)}
                </span>
              </p>
              <p className="flex justify-between font-mono text-xs text-[#dbe5ee]">
                <span>Score</span>
                <span>{row.latestScore}</span>
              </p>
              <p className="flex justify-between font-mono text-xs text-[#a8b5c2]">
                <span>Strength</span>
                <span className="text-[#43d18b]">{row.relativeStrength}%</span>
              </p>
              <p className="flex justify-between font-mono text-xs text-[#8190a0]">
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
