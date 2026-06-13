import { tickerLogoUrl } from '@/lib/ticker-logos';

/**
 * Artistic trading view for the light premium "Why Lyra" band.
 * A stylised momentum-recovery chart in the brand palette: muted candles, a glowing
 * electric-blue momentum line with an area wash, a "setup detected" signal marker, and
 * floating glass stat chips at depth. Deterministic + presentational (server-safe).
 * See onboarding-aesthetic-prompt.md.
 */

// Close prices forming a classic dip -> recovery (what Lyra actually detects).
const SERIES = [60, 57, 53, 50, 46, 43, 41, 40, 41, 43, 47, 51, 55, 58, 62, 65, 67, 69];

const W = 360;
const LPAD = 14;
const RPAD = 14;
const TOP = 16;
const BOT = 150;
const PMIN = 36;
const PMAX = 72;

function buildChart() {
  const n = SERIES.length;
  const step = (W - LPAD - RPAD) / n;
  const bodyW = step * 0.5;
  const yOf = (p: number) => TOP + ((PMAX - p) / (PMAX - PMIN)) * (BOT - TOP);
  const xOf = (i: number) => LPAD + step * i + step / 2;

  const candles = SERIES.map((close, i) => {
    const open = i === 0 ? close + 2 : SERIES[i - 1];
    const up = close >= open;
    const hi = Math.max(open, close) + (0.8 + (i % 3) * 0.5);
    const lo = Math.min(open, close) - (0.8 + ((i + 1) % 3) * 0.5);
    return { i, x: xOf(i), up, yOpen: yOf(open), yClose: yOf(close), yHi: yOf(hi), yLo: yOf(lo) };
  });

  const pts = SERIES.map((c, i) => ({ x: xOf(i), y: yOf(c) }));
  let line = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    line += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  const area = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${BOT} L ${pts[0].x.toFixed(1)} ${BOT} Z`;
  return { candles, bodyW, line, area, signal: pts[8], last: pts[pts.length - 1] };
}

export function ArtisticTradingView() {
  const { candles, bodyW, line, area, signal, last } = buildChart();

  return (
    <div className="relative" style={{ perspective: '1400px' }}>
      {/* soft brand glow behind the panel */}
      <div className="pointer-events-none absolute -inset-2 rounded-[28px] bg-gradient-to-tr from-[#1E63FF]/15 via-transparent to-[#5BC8FF]/20 blur-2xl" />

      {/* glass chart panel */}
      <div className="relative overflow-hidden rounded-3xl border border-white/80 bg-white/70 p-4 shadow-[0_40px_90px_-40px_rgba(14,30,58,0.5)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />

        {/* header */}
        <div className="mb-3 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element -- favicon CDN, not a bundled asset */}
            <img src={tickerLogoUrl('NVDA', 24) ?? ''} alt="NVIDIA" width={24} height={24} />
          </span>
          <div className="leading-tight">
            <p className="font-mono text-[13px] font-semibold text-[#0E1E3A]">NVDA <span className="ml-1 text-[#1FA971]">▲ 2.1%</span></p>
            <p className="font-mono text-[9px] uppercase tracking-wider text-[#5A6B82]">1H · momentum recovery</p>
          </div>
        </div>

        {/* chart */}
        <svg viewBox="0 0 360 162" className="h-auto w-full" role="img" aria-label="Stylised momentum recovery chart">
          <defs>
            <linearGradient id="atv-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#1E63FF" />
              <stop offset="1" stopColor="#5BC8FF" />
            </linearGradient>
            <linearGradient id="atv-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1E63FF" stopOpacity="0.22" />
              <stop offset="1" stopColor="#1E63FF" stopOpacity="0" />
            </linearGradient>
            <filter id="atv-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* gridlines */}
          {[42, 76, 110, 144].map((y) => (
            <line key={y} x1="8" y1={y} x2="352" y2={y} stroke="#0E1E3A" strokeOpacity="0.06" strokeWidth="1" />
          ))}

          {/* candles */}
          {candles.map((c) => (
            <g key={c.i}>
              <line x1={c.x} y1={c.yHi} x2={c.x} y2={c.yLo} stroke={c.up ? '#1FA971' : '#E5484D'} strokeOpacity="0.55" strokeWidth="1" />
              <rect
                x={c.x - bodyW / 2}
                y={Math.min(c.yOpen, c.yClose)}
                width={bodyW}
                height={Math.max(2, Math.abs(c.yClose - c.yOpen))}
                rx="1.2"
                fill={c.up ? '#1FA971' : '#E5484D'}
                fillOpacity="0.55"
              />
            </g>
          ))}

          {/* momentum line + area */}
          <path d={area} fill="url(#atv-area)" />
          <path d={line} fill="none" stroke="url(#atv-line)" strokeWidth="2.5" strokeLinecap="round" filter="url(#atv-glow)" />

          {/* signal marker at the turn */}
          <circle cx={signal.x} cy={signal.y} r="9" fill="#1E63FF" fillOpacity="0.16" />
          <circle cx={signal.x} cy={signal.y} r="4" fill="#1E63FF" stroke="#ffffff" strokeWidth="1.5" />
          {/* last-price dot */}
          <circle cx={last.x} cy={last.y} r="3.5" fill="#5BC8FF" stroke="#ffffff" strokeWidth="1.5" />
        </svg>

        {/* RSI sub-strip */}
        <div className="mt-2 flex items-center gap-3 border-t border-[#0E1E3A]/8 pt-2">
          <span className="font-mono text-[9px] uppercase tracking-wider text-[#5A6B82]">RSI</span>
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[#0E1E3A]/8">
            <div className="absolute inset-y-0 left-0 w-[48%] rounded-full bg-gradient-to-r from-[#1E63FF] to-[#5BC8FF]" />
          </div>
          <span className="font-mono text-[10px] font-semibold text-[#1E63FF]">32 → 48</span>
        </div>
      </div>

      {/* floating glass stat chips - depth, echoing the hero */}
      <div
        className="absolute -right-3 -top-3 rounded-xl border border-white/80 bg-white/85 px-3 py-1.5 shadow-[0_18px_40px_-18px_rgba(14,30,58,0.55)] backdrop-blur-md"
        style={{ transform: 'translateZ(60px)' }}
      >
        <p className="font-mono text-[9px] uppercase tracking-wider text-[#5A6B82]">Score</p>
        <p className="font-mono text-sm font-semibold text-[#1E63FF]">84 · strong</p>
      </div>
      <div
        className="absolute -bottom-3 left-6 inline-flex items-center gap-1.5 rounded-xl border border-white/80 bg-white/85 px-3 py-1.5 shadow-[0_18px_40px_-18px_rgba(14,30,58,0.5)] backdrop-blur-md"
        style={{ transform: 'translateZ(40px)' }}
      >
        <span className="h-2 w-2 rounded-full bg-[#1E63FF]" />
        <span className="text-[11px] font-semibold text-[#0E1E3A]">Setup detected</span>
      </div>
    </div>
  );
}
