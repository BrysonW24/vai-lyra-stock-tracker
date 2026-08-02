'use client';

/**
 * Momentum Pulse - a lightweight, fully-responsive hero visual (pure SVG + CSS,
 * no Three.js) that reads as a "live" market scan: a glowing momentum line under
 * a soft area fill, a sweeping scan beam, and a pulsing "now" node. Scales cleanly
 * from a compact mobile strip up to the tall desktop side panel via the viewBox,
 * so it never needs measuring or a fallback. Lyra's dark + amber palette.
 */
export function MomentumPulse() {
  // Up-trending momentum wave. Same start/end height region so it reads as a clean
  // climb. Area fill closes the path to the floor.
  const line =
    'M0,88 C30,82 46,64 72,66 C98,68 112,40 142,45 C170,49 182,72 212,63 C240,55 252,30 286,35 C316,39 332,22 344,20';
  const area = `${line} L360,120 L0,120 Z`;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[inherit]">
      <svg viewBox="0 0 360 120" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <defs>
          {/* Base colours are design tokens (stopColor resolves the CSS variables); the lightened
              scan-tip and "now"-node highlights below stay artistic per TOKENS.md's glass-visual
              allowance. */}
          <linearGradient id="mpLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" style={{ stopColor: 'var(--lyra-blue-focus)' }} />
            <stop offset="55%" style={{ stopColor: 'var(--lyra-positive)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--lyra-accent)' }} />
          </linearGradient>
          <linearGradient id="mpArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--lyra-accent)' }} stopOpacity="0.22" />
            <stop offset="100%" style={{ stopColor: 'var(--lyra-accent)' }} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="mpScan" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" style={{ stopColor: 'var(--lyra-blue-focus)' }} stopOpacity="0" />
            <stop offset="70%" style={{ stopColor: 'var(--lyra-blue-focus)' }} stopOpacity="0.10" />
            <stop offset="100%" stopColor="#cfe3ff" stopOpacity="0.32" />
          </linearGradient>
          <filter id="mpGlow">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* faint grid */}
        {[28, 58, 88].map((y) => (
          <line key={y} x1="0" y1={y} x2="360" y2={y} className="stroke-line" strokeWidth="0.6" opacity="0.5" />
        ))}

        <path d={area} fill="url(#mpArea)" />
        <path d={line} fill="none" stroke="url(#mpLine)" strokeWidth="2.4" strokeLinecap="round" filter="url(#mpGlow)" />

        {/* static glow nodes sitting on the line */}
        <circle cx="72" cy="66" r="2.4" className="fill-blue-focus" opacity="0.85" />
        <circle cx="212" cy="63" r="2.4" className="fill-positive" opacity="0.85" />

        {/* pulsing "now" node at the leading edge */}
        <g style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'pulseCore 2.4s ease-in-out infinite' }}>
          <circle cx="344" cy="20" r="6" className="fill-accent" opacity="0.35" />
        </g>
        <circle cx="344" cy="20" r="3" fill="#ffce8a" filter="url(#mpGlow)" />

        {/* sweeping scan beam */}
        <rect x="-46" y="0" width="46" height="120" fill="url(#mpScan)" style={{ animation: 'pulseScanX 3.2s linear infinite' }} />
      </svg>
    </div>
  );
}
