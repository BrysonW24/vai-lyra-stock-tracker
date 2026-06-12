'use client';

import { useState } from 'react';
import { Activity, ArrowUp, BarChart3, HelpCircle, TrendingUp, type LucideIcon } from 'lucide-react';
import { DetailDrawer } from '@/components/DetailDrawer';

interface Condition {
  icon: LucideIcon;
  label: string;
  rule: string;
  why: string;
}

const CONDITIONS: Condition[] = [
  { icon: TrendingUp, label: 'RSI rising', rule: 'RSI ≤ 60 and ticking up', why: 'Recovering, with room left to run - not already overbought.' },
  { icon: Activity, label: 'MACD turning up', rule: 'Histogram rising', why: 'Selling pressure easing - momentum is turning higher.' },
  { icon: BarChart3, label: 'Volume confirming', rule: '≥ 1x average', why: 'Real participation behind the move, not a quiet drift.' },
  { icon: ArrowUp, label: 'Score climbing', rule: 'Higher than last scan', why: 'The whole composite picture is improving, not just one factor.' },
];

/**
 * The "?" explainer for the Prime Setups 4/4 confirmation system. Opens a diagrammed
 * drawer: the agreement meter, the four deterministic checks, and what Prime vs Watch
 * mean. Every check is read off the backend signal - structure + momentum, never advice.
 */
export function PrimeSetupsHelp() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="How the 4/4 confirmation works"
        title="How the 4/4 confirmation works"
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[#263241] text-[#8190a0] transition hover:border-[#3a4754] hover:text-[#eef3f8]"
      >
        <HelpCircle size={12} />
      </button>

      <DetailDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="How the 4/4 confirmation works"
        subtitle="The momentum-agreement checklist behind every Prime setup"
      >
        <p className="text-[12px] leading-relaxed text-[#dbe5ee]">
          A setup earns up to <span className="font-semibold text-[#43d18b]">4 confirmation points</span> - one for each
          independent signal that agrees the move is real. The more that agree, the stronger the setup.
        </p>

        {/* Agreement meter diagram */}
        <div className="rounded-md border border-[#263241] bg-[#0d141c] p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">The agreement meter</p>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-2.5 flex-1 rounded-full bg-gradient-to-r from-[#3b5bdb] to-[#43d18b]" />
            ))}
            <span className="ml-2 font-mono text-[12px] font-semibold text-[#43d18b]">4/4</span>
          </div>
          <div className="mt-2 flex justify-between font-mono text-[9px] text-[#8190a0]">
            <span><span className="text-[#43d18b]">4/4</span> all agree</span>
            <span><span className="text-[#f3a33a]">2-3</span> partial</span>
            <span><span className="text-[#ff6b6b]">0-1</span> little</span>
          </div>
        </div>

        {/* The four checks */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">The four checks</p>
          {CONDITIONS.map((c, i) => (
            <div key={c.label} className="flex items-start gap-2 rounded-md border border-[#1b2530] bg-[#0d141c] p-2.5">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-[#1d4f3a] bg-[#0d251b] text-[#43d18b]">
                <c.icon size={13} />
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold text-[#eef3f8]">
                  <span>{i + 1}. {c.label}</span>
                  <span className="rounded border border-[#263241] bg-[#0b1016] px-1.5 py-0.5 font-mono text-[9px] text-[#a8b5c2]">{c.rule}</span>
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-[#a8b5c2]">{c.why}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tiers */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">How a name gets tagged</p>
          <div className="rounded-md border border-[#1d4f3a] bg-[#0d251b] p-2.5">
            <p className="text-[11px] font-semibold text-[#43d18b]">Prime - worth a look now</p>
            <p className="mt-0.5 text-[11px] leading-snug text-[#c8d3de]">
              The engine already flagged a strong setup AND at least 2 of the 4 checks agree. Structure and momentum line up.
            </p>
          </div>
          <div className="rounded-md border border-[#9a6a1f] bg-[#2a1f0f] p-2.5">
            <p className="text-[11px] font-semibold text-[#f3a33a]">Watch - closing in</p>
            <p className="mt-0.5 text-[11px] leading-snug text-[#c8d3de]">
              Not prime yet but heading there - a rising mid-score, a gaining watchlist name, or an early oversold turn.
            </p>
          </div>
        </div>

        <p className="rounded-md border border-[#263241] bg-[#0d141c] p-2.5 font-mono text-[10px] leading-snug text-[#8190a0]">
          Every check is read straight off the deterministic backend signal. Lyra flags structure + momentum - it never
          tells you to buy or sell. Research only.
        </p>
      </DetailDrawer>
    </>
  );
}
