import { Activity, BarChart3, TrendingUp, Gauge, LineChart, Check, Sparkles } from 'lucide-react';

/**
 * Brand hero for the light premium landing/onboarding surface.
 * A 3D-perspective frosted-glass "momentum engine": floating glass module tiles on the
 * left, wired by glowing connector lines into a central glass card, on a glowing plinth,
 * with a result chip floating to the side. Mirrors the Vivacity.ai brand-image style
 * (glass + perspective + connected modules). See onboarding-aesthetic-prompt.md.
 * Pure presentational - safe in a server component.
 */

const MODULES = [
  { icon: Activity, label: 'RSI', tone: '#1E63FF' },
  { icon: BarChart3, label: 'MACD', tone: '#2D6BFF' },
  { icon: TrendingUp, label: 'Trend', tone: '#1E63FF' },
  { icon: Gauge, label: 'Volume', tone: '#2D6BFF' },
  { icon: LineChart, label: 'Price', tone: '#1E63FF' },
];

const CHECKS = ['RSI turning up from oversold', 'MACD histogram recovering', 'Volume confirming the move'];

export function BrandHeroGlass() {
  return (
    <div className="relative mx-auto w-full max-w-[420px] select-none" style={{ perspective: '1500px' }}>
      {/* Glowing plinth */}
      <div className="pointer-events-none absolute inset-x-10 bottom-3 h-24 rounded-[50%] bg-[#1E63FF]/25 blur-[40px]" />
      <div className="pointer-events-none absolute inset-x-20 bottom-7 h-14 rounded-[50%] bg-[#5BC8FF]/40 blur-[30px]" />

      {/* Tilted stage */}
      <div
        className="relative h-[420px]"
        style={{ transformStyle: 'preserve-3d', transform: 'rotateX(9deg) rotateY(-17deg)' }}
      >
        {/* Glowing connector lines: left rail -> central card */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 420 420" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="vlink" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#9CC2FF" stopOpacity="0.2" />
              <stop offset="1" stopColor="#1E63FF" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          {[120, 170, 210, 250, 300].map((y, i) => (
            <path
              key={y}
              d={`M 120 ${y} C 170 ${y}, 175 ${210 + (i - 2) * 6}, 220 ${210 + (i - 2) * 6}`}
              stroke="url(#vlink)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          ))}
        </svg>

        {/* Left module rail (floating glass chips) */}
        <div className="absolute left-0 top-1/2 flex -translate-y-1/2 flex-col gap-2.5" style={{ transform: 'translateZ(30px)' }}>
          {MODULES.map((m) => (
            <div
              key={m.label}
              className="flex items-center gap-2 rounded-xl border border-white/70 bg-white/70 px-2.5 py-2 shadow-[0_10px_24px_-14px_rgba(14,30,58,0.5)] backdrop-blur-md"
            >
              <span className="grid h-6 w-6 place-items-center rounded-md text-white" style={{ background: m.tone }}>
                <m.icon size={13} />
              </span>
              <span className="text-[11px] font-semibold text-[#0E1E3A]">{m.label}</span>
            </div>
          ))}
        </div>

        {/* Central engine card */}
        <div
          className="absolute left-1/2 top-1/2 w-[210px] -translate-x-[38%] -translate-y-1/2 overflow-hidden rounded-2xl border border-white/80 bg-white/65 p-3.5 shadow-[0_50px_90px_-40px_rgba(14,30,58,0.6)] backdrop-blur-xl"
          style={{ transform: 'translateX(-38%) translateY(-50%) translateZ(70px)' }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
          <div className="flex items-center justify-between">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#1E63FF] to-[#5BC8FF] text-white shadow-[0_8px_18px_-6px_rgba(30,99,255,0.7)]">
              <Sparkles size={15} />
            </span>
            <span className="rounded-full border border-[#1E63FF]/20 bg-[#1E63FF]/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#1E63FF]">
              84 · strong
            </span>
          </div>
          <p className="mt-3 text-[13px] font-semibold text-[#0E1E3A]">Momentum Engine</p>
          <p className="mt-0.5 text-[10px] leading-snug text-[#5A6B82]">Deterministic signal, scored live</p>
          <div className="mt-3 space-y-1.5">
            {CHECKS.map((c) => (
              <div key={c} className="flex items-start gap-1.5">
                <span className="mt-px grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-[#1FA971] text-white">
                  <Check size={9} strokeWidth={3} />
                </span>
                <span className="text-[10px] leading-snug text-[#3a4a63]">{c}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Floating result chip - sits just above the engine card */}
        <div
          className="absolute left-[49%] top-[24%] flex items-center gap-2 rounded-xl border border-white/80 bg-white/85 px-3 py-2 shadow-[0_18px_40px_-18px_rgba(14,30,58,0.55)] backdrop-blur-md"
          style={{ transform: 'translateZ(100px)' }}
        >
          <span className="grid h-5 w-5 place-items-center rounded-full bg-[#1FA971] text-white">
            <Check size={11} strokeWidth={3} />
          </span>
          <span className="text-[11px] font-semibold text-[#0E1E3A]">Strong setup</span>
        </div>

        {/* Floating mini-stat chip (lower right) */}
        <div
          className="absolute bottom-12 right-6 rounded-xl border border-white/80 bg-white/75 px-3 py-2 shadow-[0_18px_40px_-18px_rgba(14,30,58,0.5)] backdrop-blur-md"
          style={{ transform: 'translateZ(55px)' }}
        >
          <p className="font-mono text-[10px] text-[#5A6B82]">Near trigger</p>
          <p className="font-mono text-sm font-semibold text-[#1E63FF]">+6 today</p>
        </div>
      </div>
    </div>
  );
}
