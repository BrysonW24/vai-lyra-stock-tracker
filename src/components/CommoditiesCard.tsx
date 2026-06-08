import { COMMODITIES } from '@/lib/commodities';

/**
 * Commodities space - key raw materials, real source countries, and the AI-buildout
 * angle. Source data is real; one-line notes are illustrative until live prices +
 * commodity newsflow wire in (see lib/commodities.ts).
 */
export function CommoditiesCard() {
  return (
    <section className="terminal-panel overflow-hidden rounded-md">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1b2530] px-3 py-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Commodities</p>
          <p className="mt-0.5 text-[10px] text-[#a8b5c2]">Key raw materials, where they come from, and the AI-buildout angle</p>
        </div>
        <span className="shrink-0 rounded border border-[#9a6a1f] bg-[#2a1f0f] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#f3a33a]">Sample notes</span>
      </div>
      <div className="divide-y divide-[#1b2530]">
        {COMMODITIES.map((c) => (
          <div key={c.name} className="px-3 py-2">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{c.emoji}</span>
              <span className="text-sm font-semibold text-[#eef3f8]">{c.name}</span>
              {c.ai && (
                <span className="rounded border border-[#1d4f3a] bg-[#0d251b] px-1 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[#43d18b]">AI</span>
              )}
              <span className="ml-auto truncate pl-2 font-mono text-[10px] text-[#8190a0]">{c.from}</span>
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-[#c8d3de]">{c.note}</p>
          </div>
        ))}
      </div>
      <p className="border-t border-[#1b2530] px-3 py-1.5 font-mono text-[10px] text-[#5e6b78]">
        Source countries are real; notes are illustrative. Live next: prices + commodity newsflow.
      </p>
    </section>
  );
}
