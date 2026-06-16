'use client';

import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '@/lib/activation/animationTiming';
import { ACTIVATION_SCENES } from '@/lib/activation/activationSteps';

interface PaperBotAnimationProps {
  onComplete?: () => void;
}

// Sample bot proposal card shown in the animation
const BOT_PROPOSAL = {
  ticker: 'AMD',
  side: 'BUY',
  shares: 12,
  price: 172.40,
  reason: 'RSI 46↑ recovering from oversold. MACD histogram improving. Score 82, +9 this scan.',
  risk: '$2,068.80',
  stopLoss: '$162.00',
};

const TRADE_JOURNAL = [
  { ticker: 'NVDA', side: 'BUY', pnl: '+$340', pnlPct: '+2.8%', status: 'Open', positive: true },
  { ticker: 'MSFT', side: 'BUY', pnl: '+$118', pnlPct: '+1.1%', status: 'Open', positive: true },
  { ticker: 'META', side: 'BUY', pnl: '-$62', pnlPct: '-0.6%', status: 'Closed', positive: false },
];

/**
 * Scene 4: Trade on paper, before it counts.
 * Staged reveal: header → bot proposal card → approve button → journal rows → live bot teaser.
 * Matches the visual language of the other activation scenes (terminal-panel, brand palette).
 */
