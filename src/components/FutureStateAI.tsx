import { Sparkles, Newspaper, Brain, Target, ShieldCheck } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';
import { faviconUrl } from '@/lib/ticker-logos';

/**
 * "Future state" showcase on the light landing - an LLM intelligence layer over the
 * deterministic engine. Built in the same perspective-glass language as the momentum
 * engine hero: a central AI bot with capability tiles floating around it, glowing
 * connectors, plinth + rings. Intro header first (Why-Lyra style), then the scene.
 * Coming-soon + honest doctrine caveat. Presentational, server-safe.
 */

const CAPS = [
  { icon: Newspaper, label: 'Summarises news' },
  { icon: Brain, label: 'Explains the why' },
  { icon: Target, label: 'Ranks the trades' },
];

export function FutureStateAI() {
  return (
    <div>
      {/* Intro header - same style as Why Lyra, before the graphic */}
      <div className="mb-7 min-w-0">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#1E63FF]">Future state · Coming soon</p>
        <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-[#0E1E3A] md:text-3xl">
          Meet your <span className="text-[#1E63FF]">AI co-pilot</span>.
        </h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-[#5A6B82]">
          An LLM intelligence layer over the deterministic engine - it reads the market, explains every setup, and
          surfaces what&apos;s worth acting on, in plain English.
        </p>
      </div>

      {/* AI-engine scene - perspective glass, matching the momentum engine hero */}
      <div className="relative mx-auto w-full max-w-[460px]" style={{ perspective: '1500px' }}>
        {/* glowing plinth */}
        <div className="pointer-events-none absolute inset-x-10 bottom-3 h-24 rounded-[50%] bg-[#1E63FF]/20 blur-[40px]" />
        <div className="pointer-events-none absolute inset-x-24 bottom-7 h-14 rounded-[50%] bg-[#5BC8FF]/30 blur-[28px]" />
        {/* concentric rings */}
        <svg className="pointer-events-none absolute left-1/2 top-1/2 h-[24rem] w-[24rem] -translate-x-1/2 -translate-y-1/2 opacity-70" viewBox="0 0 320 320" fill="none" aria-hidden="true">
          {[72, 112, 150].map((r) => (
            <circle key={r} cx="160" cy="160" r={r} stroke="#1E63FF" strokeOpacity="0.1" strokeWidth="1" />
          ))}
        </svg>

        <div className="relative h-[430px]" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(8deg) rotateY(-15deg)' }}>
          {/* glowing connectors: capability rail -> bot */}
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 460 430" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="ai-link" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#9CC2FF" stopOpacity="0.2" />
                <stop offset="1" stopColor="#1E63FF" stopOpacity="0.85" />
              </linearGradient>
            </defs>
            {[160, 215, 270].map((y) => (
              <path key={y} d={`M 140 ${y} C 190 ${y}, 200 215, 250 215`} stroke="url(#ai-link)" strokeWidth="1.5" strokeLinecap="round" />
            ))}
          </svg>

          {/* left rail: capability tiles */}
          <div className="absolute left-0 top-1/2 flex -translate-y-1/2 flex-col gap-3" style={{ transform: 'translateZ(30px)' }}>
            {CAPS.map((c) => (
              <div
                key={c.label}
                className="flex items-center gap-2 rounded-xl border border-white/70 bg-white/80 px-2.5 py-2 shadow-[0_10px_24px_-14px_rgba(14,30,58,0.5)] backdrop-blur-md"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#1E63FF] to-[#5BC8FF] text-white">
                  <c.icon size={14} />
                </span>
                <span className="text-[11px] font-semibold text-[#0E1E3A]">{c.label}</span>
              </div>
            ))}
          </div>

          {/* central AI bot */}
          <div
            className="absolute left-1/2 top-1/2"
            style={{ transform: 'translateX(-22%) translateY(-70%) translateZ(75px)' }}
          >
            {/* antenna */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-center">
              <span className="mx-auto block h-3.5 w-px bg-[#1E63FF]/40" />
              <span className="block h-2.5 w-2.5 rounded-full bg-[#5BC8FF] shadow-[0_0_14px_3px_rgba(91,200,255,0.7)]" />
            </div>
            {/* head */}
            <div className="grid h-32 w-36 place-items-center rounded-[28px] border border-white/80 bg-gradient-to-br from-white/90 to-[#cfe0ff]/70 shadow-[0_36px_70px_-26px_rgba(30,99,255,0.55)] backdrop-blur-xl">
              <div className="relative grid h-20 w-28 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E63FF] to-[#5BC8FF]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-white/15" />
                <div className="flex items-center gap-4">
                  <span className="h-3.5 w-3.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]" />
                  <span className="h-3.5 w-3.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]" />
                </div>
                <span className="mt-2 h-1 w-8 rounded-full bg-white/70" />
              </div>
            </div>
            <p className="mt-2 text-center font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0E1E3A]">{BRAND_NAME} AI</p>
          </div>

          {/* input chip */}
          <div
            className="absolute left-10 top-3 rounded-xl border border-white/80 bg-white/90 px-2.5 py-1.5 shadow-[0_14px_30px_-16px_rgba(14,30,58,0.5)] backdrop-blur-md"
            style={{ transform: 'translateZ(50px)' }}
          >
            <p className="text-[10px] font-semibold text-[#1E63FF]">News in →</p>
          </div>

          {/* output chip */}
          <div
            className="absolute bottom-12 right-2 inline-flex items-center gap-1.5 rounded-xl border border-white/80 bg-white/90 px-3 py-2 shadow-[0_18px_40px_-18px_rgba(14,30,58,0.55)] backdrop-blur-md"
            style={{ transform: 'translateZ(95px)' }}
          >
            <Sparkles size={12} className="text-[#1E63FF]" />
            <span className="text-[11px] font-semibold text-[#0E1E3A]">Buy review</span>
          </div>

          {/* Example alert message - what a user actually receives (top-right, in line with "News in") */}
          <div
            className="absolute -right-3 top-3.5 w-[182px] rounded-2xl rounded-tr-sm border border-white/80 bg-white/95 p-2.5 shadow-[0_22px_44px_-18px_rgba(14,30,58,0.55)] backdrop-blur-md"
            style={{ transform: 'translateZ(110px)' }}
          >
            <div className="flex items-center gap-1.5">
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded-[5px] bg-gradient-to-br from-[#1E63FF] to-[#5BC8FF]">
                <Sparkles size={9} className="text-white" />
              </span>
              <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.14em] text-[#5A6B82]">Lyra · now</span>
            </div>
            <p className="mt-1 text-[11px] font-semibold leading-snug text-[#0E1E3A]">
              NVDA strong setup - score 84 <span className="text-[#1FA971]">+9</span>
            </p>
            <p className="text-[10px] leading-snug text-[#5A6B82]">RSI 48↑ · MACD recovering</p>
          </div>
        </div>
      </div>

      {/* Delivery - the real Telegram + WhatsApp integration (live today) */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
        <span className="text-[11px] font-medium text-[#5A6B82]">Straight to your phone -</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/70 px-2.5 py-1 shadow-sm backdrop-blur">
          <span className="grid h-4 w-4 shrink-0 place-items-center overflow-hidden rounded-[4px] bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element -- favicon CDN, not a bundled asset */}
            <img src={faviconUrl('telegram.org', 14)} alt="Telegram" width={14} height={14} />
          </span>
          <span className="text-[11px] font-semibold text-[#0E1E3A]">Telegram</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/70 px-2.5 py-1 shadow-sm backdrop-blur">
          <span className="grid h-4 w-4 shrink-0 place-items-center overflow-hidden rounded-[4px] bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element -- favicon CDN, not a bundled asset */}
            <img src={faviconUrl('whatsapp.com', 14)} alt="WhatsApp" width={14} height={14} />
          </span>
          <span className="text-[11px] font-semibold text-[#0E1E3A]">WhatsApp</span>
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1FA971]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#1FA971]" /> Live now
        </span>
      </div>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-[#8290a0]">
        <ShieldCheck size={12} /> The AI explains; the deterministic engine decides. Research, never advice.
      </p>
    </div>
  );
}
