'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { searchUniverse } from '@/lib/universe';
import { TickerLogo } from '@/components/TickerLogo';

/**
 * Header ticker quick-search - a REAL control, not the old decorative "Search: NVDA" label
 * that looked interactive and did nothing (the 2026-07-27 audit V3 fix). Type a ticker, pick a
 * match, land on its detail page. Suggestions come from the scanned universe so the obvious
 * pick is one tap; an off-universe symbol still routes (the ticker page owns the honest
 * "not scanned yet" state rather than a bare 404).
 */
export function TickerQuickSearch() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const query = value.trim();
  const suggestions = useMemo(() => searchUniverse(query, 6), [query]);
  const showSuggestions = focused && query.length > 0 && suggestions.length > 0;

  function go(symbol: string) {
    const clean = symbol
      .trim()
      .toUpperCase()
      .replace(/^\$/, '')
      .replace(/\.(AX|US|NYSE|NASDAQ)$/i, '');
    if (!clean) return;
    setValue('');
    setFocused(false);
    setActiveIdx(-1);
    inputRef.current?.blur();
    router.push(`/tickers/${clean}`);
  }

  return (
    <div className="relative flex min-w-0 flex-1 items-center lg:max-w-[380px]">
      <div className="flex w-full items-center gap-1.5 rounded-cell border border-line-strong bg-panel px-2.5 py-1.5 focus-within:border-blue-focus/50 focus-within:ring-1 focus-within:ring-blue-focus/30 transition-all">
        <Search size={14} className="shrink-0 text-ink-3" />
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          autoComplete="off"
          aria-label="Search a ticker"
          placeholder="Search a ticker - e.g. NVDA"
          value={value}
          onChange={(e) => {
            setValue(e.target.value.toUpperCase());
            setActiveIdx(-1);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && showSuggestions) {
              e.preventDefault();
              setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
            } else if (e.key === 'ArrowUp' && showSuggestions) {
              e.preventDefault();
              setActiveIdx((i) => Math.max(i - 1, -1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (showSuggestions && activeIdx >= 0) go(suggestions[activeIdx].symbol);
              else if (query.length > 0) go(query);
            } else if (e.key === 'Escape') {
              setFocused(false);
              inputRef.current?.blur();
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-xs text-ink-title placeholder:text-ink-3 outline-none"
        />
      </div>

      {showSuggestions && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-panel border border-line-strong bg-well shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
          {suggestions.map((s, i) => (
            <button
              key={s.symbol}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                go(s.symbol);
              }}
              onMouseEnter={() => setActiveIdx(i)}
              className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors ${
                i === activeIdx ? 'bg-blue-tint' : 'hover:bg-panel'
              }`}
            >
              <TickerLogo symbol={s.symbol} companyName={s.name} size={20} />
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="font-mono text-[12px] font-bold text-ink">{s.symbol}</span>
                <span className="truncate text-[9px] text-ink-dim">{s.name}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
