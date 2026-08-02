'use client';

import { useState } from 'react';
import { tickerLogoUrl } from '@/lib/ticker-logos';

/**
 * Glass Radar Orb - a premium glassmorphism radar with company logos orbiting
 * a central glass core. The orbit ring rotates smoothly; each node counter-rotates
 * so logos and labels stay upright (never upside-down) and follow a clean circular
 * path. Logos render in a solid white tile so real brand favicons read clearly.
 */

function OrbitLogo({ symbol }: { symbol: string }) {
  const [errored, setErrored] = useState(false);
  const src = tickerLogoUrl(symbol, 28);

  function hue(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
    return Math.abs(h) % 360;
  }

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Solid white logo tile is functional, not decorative: real brand favicons need a
          neutral white ground to read clearly on the dark orb. */}
      <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-ink/20 bg-white shadow-[0_8px_22px_-8px_rgba(0,0,0,0.8)]">
        {src && !errored ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={symbol}
            width={28}
            height={28}
            className="h-7 w-7 object-contain"
            onError={() => setErrored(true)}
          />
        ) : (
          <span
            className="grid h-full w-full place-items-center font-mono text-sm font-bold text-white"
            style={{ backgroundColor: `hsl(${hue(symbol)}, 60%, 38%)` }}
          >
            {symbol.charAt(0)}
          </span>
        )}
      </div>
      <span className="rounded-cell bg-chrome/85 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-tight text-ink">
        {symbol}
      </span>
    </div>
  );
}

export function GlassRadarOrb() {
  const tickers = ['NVDA', 'AMD', 'MSFT', 'AAPL', 'META', 'GOOGL'];
  const radius = 132;
  const orbitSeconds = 28;

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="relative h-[340px] w-[340px]">
        {/* Glass backdrop: rings, glow, glass core, sweep */}
        <svg viewBox="0 0 340 340" className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            {/* Artistic glass-core gradient; every base stop resolves a design token. */}
            <radialGradient id="orbCore" cx="50%" cy="42%" r="60%">
              <stop offset="0%" style={{ stopColor: 'var(--lyra-blue-focus)' }} stopOpacity="0.28" />
              <stop offset="55%" style={{ stopColor: 'var(--lyra-blue-deep)' }} stopOpacity="0.10" />
              <stop offset="100%" style={{ stopColor: 'var(--lyra-panel-deep)' }} stopOpacity="0.0" />
            </radialGradient>
            <linearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" style={{ stopColor: 'var(--lyra-blue-focus)' }} stopOpacity="0" />
              <stop offset="100%" style={{ stopColor: 'var(--lyra-blue-focus)' }} stopOpacity="0.5" />
            </linearGradient>
            <filter id="orbGlow">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle cx="170" cy="170" r="132" fill="none" className="stroke-line-strong" strokeWidth="1" opacity="0.35" />
          <circle cx="170" cy="170" r="96" fill="none" className="stroke-line" strokeWidth="1" opacity="0.5" />
          <circle cx="170" cy="170" r="60" fill="none" className="stroke-line" strokeWidth="1" opacity="0.6" />

          <g className="radar-sweep" style={{ transformOrigin: '170px 170px', animation: `radarSweepSpin ${orbitSeconds / 2}s linear infinite` }}>
            <path d="M170 170 L170 38 A132 132 0 0 1 268 96 Z" fill="url(#sweepGrad)" opacity="0.18" />
            <line x1="170" y1="170" x2="170" y2="40" className="stroke-blue-focus" strokeWidth="1.5" opacity="0.7" filter="url(#orbGlow)" />
          </g>

          <circle cx="170" cy="170" r="58" fill="url(#orbCore)" className="stroke-blue-focus" strokeWidth="1" opacity="0.55" />
          {/* Faint white rim = the glass highlight (artistic allowance). */}
          <circle cx="170" cy="170" r="58" fill="none" stroke="white" strokeWidth="0.5" opacity="0.06" />
          <circle cx="170" cy="170" r="6" className="fill-blue-focus" opacity="0.9" filter="url(#orbGlow)" />
        </svg>

        {/* Orbiting logo nodes (HTML overlay; counter-rotated to stay upright) */}
        <div
          className="orbit-rotor absolute inset-0"
          style={{ animation: `orbitSpinFwd ${orbitSeconds}s linear infinite` }}
        >
          {tickers.map((ticker, i) => {
            const angle = (i / tickers.length) * 360;
            return (
              <div
                key={ticker}
                className="absolute left-1/2 top-1/2 h-0 w-0"
                style={{ transform: `rotate(${angle}deg) translateY(-${radius}px) rotate(${-angle}deg)` }}
              >
                <div
                  className="orbit-counter"
                  // Pivot the counter-rotation at the ring point (where the logo's
                  // centre sits via the -translate below), not the box centre -
                  // otherwise each logo orbits a small epicycle and drifts off-ring.
                  style={{ animation: `orbitSpinRev ${orbitSeconds}s linear infinite`, transformOrigin: '0 0' }}
                >
                  <div className="-translate-x-1/2 -translate-y-1/2">
                    <OrbitLogo symbol={ticker} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
