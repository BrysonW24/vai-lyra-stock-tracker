'use client';

import { useEffect, useState } from 'react';
import { tickerLogoSources } from '@/lib/ticker-logos';

interface TickerLogoProps {
  symbol: string;
  companyName?: string;
  size?: number;
}

function hueFromString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash &= hash;
  }
  return Math.abs(hash) % 360;
}

/**
 * Company logo for a ticker - the single component every surface uses (tables, drawers,
 * watchlist, onboarding). Resolves through the shared logo router (override -> favicon)
 * and walks the source list on error, finally falling back to a deterministic coloured
 * letter badge. Logos render on a contrast-safe light chip so dark marks (e.g. AMD's)
 * stay visible against the dark theme.
 */
export function TickerLogo({ symbol, companyName, size = 18 }: TickerLogoProps) {
  const sources = tickerLogoSources(symbol, size);
  const [idx, setIdx] = useState(0);

  // Reset to the best source whenever the symbol changes (rows recycle in long lists).
  useEffect(() => {
    setIdx(0);
  }, [symbol]);

  const dim = `${size}px`;
  const exhausted = idx >= sources.length;

  if (exhausted) {
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

  const inner = Math.round(size * 0.82);

  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded border border-[#263241] bg-white"
      style={{ width: dim, height: dim }}
      title={companyName ?? symbol}
      aria-label={companyName ?? symbol}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- logos load from arbitrary brand hosts
          with a runtime fallback chain; next/image can't allow-list every ticker's domain. */}
      <img
        src={sources[idx]}
        alt={companyName ?? symbol}
        width={inner}
        height={inner}
        loading="lazy"
        className="object-contain"
        style={{ width: `${inner}px`, height: `${inner}px` }}
        onError={() => setIdx((current) => current + 1)}
      />
    </span>
  );
}
