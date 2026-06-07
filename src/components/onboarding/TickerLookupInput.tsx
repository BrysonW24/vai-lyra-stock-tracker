'use client';

import { useMemo, useState } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import { searchUniverse } from '@/lib/universe';

export interface TickerLookup {
  valid: boolean;
  symbol: string;
  name?: string | null;
  price?: number | null;
  currency?: string | null;
  exchange?: string | null;
  changePercent?: number | null;
  error?: string;
}

interface TickerLookupInputProps {
  /** Called with the validated, live-fetched ticker when the user adds one. */
  onAdd: (result: TickerLookup) => void;
  /** Symbols already added, to block duplicates. */
  existing?: string[];
  placeholder?: string;
  /** Button label - e.g. "Add" / "Add holding". */
  ctaLabel?: string;
}

/**
 * Ticker entry with type-ahead: as the user types we suggest matches from Lyra's
 * scanned universe (one tap to add). Anything not in that list still works - they
 * type the exact symbol and /api/ticker-lookup fetches it live (US or ASX). The
 * real company name + price are confirmed before it is added.
 */
export function TickerLookupInput({
  onAdd,
  existing = [],
  placeholder = 'Search or type a ticker - NVDA, CBA, BHP.AX...',
  ctaLabel = 'Add',
}: TickerLookupInputProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const query = input.trim();
  const suggestions = useMemo(() => searchUniverse(query), [query]);
  const showSuggestions = focused && query.length > 0 && suggestions.length > 0;
  const showFetchHint = focused && query.length >= 1 && suggestions.length === 0;

  const submit = async (symbolOverride?: string) => {
    const sym = (symbolOverride ?? input).toUpperCase().trim();
    if (!sym || loading) return;
    setError(null);
    setLoading(true);
    setFocused(false);
    try {
      const res = await fetch(`/api/ticker-lookup?symbol=${encodeURIComponent(sym)}`);
      const data = (await res.json()) as TickerLookup;
      if (!data.valid) {
        setError(data.error ?? `Couldn't find ${sym}.`);
        return;
      }
      if (existing.includes(data.symbol)) {
        setError(`${data.symbol} is already added.`);
        return;
      }
      onAdd(data);
      setInput('');
    } catch {
      setError('Lookup failed - check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5d6b79]" />
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value.toUpperCase());
              if (error) setError(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            placeholder={placeholder}
            className="h-9 w-full rounded-md border border-[#263241] bg-[#0d141c] pl-8 pr-3 font-mono text-[13px] text-[#dbe5ee] placeholder:text-[#5d6b79] outline-none focus:border-[#f3a33a]/50"
          />

          {/* Type-ahead suggestions from the scanned universe */}
          {showSuggestions && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-[#2c3a4a] bg-[#0d1117] shadow-2xl ring-1 ring-black/40">
              {suggestions.map((s) => (
                <button
                  key={s.symbol}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    submit(s.symbol);
                  }}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition hover:bg-[#151c25]"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#43d18b]" title="Scanned hourly" />
                  <span className="font-mono text-[13px] font-semibold text-[#eef3f8]">{s.symbol}</span>
                  <span className="truncate text-[11px] text-[#8190a0]">{s.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => submit()}
          disabled={loading || !input.trim()}
          className="inline-flex min-w-[60px] items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-[#3b5bdb] via-[#43d18b] to-[#f3a33a] px-3 text-xs font-semibold text-[#07090c] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : ctaLabel}
        </button>
      </div>

      {error ? (
        <p className="flex items-center gap-1 text-[11px] text-[#ff6b6b]">
          <X size={12} className="shrink-0" /> {error}
        </p>
      ) : showFetchHint ? (
        <p className="text-[11px] text-[#5d6b79]">Not in our scanned list - press Add and we&apos;ll fetch it live by exact ticker.</p>
      ) : null}
    </div>
  );
}
