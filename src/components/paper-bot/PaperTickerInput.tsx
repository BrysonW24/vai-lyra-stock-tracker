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
        setQuoteError('Connection error — check your network');
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
    hot: changeUp ? 'text-[#43d18b]' : 'text-[#ff6b6b]',
    moving: changeUp ? 'text-[#43d18b]' : 'text-[#ff8a5c]',
    calm: 'text-[#8190a0]',
  }[mood];
  const glowColor = {
    hot: changeUp ? 'shadow-[0_0_24px_rgba(67,209,139,0.15)]' : 'shadow-[0_0_24px_rgba(255,107,107,0.15)]',
    moving: changeUp ? 'shadow-[0_0_16px_rgba(67,209,139,0.08)]' : 'shadow-[0_0_16px_rgba(255,138,92,0.08)]',
    calm: '',
  }[mood];
  const borderGlow = {
    hot: changeUp ? 'border-[#1d4a35]' : 'border-[#4a1d1d]',
    moving: changeUp ? 'border-[#1d3a2d]' : 'border-[#3a2a1d]',
    calm: 'border-[#1d2d40]',
  }[mood];

  return (
    <div className="space-y-3">
      {/* Ticker search + qty row */}
      <div className="flex gap-2.5">
        {/* Search input */}
        <div className="relative flex-1">
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
            {quoteLoading
              ? <Loader2 size={14} className="animate-spin text-[#8aa2ff]" />
              : <Search size={14} className="text-[#4a5a6a]" />
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
            placeholder="Search — NVDA, AAPL, BHP…"
            spellCheck={false}
            autoCapitalize="characters"
            className="h-12 w-full rounded-xl border border-[#263241] bg-[#0a1018] pl-9 pr-3 font-mono text-[15px] font-bold text-[#dbe5ee] placeholder:font-normal placeholder:text-[#3a4a5a] outline-none focus:border-[#8aa2ff]/50 focus:ring-2 focus:ring-[#8aa2ff]/10 transition-all duration-200"
          />

          {/* Typeahead dropdown */}
          {showSuggestions && (
            <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-[#1e2d3d] bg-[#070b10] shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
              <div className="px-3 py-1.5 border-b border-[#111d28]">
                <span className="text-[9px] uppercase tracking-[0.12em] text-[#4a5a6a]">Scanned Universe</span>
              </div>
              {suggestions.slice(0, 7).map((s, i) => (
                <button
                  key={s.symbol}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); pickSuggestion(s.symbol); }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${i === activeIdx ? 'bg-[#0e1826]' : 'hover:bg-[#0b1520]'}`}
                >
                  <TickerLogo symbol={s.symbol} companyName={s.name} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[13px] font-bold text-[#eef3f8]">{s.symbol}</span>
                      <span className="truncate text-[10px] text-[#5e6b78]">{s.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#43d18b] animate-pulse" />
                    <span className="text-[8px] text-[#3a5a4a]">Live</span>
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
            className="h-12 w-20 rounded-xl border border-[#263241] bg-[#0a1018] px-2 text-center font-mono text-[15px] font-bold text-[#dbe5ee] outline-none focus:border-[#8aa2ff]/50 focus:ring-2 focus:ring-[#8aa2ff]/10 transition-all"
          />
          <span className="text-[9px] text-[#3a4a5a]">shares</span>
        </div>
      </div>

      {/* Live price card */}
      {(quoteLoading || quoteError || quote) && (
        <div className={`relative overflow-hidden rounded-2xl border transition-all duration-500 ${
          quote ? `${borderGlow} bg-[#070b10] ${glowColor}` : 'border-[#1a2230] bg-[#070b10]'
        }`}>

          {/* Subtle gradient sweep bg */}
          {quote && !quoteError && (
            <div className={`absolute inset-0 opacity-[0.04] ${
              changeUp ? 'bg-gradient-to-br from-[#43d18b] via-transparent to-transparent'
              : changeFlat ? 'bg-gradient-to-br from-[#8aa2ff] via-transparent to-transparent'
              : 'bg-gradient-to-br from-[#ff6b6b] via-transparent to-transparent'
            }`} />
          )}

          <div className="relative p-4">
            {/* Loading state */}
            {quoteLoading && (
              <div className="flex items-center gap-3 py-1">
                <div className="h-8 w-8 rounded-lg bg-[#111d28] animate-pulse" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-24 rounded bg-[#111d28] animate-pulse" />
                  <div className="h-2 w-16 rounded bg-[#0d1720] animate-pulse" />
                </div>
                <div className="h-7 w-20 rounded bg-[#111d28] animate-pulse" />
              </div>
            )}

            {/* Error state */}
            {!quoteLoading && quoteError && (
              <div className="flex items-center gap-2.5 py-1">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[#4a1d1d] bg-[#2b1214]">
                  <AlertCircle size={14} className="text-[#ff6b6b]" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#ff6b6b]">Ticker not found</p>
                  <p className="text-[10px] text-[#6f3a3a]">{quoteError}</p>
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
                      <span className="font-mono text-[16px] font-bold text-[#eef3f8]">{quote.symbol}</span>
                      {/* Live pulsing dot */}
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#43d18b] opacity-50" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#43d18b]" />
                      </span>
                    </div>
                    {quote.name && (
                      <p className="truncate text-[10px] text-[#5e6b78] max-w-[160px] leading-tight">{quote.name}</p>
                    )}
                    {quote.exchange && (
                      <p className="text-[9px] text-[#3a4a5a] leading-tight">{quote.exchange}</p>
                    )}
                  </div>
                  {/* Mood chip */}
                  <span className={`shrink-0 text-[10px] font-semibold ${moodColor}`}>{moodLabel}</span>
                </div>

                {/* Price hero */}
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.1em] text-[#4a5a6a] mb-0.5">Last Price</p>
                    <p className={`font-mono text-[32px] font-black leading-none tracking-tight transition-colors duration-300 ${
                      priceFlash
                        ? changeUp ? 'text-[#43d18b]' : changeFlat ? 'text-[#eef3f8]' : 'text-[#ff6b6b]'
                        : 'text-[#eef3f8]'
                    }`}>
                      {quote.currency === 'AUD' ? 'A$' : '$'}{quote.price?.toFixed(2)}
                    </p>
                  </div>
                  {/* Change badge */}
                  <div className={`flex flex-col items-end gap-1`}>
                    <div className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 ${
                      changeFlat
                        ? 'bg-[#1a2535] text-[#8190a0]'
                        : changeUp
                        ? 'bg-[#0a2218] text-[#43d18b]'
                        : 'bg-[#220a0a] text-[#ff6b6b]'
                    }`}>
                      {changeFlat ? <Minus size={12} /> : changeUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      <span className="font-mono text-[13px] font-bold">
                        {changeUp ? '+' : ''}{changePct.toFixed(2)}%
                      </span>
                    </div>
                    <span className="text-[9px] text-[#3a4a5a]">today vs close</span>
                  </div>
                </div>

                {/* Change bar (visual indicator of today's move magnitude) */}
                <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-[#0d141c]">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      changeUp ? 'bg-gradient-to-r from-[#1d7f55] to-[#43d18b]'
                      : changeFlat ? 'bg-[#2a3a4a]'
                      : 'bg-gradient-to-r from-[#7f1d1d] to-[#ff6b6b]'
                    }`}
                    style={{ width: `${Math.min(100, absPct * 15)}%` }}
                  />
                </div>

                {/* Order value summary */}
                <div className="flex items-center justify-between rounded-xl border border-[#111d28] bg-[#040710] px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="grid h-7 w-7 place-items-center rounded-lg border border-[#8aa2ff]/20 bg-[#0d1730]">
                      <Zap size={13} className="text-[#8aa2ff]" />
                    </div>
                    <div>
                      <p className="text-[8px] uppercase tracking-[0.1em] text-[#4a5a6a]">Order Value</p>
                      <p className="font-mono text-[17px] font-black text-[#eef3f8] leading-tight">
                        {quote.currency === 'AUD' ? 'A$' : '$'}{estimatedValue?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] uppercase tracking-[0.1em] text-[#4a5a6a]">Calc</p>
                    <p className="font-mono text-[11px] text-[#5e6b78]">
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
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[#1a2535] px-4 py-5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#1d3a5a] bg-[#0b1626]">
            <Search size={16} className="text-[#2a4a6a]" />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-[#2a3a4a]">Search a ticker above</p>
            <p className="text-[10px] text-[#1e2a38]">Live price · logo · order value — all auto-calculated</p>
          </div>
        </div>
      )}
    </div>
  );
}
