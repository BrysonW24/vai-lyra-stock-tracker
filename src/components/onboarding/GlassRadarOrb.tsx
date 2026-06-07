'use client';

import { useState } from 'react';
import { tickerDomain } from '@/lib/ticker-logos';

/**
 * Glass Radar Orb - a premium glassmorphism radar with company logos orbiting
 * a central glass core. The orbit ring rotates smoothly; each node counter-rotates
 * so logos and labels stay upright (never upside-down) and follow a clean circular
 * path. Logos render in a solid white tile so real brand favicons read clearly.
 */

function OrbitLogo({ symbol }: { symbol: string }) {
  const [errored, setErrored] = useState(false);
  const domain = tickerDomain(symbol);

  function hue(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
    return Math.abs(h) % 360;
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-white/20 bg-white shadow-[0_8px_22px_-8px_rgba(0,0,0,0.8)]">
        {domain && !errored ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
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
      <span className="rounded bg-[#0b1016]/85 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-tight text-[#eef3f8]">
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
            <radialGradient id="orbCore" cx="50%" cy="42%" r="60%">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.28" />
              <stop offset="55%" stopColor="#3b5bdb" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#0d1117" stopOpacity="0.0" />
            </radialGradient>
            <linearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.5" />
            </linearGradient>
            <filter id="orbGlow">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle cx="170" cy="170" r="132" fill="none" stroke="#263241" strokeWidth="1" opacity="0.35" />
          <circle cx="170" cy="170" r="96" fill="none" stroke="#1b2530" strokeWidth="1" opacity="0.5" />
          <circle cx="170" cy="170" r="60" fill="none" stroke="#1b2530" strokeWidth="1" opacity="0.6" />

          <g className="radar-sweep" style={{ transformOrigin: '170px 170px', animation: `radarSweepSpin ${orbitSeconds / 2}s linear infinite` }}>
            <path d="M170 170 L170 38 A132 132 0 0 1 268 96 Z" fill="url(#sweepGrad)" opacity="0.18" />
            <line x1="170" y1="170" x2="170" y2="40" stroke="#60a5fa" strokeWidth="1.5" opacity="0.7" filter="url(#orbGlow)" />
          </g>

          <circle cx="170" cy="170" r="58" fill="url(#orbCore)" stroke="#60a5fa" strokeWidth="1" opacity="0.55" />
          <circle cx="170" cy="170" r="58" fill="none" stroke="#ffffff" strokeWidth="0.5" opacity="0.06" />
          <circle cx="170" cy="170" r="6" fill="#60a5fa" opacity="0.9" filter="url(#orbGlow)" />
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
