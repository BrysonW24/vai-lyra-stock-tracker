'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import type { PortfolioHolding, SignalRow, TickerSetting } from '@/types/scanner';
import { TickerLogo } from '@/components/TickerLogo';
import { TradingViewChart, DEFAULT_CHART_INDICATORS, type ChartIndicators } from '@/components/TradingViewChart';
import { PanelCarousel } from '@/components/PanelCarousel';
import { HoldingSetupSlide } from '@/components/HoldingSetupSlide';
import { HoldingIntelSlide } from '@/components/HoldingIntelSlide';
import { formatCompactCurrency, formatCurrency, formatSignedNumber, formatSignedPercent, toneClass } from '@/lib/format';
import { loadLocalHoldings } from '@/lib/local-portfolio';

interface HoldingsMomentumBoardProps {
  holdings: PortfolioHolding[];
  signals: SignalRow[];
  tickers: TickerSetting[];
}

const SLOT_COUNT = 4;
const STORAGE_KEY = 'lyra.momentumSlots';

function amountSpent(holding: PortfolioHolding): number {
  return holding.quantity * holding.averagePrice;
}

function readLine(scoreDelta: number, histDelta: number): string {
  const pressureFading = histDelta > 0;
  if (scoreDelta >= 3 && pressureFading) return 'Strengthening - score rising and downward pressure easing.';
  if (scoreDelta >= 3) return 'Setup score grinding higher since the last scan.';
  if (scoreDelta <= -3) return 'Cooling off - score has slipped since the last scan.';
  return 'Holding steady - little change since the last scan.';
}

