import { COMMODITIES } from '@/lib/commodities';

/**
 * Commodities space - key raw materials, real source countries, and the AI-buildout
 * angle. Source data is real; one-line notes are illustrative until live prices +
 * commodity newsflow wire in (see lib/commodities.ts).
 */
export function CommoditiesCard() {
  return (
    <section className="terminal-panel overflow-hidden rounded-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">Commodities</p>
          <p className="mt-0.5 text-[10px] text-ink-2">Key raw materials, where they come from, and the AI-buildout angle</p>
        </div>
        <span className="shrink-0 rounded border border-accent-border bg-accent-tint px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-accent">Sample notes</span>
      </div>
      <div className="divide-y divide-line">
        {COMMODITIES.map((c) => (
          <div key={c.name} className="px-3 py-2">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{c.emoji}</span>
              <span className="text-sm font-semibold text-ink">{c.name}</span>
              {c.ai && (
                <span className="rounded border border-positive/40 bg-positive-tint px-1 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-positive">AI</span>
              )}
              <span className="ml-auto truncate pl-2 font-mono text-[10px] text-ink-3">{c.from}</span>
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-ink-title">{c.note}</p>
          </div>
        ))}
      </div>
      <p className="border-t border-line px-3 py-1.5 font-mono text-[10px] text-ink-dim">
        Source countries are real; notes are illustrative. Live next: prices + commodity newsflow.
      </p>
    </section>
  );
}
