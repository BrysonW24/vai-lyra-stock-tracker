'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowUpRight, Info, ListFilter, Pin, Rows3, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SignalRow } from '@/types/scanner';
import { formatCurrency, formatNumber, formatPercent, formatSignedNumber, formatSignedPercent, toneClass, trendArrow } from '@/lib/format';
import { StatusBadge } from '@/components/StatusBadge';
import { TickerLogo } from '@/components/TickerLogo';
import { SignalDrawer } from '@/components/SignalDrawer';
import { HelpDrawer, type HelpTerm } from '@/components/education/HelpDrawer';
import {
  loadLocalHoldings,
  PORTFOLIO_CHANGED_EVENT,
} from '@/lib/local-portfolio';
import {
  loadLocalWatchlist,
  WATCHLIST_CHANGED_EVENT,
} from '@/lib/local-watchlist';

// Per-column plain-English help + the academy module it deep-links to. Native title=
// tooltips read this on hover; the header "?" drawer renders the same set so the two
// can never drift. Definitions stay short - the module is the full explanation.
const COLUMN_HELP: Array<HelpTerm & { tip: string }> = [
  { term: 'Score', tip: '0-100 oversold-recovery score. Higher = a more beaten-down name showing an early turn.', what: '0-100 oversold-recovery score built from RSI, MACD, price location, trend and volume. Higher = a more beaten-down name showing an early turn - a dip catch, not buying strength.', moduleId: 'momentum-recovery' },
  { term: 'Delta', tip: 'Change in score since the last scan. Positive = the setup is firming up.', what: 'How much the score moved since the previous scan. A rising delta means the composite picture is improving scan-over-scan.', moduleId: 'momentum-recovery' },
  { term: 'Signal Status', tip: 'Lifecycle tag the engine assigns: strong / watchlist / weakening / overextended.', what: 'The setup tag the deterministic engine assigns - strong, watchlist, weakening, invalidated or overextended - based on where structure and momentum stand right now.', moduleId: 'momentum-recovery' },
  { term: 'Action', tip: 'Suggested review state, e.g. trim_review. Research only - never advice.', what: 'The review state the engine flags for a holding, e.g. trim_review when a position looks overextended. It is a prompt to look, never a buy or sell instruction.', moduleId: 'overextension' },
  { term: 'RSI', tip: 'Relative Strength Index (0-100). Low and turning up can mean recovery; very high can mean overbought.', what: 'How hard the stock has been bought or sold lately, 0-100. Low and turning up can mean it is recovering; very high can mean it has run hot.', moduleId: 'rsi' },
  { term: 'RSI Delta', tip: 'Change in RSI since the last scan. Up = momentum accelerating.', what: 'The change in RSI scan-over-scan. A rising RSI off a low reading is an early sign momentum is turning back up.', moduleId: 'rsi' },
  { term: 'MACD Hist', tip: 'MACD histogram: recent momentum vs the longer trend. Negative-but-rising is an early turn.', what: 'The gap between the MACD line and its signal line. Shrinking toward zero or turning up means selling pressure is easing - an early turn signal.', moduleId: 'macd-histogram' },
  { term: 'Hist Delta', tip: 'Change in the MACD histogram since the last scan. Up arrow = momentum recovering.', what: 'The slope of the MACD histogram scan-over-scan. A negative-but-rising histogram is a core trigger for a momentum-recovery setup.', moduleId: 'macd-histogram' },
  { term: 'MACD State', tip: 'Trend regime: bullish/bearish, above/below the signal line.', what: 'The MACD regime the engine tracks - bullish_above, bullish_below, bearish_above, bearish_below - summarising trend direction and where momentum sits versus its signal line.', moduleId: 'macd' },
  { term: 'Vol Ratio', tip: 'Volume vs its own average. Above 1x = heavier-than-usual participation confirming the move.', what: 'Recent volume against its own average. Above 1x means heavier-than-usual participation; above ~1.2x suggests real conviction behind the move.', moduleId: 'volume-confirmation' },
  { term: 'vs 20MA', tip: 'Price distance from the 20-day moving average. Near it in an uptrend often marks support.', what: 'How far price sits from the 20-day simple moving average. Pulling back near the 20MA in an uptrend often finds support.', moduleId: 'moving-averages' },
  { term: 'vs 50MA', tip: 'Price distance from the 50-day moving average - the medium-term trend filter.', what: 'How far price sits from the 50-day simple moving average, a medium-term trend reference.', moduleId: 'moving-averages' },
  { term: 'vs 200MA', tip: 'Price distance from the 200-day moving average. Above it = long-term uptrend.', what: 'How far price sits from the 200-day simple moving average. Above it indicates a long-term uptrend.', moduleId: 'moving-averages' },
  { term: '60D Low', tip: 'How far price has risen above its 60-period low. Near the low = early in a recovery.', what: 'How far the current price has risen from its recent low, as a percentage. Near the low is early in a recovery; far from it risks running into resistance.', moduleId: 'distance-from-low' },
  { term: 'Lifecycle', tip: 'Where the signal sits in its life: new, confirmed, maturing, fading.', what: 'Where the signal sits across its life - the engine tracks whether a setup is freshly fired, confirmed, maturing or fading.', moduleId: 'momentum-recovery' },
];

