'use client';

import { useState, useEffect, useMemo } from 'react';
import type { DashboardData, SignalRow } from '@/types/scanner';
import { loadLocalHoldings } from '@/lib/local-portfolio';
import { formatNumber, formatSignedPercent, formatSignedNumber, statusLabel } from '@/lib/format';

/**
 * Comparison Lab - side-by-side read of REAL scanned signals. Rebuilt in the 2026-08-11
 * honesty audit: the previous version drew a 30-hour multi-series "history" for ten
 * hardcoded tickers from a Math.random walk (regenerated every server restart), complete
 * with a hover scrubber over fabricated timestamps. All of it is gone. This version
 * compares the CURRENT scan values the engine actually computed for the names it scans -
 * no time series is drawn because no per-ticker intraday history is recorded yet.
 */

type MetricKey = 'score' | 'return1d' | 'rsi' | 'macd' | 'volume' | 'lowDistance';

interface MetricDef {
  key: MetricKey;
  label: string;
  /** true = value can be negative and diverges from a zero baseline. */
  signed: boolean;
  read: (s: SignalRow) => number;
  fmt: (v: number) => string;
  explain: string;
}

const METRICS: MetricDef[] = [
  { key: 'score', label: 'Score', signed: false, read: (s) => s.score, fmt: (v) => `${Math.round(v)}`, explain: 'the 0-100 oversold-recovery read - higher means more of the five factors are in band' },
  { key: 'return1d', label: '1D return', signed: true, read: (s) => s.priceChange1d, fmt: (v) => formatSignedPercent(v), explain: 'price change over the last day - green right, red left' },
  { key: 'rsi', label: 'RSI', signed: false, read: (s) => s.rsi, fmt: (v) => formatNumber(v, 1), explain: 'the strategy wants the 35-50 reset band, not the extremes' },
  { key: 'macd', label: 'MACD hist', signed: true, read: (s) => s.macdHistogram, fmt: (v) => formatSignedNumber(v, 2), explain: 'negative-but-rising is the early-turn shape this strategy hunts' },
  { key: 'volume', label: 'Volume', signed: false, read: (s) => s.volumeRatio, fmt: (v) => `${formatNumber(v, 2)}x`, explain: 'participation vs the 20-period average - 0.8x+ confirms a move' },
  { key: 'lowDistance', label: '60d-low dist', signed: false, read: (s) => s.distanceFromLow, fmt: (v) => `${formatNumber(v, 1)}%`, explain: 'how far price sits above its 60-day low - within ~10% is the reset zone' },
];

