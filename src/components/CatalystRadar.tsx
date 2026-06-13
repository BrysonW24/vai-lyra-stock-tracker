import { Banknote, CalendarClock, Cpu, DollarSign, Landmark, Link2, Radar as RadarIcon, Rocket, Timer, type LucideIcon } from 'lucide-react';
import { TickerLogo } from '@/components/TickerLogo';
import { SourceFavicon } from '@/components/SourceFavicon';
import { CatalystRadarHelp } from '@/components/CatalystRadarHelp';
import { deriveCatalystRadar, type CatalystCategory, type CatalystTier, type ScoredCatalyst } from '@/lib/catalysts';

const CATEGORY_ICON: Record<CatalystCategory, LucideIcon> = {
  ipo: Rocket,
  funding: Banknote,
  earnings: CalendarClock,
  product: Cpu,
  launch: Rocket,
  regulatory: Landmark,
  macro: Landmark,
};

const TIER: Record<CatalystTier, { label: string; chip: string; heat: string }> = {
  now: { label: 'Act window', chip: 'border-[#7f1d1d] bg-[#2b1214] text-[#ff8a8a]', heat: 'text-[#ff6b6b]' },
  building: { label: 'Building', chip: 'border-[#9a6a1f] bg-[#2a1f0f] text-[#f3a33a]', heat: 'text-[#f3a33a]' },
  horizon: { label: 'Horizon', chip: 'border-[#27496b] bg-[#0d1b2b] text-[#7fb0ff]', heat: 'text-[#7fb0ff]' },
};

function whenLabel(days: number): string {
  if (days === 0) return 'today';
  if (days > 0) return `in ${days}d`;
  if (days >= -1) return 'live now';
  return `${Math.abs(days)}d ago`;
}

function MatrixBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-[52px] shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-[#8190a0]">{label}</span>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#17202a]">
        <div className="h-full rounded-full bg-gradient-to-r from-[#3b5bdb] to-[#43d18b]" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <span className="w-6 shrink-0 text-right font-mono text-[9px] text-[#a8b5c2]">{value}</span>
    </div>
  );
}

const isTicker = (s: string) => /^[A-Z]{1,5}$/.test(s);

function ExposureChip({ item }: { item: string }) {
  if (isTicker(item)) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-[#263241] bg-[#0d141c] px-1.5 py-0.5 font-mono text-[10px] text-[#dbe5ee]">
        <TickerLogo symbol={item} size={12} /> {item}
      </span>
    );
  }
  return (
    <span className="rounded border border-[#263241] bg-[#0d141c] px-1.5 py-0.5 font-mono text-[10px] text-[#a8b5c2]">{item}</span>
  );
}

function CatalystCard({ catalyst }: { catalyst: ScoredCatalyst }) {
  const Icon = CATEGORY_ICON[catalyst.category];
  const tier = TIER[catalyst.tier];
  const showFlow = Boolean(catalyst.priceNote || catalyst.accessNote);

  return (
    <div className="px-3 py-2.5">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-[#263241] bg-[#0d141c] text-[#7fb0ff]">
          <Icon size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] font-semibold leading-snug text-[#eef3f8]">{catalyst.title}</span>
            <span className={`rounded border px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.1em] ${tier.chip}`}>{tier.label}</span>
            <span className="font-mono text-[9px] text-[#8190a0]">{whenLabel(catalyst.daysUntil)}</span>
            {catalyst.dateConfidence !== 'confirmed' && (
              <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[#5e6b78]">{catalyst.dateConfidence}</span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-[#a8b5c2]">{catalyst.why}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`font-mono text-lg font-semibold leading-none ${tier.heat}`}>{catalyst.heat}</p>
          <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-[#5e6b78]">heat</p>
        </div>
      </div>

      {/* The priority matrix - the three axes feeding Heat. */}
      <div className="mt-2 space-y-1 rounded-md border border-[#1b2530] bg-[#0b1016] px-2.5 py-1.5">
        <MatrixBar label="Timing" value={catalyst.timing} />
        <MatrixBar label="Impact" value={catalyst.impactScore} />
        <MatrixBar label="Attention" value={catalyst.attentionScore} />
      </div>

      {/* IPO / funding value chain: time -> price -> access. */}
      {showFlow && (
        <div className="mt-2 grid gap-1 rounded-md border border-[#27406b]/50 bg-[#0c1422] p-2 sm:grid-cols-3">
          <div className="flex items-start gap-1.5">
            <Timer size={11} className="mt-0.5 shrink-0 text-[#7fb0ff]" />
            <p className="text-[10px] leading-snug text-[#c8d3de]"><span className="text-[#8190a0]">When </span>{whenLabel(catalyst.daysUntil)}</p>
          </div>
          {catalyst.priceNote && (
            <div className="flex items-start gap-1.5">
              <DollarSign size={11} className="mt-0.5 shrink-0 text-[#43d18b]" />
              <p className="text-[10px] leading-snug text-[#c8d3de]"><span className="text-[#8190a0]">Price </span>{catalyst.priceNote}</p>
            </div>
          )}
          {catalyst.accessNote && (
            <div className="flex items-start gap-1.5">
              <Link2 size={11} className="mt-0.5 shrink-0 text-[#f3a33a]" />
              <p className="text-[10px] leading-snug text-[#c8d3de]"><span className="text-[#8190a0]">Access </span>{catalyst.accessNote}</p>
            </div>
          )}
        </div>
      )}

      <p className="mt-2 text-[10px] leading-snug text-[#a8b5c2]"><span className="font-semibold text-[#43d18b]">Set up: </span>{catalyst.setup}</p>

      {(catalyst.exposure.length > 0 || catalyst.sources?.length) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {catalyst.exposure.map((item) => (
            <ExposureChip key={item} item={item} />
          ))}
          {catalyst.sources?.map((source) => (
            <span key={source.domain} className="inline-flex items-center gap-1 font-mono text-[9px] text-[#8190a0]">
              <SourceFavicon domain={source.domain} sourceName={source.name} /> {source.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Catalyst Radar - the forward-looking board: upcoming market-moving moments ranked by a
 * deterministic priority matrix (Timing x Impact x Attention -> Heat), bucketed into
 * urgency tiers. The future-state companion to the present-state Signals. For IPOs it
 * also threads the value chain - when, expected price, how to access. Research only.
 */
export function CatalystRadar() {
  const catalysts = deriveCatalystRadar(new Date());
  const actNow = catalysts.filter((c) => c.tier === 'now').length;

  return (
    <section id="catalyst-radar" className="terminal-panel scroll-mt-16 overflow-hidden rounded-md">
      <div className="flex items-center justify-between gap-2 border-b border-[#1b2530] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[#263241] bg-[#0d141c] text-[#f3a33a]">
            <RadarIcon size={14} />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Catalyst radar</p>
            <p className="mt-0.5 text-[11px] leading-snug text-[#a8b5c2]">
              The moments worth positioning for - scored on timing, impact and attention. Set up today for what is coming.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="font-mono text-[10px] text-[#8190a0]">{actNow} act now</span>
          <CatalystRadarHelp />
        </div>
      </div>

      <div className="divide-y divide-[#141c25]">
        {catalysts.map((catalyst) => (
          <CatalystCard key={catalyst.id} catalyst={catalyst} />
        ))}
      </div>

      <p className="border-t border-[#1b2530] px-3 py-1.5 font-mono text-[10px] text-[#5e6b78]">
        Deterministic priority: timing x impact x attention. Research context for what is coming - never a buy/sell instruction.
      </p>
    </section>
  );
}
