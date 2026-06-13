import { Bell } from 'lucide-react';
import { tickerLogoUrl } from '@/lib/ticker-logos';

/**
 * Feature visualisation tiles for the light premium "Why Lyra" band.
 * Each value prop is shown as a small glass *visualisation* (not an icon card) — a
 * portfolio overlay with real company logos, a daily-brief digest, an alert bubble —
 * matching the Vivacity.ai brand-image style. Presentational, server-safe.
 */

const favicon = (sym: string) => tickerLogoUrl(sym, 16) ?? '';

const CARD = 'relative overflow-hidden rounded-2xl border border-white/70 bg-white/65 p-4 shadow-[0_24px_60px_-38px_rgba(14,30,58,0.4)] backdrop-blur-xl';
const SHEEN = 'pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent';

const HOLDINGS = [
  { sym: 'NVDA', chg: '+2.1%', up: true, state: 'Strong' },
  { sym: 'AMD', chg: '-0.8%', up: false, state: 'Cooling' },
  { sym: 'MSFT', chg: '+0.4%', up: true, state: 'Near trigger' },
];

export function PortfolioTile() {
  return (
    <div className={CARD}>
      <div className={SHEEN} />
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-[13px] font-semibold text-[#0E1E3A]">Personal to your book</p>
        <span className="font-mono text-[10px] text-[#5A6B82]">overlaid</span>
      </div>
      <div className="space-y-1.5">
        {HOLDINGS.map((h) => (
          <div key={h.sym} className="flex items-center gap-2.5 rounded-xl border border-white/60 bg-white/70 px-2.5 py-1.5">
            <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-md border border-black/5 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element -- favicon CDN, not a bundled asset */}
              <img src={favicon(h.sym)} alt={h.sym} width={16} height={16} />
            </span>
            <span className="font-mono text-[12px] font-semibold text-[#0E1E3A]">{h.sym}</span>
            <span className={`ml-auto font-mono text-[11px] font-semibold ${h.up ? 'text-[#1FA971]' : 'text-[#E5484D]'}`}>{h.chg}</span>
            <span className="rounded-full border border-[#1E63FF]/15 bg-[#1E63FF]/10 px-2 py-0.5 text-[9px] font-semibold text-[#1E63FF]">{h.state}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BriefTile() {
  return (
    <div className={CARD}>
      <div className={SHEEN} />
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] font-semibold text-[#0E1E3A]">Your day in 30 seconds</p>
        <span className="font-mono text-[9px] uppercase tracking-wider text-[#5A6B82]">Daily brief</span>
      </div>
      <svg viewBox="0 0 240 38" className="mb-2.5 h-9 w-full" aria-hidden="true">
        <defs>
          <linearGradient id="brief-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#1E63FF" />
            <stop offset="1" stopColor="#5BC8FF" />
          </linearGradient>
          <linearGradient id="brief-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1E63FF" stopOpacity="0.18" />
            <stop offset="1" stopColor="#1E63FF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M2 30 C 44 28, 64 20, 94 22 S 158 9, 192 11 238 5 L 238 38 L 2 38 Z" fill="url(#brief-fill)" />
        <path d="M2 30 C 44 28, 64 20, 94 22 S 158 9, 192 11 238 5" fill="none" stroke="url(#brief-line)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full bg-[#1FA971]/12 px-2 py-0.5 text-[10px] font-semibold text-[#1FA971]">3 strong setups</span>
        <span className="rounded-full bg-[#E5484D]/12 px-2 py-0.5 text-[10px] font-semibold text-[#E5484D]">1 risk flag</span>
        <span className="rounded-full bg-[#1E63FF]/12 px-2 py-0.5 text-[10px] font-semibold text-[#1E63FF]">2 near trigger</span>
      </div>
    </div>
  );
}

export function AlertTile() {
  return (
    <div className={CARD}>
      <div className={SHEEN} />
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-[13px] font-semibold text-[#0E1E3A]">Only the ones that matter</p>
        <Bell size={13} className="text-[#1E63FF]" />
      </div>
      <div className="flex items-start gap-2 rounded-xl rounded-tl-sm border border-[#1E63FF]/15 bg-[#1E63FF]/[0.06] px-3 py-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#1E63FF] to-[#5BC8FF] text-white">
          <Bell size={12} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-[#0E1E3A]">NVDA · strong setup forming</p>
          <p className="text-[10px] text-[#5A6B82]">RSI recovering · volume confirming</p>
        </div>
      </div>
      <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-[#5A6B82]">Telegram · WhatsApp · quiet hours</p>
    </div>
  );
}
