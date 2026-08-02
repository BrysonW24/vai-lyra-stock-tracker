'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Loader2, TrendingUp, TrendingDown, Minus, AlertCircle, Zap } from 'lucide-react';
import { searchUniverse } from '@/lib/universe';
import { TickerLogo } from '@/components/TickerLogo';

export interface MarketQuote {
  valid: boolean;
  symbol: string;
  name: string | null;
  price: number | null;
  currency: string | null;
  exchange: string | null;
  changePercent: number | null;
  error?: string;
}

interface PaperTickerInputProps {
  symbol: string;
  quantity: number;
  onSymbolChange: (symbol: string) => void;
  onQuantityChange: (qty: number) => void;
  onQuoteResolved: (quote: MarketQuote | null) => void;
}

/**
 * Premium ticker input for the Paper Bot propose form.
 * Search + logo + live price card + animated order preview.
 */
export function PaperTickerInput({
  symbol,
  quantity,
  onSymbolChange,
  onQuantityChange,
  onQuoteResolved,
}: PaperTickerInputProps) {
  const [input, setInput] = useState(symbol);
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [priceFlash, setPriceFlash] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = input.trim().toUpperCase();
  const suggestions = useMemo(() => searchUniverse(query), [query]);
  const showSuggestions = focused && query.length > 0 && suggestions.length > 0;

  // Debounced quote fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query) {
      setQuote(null);
      setQuoteError(null);
      onQuoteResolved(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setQuoteLoading(true);
      setQuoteError(null);
      try {
        const res = await fetch(`/api/ticker-lookup?symbol=${encodeURIComponent(query)}`);
        const data = (await res.json()) as MarketQuote;
        if (data.valid) {
          setQuote(data);
          setQuoteError(null);
          onQuoteResolved(data);
          onSymbolChange(data.symbol);
          setInput(data.symbol);
          // Flash animation on new price
          setPriceFlash(true);
          setTimeout(() => setPriceFlash(false), 600);
        } else {
          setQuote(null);
          setQuoteError(data.error ?? `No market data for ${query}`);
          onQuoteResolved(null);
        }
      } catch {
        setQuoteError('Connection error - check your network');
        onQuoteResolved(null);
      } finally {
        setQuoteLoading(false);
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => { setActiveIdx(-1); }, [query]);

  function pickSuggestion(sym: string) {
    const upper = sym.toUpperCase();
    setInput(upper);
    onSymbolChange(upper);
    setFocused(false);
    setActiveIdx(-1);
  }

  const estimatedValue = quote?.price != null ? quote.price * quantity : null;
  const changeUp = (quote?.changePercent ?? 0) > 0;
  const changeFlat = quote?.changePercent === 0 || quote?.changePercent === null;
  const changePct = quote?.changePercent ?? 0;
  const absPct = Math.abs(changePct);

  // Market mood: 0-2% = calm, 2-4% = moving, 4%+ = hot
  const mood = absPct >= 4 ? 'hot' : absPct >= 2 ? 'moving' : 'calm';
  const moodLabel = { hot: '🔥 Moving fast', moving: '⚡ Active', calm: '◉ Steady' }[mood];
  const moodColor = {
    hot: changeUp ? 'text-positive' : 'text-negative',
    moving: changeUp ? 'text-positive' : 'text-accent',
    calm: 'text-ink-3',
  }[mood];
  // Glow shadows stay literal rgba (alpha mixes, P0 precedent) - byte-aligned to positive/negative/accent.
  const glowColor = {
    hot: changeUp ? 'shadow-[0_0_24px_rgba(67,209,139,0.15)]' : 'shadow-[0_0_24px_rgba(255,107,107,0.15)]',
    moving: changeUp ? 'shadow-[0_0_16px_rgba(67,209,139,0.08)]' : 'shadow-[0_0_16px_rgba(243,163,58,0.08)]',
    calm: '',
  }[mood];
  const borderGlow = {
    hot: changeUp ? 'border-positive/40' : 'border-negative/30',
    moving: changeUp ? 'border-positive/30' : 'border-accent-border/40',
    calm: 'border-line-strong',
  }[mood];

  return (
    <div className="space-y-3">
      {/* Ticker search + qty row */}
      <div className="flex gap-2.5">
        {/* Search input */}
        <div className="relative flex-1">
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
            {quoteLoading
              ? <Loader2 size={14} className="animate-spin text-pending" />
              : <Search size={14} className="text-ink-dim" />
            }
          </div>
          <input
            value={input}
            onChange={(e) => {
              const v = e.target.value.toUpperCase();
              setInput(v);
              onSymbolChange(v);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && showSuggestions) { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
              else if (e.key === 'ArrowUp' && showSuggestions) { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
              else if (e.key === 'Enter' && showSuggestions && activeIdx >= 0) { e.preventDefault(); pickSuggestion(suggestions[activeIdx].symbol); }
              else if (e.key === 'Escape') setFocused(false);
            }}
            placeholder="Search - NVDA, AAPL, BHP…"
            spellCheck={false}
            autoCapitalize="characters"
            className="h-12 w-full rounded-cell border border-line-strong bg-well pl-9 pr-3 font-mono text-[15px] font-bold text-ink-title placeholder:font-normal placeholder:text-ink-dim/80 outline-none focus:border-blue-focus/50 focus:ring-2 focus:ring-blue-focus/10 transition-all duration-200"
          />

          {/* Typeahead dropdown */}
          {showSuggestions && (
            <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-panel border border-line-strong bg-well shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
              <div className="px-3 py-1.5 border-b border-line/70">
                <span className="text-[9px] uppercase tracking-[0.12em] text-ink-dim">Scanned Universe</span>
              </div>
              {suggestions.slice(0, 7).map((s, i) => (
                <button
                  key={s.symbol}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); pickSuggestion(s.symbol); }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${i === activeIdx ? 'bg-blue-tint' : 'hover:bg-panel'}`}
                >
                  <TickerLogo symbol={s.symbol} companyName={s.name} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[13px] font-bold text-ink">{s.symbol}</span>
                      <span className="truncate text-[10px] text-ink-dim">{s.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-positive animate-pulse" />
                    <span className="text-[8px] text-positive/50">Live</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quantity pill */}
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <input
            type="number"
            value={quantity}
            min={1}
            onChange={(e) => onQuantityChange(Math.max(1, Number(e.target.value) || 1))}
            className="h-12 w-20 rounded-cell border border-line-strong bg-well px-2 text-center font-mono text-[15px] font-bold tabular-nums text-ink-title outline-none focus:border-blue-focus/50 focus:ring-2 focus:ring-blue-focus/10 transition-all"
          />
          <span className="text-[9px] text-ink-dim/80">shares</span>
        </div>
      </div>

      {/* Live price card */}
      {(quoteLoading || quoteError || quote) && (
        <div className={`relative overflow-hidden rounded-panel border transition-all duration-500 ${
          quote ? `${borderGlow} bg-well ${glowColor}` : 'border-line bg-well'
        }`}>

          {/* Subtle gradient sweep bg (4% mood tint, not a CTA gradient) */}
          {quote && !quoteError && (
            <div className={`absolute inset-0 opacity-[0.04] ${
              changeUp ? 'bg-gradient-to-br from-positive via-transparent to-transparent'
              : changeFlat ? 'bg-gradient-to-br from-pending via-transparent to-transparent'
              : 'bg-gradient-to-br from-negative via-transparent to-transparent'
            }`} />
          )}

          <div className="relative p-4">
            {/* Loading state */}
            {quoteLoading && (
              <div className="flex items-center gap-3 py-1">
                <div className="h-8 w-8 rounded-cell bg-line/70 animate-pulse" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-24 rounded bg-line/70 animate-pulse" />
                  <div className="h-2 w-16 rounded bg-line/50 animate-pulse" />
                </div>
                <div className="h-7 w-20 rounded bg-line/70 animate-pulse" />
              </div>
            )}

            {/* Error state */}
            {!quoteLoading && quoteError && (
              <div className="flex items-center gap-2.5 py-1">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-cell border border-negative/30 bg-negative/10">
                  <AlertCircle size={14} className="text-negative" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-negative">Ticker not found</p>
                  <p className="text-[10px] text-negative/50">{quoteError}</p>
                </div>
              </div>
            )}

            {/* Quote loaded */}
            {!quoteLoading && quote && (
              <>
                {/* Top row: logo + name + live dot + mood */}
                <div className="flex items-center gap-3 mb-3">
                  <TickerLogo symbol={quote.symbol} companyName={quote.name ?? undefined} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[16px] font-bold text-ink">{quote.symbol}</span>
                      {/* Live pulsing dot */}
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-50" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-positive" />
                      </span>
                    </div>
                    {quote.name && (
                      <p className="truncate text-[10px] text-ink-dim max-w-[160px] leading-tight">{quote.name}</p>
                    )}
                    {quote.exchange && (
                      <p className="text-[9px] text-ink-dim/80 leading-tight">{quote.exchange}</p>
                    )}
                  </div>
                  {/* Mood chip */}
                  <span className={`shrink-0 text-[10px] font-semibold ${moodColor}`}>{moodLabel}</span>
                </div>

                {/* Price hero */}
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.1em] text-ink-dim mb-0.5">Last Price</p>
                    <p className={`font-mono text-[32px] font-black leading-none tracking-tight tabular-nums transition-colors duration-300 ${
                      priceFlash
                        ? changeUp ? 'text-positive' : changeFlat ? 'text-ink' : 'text-negative'
                        : 'text-ink'
                    }`}>
                      {quote.currency === 'AUD' ? 'A$' : '$'}{quote.price?.toFixed(2)}
                    </p>
                  </div>
                  {/* Change badge */}
                  <div className={`flex flex-col items-end gap-1`}>
                    <div className={`inline-flex items-center gap-1.5 rounded-cell px-3 py-1.5 ${
                      changeFlat
                        ? 'bg-line text-ink-3'
                        : changeUp
                        ? 'bg-positive-tint text-positive'
                        : 'bg-negative/10 text-negative'
                    }`}>
                      {changeFlat ? <Minus size={12} /> : changeUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      <span className="font-mono text-[13px] font-bold tabular-nums">
                        {changeUp ? '+' : ''}{changePct.toFixed(2)}%
                      </span>
                    </div>
                    <span className="text-[9px] text-ink-dim/80">today vs close</span>
                  </div>
                </div>

                {/* Change bar (visual indicator of today's move magnitude) */}
                <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-panel">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      changeUp ? 'bg-gradient-to-r from-positive/50 to-positive'
                      : changeFlat ? 'bg-line-strong'
                      : 'bg-gradient-to-r from-negative/50 to-negative'
                    }`}
                    style={{ width: `${Math.min(100, absPct * 15)}%` }}
                  />
                </div>

                {/* Order value summary */}
                <div className="flex items-center justify-between rounded-cell border border-line/70 bg-ground px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="grid h-7 w-7 place-items-center rounded-cell border border-pending/20 bg-blue-tint">
                      <Zap size={13} className="text-pending" />
                    </div>
                    <div>
                      <p className="text-[8px] uppercase tracking-[0.1em] text-ink-dim">Order Value</p>
                      <p className="font-mono text-[17px] font-black tabular-nums text-ink leading-tight">
                        {quote.currency === 'AUD' ? 'A$' : '$'}{estimatedValue?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] uppercase tracking-[0.1em] text-ink-dim">Calc</p>
                    <p className="font-mono text-[11px] tabular-nums text-ink-dim">
                      {quote.currency === 'AUD' ? 'A$' : '$'}{quote.price?.toFixed(2)} × {quantity}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Placeholder when nothing typed yet */}
      {!quoteLoading && !quoteError && !quote && (
        <div className="flex items-center gap-3 rounded-panel border border-dashed border-line px-4 py-5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-cell border border-blue-focus/40 bg-blue-tint/60">
            <Search size={16} className="text-blue-focus/40" />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-ink-dim/60">Search a ticker above</p>
            <p className="text-[10px] text-ink-dim/50">Live price · logo · order value - all auto-calculated</p>
          </div>
        </div>
      )}
    </div>
  );
}
