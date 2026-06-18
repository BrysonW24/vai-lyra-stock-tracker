'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowUpRight, ListFilter, Pin, Rows3, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { SignalRow } from '@/types/scanner';
import { formatCurrency, formatNumber, formatPercent, formatSignedNumber, formatSignedPercent, toneClass, trendArrow } from '@/lib/format';
import { StatusBadge } from '@/components/StatusBadge';
import { TickerLogo } from '@/components/TickerLogo';
import { SignalDrawer } from '@/components/SignalDrawer';

type FilterMode =
  | 'all'
  | 'strong'
  | 'watchlist'
  | 'portfolio'
  | 'weakening'
  | 'rsi_lt_50'
  | 'macd_rising'
  | 'near_low'
  | 'above_200'
  | 'delta_gt_8';

type SortMode = 'score' | 'delta' | 'ticker' | 'rsi' | 'low' | 'volume';

interface SignalTableProps {
  signals: SignalRow[];
  compact?: boolean;
  portfolioSymbols?: string[];
  watchlistSymbols?: string[];
  title?: string;
}

const filterLabels: Array<{ value: FilterMode; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'strong', label: 'Strong' },
  { value: 'watchlist', label: 'Watchlist' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'weakening', label: 'Weakening' },
  { value: 'rsi_lt_50', label: 'RSI < 50' },
  { value: 'macd_rising', label: 'Hist Rising' },
  { value: 'near_low', label: 'Near 60D Low' },
  { value: 'above_200', label: 'Above 200MA' },
  { value: 'delta_gt_8', label: 'Delta > 8' },
];

