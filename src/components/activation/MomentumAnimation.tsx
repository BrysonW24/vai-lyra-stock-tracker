'use client';

import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '@/lib/activation/animationTiming';
import { ACTIVATION_SCENES } from '@/lib/activation/activationSteps';

interface MomentumAnimationProps {
  onComplete?: () => void;
}

/**
 * Scene 2: Read the momentum - a dense, Bloomberg-style terminal read of a single
 * name. Instrument header + stat row, a price panel with axes / 50-MA / recovery
 * annotation, detailed RSI and MACD panels, and a signal-read strip culminating in
 * a Buy Review badge. Staged reveal; advances manually via the shell's Continue.
 * Reduced motion: everything shown at once.
 */
export function MomentumAnimation({ onComplete }: MomentumAnimationProps) {
  const reduced = prefersReducedMotion();
  const scene = ACTIVATION_SCENES.readMomentum;

  // Staged reveal: 0 header → 1 price → 2 panels → 3 signal read/badge
  const [stage, setStage] = useState(reduced ? 3 : 0);

  useEffect(() => {
    if (reduced) {
      onComplete?.();
      return;
    }
    const t1 = setTimeout(() => setStage(1), 250);
    const t2 = setTimeout(() => setStage(2), 1300);
    const t3 = setTimeout(() => setStage(3), 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [reduced, onComplete]);

  const pricePath = 'M16,150 L70,140 L120,120 L175,126 L230,98 L285,108 L340,72 L395,80 L450,52 L505,60 L560,34';
  const maPath = 'M16,158 L120,140 L230,120 L340,98 L450,78 L560,60';
  const priceLen = 1100;

  return (
    <div className="mx-auto w-full max-w-4xl px-1">
      {/* Title */}
      <div className="mb-3 text-center">
        <h2 className="mb-0.5 text-xl font-semibold text-[#eef3f8] md:text-2xl">{scene.title}</h2>
        <p className="text-xs text-[#a8b5c2] md:text-sm">{scene.description}</p>
      </div>

      {/* Instrument header strip */}
      <div className="terminal-panel flex flex-wrap items-center justify-between gap-2 rounded-t-md border-b-0 px-4 py-2.5 font-mono">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-[#eef3f8]">NVDA</span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-[#8190a0]">NVIDIA CORP · NASDAQ</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-[#eef3f8]">172.40</span>
          <span className="text-xs text-[#43d18b]">+6.34 (+3.82%)</span>
        </div>
      </div>
      <div className="terminal-panel grid grid-cols-3 gap-px rounded-b-none border-y-0 bg-[#1b2530] sm:grid-cols-6">
        {[
          ['Open', '166.1'],
          ['High', '173.9'],
          ['Low', '164.8'],
          ['Vol', '1.24x'],
          ['Regime', 'Risk-on'],
          ['Score', '82 ↑'],
        ].map(([k, v]) => (
          <div key={k} className="bg-[#0d1117] px-3 py-1.5 font-mono">
            <p className="text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">{k}</p>
            <p className="text-xs text-[#dbe5ee]">{v}</p>
          </div>
        ))}
      </div>

      {/* Price panel */}
      <div className="terminal-panel rounded-t-none px-4 py-2">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Price · 52W</p>
          <div className="flex items-center gap-3 font-mono text-[10px]">
            <span className="flex items-center gap-1 text-[#8aa2ff]"><span className="h-0.5 w-3 bg-[#8aa2ff]" /> Price</span>
            <span className="flex items-center gap-1 text-[#8190a0]"><span className="h-0.5 w-3 border-t border-dashed border-[#8190a0]" /> 50-MA</span>
          </div>
        </div>
        <div className="relative">
          <svg viewBox="0 0 600 190" width="100%" height="140" preserveAspectRatio="none" className="w-full" shapeRendering="geometricPrecision">
            <defs>
              <linearGradient id="momLine" x1="0" y1="0" x2="600" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="100%" stopColor="#43d18b" />
              </linearGradient>
              <linearGradient id="momFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#43d18b" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#43d18b" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* gridlines + price ticks */}
            {[30, 70, 110, 150].map((y, i) => (
              <g key={y}>
                <line x1="16" x2="560" y1={y} y2={y} stroke="#17202a" strokeWidth="1" shapeRendering="crispEdges" />
                <text x="566" y={y + 3} fontSize="9" fill="#5d6b79" fontFamily="monospace">{180 - i * 8}</text>
              </g>
            ))}
            {/* area + MA + price (draw on stage>=1) */}
            <path d={`${pricePath} L560,170 L16,170 Z`} fill="url(#momFill)" opacity={stage >= 1 ? 1 : 0} style={{ transition: 'opacity 600ms ease 500ms' }} />
            <path d={maPath} fill="none" stroke="#8190a0" strokeWidth="1.2" strokeDasharray="4 4" opacity={stage >= 1 ? 0.7 : 0} style={{ transition: 'opacity 500ms ease 300ms' }} vectorEffect="non-scaling-stroke" />
            <path
              d={pricePath}
              fill="none"
              stroke="url(#momLine)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={priceLen}
              strokeDashoffset={stage >= 1 ? 0 : priceLen}
              style={{ transition: 'stroke-dashoffset 1100ms ease-in-out' }}
              vectorEffect="non-scaling-stroke"
            />
            <circle cx="560" cy="34" r="4" fill="#f3a33a" opacity={stage >= 1 ? 1 : 0} style={{ transition: 'opacity 300ms ease 1000ms' }} />
            {/* x ticks */}
            {['12M', '9M', '6M', '3M', 'Now'].map((lbl, i) => (
              <text key={lbl} x={16 + i * 136} y="185" fontSize="9" fill="#5d6b79" fontFamily="monospace">{lbl}</text>
            ))}
          </svg>
          {/* recovery annotation */}
          <div
            className="absolute right-2 top-1 rounded border border-[#1d7f55] bg-[#0d251b]/90 px-2 py-1 font-mono text-[10px] text-[#43d18b] transition-all duration-500"
            style={{ opacity: stage >= 1 ? 1 : 0, transform: stage >= 1 ? 'translateY(0)' : 'translateY(-4px)', transitionDelay: '900ms' }}
          >
            Momentum recovering ↑
          </div>
        </div>
      </div>

      {/* RSI + MACD panels */}
      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
        {/* RSI */}
        <div className="terminal-panel rounded-md px-4 py-2 transition-all duration-500" style={{ opacity: stage >= 2 ? 1 : 0, transform: stage >= 2 ? 'translateY(0)' : 'translateY(8px)' }}>
          <div className="mb-1.5 flex items-center justify-between font-mono">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">RSI (14)</p>
            <p className="text-sm text-[#8aa2ff]">46 <span className="text-[#43d18b]">↑</span></p>
          </div>
          <svg viewBox="0 0 280 86" width="100%" height="64" className="w-full" shapeRendering="geometricPrecision">
            <rect x="0" y="0" width="280" height="22" fill="#43d18b" opacity="0.05" />
            <rect x="0" y="64" width="280" height="22" fill="#ff6b6b" opacity="0.06" />
            {[['70', 22], ['50', 43], ['30', 64]].map(([lbl, y]) => (
              <g key={lbl as string}>
                <line x1="0" x2="280" y1={y as number} y2={y as number} stroke="#263241" strokeDasharray="3 3" strokeWidth="1" />
                <text x="2" y={(y as number) - 2} fontSize="8" fill="#5d6b79" fontFamily="monospace">{lbl}</text>
              </g>
            ))}
            <path
              d="M6,70 L60,66 L110,60 L160,55 L210,50 L262,48"
              fill="none"
              stroke="#8aa2ff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="300"
              strokeDashoffset={stage >= 2 ? 0 : 300}
              style={{ transition: 'stroke-dashoffset 900ms ease 200ms' }}
              vectorEffect="non-scaling-stroke"
            />
            <circle cx="262" cy="48" r="3.2" fill="#8aa2ff" opacity={stage >= 2 ? 1 : 0} style={{ transition: 'opacity 300ms ease 1000ms' }} />
          </svg>
          <p className="mt-1 font-mono text-[10px] text-[#a8b5c2]">Rising from below 50 - momentum recovering.</p>
        </div>

        {/* MACD */}
        <div className="terminal-panel rounded-md px-4 py-2 transition-all duration-500" style={{ opacity: stage >= 2 ? 1 : 0, transform: stage >= 2 ? 'translateY(0)' : 'translateY(8px)', transitionDelay: '120ms' }}>
          <div className="mb-1.5 flex items-center justify-between font-mono">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">MACD (12,26,9)</p>
            <p className="text-sm text-[#43d18b]">-0.03 ↑</p>
          </div>
          <svg viewBox="0 0 280 86" width="100%" height="64" className="w-full" shapeRendering="geometricPrecision">
            <line x1="0" x2="280" y1="50" y2="50" stroke="#3a4754" strokeWidth="1" shapeRendering="crispEdges" />
            {[-26, -22, -17, -12, -7, -3, 1, 4].map((h, i) => {
              const x = 12 + i * 33;
              const improving = h >= -26;
              const barH = Math.abs(h);
              const y = h < 0 ? 50 : 50 - barH;
              return (
                <rect
                  key={i}
                  x={x}
                  y={stage >= 2 ? y : 50}
                  width="20"
                  height={stage >= 2 ? barH : 0}
                  rx="1"
                  fill={improving && i >= 5 ? '#43d18b' : '#ff6b6b'}
                  opacity={i >= 5 ? 0.9 : 0.55}
                  style={{ transition: `height 600ms ease ${200 + i * 60}ms, y 600ms ease ${200 + i * 60}ms` }}
                />
              );
            })}
            {/* macd + signal mini lines */}
            <path d="M6,66 L60,62 L110,57 L160,54 L210,51 L274,49" fill="none" stroke="#f3a33a" strokeWidth="1.6" opacity={stage >= 2 ? 0.9 : 0} style={{ transition: 'opacity 500ms ease 400ms' }} vectorEffect="non-scaling-stroke" />
            <path d="M6,70 L60,67 L110,63 L160,60 L210,57 L274,55" fill="none" stroke="#8aa2ff" strokeWidth="1.2" strokeDasharray="3 3" opacity={stage >= 2 ? 0.7 : 0} style={{ transition: 'opacity 500ms ease 500ms' }} vectorEffect="non-scaling-stroke" />
          </svg>
          <p className="mt-1 font-mono text-[10px] text-[#a8b5c2]">Histogram improving - downside pressure easing.</p>
        </div>
      </div>

      {/* Signal read strip */}
      <div
        className="terminal-panel mt-3 flex flex-wrap items-center gap-2 rounded-md px-4 py-2 transition-all duration-500"
        style={{ opacity: stage >= 3 ? 1 : 0, transform: stage >= 3 ? 'translateY(0)' : 'translateY(8px)' }}
      >
        {['RSI 46 ↑', 'MACD hist ↑', 'Price > 50MA', 'Vol 1.24x'].map((chip) => (
          <span key={chip} className="rounded border border-[#263241] bg-[#0b1016] px-2 py-1 font-mono text-[11px] text-[#dbe5ee]">{chip}</span>
        ))}
        <span className="text-[#3a4754]">→</span>
        <span className="rounded border border-[#1d7f55] bg-[#0d251b] px-2.5 py-1 font-mono text-[11px] font-semibold text-[#43d18b]">Buy Review</span>
        <p className="mt-1 w-full font-mono text-[10px] leading-4 text-[#8190a0]">
          Momentum is turning up before price fully reacts - flagged for review, not a recommendation.
        </p>
      </div>
    </div>
  );
}
