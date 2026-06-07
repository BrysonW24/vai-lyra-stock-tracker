'use client';

import { useState } from 'react';
import { tickerDomain } from '@/lib/ticker-logos';

interface TickerLogoProps {
  symbol: string;
  companyName?: string;
  size?: number;
}

/**
 * Small, table-friendly company logo. Logo-first via favicon with a deterministic
 * coloured letter-badge fallback when the domain is unknown or the image fails.
 * Keeps dense tables scannable while staying on the dark glass theme.
 */
export function TickerLogo({ symbol, companyName, size = 18 }: TickerLogoProps) {
  const [errored, setErrored] = useState(false);
  const domain = tickerDomain(symbol);
  const dim = `${size}px`;

  function hueFromString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash &= hash;
    }
    return Math.abs(hash) % 360;
  }

  if (!domain || errored) {
    return (
      <span
        className="grid shrink-0 place-items-center rounded border border-[#263241] font-mono font-semibold text-white"
        style={{ width: dim, height: dim, backgroundColor: `hsl(${hueFromString(symbol)}, 55%, 32%)`, fontSize: `${Math.round(size * 0.5)}px` }}
        title={companyName ?? symbol}
        aria-label={companyName ?? symbol}
      >
        {symbol.charAt(0)}
      </span>
    );
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`}
      alt={companyName ?? symbol}
      title={companyName ?? symbol}
      width={size}
      height={size}
      className="shrink-0 rounded border border-[#263241] bg-[#0d141c]"
      style={{ width: dim, height: dim }}
      onError={() => setErrored(true)}
    />
  );
}
