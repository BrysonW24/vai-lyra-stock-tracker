import { Banknote, CalendarClock, Cpu, DollarSign, Landmark, Link2, Radar as RadarIcon, Rocket, Timer, type LucideIcon } from 'lucide-react';
import { TickerLogo } from '@/components/TickerLogo';
import { SourceFavicon } from '@/components/SourceFavicon';
import { CatalystRadarHelp } from '@/components/CatalystRadarHelp';
import { catalystRadarState, type CatalystCategory, type CatalystTier, type ScoredCatalyst } from '@/lib/catalysts';

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
  now: { label: 'Act window', chip: 'border-negative/50 bg-negative/10 text-negative', heat: 'text-negative' },
  building: { label: 'Building', chip: 'border-accent-border bg-accent-tint text-accent', heat: 'text-accent' },
  horizon: { label: 'Horizon', chip: 'border-blue-focus/40 bg-blue-tint text-blue-info', heat: 'text-blue-info' },
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
      <span className="w-[52px] shrink-0 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">{label}</span>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-line/70">
        <div className="h-full rounded-full bg-gradient-to-r from-blue-deep to-positive" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <span className="w-6 shrink-0 text-right font-mono text-[9px] text-ink-2">{value}</span>
    </div>
  );
}

const isTicker = (s: string) => /^[A-Z]{1,5}$/.test(s);

function ExposureChip({ item }: { item: string }) {
  if (isTicker(item)) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[10px] text-ink-title">
        <TickerLogo symbol={item} size={12} /> {item}
      </span>
    );
  }
  return (
    <span className="rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[10px] text-ink-2">{item}</span>
  );
}

/** The tall half of a catalyst card: priority matrix, value chain, setup, chips. */
function CatalystBody({ catalyst }: { catalyst: ScoredCatalyst }) {
  const showFlow = Boolean(catalyst.priceNote || catalyst.accessNote);
  return (
    <>
      {/* The priority matrix - the three axes feeding Heat. */}
      <div className="mt-2 space-y-1 rounded-cell border border-line bg-chrome px-2.5 py-1.5">
        <MatrixBar label="Timing" value={catalyst.timing} />
        <MatrixBar label="Impact" value={catalyst.impactScore} />
        <MatrixBar label="Attention" value={catalyst.attentionScore} />
      </div>

      {/* IPO / funding value chain: time -> price -> access. */}
      {showFlow && (
        <div className="mt-2 grid gap-1 rounded-cell border border-blue-focus/40 bg-blue-tint/60 p-2 sm:grid-cols-3">
          <div className="flex items-start gap-1.5">
            <Timer size={11} className="mt-0.5 shrink-0 text-blue-info" />
            <p className="text-[10px] leading-snug text-ink-title"><span className="text-ink-3">When </span>{whenLabel(catalyst.daysUntil)}</p>
          </div>
          {catalyst.priceNote && (
            <div className="flex items-start gap-1.5">
              <DollarSign size={11} className="mt-0.5 shrink-0 text-positive" />
              <p className="text-[10px] leading-snug text-ink-title"><span className="text-ink-3">Price </span>{catalyst.priceNote}</p>
            </div>
          )}
          {catalyst.accessNote && (
            <div className="flex items-start gap-1.5">
              <Link2 size={11} className="mt-0.5 shrink-0 text-accent" />
              <p className="text-[10px] leading-snug text-ink-title"><span className="text-ink-3">Access </span>{catalyst.accessNote}</p>
            </div>
          )}
        </div>
      )}

      <p className="mt-2 text-[10px] leading-snug text-ink-2"><span className="font-semibold text-positive">Set up: </span>{catalyst.setup}</p>

      {(catalyst.exposure.length > 0 || catalyst.sources?.length) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {catalyst.exposure.map((item) => (
            <ExposureChip key={item} item={item} />
          ))}
          {catalyst.sources?.map((source) => (
            <span key={source.domain} className="inline-flex items-center gap-1 font-mono text-[9px] text-ink-3">
              <SourceFavicon domain={source.domain} sourceName={source.name} /> {source.name}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function CatalystCard({ catalyst }: { catalyst: ScoredCatalyst }) {
  const Icon = CATEGORY_ICON[catalyst.category];
  const tier = TIER[catalyst.tier];

  return (
    <div className="px-3 py-2.5">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-cell border border-line-strong bg-panel text-blue-info">
          <Icon size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] font-semibold leading-snug text-ink">{catalyst.title}</span>
            <span className={`rounded border px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.1em] ${tier.chip}`}>{tier.label}</span>
            <span className="font-mono text-[9px] text-ink-3">{whenLabel(catalyst.daysUntil)}</span>
            {catalyst.dateConfidence !== 'confirmed' && (
              <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-ink-dim">{catalyst.dateConfidence}</span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-ink-2">{catalyst.why}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`font-mono text-lg font-semibold leading-none ${tier.heat}`}>{catalyst.heat}</p>
          <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-dim">heat</p>
        </div>
      </div>

      {/* Desktop: full card. Mobile: header + heat only, tall body folded behind a
          native <details> - nine fully-expanded cards were an entire screen each. */}
      <div className="hidden md:block">
        <CatalystBody catalyst={catalyst} />
      </div>
      <details className="md:hidden">
        <summary className="-mx-1 mt-1 min-h-[44px] cursor-pointer list-none rounded px-1 py-2 font-mono text-[11px] text-pending">
          Heat breakdown + how to set up
        </summary>
        <CatalystBody catalyst={catalyst} />
      </details>
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
  const { items: catalysts, asOf, isEmpty, stalenessDays } = catalystRadarState(new Date());
  const actNow = catalysts.filter((c) => c.tier === 'now').length;

  return (
    <section id="catalyst-radar" className="terminal-panel scroll-mt-16 overflow-hidden rounded-panel">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-cell border border-line-strong bg-panel text-accent">
            <RadarIcon size={14} />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">Catalyst radar</p>
            <p className="mt-0.5 text-[11px] leading-snug text-ink-2">
              The moments worth positioning for - scored on timing, impact and attention. Set up today for what is coming.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="font-mono text-[10px] text-ink-3">{actNow} act now</span>
          <CatalystRadarHelp />
        </div>
      </div>

      {isEmpty ? (
        <div className="px-3 py-6 text-center">
          <p className="text-[12px] font-semibold text-ink-title">No fresh catalysts on the board</p>
          <p className="mx-auto mt-1 max-w-md text-[11px] leading-snug text-ink-2">
            Every event in the curated set has passed. This is a hand-maintained editorial list, last curated on{' '}
            <span className="font-mono text-accent">{asOf}</span>
            {stalenessDays > 0 ? ` (${stalenessDays}d ago)` : ''} - an empty board means it is due a refresh, not that
            nothing is coming.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-line/70">
          {catalysts.map((catalyst) => (
            <CatalystCard key={catalyst.id} catalyst={catalyst} />
          ))}
        </div>
      )}

      <p className="border-t border-line px-3 py-1.5 font-mono text-[10px] text-ink-dim">
        Deterministic priority: timing x impact x attention. Curated list as of {asOf}. Research context for what is coming - never a buy/sell instruction.
      </p>
    </section>
  );
}