const tip = (term: string): string => COLUMN_HELP.find((c) => c.term === term)?.tip ?? '';

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
  /** In Solo, layer device-local ownership markers over the shared market scan. */
  soloPersonalize?: boolean;
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
  soloPersonalize = false,
}: SignalTableProps) {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [filter, setFilter] = useState<FilterMode>(compact ? 'all' : 'all');
  const [sort, setSort] = useState<SortMode>('score');
  const [dense, setDense] = useState(true);
  const [selected, setSelected] = useState<SignalRow | null>(null);
  // Mobile card list is capped so 80 signals never become one endless thumb-scroll;
  // "Show more" extends in pages. Desktop table is unaffected.
  const [mobileVisible, setMobileVisible] = useState(12);
  const [activePortfolioSymbols, setActivePortfolioSymbols] =
    useState(portfolioSymbols);
  const [activeWatchlistSymbols, setActiveWatchlistSymbols] =
    useState(watchlistSymbols);

  useEffect(() => {
    if (!soloPersonalize) {
      setActivePortfolioSymbols(portfolioSymbols);
      setActiveWatchlistSymbols(watchlistSymbols);
      return;
    }
    const refreshPortfolio = () =>
      setActivePortfolioSymbols(loadLocalHoldings().map((item) => item.symbol));
    const refreshWatchlist = () =>
      setActiveWatchlistSymbols(loadLocalWatchlist().map((item) => item.symbol));
    refreshPortfolio();
    refreshWatchlist();
    window.addEventListener(PORTFOLIO_CHANGED_EVENT, refreshPortfolio);
    window.addEventListener(WATCHLIST_CHANGED_EVENT, refreshWatchlist);
    return () => {
      window.removeEventListener(PORTFOLIO_CHANGED_EVENT, refreshPortfolio);
      window.removeEventListener(WATCHLIST_CHANGED_EVENT, refreshWatchlist);
    };
  }, [portfolioSymbols, soloPersonalize, watchlistSymbols]);

  // The drawer is URL-routed (?signal=SYM) so an open explainer survives refresh and
  // can be shared/deep-linked ("look at NVDA's setup"). history.replaceState keeps it
  // out of the router (no re-render, no history spam); the mount effect below restores it.
  const restoredFromUrl = useRef(false);
  const writeSignalParam = (symbol: string | null) => {
    const url = new URL(window.location.href);
    if (symbol) url.searchParams.set('signal', symbol);
    else url.searchParams.delete('signal');
    window.history.replaceState(null, '', url);
  };
  const openSignal = useCallback((signal: SignalRow) => {
    setSelected(signal);
    writeSignalParam(signal.symbol);
  }, []);
  const closeSignal = useCallback(() => {
    setSelected(null);
    writeSignalParam(null);
  }, []);

  useEffect(() => {
    if (restoredFromUrl.current) return;
    restoredFromUrl.current = true;
    const fromUrl = searchParams.get('signal');
    if (!fromUrl) return;
    const match = signals.find((s) => s.symbol.toUpperCase() === fromUrl.toUpperCase());
    if (match) setSelected(match);
  }, [searchParams, signals]);

  const portfolioSet = useMemo(
    () => new Set(activePortfolioSymbols),
    [activePortfolioSymbols],
  );
  const watchlistSet = useMemo(
    () => new Set(activeWatchlistSymbols),
    [activeWatchlistSymbols],
  );

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
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">{title}</p>
            <HelpDrawer
              title="What do these columns mean?"
              subtitle="Every column on the radar, in plain English"
              ariaLabel="What do these columns mean?"
              intro="The radar lists the deterministic signal fields the engine scores. Tap any term for the definition and a link into the academy."
              terms={COLUMN_HELP}
            />
          </div>
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
              <select aria-label="Sort signals by" className="bg-transparent font-mono text-xs text-[#dbe5ee] outline-none" value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
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
              className="flex h-11 items-center gap-2 rounded border border-[#263241] bg-[#0d141c] px-2 text-[11px] text-[#a8b5c2] transition hover:text-[#eef3f8] sm:h-8"
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
              <th className={`${rowPadding} w-24 cursor-help font-semibold underline decoration-dotted decoration-[#3a4754] underline-offset-2`} title={tip('Score')}>Score</th>
              <th className={`${rowPadding} w-24 cursor-help font-semibold underline decoration-dotted decoration-[#3a4754] underline-offset-2`} title={tip('Delta')}>Delta</th>
              <th className={`${rowPadding} w-36 cursor-help font-semibold underline decoration-dotted decoration-[#3a4754] underline-offset-2`} title={tip('Signal Status')}>Signal Status</th>
              <th className={`${rowPadding} w-32 cursor-help font-semibold underline decoration-dotted decoration-[#3a4754] underline-offset-2`} title={tip('Action')}>Action</th>
              <th className={`${rowPadding} w-20 cursor-help font-semibold underline decoration-dotted decoration-[#3a4754] underline-offset-2`} title={tip('RSI')}>RSI</th>
              <th className={`${rowPadding} w-20 cursor-help font-semibold underline decoration-dotted decoration-[#3a4754] underline-offset-2`} title={tip('RSI Delta')}>RSI Delta</th>
              <th className={`${rowPadding} w-24 cursor-help font-semibold underline decoration-dotted decoration-[#3a4754] underline-offset-2`} title={tip('MACD Hist')}>MACD Hist</th>
              <th className={`${rowPadding} w-20 cursor-help font-semibold underline decoration-dotted decoration-[#3a4754] underline-offset-2`} title={tip('Hist Delta')}>Hist Delta</th>
              <th className={`${rowPadding} w-28 cursor-help font-semibold underline decoration-dotted decoration-[#3a4754] underline-offset-2`} title={tip('MACD State')}>MACD State</th>
              <th className={`${rowPadding} w-24 cursor-help font-semibold underline decoration-dotted decoration-[#3a4754] underline-offset-2`} title={tip('Vol Ratio')}>Vol Ratio</th>
              <th className={`${rowPadding} w-24 cursor-help font-semibold underline decoration-dotted decoration-[#3a4754] underline-offset-2`} title={tip('vs 20MA')}>vs 20MA</th>
              <th className={`${rowPadding} w-24 cursor-help font-semibold underline decoration-dotted decoration-[#3a4754] underline-offset-2`} title={tip('vs 50MA')}>vs 50MA</th>
              <th className={`${rowPadding} w-24 cursor-help font-semibold underline decoration-dotted decoration-[#3a4754] underline-offset-2`} title={tip('vs 200MA')}>vs 200MA</th>
              <th className={`${rowPadding} w-24 cursor-help font-semibold underline decoration-dotted decoration-[#3a4754] underline-offset-2`} title={tip('60D Low')}>60D Low</th>
              <th className={`${rowPadding} w-28 cursor-help font-semibold underline decoration-dotted decoration-[#3a4754] underline-offset-2`} title={tip('Lifecycle')}>Lifecycle</th>
              <th className={`${rowPadding} w-32 font-semibold`}>Last Alert</th>
              <th className={`${rowPadding} w-12 font-semibold`}><span className="sr-only">Explain</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1b2530]">
            {rows.length === 0 && (
              <tr>
                <td colSpan={21} className="px-3 py-8 text-center font-mono text-xs text-[#8190a0]">
                  No signals match{search ? ` "${search}"` : ''} with the current filter.{' '}
                  <button
                    type="button"
                    className="text-[#f3a33a] underline decoration-dotted underline-offset-2 hover:text-[#f7b95e]"
                    onClick={() => {
                      setSearch('');
                      setFilter('all');
                    }}
                  >
                    Clear filters
                  </button>
                </td>
              </tr>
            )}
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
                <td className={rowPadding}>
                  <button
                    type="button"
                    onClick={() => openSignal(signal)}
                    aria-label={`Explain ${signal.symbol} signal`}
                    title="Explain this signal"
                    className="grid h-6 w-6 place-items-center rounded border border-[#263241] bg-[#0d141c] text-[#8190a0] transition hover:border-[#3a4754] hover:text-[#eef3f8]"
                  >
                    <Info size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-[#1b2530] md:hidden">
        {rows.length === 0 && (
          <p className="px-3 py-6 text-center font-mono text-xs text-[#8190a0]">
            No signals match{search ? ` "${search}"` : ''} with the current filter.
          </p>
        )}
        {rows.slice(0, mobileVisible).map((signal) => (
          <button
            type="button"
            onClick={() => openSignal(signal)}
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
        {rows.length > mobileVisible && (
          <button
            type="button"
            onClick={() => setMobileVisible((n) => n + 20)}
            className="block min-h-[44px] w-full px-3 py-3 text-center font-mono text-xs font-semibold uppercase tracking-[0.12em] text-[#8aa2ff] transition hover:bg-[#101720]"
          >
            Show {Math.min(20, rows.length - mobileVisible)} more of {rows.length}
          </button>
        )}
      </div>

      <SignalDrawer signal={selected} onClose={closeSignal} />
    </section>
  );
}
