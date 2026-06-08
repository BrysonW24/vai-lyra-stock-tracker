'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { PortfolioHolding, SignalRow, TickerSetting } from '@/types/scanner';
import { TickerLogo } from '@/components/TickerLogo';
import { TradingViewChart } from '@/components/TradingViewChart';
import { PanelCarousel } from '@/components/PanelCarousel';
import { HoldingSetupSlide } from '@/components/HoldingSetupSlide';
import { HoldingIntelSlide } from '@/components/HoldingIntelSlide';
import { formatCurrency, formatSignedNumber, formatSignedPercent, toneClass } from '@/lib/format';
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

  // RSI + MACD overlay the live charts by default; the user can switch to clean candles.
  const [showIndicators, setShowIndicators] = useState(true);
  // Persist the indicators preference so it never resets between sessions (default on).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('lyra.chartIndicators');
      if (saved !== null) setShowIndicators(saved === 'true');
    } catch {
      /* ignore */
    }
  }, []);

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
    <section className="terminal-panel overflow-hidden rounded-md">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1b2530] px-3 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Holdings momentum</p>
          <p className="mt-1 text-xs text-[#a8b5c2]">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setShowIndicators((value) => {
                const next = !value;
                try {
                  window.localStorage.setItem('lyra.chartIndicators', String(next));
                } catch {
                  /* ignore */
                }
                return next;
              })
            }
            aria-pressed={showIndicators}
            title="Toggle RSI + MACD on the live charts"
            className={[
              'rounded border px-2 py-1 font-mono text-[11px] transition',
              showIndicators
                ? 'border-[#f3a33a] bg-[#23180b] text-[#f3a33a]'
                : 'border-[#263241] bg-[#0d141c] text-[#a8b5c2] hover:text-[#eef3f8]',
            ].join(' ')}
          >
            Indicators {showIndicators ? 'on' : 'off'}
          </button>
          <button
            type="button"
            onClick={resetSlots}
            className="rounded border border-[#263241] bg-[#0d141c] px-2 py-1 font-mono text-[11px] text-[#a8b5c2] transition hover:text-[#eef3f8]"
          >
            Reset
          </button>
          <Link
            href="/portfolio"
            className="inline-flex items-center gap-1 rounded border border-[#263241] bg-[#0d141c] px-2 py-1 text-xs text-[#a8b5c2] transition hover:text-[#eef3f8]"
          >
            Portfolio <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px bg-[#1b2530]">
        {slots.map((symbol, index) => {
          const signal = signalBySymbol.get(symbol);
          const holding = holdingBySymbol.get(symbol);
          if (!signal) return null;

          const owned = Boolean(holding);

          return (
            <div className="bg-[#0d1117] p-3" key={`${index}-${symbol}`}>
              {/* Header: identity + slot picker */}
              <div className="flex items-start justify-between gap-2">
                <Link href={`/tickers/${signal.symbol}`} className="flex min-w-0 items-center gap-2">
                  <TickerLogo symbol={signal.symbol} companyName={signal.companyName} size={26} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 font-mono text-sm font-semibold text-[#eef3f8]">
                      {signal.symbol} <ArrowUpRight size={11} className="text-[#8190a0]" />
                    </span>
                    <span className="block max-w-[120px] truncate text-[11px] text-[#8190a0] sm:max-w-[180px]">{signal.companyName}</span>
                  </span>
                </Link>
                <label className="shrink-0">
                  <span className="sr-only">Choose ticker for this panel</span>
                  <select
                    value={symbol}
                    onChange={(event) => changeSlot(index, event.target.value)}
                    className="max-w-[92px] rounded border border-[#263241] bg-[#0d141c] px-1.5 py-1 font-mono text-[11px] text-[#a8b5c2] outline-none transition focus:ring-1 focus:ring-[#f3a33a]/40"
                    aria-label="Choose ticker for this panel"
                  >
                    {options.map((option) => (
                      <option key={option.symbol} value={option.symbol} className="bg-[#0d141c] text-[#dbe5ee]">
                        {option.symbol}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Money / radar context + setup chips */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                {owned && holding ? (
                  <>
                    <span className="rounded border border-[#263241] bg-[#0d141c] px-2 py-0.5 text-[#dbe5ee]">
                      {formatCurrency(holding.marketValue)}
                    </span>
                    <span className="rounded border border-[#263241] bg-[#0d141c] px-2 py-0.5 text-[#8190a0]">
                      Spent {formatCurrency(amountSpent(holding))}
                    </span>
                    <span className={`rounded border border-[#263241] bg-[#0d141c] px-2 py-0.5 ${toneClass(holding.unrealisedPnl)}`}>
                      {formatSignedPercent(holding.unrealisedPnlPercent)}
                    </span>
                  </>
                ) : (
                  <span className="rounded border border-[#263241] bg-[#0d141c] px-2 py-0.5 uppercase tracking-wide text-[#8190a0]">
                    On radar · not held
                  </span>
                )}
                <span className="rounded border border-[#263241] bg-[#0d141c] px-2 py-0.5 text-[#f3a33a]">
                  Setup {signal.score}/100 <span className={toneClass(signal.scoreDelta)}>{formatSignedNumber(signal.scoreDelta, 0)}</span>
                </span>
              </div>

              {/* Swipeable dossier: live chart -> setup -> intelligence, all keyed to the
                  selected ticker. Live chart shows real history/trend; the dossier slides
                  surface the backend setup read and ticker-tagged intelligence. */}
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
                          showIndicators={showIndicators}
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

              <p className="mt-1 text-[11px] leading-snug text-[#a8b5c2]">{readLine(signal.scoreDelta, signal.histDelta)}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