export function SignalTable({
  signals,
  compact = false,
  portfolioSymbols = [],
  watchlistSymbols = [],
  title = 'Signal Radar',
}: SignalTableProps) {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [filter, setFilter] = useState<FilterMode>(compact ? 'all' : 'all');
  const [sort, setSort] = useState<SortMode>('score');
  const [dense, setDense] = useState(true);
  const [selected, setSelected] = useState<SignalRow | null>(null);

  const portfolioSet = useMemo(() => new Set(portfolioSymbols), [portfolioSymbols]);
  const watchlistSet = useMemo(() => new Set(watchlistSymbols), [watchlistSymbols]);

  const rows = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return signals
      .filter((signal) => {
        const matchesSearch =
          !searchValue ||
          signal.symbol.toLowerCase().includes(searchValue) ||
          signal.companyName.toLowerCase().includes(searchValue);

        if (!matchesSearch) {
          return false;
        }

        if (filter === 'strong') return signal.status === 'strong_setup';
        if (filter === 'watchlist') return signal.status === 'watchlist_setup' || watchlistSet.has(signal.symbol);
        if (filter === 'portfolio') return portfolioSet.has(signal.symbol);
        if (filter === 'weakening') return signal.status === 'weakening' || signal.status === 'invalidated' || signal.status === 'overextended';
        if (filter === 'rsi_lt_50') return signal.rsi < 50;
        if (filter === 'macd_rising') return signal.histDelta > 0;
        if (filter === 'near_low') return signal.distanceFromLow <= 10;
        if (filter === 'above_200') return signal.priceVsSma200 >= 0;
        if (filter === 'delta_gt_8') return signal.scoreDelta > 8;

        return true;
      })
      .sort((a, b) => {
        if (sort === 'delta') return b.scoreDelta - a.scoreDelta;
        if (sort === 'ticker') return a.symbol.localeCompare(b.symbol);
        if (sort === 'rsi') return a.rsi - b.rsi;
        if (sort === 'low') return a.distanceFromLow - b.distanceFromLow;
        if (sort === 'volume') return b.volumeRatio - a.volumeRatio;
        return b.score - a.score;
      });
  }, [filter, portfolioSet, search, signals, sort, watchlistSet]);

  const rowPadding = dense ? 'px-3 py-2' : 'px-3 py-3';

  return (
    <section className="terminal-panel overflow-hidden rounded-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1b2530] px-3 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">{title}</p>
          <p className="mt-1 font-mono text-xs text-[#a8b5c2]">{rows.length}/{signals.length} rows | middleware-owned signal fields</p>
        </div>
        {!compact && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-8 items-center gap-2 rounded border border-[#263241] bg-[#0d141c] px-2 text-[11px] text-[#8190a0]">
              <Search size={14} />
              <input
                className="w-32 bg-transparent font-mono text-xs text-[#dbe5ee] outline-none placeholder:text-[#5d6b79]"
                placeholder="Ticker"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="flex h-8 items-center gap-2 rounded border border-[#263241] bg-[#0d141c] px-2 text-[11px] text-[#8190a0]">
              <ListFilter size={14} />
              <select className="bg-transparent font-mono text-xs text-[#dbe5ee] outline-none" value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
                <option value="score">Score</option>
                <option value="delta">Score Delta</option>
                <option value="ticker">Ticker</option>
                <option value="rsi">RSI Low</option>
                <option value="low">Near Low</option>
                <option value="volume">Volume</option>
              </select>
            </label>
            <button
              type="button"
              className="flex h-8 items-center gap-2 rounded border border-[#263241] bg-[#0d141c] px-2 text-[11px] text-[#a8b5c2] transition hover:text-[#eef3f8]"
              onClick={() => setDense((value) => !value)}
            >
              <Rows3 size={14} />
              {dense ? 'Compact' : 'Comfort'}
            </button>
          </div>
        )}
      </div>

      {!compact && (
        <div className="flex gap-1 overflow-x-auto border-b border-[#1b2530] px-3 py-2">
          {filterLabels.map((item) => (
            <button
              type="button"
              className={[
                'shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] transition',
                filter === item.value
                  ? 'border-[#f3a33a] bg-[#23180b] text-[#f3a33a]'
                  : 'border-[#263241] bg-[#0d141c] text-[#8190a0] hover:text-[#dbe5ee]',
              ].join(' ')}
              onClick={() => setFilter(item.value)}
              key={item.value}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[1500px] table-fixed text-left text-xs">
          <thead className="sticky top-0 z-10 bg-[#0b1016] font-mono uppercase text-[#8190a0]">
            <tr>
              <th className={`${rowPadding} sticky left-0 z-20 w-28 bg-[#0b1016] font-semibold`}>
                <span className="inline-flex items-center gap-1"><Pin size={12} /> Ticker</span>
              </th>
              <th className={`${rowPadding} w-48 font-semibold`}>Company</th>
              <th className={`${rowPadding} w-24 font-semibold`}>Price</th>
              <th className={`${rowPadding} w-20 font-semibold`}>1D %</th>
              <th className={`${rowPadding} w-24 font-semibold`}>Score</th>
              <th className={`${rowPadding} w-24 font-semibold`}>Delta</th>
              <th className={`${rowPadding} w-36 font-semibold`}>Signal Status</th>
              <th className={`${rowPadding} w-32 font-semibold`}>Action</th>
              <th className={`${rowPadding} w-20 font-semibold`}>RSI</th>
              <th className={`${rowPadding} w-20 font-semibold`}>RSI Delta</th>
              <th className={`${rowPadding} w-24 font-semibold`}>MACD Hist</th>
              <th className={`${rowPadding} w-20 font-semibold`}>Hist Delta</th>
              <th className={`${rowPadding} w-28 font-semibold`}>MACD State</th>
              <th className={`${rowPadding} w-24 font-semibold`}>Vol Ratio</th>
              <th className={`${rowPadding} w-24 font-semibold`}>vs 20MA</th>
              <th className={`${rowPadding} w-24 font-semibold`}>vs 50MA</th>
              <th className={`${rowPadding} w-24 font-semibold`}>vs 200MA</th>
              <th className={`${rowPadding} w-24 font-semibold`}>60D Low</th>
              <th className={`${rowPadding} w-28 font-semibold`}>Lifecycle</th>
              <th className={`${rowPadding} w-32 font-semibold`}>Last Alert</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1b2530]">
            {rows.map((signal) => (
              <tr className="font-mono text-[#dbe5ee] transition hover:bg-[#101720]" key={signal.symbol}>
                <td className={`${rowPadding} sticky left-0 z-10 bg-[#0d1117] font-semibold text-[#eef3f8]`}>
                  <Link href={`/tickers/${signal.symbol}`} className="group inline-flex items-center gap-1.5">
                    <TickerLogo symbol={signal.symbol} companyName={signal.companyName} size={16} />
                    {signal.symbol}
                    <ArrowUpRight className="opacity-0 transition group-hover:opacity-100" size={12} />
                  </Link>
                </td>
                <td className={`${rowPadding} truncate text-[#a8b5c2]`}>{signal.companyName}</td>
                <td className={rowPadding}>{formatCurrency(signal.close)}</td>
                <td className={`${rowPadding} ${toneClass(signal.priceChange1d)}`}>{formatSignedPercent(signal.priceChange1d)}</td>
                <td className={`${rowPadding} text-lg font-semibold text-[#eef3f8]`}>{signal.score}</td>
                <td className={`${rowPadding} ${toneClass(signal.scoreDelta)}`}>{formatSignedNumber(signal.scoreDelta, 0)}</td>
                <td className={rowPadding}><StatusBadge status={signal.status} /></td>
                <td className={`${rowPadding} text-[#f3a33a]`}>{signal.actionState.replaceAll('_', ' ')}</td>
                <td className={rowPadding}>{formatNumber(signal.rsi)}</td>
                <td className={`${rowPadding} ${toneClass(signal.rsiDelta)}`}>{trendArrow(signal.rsiDelta)} {formatSignedNumber(signal.rsiDelta)}</td>
                <td className={rowPadding}>{formatNumber(signal.macdHistogram, 2)}</td>
                <td className={`${rowPadding} ${toneClass(signal.histDelta)}`}>{trendArrow(signal.histDelta)} {formatSignedNumber(signal.histDelta, 2)}</td>
                <td className={`${rowPadding} truncate`}>{signal.macdState}</td>
                <td className={rowPadding}>{formatNumber(signal.volumeRatio, 2)}x</td>
                <td className={`${rowPadding} ${toneClass(signal.priceVsSma20)}`}>{formatSignedPercent(signal.priceVsSma20)}</td>
                <td className={`${rowPadding} ${toneClass(signal.priceVsSma50)}`}>{formatSignedPercent(signal.priceVsSma50)}</td>
                <td className={`${rowPadding} ${toneClass(signal.priceVsSma200)}`}>{formatSignedPercent(signal.priceVsSma200)}</td>
                <td className={rowPadding}>{formatPercent(signal.distanceFromLow)}</td>
                <td className={`${rowPadding} text-[#a8b5c2]`}>{signal.lifecycleState.replaceAll('_', ' ')}</td>
                <td className={`${rowPadding} text-[#8190a0]`}>{signal.lastAlert ?? 'none'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-[#1b2530] md:hidden">
        {rows.map((signal) => (
          <button
            type="button"
            onClick={() => setSelected(signal)}
            className="block w-full px-3 py-2 text-left transition hover:bg-[#101720]"
            key={signal.symbol}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <TickerLogo symbol={signal.symbol} companyName={signal.companyName} size={16} />
                  <span className="font-mono text-sm font-semibold text-[#eef3f8]">{signal.symbol}</span>
                  <StatusBadge status={signal.status} />
                  <span className="ml-auto truncate text-[10px] text-[#f3a33a]">{signal.actionState.replaceAll('_', ' ')}</span>
                </div>
                <p className="mt-0.5 truncate font-mono text-[10px] text-[#a8b5c2]">
                  {formatCurrency(signal.close)} | RSI {formatNumber(signal.rsi)}{trendArrow(signal.rsiDelta)} | Hist {formatNumber(signal.macdHistogram, 2)}{trendArrow(signal.histDelta)} | Vol {formatNumber(signal.volumeRatio, 2)}x
                </p>
              </div>
              <div className="shrink-0 text-right font-mono">
                <p className="text-base font-semibold leading-none text-[#eef3f8]">{signal.score}</p>
                <p className={`text-[11px] ${toneClass(signal.scoreDelta)}`}>{formatSignedNumber(signal.scoreDelta, 0)}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <SignalDrawer signal={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
