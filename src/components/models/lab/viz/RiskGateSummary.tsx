'use client';

import type { LabResult } from '@/lib/models/lab';

/**
 * RiskGateSummary - how the whole run cleared the five risk gates. For each gate it counts the real
 * verdicts across every reviewed name (pass / review / block / insufficient) and draws one stacked
 * bar, so you can see at a glance which gate is doing the excluding. `insufficient` (missing data) is
 * its own segment - a gate that could not judge is never silently counted as a pass.
 */

const SEG = [
  { key: 'pass', label: 'pass', color: 'hsl(152 62% 46%)' },
  { key: 'review', label: 'review', color: 'hsl(38 92% 55%)' },
  { key: 'block', label: 'block', color: 'hsl(2 74% 56%)' },
  { key: 'insufficient', label: 'insufficient', color: 'hsl(215 15% 45%)' },
] as const;

export function RiskGateSummary({ results }: { results: LabResult[] }) {
  const ew = results.filter((r) => r.ew);
  if (!ew.length) return null;

  // Aggregate verdict counts per gate key, preserving first-seen label + order.
  const gates = new Map<string, { label: string; counts: Record<string, number> }>();
  for (const r of ew) {
    for (const g of r.ew!.risk.gates) {
      if (!gates.has(g.key)) gates.set(g.key, { label: g.label, counts: { pass: 0, review: 0, block: 0, insufficient: 0 } });
      const rec = gates.get(g.key)!;
      rec.counts[g.verdict] = (rec.counts[g.verdict] ?? 0) + 1;
    }
  }
  const list = [...gates.values()];
  if (!list.length) return null;

  return (
    <div className="space-y-2">
      {list.map((g) => {
        const total = SEG.reduce((s, seg) => s + (g.counts[seg.key] ?? 0), 0) || 1;
        return (
          <div key={g.label} className="flex items-center gap-2">
            <span className="w-24 shrink-0 truncate text-[11px] text-white/55">{g.label}</span>
            <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
              {SEG.map((seg) => {
                const c = g.counts[seg.key] ?? 0;
                if (!c) return null;
                return <div key={seg.key} style={{ width: `${(c / total) * 100}%`, backgroundColor: seg.color }} title={`${seg.label}: ${c}`} />;
              })}
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5 text-[10px] text-white/45">
        {SEG.map((seg) => (
          <span key={seg.key} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: seg.color }} /> {seg.label}
          </span>
        ))}
      </div>
    </div>
  );
}