export function PaperBotAnimation({ onComplete }: PaperBotAnimationProps) {
  const reduced = prefersReducedMotion();
  const scene = ACTIVATION_SCENES.paperBot;

  // Staged reveal: 0 → header | 1 → proposal card | 2 → approve glow | 3 → journal | 4 → teaser
  const [stage, setStage] = useState(reduced ? 4 : 0);

  useEffect(() => {
    if (reduced) {
      onComplete?.();
      return;
    }
    const t1 = setTimeout(() => setStage(1), 300);
    const t2 = setTimeout(() => setStage(2), 1200);
    const t3 = setTimeout(() => setStage(3), 2200);
    const t4 = setTimeout(() => setStage(4), 3100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [reduced, onComplete]);

  return (
    <div className="mx-auto w-full max-w-3xl px-1">
      {/* Title */}
      <div className="mb-3 text-center">
        <h2 className="mb-0.5 text-xl font-semibold text-[#eef3f8] md:text-2xl">{scene.title}</h2>
        <p className="text-xs text-[#a8b5c2] md:text-sm">{scene.description}</p>
      </div>

      {/* Stats strip */}
      <div
        className="mb-2 grid grid-cols-3 gap-2 transition-all duration-500"
        style={{ opacity: stage >= 1 ? 1 : 0, transform: stage >= 1 ? 'translateY(0)' : 'translateY(10px)' }}
      >
        {[
          { label: 'Paper P&L', value: '+$396', sub: 'This month', pos: true },
          { label: 'Open trades', value: '2', sub: 'Active positions', pos: null },
          { label: 'Win rate', value: '67%', sub: '6 of 9 closed', pos: true },
        ].map((tile) => (
          <div key={tile.label} className="terminal-panel rounded px-2.5 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8190a0]">{tile.label}</p>
            <p className={`mt-0.5 font-mono text-lg font-semibold ${tile.pos === true ? 'text-[#43d18b]' : tile.pos === false ? 'text-[#ff6b6b]' : 'text-[#eef3f8]'}`}>
              {tile.value}
            </p>
            <p className="text-[9px] text-[#8190a0]">{tile.sub}</p>
          </div>
        ))}
      </div>

      {/* Bot proposal card */}
      <div
        className="terminal-panel mb-2 overflow-hidden rounded-md border border-[#8aa2ff]/30 transition-all duration-500"
        style={{ opacity: stage >= 1 ? 1 : 0, transform: stage >= 1 ? 'translateY(0)' : 'translateY(12px)' }}
      >
        {/* Card header */}
        <div className="flex items-center justify-between border-b border-[#1b2530] bg-[#0b1016] px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="grid h-5 w-5 place-items-center rounded border border-[#8aa2ff]/40 bg-[#101a2e] text-[#8aa2ff]">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
              </svg>
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8aa2ff]">Paper Bot · Proposal</span>
          </div>
          <span className="rounded-full border border-[#8aa2ff]/30 bg-[#101a2e] px-2 py-0.5 font-mono text-[9px] text-[#8aa2ff]">
            Awaiting approval
          </span>
        </div>

        {/* Proposal body */}
        <div className="p-3">
          <div className="mb-2 flex items-baseline gap-3">
            <span className="rounded border border-[#1d7f55] bg-[#0d251b] px-2 py-0.5 font-mono text-xs font-bold text-[#43d18b]">
              {BOT_PROPOSAL.side}
            </span>
            <span className="text-sm font-semibold text-[#eef3f8]">{BOT_PROPOSAL.ticker}</span>
            <span className="font-mono text-xs text-[#a8b5c2]">{BOT_PROPOSAL.shares} shares @ ${BOT_PROPOSAL.price.toFixed(2)}</span>
          </div>

          <p className="mb-2.5 font-mono text-[10px] leading-relaxed text-[#8190a0]">{BOT_PROPOSAL.reason}</p>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="rounded border border-[#1b2530] bg-[#0d1117] px-2.5 py-1.5">
              <p className="text-[9px] uppercase tracking-[0.12em] text-[#6f7d8a]">Notional</p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-[#eef3f8]">{BOT_PROPOSAL.risk}</p>
            </div>
            <div className="rounded border border-[#1b2530] bg-[#0d1117] px-2.5 py-1.5">
              <p className="text-[9px] uppercase tracking-[0.12em] text-[#6f7d8a]">Stop loss</p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-[#ff8a8a]">{BOT_PROPOSAL.stopLoss}</p>
            </div>
          </div>

          {/* Approve / reject buttons */}
          <div
            className="flex gap-2 transition-all duration-500"
            style={{ opacity: stage >= 2 ? 1 : 0, transform: stage >= 2 ? 'translateY(0)' : 'translateY(6px)' }}
          >
            <div
              className="flex-1 rounded-md border border-[#1d7f55] bg-[#0d251b] px-3 py-2 text-center font-mono text-xs font-semibold text-[#43d18b] transition-all duration-300"
              style={{
                boxShadow: stage >= 2 ? '0 0 18px -4px rgba(67,209,139,0.45)' : 'none',
              }}
            >
              ✓ Approve fill
            </div>
            <div className="rounded-md border border-[#263241] bg-[#0d141c] px-3 py-2 text-center font-mono text-xs text-[#6f7d8a]">
              ✕ Skip
            </div>
          </div>
          <p className="mt-1.5 text-center font-mono text-[9px] text-[#4a5868]">
            Paper only · no real money · you stay in control
          </p>
        </div>
      </div>

      {/* Trade journal mini-table */}
      <div
        className="terminal-panel mb-2 overflow-hidden rounded-md transition-all duration-500"
        style={{ opacity: stage >= 3 ? 1 : 0, transform: stage >= 3 ? 'translateY(0)' : 'translateY(10px)' }}
      >
        <div className="border-b border-[#1b2530] bg-[#0b1016] px-3 py-1.5">
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Paper journal</p>
        </div>
        <table className="min-w-full text-left">
          <tbody className="divide-y divide-[#141c25]">
            {TRADE_JOURNAL.map((row, i) => (
              <tr
                key={row.ticker}
                style={{
                  opacity: stage >= 3 ? 1 : 0,
                  transform: stage >= 3 ? 'translateY(0)' : 'translateY(8px)',
                  transition: `opacity 400ms ease ${i * 120}ms, transform 400ms ease ${i * 120}ms`,
                }}
              >
                <td className="px-3 py-1.5 font-mono text-xs font-semibold text-[#eef3f8]">{row.ticker}</td>
                <td className="px-3 py-1.5">
                  <span className="rounded border border-[#1d7f55]/50 bg-[#0d251b] px-1.5 py-0.5 font-mono text-[9px] text-[#43d18b]">
                    {row.side}
                  </span>
                </td>
                <td className={`px-3 py-1.5 text-right font-mono text-xs font-semibold ${row.positive ? 'text-[#43d18b]' : 'text-[#ff6b6b]'}`}>
                  {row.pnl}
                </td>
                <td className={`px-3 py-1.5 text-right font-mono text-[10px] ${row.positive ? 'text-[#43d18b]' : 'text-[#ff6b6b]'}`}>
                  {row.pnlPct}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-[10px] text-[#6f7d8a]">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Live bot teaser */}
      <div
        className="relative overflow-hidden rounded-md border border-[#5bc8ff]/20 bg-gradient-to-r from-[#07090c] via-[#0d1a2a] to-[#07090c] px-4 py-3 transition-all duration-500"
        style={{ opacity: stage >= 4 ? 1 : 0, transform: stage >= 4 ? 'translateY(0)' : 'translateY(8px)' }}
      >
        {/* Subtle shimmer line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#5bc8ff]/40 to-transparent" />

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-[#5bc8ff]">Live Trading Bot</span>
              <span className="rounded-full border border-[#5bc8ff]/30 bg-[#0d1a2a] px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-[#5bc8ff]">
                Coming soon
              </span>
            </div>
            <p className="mt-0.5 font-mono text-[10px] leading-snug text-[#4a6a88]">
              When you&apos;re ready: the same approval gate, but filling against your real broker.
              Paper bot is the proving ground — live bot is the graduation.
            </p>
          </div>
          <div className="shrink-0">
            {/* Animated lock icon */}
            <div className="grid h-9 w-9 place-items-center rounded-full border border-[#5bc8ff]/25 bg-[#0d1a2a] text-[#5bc8ff]/60">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
