'use client';

import { useState } from 'react';
import { Eye, Flame, HelpCircle, Timer, TrendingUp, type LucideIcon } from 'lucide-react';
import { DetailDrawer } from '@/components/DetailDrawer';

interface Axis {
  icon: LucideIcon;
  label: string;
  weight: string;
  what: string;
}

const AXES: Axis[] = [
  { icon: Timer, label: 'Timing', weight: '34%', what: 'How soon it lands. An imminent or just-live moment outranks a distant one - and a passed moment fades fast.' },
  { icon: TrendingUp, label: 'Impact', weight: '36%', what: 'Potential market movement if it lands. A mega IPO moves the whole complex; a single mid-cap print moves one name. Rumored dates are discounted.' },
  { icon: Eye, label: 'Attention', weight: '30%', what: 'Current hype, interest and news activity around it - how loud the moment already is.' },
];

/**
 * The "?" explainer for the Catalyst Radar priority matrix. Opens a diagrammed drawer:
 * the three axes that feed Heat, how Heat buckets into urgency tiers, and the research
 * framing. Mirrors the Prime Setups explainer.
 */
export function CatalystRadarHelp() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="How the catalyst priority works"
        title="How the catalyst priority works"
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[#263241] text-[#8190a0] transition hover:border-[#3a4754] hover:text-[#eef3f8]"
      >
        <HelpCircle size={12} />
      </button>

      <DetailDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="How the catalyst priority works"
        subtitle="Why a moment ranks where it does on the radar"
      >
        <p className="text-[12px] leading-relaxed text-[#dbe5ee]">
          Every upcoming moment is scored on three axes, blended into a single{' '}
          <span className="font-semibold text-[#f3a33a]">Heat</span> (0-100). Heat is what ranks the radar - the higher it
          is, the more the moment deserves your attention today.
        </p>

        {/* Heat formula diagram */}
        <div className="rounded-md border border-[#263241] bg-[#0d141c] p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">The blend</p>
          <div className="flex items-center justify-center gap-1.5 font-mono text-[11px]">
            <span className="rounded border border-[#27496b] bg-[#0d1b2b] px-1.5 py-1 text-[#7fb0ff]">Timing</span>
            <span className="text-[#5e6b78]">+</span>
            <span className="rounded border border-[#1d4f3a] bg-[#0d251b] px-1.5 py-1 text-[#43d18b]">Impact</span>
            <span className="text-[#5e6b78]">+</span>
            <span className="rounded border border-[#5a3b7a] bg-[#170f24] px-1.5 py-1 text-[#a78bfa]">Attention</span>
            <span className="text-[#5e6b78]">=</span>
            <span className="rounded border border-[#9a6a1f] bg-[#2a1f0f] px-1.5 py-1 font-semibold text-[#f3a33a]">Heat</span>
          </div>
        </div>

        {/* The three axes */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">The three axes</p>
          {AXES.map((axis) => (
            <div key={axis.label} className="flex items-start gap-2 rounded-md border border-[#1b2530] bg-[#0d141c] p-2.5">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-[#263241] bg-[#0b1016] text-[#7fb0ff]">
                <axis.icon size={13} />
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#eef3f8]">
                  {axis.label}
                  <span className="rounded border border-[#263241] bg-[#0b1016] px-1.5 py-0.5 font-mono text-[9px] text-[#a8b5c2]">{axis.weight}</span>
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-[#a8b5c2]">{axis.what}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tiers */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Urgency tiers</p>
          <div className="flex items-start gap-2 rounded-md border border-[#7f1d1d] bg-[#2b1214] p-2.5">
            <Flame size={14} className="mt-0.5 shrink-0 text-[#ff6b6b]" />
            <p className="text-[11px] leading-snug text-[#c8d3de]"><span className="font-semibold text-[#ff8a8a]">Act window</span> - high heat and imminent (within ~2 weeks). The set-up window is open now.</p>
          </div>
          <div className="rounded-md border border-[#9a6a1f] bg-[#2a1f0f] p-2.5">
            <p className="text-[11px] leading-snug text-[#c8d3de]"><span className="font-semibold text-[#f3a33a]">Building</span> - meaningful heat and approaching. Worth tracking as it firms up.</p>
          </div>
          <div className="rounded-md border border-[#27496b] bg-[#0d1b2b] p-2.5">
            <p className="text-[11px] leading-snug text-[#c8d3de]"><span className="font-semibold text-[#7fb0ff]">Horizon</span> - further out or quieter. On the radar, not yet urgent.</p>
          </div>
        </div>

        <p className="rounded-md border border-[#263241] bg-[#0d141c] p-2.5 font-mono text-[10px] leading-snug text-[#8190a0]">
          Catalysts are curated research context with explicit date-confidence flags. Lyra surfaces what is coming and why
          it matters - it never tells you to buy or sell, and never invents a price.
        </p>
      </DetailDrawer>
    </>
  );
}