export function ComparisonLab({ data }: { data: DashboardData }) {
  const scanned = data.signals;
  const bySymbol = useMemo(() => new Map(scanned.map((s) => [s.symbol, s])), [scanned]);

  const defaults = useMemo(() => scanned.slice(0, 3).map((s) => s.symbol), [scanned]);
  const [selected, setSelected] = useState<string[]>(defaults);
  const [metricKey, setMetricKey] = useState<MetricKey>('score');
  const [tickerSearch, setTickerSearch] = useState('');

  // Smart default: if the user has a portfolio, compare the names Lyra scans.
  useEffect(() => {
    const owned = loadLocalHoldings()
      .map((h) => h.symbol)
      .filter((s) => bySymbol.has(s));
    if (owned.length > 0) setSelected(owned.slice(0, 6));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = selected.map((t) => bySymbol.get(t)).filter((s): s is SignalRow => Boolean(s));
  const metric = METRICS.find((m) => m.key === metricKey) ?? METRICS[0];

  const addTicker = (ticker: string) => {
    setSelected((prev) => (prev.includes(ticker) ? prev : [...prev, ticker].slice(-6)));
    setTickerSearch('');
  };
  const removeTicker = (ticker: string) => setSelected((prev) => prev.filter((t) => t !== ticker));
  const usePortfolio = () => {
    const owned = loadLocalHoldings()
      .map((h) => h.symbol)
      .filter((s) => bySymbol.has(s))
      .slice(0, 6);
    if (owned.length > 0) setSelected(owned);
  };
  const filteredTickers = scanned
    .map((s) => s.symbol)
    .filter((t) => !selected.includes(t) && t.toLowerCase().includes(tickerSearch.trim().toLowerCase()));

  return (
    <div className="space-y-3 pb-20 md:pb-0">
      {/* Ticker picker - search the scanned set, with a one-tap "use my portfolio" */}
      <section className="terminal-panel overflow-hidden rounded-panel">
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">Ticker selector</p>
            <p className="mt-0.5 text-[10px] text-ink-2">Any name in the current scan - up to 6</p>
          </div>
          <button
            type="button"
            onClick={usePortfolio}
            className="shrink-0 rounded-cell border border-accent-border bg-accent-tint px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-accent transition hover:border-accent"
          >
            Use my portfolio
          </button>
        </div>

        <div className="space-y-2 px-3 py-2.5">
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((t) => (
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
              placeholder="Add a scanned ticker (e.g. NVDA)"
              className="h-8 w-full rounded border border-line-strong bg-panel px-2 font-mono text-xs text-ink-title outline-none placeholder:text-ink-dim focus:border-blue-focus/50"
            />
            {tickerSearch.trim().length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {filteredTickers.length === 0 ? (
                  <span className="font-mono text-[10px] text-ink-3">Not in the current scan set</span>
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

      {rows.length === 0 ? (
        <section className="terminal-panel rounded-panel p-6 text-center">
          <p className="text-sm text-ink-3">Select tickers above to begin comparison</p>
        </section>
      ) : (
        <>
          {/* Metric switcher */}
          <section className="terminal-panel overflow-hidden rounded-panel">
            <div className="border-b border-line px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">Metric</p>
            </div>
            <div className="flex flex-wrap gap-2 px-4 py-3">
              {METRICS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMetricKey(m.key)}
                  className={`whitespace-nowrap rounded-cell border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    metricKey === m.key
                      ? 'border-line-strong bg-panel-deep text-accent'
                      : 'border-line bg-ground text-ink-3 hover:text-ink-title'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="border-t border-line px-4 py-2 text-[10px] leading-relaxed text-ink-3">
              <span className="text-ink-2">{metric.label}</span> - {metric.explain}.
            </p>
          </section>

          {/* Real-value comparison bars */}
          <MetricBars rows={rows} metric={metric} />

          {/* Comparison table - the full real read per name */}
          <ComparisonTable rows={rows} />

          <p className="px-1 font-mono text-[10px] leading-snug text-ink-dim">
            Latest scan values only. Lyra records no per-ticker intraday history yet, so nothing here is a
            time series - and none is invented. Research only, never advice.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * One labelled horizontal bar per ticker for the selected metric - real current values.
 * Signed metrics (1D return, MACD hist) diverge from a zero baseline with gain/loss tones;
 * unsigned metrics scale from zero in the neutral accent. Identity is text, never colour.
 */
function MetricBars({ rows, metric }: { rows: SignalRow[]; metric: MetricDef }) {
  const values = rows.map((s) => metric.read(s));
  const maxAbs = Math.max(...values.map((v) => Math.abs(v)), 1e-9);
  const sorted = [...rows]
    .map((s) => ({ s, v: metric.read(s) }))
    .sort((a, b) => b.v - a.v);

  return (
    <section className="terminal-panel overflow-hidden rounded-panel">
      <div className="border-b border-line px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">{metric.label} - current scan</p>
        <p className="mt-1 text-xs text-ink-2">Measured values from the latest scan, ranked.</p>
      </div>
      <div className="space-y-2 px-4 py-3">
        {sorted.map(({ s, v }) => {
          const frac = Math.abs(v) / maxAbs;
          const widthPct = Math.max(2, frac * 100);
          const tone = metric.signed ? (v >= 0 ? 'bg-positive' : 'bg-negative') : 'bg-accent';
          const text = metric.signed ? (v >= 0 ? 'text-positive' : 'text-negative') : 'text-ink-title';
          return (
            <div key={s.symbol} className="grid grid-cols-[64px_1fr_88px] items-center gap-3">
              <span className="truncate font-mono text-[12px] font-semibold text-ink">{s.symbol}</span>
              {metric.signed ? (
                <div className="relative h-3 overflow-hidden rounded-sm bg-line/50">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-ink-3/50" />
                  <div
                    className={`absolute inset-y-0 ${tone} rounded-sm opacity-80`}
                    style={v >= 0 ? { left: '50%', width: `${widthPct / 2}%` } : { right: '50%', width: `${widthPct / 2}%` }}
                  />
                </div>
              ) : (
                <div className="h-3 overflow-hidden rounded-sm bg-line/50">
                  <div className={`h-full ${tone} rounded-sm opacity-80`} style={{ width: `${widthPct}%` }} />
                </div>
              )}
              <span className={`text-right font-mono text-[12px] tabular-nums ${text}`}>{metric.fmt(v)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** The full real read per selected name, ranked by score. */
function ComparisonTable({ rows }: { rows: SignalRow[] }) {
  const ranked = [...rows].sort((a, b) => b.score - a.score);

  return (
    <section className="terminal-panel overflow-hidden rounded-panel">
      <div className="border-b border-line px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">Side by side</p>
        <p className="mt-1 text-xs text-ink-2">Every metric the engine computed this scan, ranked by score.</p>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-chrome font-mono uppercase text-ink-3">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Ticker</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Score</th>
              <th className="px-3 py-2">1D %</th>
              <th className="px-3 py-2">RSI</th>
              <th className="px-3 py-2">MACD Hist</th>
              <th className="px-3 py-2">Vol Ratio</th>
              <th className="px-3 py-2">60d-low</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ranked.map((s, i) => (
              <tr className="font-mono tabular-nums text-ink-title hover:bg-line/30" key={s.symbol}>
                <td className="px-3 py-2 text-ink-3">{i + 1}</td>
                <td className="px-3 py-2 font-semibold text-ink">{s.symbol}</td>
                <td className="px-3 py-2 text-ink-2">{statusLabel(s.status)}</td>
                <td className="px-3 py-2">
                  {s.score} <span className={s.scoreDelta >= 0 ? 'text-positive' : 'text-negative'}>{formatSignedNumber(s.scoreDelta, 0)}</span>
                </td>
                <td className={`px-3 py-2 ${s.priceChange1d >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {formatSignedPercent(s.priceChange1d)}
                </td>
                <td className="px-3 py-2">{formatNumber(s.rsi, 1)}</td>
                <td className={`px-3 py-2 ${s.macdHistogram >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {formatSignedNumber(s.macdHistogram, 2)}
                </td>
                <td className="px-3 py-2">{formatNumber(s.volumeRatio, 2)}x</td>
                <td className="px-3 py-2">{formatNumber(s.distanceFromLow, 1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="divide-y divide-line md:hidden">
        {ranked.map((s, i) => (
          <div className="grid grid-cols-[48px_1fr] gap-3 px-3 py-3" key={s.symbol}>
            <div>
              <p className="font-mono text-lg font-semibold text-ink">{s.symbol}</p>
              <p className="font-mono text-[10px] text-ink-3">#{i + 1}</p>
            </div>
            <div className="min-w-0 space-y-1 font-mono tabular-nums">
              <p className="flex justify-between text-xs text-ink-title">
                <span>Score</span>
                <span>
                  {s.score} <span className={s.scoreDelta >= 0 ? 'text-positive' : 'text-negative'}>{formatSignedNumber(s.scoreDelta, 0)}</span>
                </span>
              </p>
              <p className="flex justify-between text-xs text-ink-title">
                <span>1D</span>
                <span className={s.priceChange1d >= 0 ? 'text-positive' : 'text-negative'}>{formatSignedPercent(s.priceChange1d)}</span>
              </p>
              <p className="flex justify-between text-xs text-ink-2">
                <span>RSI / Hist</span>
                <span>{formatNumber(s.rsi, 1)} / {formatSignedNumber(s.macdHistogram, 2)}</span>
              </p>
              <p className="flex justify-between text-xs text-ink-3">
                <span>Vol / 60d-low</span>
                <span>{formatNumber(s.volumeRatio, 2)}x / {formatNumber(s.distanceFromLow, 1)}%</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
