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
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-line-strong text-ink-3 transition hover:border-line-hair hover:text-ink"
      >
        <HelpCircle size={12} />
      </button>

      <DetailDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="How the catalyst priority works"
        subtitle="Why a moment ranks where it does on the radar"
      >
        <p className="text-[12px] leading-relaxed text-ink-title">
          Every upcoming moment is scored on three axes, blended into a single{' '}
          <span className="font-semibold text-accent">Heat</span> (0-100). Heat is what ranks the radar - the higher it
          is, the more the moment deserves your attention today.
        </p>

        {/* Heat formula diagram */}
        <div className="rounded-cell border border-line-strong bg-panel p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">The blend</p>
          <div className="flex items-center justify-center gap-1.5 font-mono text-[11px]">
            <span className="rounded border border-blue-focus/40 bg-blue-tint px-1.5 py-1 text-blue-info">Timing</span>
            <span className="text-ink-dim">+</span>
            <span className="rounded border border-positive/40 bg-positive-tint px-1.5 py-1 text-positive">Impact</span>
            <span className="text-ink-dim">+</span>
            <span className="rounded border border-pending/40 bg-pending/10 px-1.5 py-1 text-pending">Attention</span>
            <span className="text-ink-dim">=</span>
            <span className="rounded border border-accent-border bg-accent-tint px-1.5 py-1 font-semibold text-accent">Heat</span>
          </div>
        </div>

        {/* The three axes */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">The three axes</p>
          {AXES.map((axis) => (
            <div key={axis.label} className="flex items-start gap-2 rounded-cell border border-line bg-panel p-2.5">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-cell border border-line-strong bg-chrome text-blue-info">
                <axis.icon size={13} />
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                  {axis.label}
                  <span className="rounded border border-line-strong bg-chrome px-1.5 py-0.5 font-mono text-[9px] text-ink-2">{axis.weight}</span>
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-ink-2">{axis.what}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tiers */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Urgency tiers</p>
          <div className="flex items-start gap-2 rounded-cell border border-negative/50 bg-negative/10 p-2.5">
            <Flame size={14} className="mt-0.5 shrink-0 text-negative" />
            <p className="text-[11px] leading-snug text-ink-title"><span className="font-semibold text-negative">Act window</span> - high heat and imminent (within ~2 weeks). The set-up window is open now.</p>
          </div>
          <div className="rounded-cell border border-accent-border bg-accent-tint p-2.5">
            <p className="text-[11px] leading-snug text-ink-title"><span className="font-semibold text-accent">Building</span> - meaningful heat and approaching. Worth tracking as it firms up.</p>
          </div>
          <div className="rounded-cell border border-blue-focus/40 bg-blue-tint p-2.5">
            <p className="text-[11px] leading-snug text-ink-title"><span className="font-semibold text-blue-info">Horizon</span> - further out or quieter. On the radar, not yet urgent.</p>
          </div>
        </div>

        <p className="rounded-cell border border-line-strong bg-panel p-2.5 font-mono text-[10px] leading-snug text-ink-3">
          Catalysts are curated research context with explicit date-confidence flags. Lyra surfaces what is coming and why
          it matters - it never tells you to buy or sell, and never invents a price.
        </p>
      </DetailDrawer>
    </>
  );
}