export function HoldingsMomentumBoard({ holdings, signals, tickers }: HoldingsMomentumBoardProps) {
  const signalBySymbol = useMemo(() => new Map(signals.map((s) => [s.symbol, s])), [signals]);
  const holdingBySymbol = useMemo(() => new Map(holdings.map((h) => [h.symbol, h])), [holdings]);
  // Symbol -> TradingView exchange prefix, mirroring the ticker-detail page so
  // the live candle embed resolves the right venue (NYSE vs NASDAQ).
  const exchangeBySymbol = useMemo(
    () => new Map(tickers.map((t) => [t.symbol, t.exchange === 'NYSE' ? 'NYSE' : 'NASDAQ'])),
    [tickers],
  );
  const tickerBySymbol = useMemo(() => new Map(tickers.map((t) => [t.symbol, t])), [tickers]);

  // Each study (Bollinger / RSI / MACD) toggles independently and persists.
  const [indicators, setIndicators] = useState<ChartIndicators>(DEFAULT_CHART_INDICATORS);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('lyra.chartIndicators.v2');
      if (saved) setIndicators({ ...DEFAULT_CHART_INDICATORS, ...(JSON.parse(saved) as Partial<ChartIndicators>) });
    } catch {
      /* ignore */
    }
  }, []);
  // Per-holding collapse (keyed by symbol). Collapsed hides the chart carousel but
  // keeps the header + chips, so the board can show every name at a glance.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCollapse = (symbol: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });

  const toggleIndicator = (key: keyof ChartIndicators) =>
    setIndicators((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        window.localStorage.setItem('lyra.chartIndicators.v2', JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });

  // Selectable universe (alphabetical for easy scanning in the picker).
  const options = useMemo(
    () => [...signals].sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [signals],
  );

  // Default slots: owned holdings first (by amount invested), then top radar setups.
  const defaultSlots = useMemo(() => {
    const owned = [...holdings].sort((a, b) => amountSpent(b) - amountSpent(a)).map((h) => h.symbol);
    const ownedSet = new Set(owned);
    const radar = [...signals]
      .filter((s) => !ownedSet.has(s.symbol))
      .sort((a, b) => b.score - a.score)
      .map((s) => s.symbol);
    const merged = [...owned, ...radar];
    // Pad defensively so we always have SLOT_COUNT entries.
    while (merged.length < SLOT_COUNT && merged.length > 0) merged.push(merged[merged.length - 1]);
    return merged.slice(0, SLOT_COUNT);
  }, [holdings, signals]);

  const [slots, setSlots] = useState<string[]>(defaultSlots);

  // Hydrate slots on the client: saved choices win; otherwise lead with the user's OWN
  // holdings (from onboarding / the local book) so your book is the default, padded with
  // top radar setups; else fall back to the demo-derived defaults.
  useEffect(() => {
    let saved: string[] = [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) saved = parsed.filter((s): s is string => typeof s === 'string' && signalBySymbol.has(s));
    } catch {
      /* ignore malformed storage */
    }

    if (saved.length > 0) {
      const next = [...saved];
      for (const fallback of defaultSlots) {
        if (next.length >= SLOT_COUNT) break;
        if (!next.includes(fallback)) next.push(fallback);
      }
      setSlots(next.slice(0, SLOT_COUNT));
      return;
    }

    // No saved choices: lead with the user's own holdings (largest first) we can chart.
    const owned = [...loadLocalHoldings()]
      .sort((a, b) => b.quantity * b.averageBuyPrice - a.quantity * a.averageBuyPrice)
      .map((h) => h.symbol)
      .filter((s) => signalBySymbol.has(s));
    if (owned.length === 0) return; // keep the demo-derived defaultSlots

    const ownedSet = new Set(owned);
    const radar = [...signals]
      .filter((s) => !ownedSet.has(s.symbol))
      .sort((a, b) => b.score - a.score)
      .map((s) => s.symbol);
    setSlots([...owned, ...radar].slice(0, SLOT_COUNT));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeSlot(index: number, symbol: string) {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = symbol;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore storage failures */
      }
      return next;
    });
  }

  const allCollapsed = slots.length > 0 && slots.every((s) => collapsed.has(s));
  const toggleAll = () => setCollapsed(allCollapsed ? new Set() : new Set(slots));

  function resetSlots() {
    setSlots(defaultSlots);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  const ownedCount = holdings.length;
  const subtitle =
    ownedCount === 0
      ? 'No holdings yet - showing the strongest setups on the radar. Swap any panel to a ticker you care about.'
      : ownedCount >= SLOT_COUNT
        ? 'Your top holdings by amount invested · swap any panel to any ticker'
        : `Your ${ownedCount} holding${ownedCount > 1 ? 's' : ''} + top radar setups · swap any panel to any ticker`;

  return (
    <section className="terminal-panel overflow-hidden rounded-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">Holdings momentum</p>
          <p className="mt-1 text-xs text-ink-2">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1" role="group" aria-label="Chart indicators">
            {([
              ['bb', 'BB'],
              ['rsi', 'RSI'],
              ['macd', 'MACD'],
            ] as [keyof ChartIndicators, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleIndicator(key)}
                aria-pressed={indicators[key]}
                title={`Toggle ${label} on the live charts`}
                className={[
                  'min-h-[44px] rounded-cell border px-1.5 py-1 font-mono text-[10px] transition sm:min-h-0',
                  indicators[key]
                    ? 'border-accent bg-accent-tint/80 text-accent'
                    : 'border-line-strong bg-panel text-ink-3 hover:text-ink-title',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={toggleAll}
            title={allCollapsed ? 'Expand every holding' : 'Collapse every holding'}
            className="rounded-cell border border-line-strong bg-panel px-2 py-1 font-mono text-[11px] text-ink-2 transition hover:text-ink"
          >
            {allCollapsed ? 'Expand all' : 'Collapse all'}
          </button>
          <button
            type="button"
            onClick={resetSlots}
            className="rounded-cell border border-line-strong bg-panel px-2 py-1 font-mono text-[11px] text-ink-2 transition hover:text-ink"
          >
            Reset
          </button>
          <Link
            href="/portfolio"
            className="inline-flex items-center gap-1 rounded-cell border border-line-strong bg-panel px-2 py-1 text-xs text-ink-2 transition hover:text-ink"
          >
            Portfolio <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px bg-line">
        {slots.map((symbol, index) => {
          const signal = signalBySymbol.get(symbol);
          const holding = holdingBySymbol.get(symbol);
          if (!signal) return null;

          const owned = Boolean(holding);
          const isCollapsed = collapsed.has(symbol);

          return (
            <div className="bg-panel-deep p-3" key={`${index}-${symbol}`}>
              {/* Header: identity + slot picker + collapse */}
              <div className="flex items-start justify-between gap-2">
                <Link href={`/tickers/${signal.symbol}`} className="flex min-w-0 items-center gap-2">
                  <TickerLogo symbol={signal.symbol} companyName={signal.companyName} size={26} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 font-mono text-sm font-semibold text-ink">
                      {signal.symbol} <ArrowUpRight size={11} className="text-ink-3" />
                    </span>
                    <span className="block max-w-[120px] truncate text-[11px] text-ink-3 sm:max-w-[180px]">{signal.companyName}</span>
                  </span>
                </Link>
                <div className="flex shrink-0 items-center gap-1.5">
                  <label>
                    <span className="sr-only">Choose ticker for this panel</span>
                    <select
                      value={symbol}
                      onChange={(event) => changeSlot(index, event.target.value)}
                      className="min-h-[44px] max-w-[92px] rounded-cell border border-line-strong bg-panel px-1.5 py-1 font-mono text-[11px] text-ink-2 outline-none transition focus:ring-1 focus:ring-accent/40 sm:min-h-0"
                      aria-label="Choose ticker for this panel"
                    >
                      {options.map((option) => (
                        <option key={option.symbol} value={option.symbol} className="bg-panel text-ink-title">
                          {option.symbol}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => toggleCollapse(symbol)}
                    aria-expanded={!isCollapsed}
                    aria-label={isCollapsed ? `Expand ${signal.symbol}` : `Collapse ${signal.symbol}`}
                    title={isCollapsed ? `Expand ${signal.symbol}` : `Collapse ${signal.symbol}`}
                    className="grid h-7 w-7 place-items-center rounded-cell border border-line-strong bg-panel text-ink-3 transition hover:text-ink"
                  >
                    <ChevronDown size={14} className={`transition-transform ${isCollapsed ? '' : 'rotate-180'}`} />
                  </button>
                </div>
              </div>

              {/* Money / radar context + setup chips - compact values to fit one line */}
              <div className="mt-2 flex flex-wrap items-center gap-1 font-mono text-[10px]">
                {owned && holding ? (
                  <>
                    <span className="rounded border border-line-strong bg-panel px-1.5 py-0.5 text-ink-title" title={formatCurrency(holding.marketValue)}>
                      {formatCompactCurrency(holding.marketValue)}
                    </span>
                    <span className="rounded border border-line-strong bg-panel px-1.5 py-0.5 text-ink-3" title={`Spent ${formatCurrency(amountSpent(holding))}`}>
                      Spent {formatCompactCurrency(amountSpent(holding))}
                    </span>
                    <span className={`rounded border border-line-strong bg-panel px-1.5 py-0.5 ${toneClass(holding.unrealisedPnl)}`}>
                      {formatSignedPercent(holding.unrealisedPnlPercent)}
                    </span>
                  </>
                ) : (
                  <span className="rounded border border-line-strong bg-panel px-1.5 py-0.5 uppercase tracking-wide text-ink-3">
                    On radar · not held
                  </span>
                )}
                <span className="rounded border border-line-strong bg-panel px-1.5 py-0.5 text-accent">
                  Setup {signal.score} <span className={toneClass(signal.scoreDelta)}>{formatSignedNumber(signal.scoreDelta, 0)}</span>
                </span>
              </div>

              {/* Swipeable dossier: live chart -> setup -> intelligence, all keyed to the
                  selected ticker. Collapsed holdings hide this so the board stays scannable. */}
              {!isCollapsed && (
              <div className="mt-3">
                <PanelCarousel
                  slides={[
                    {
                      key: 'chart',
                      label: 'Chart',
                      color: 'blue',
                      node: (
                        <TradingViewChart
                          symbol={signal.symbol}
                          exchange={exchangeBySymbol.get(signal.symbol) ?? 'NASDAQ'}
                          companyName={signal.companyName}
                          height={300}
                          compact
                          indicators={indicators}
                        />
                      ),
                    },
                    {
                      key: 'setup',
                      label: 'Setup',
                      color: 'amber',
                      node: (
                        <HoldingSetupSlide signal={signal} holding={holding} ticker={tickerBySymbol.get(signal.symbol)} />
                      ),
                    },
                    {
                      key: 'intel',
                      label: 'Intel',
                      color: 'green',
                      node: <HoldingIntelSlide symbol={signal.symbol} />,
                    },
                  ]}
                />
              </div>
              )}

              <p className="mt-1 text-[11px] leading-snug text-ink-2">{readLine(signal.scoreDelta, signal.histDelta)}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
