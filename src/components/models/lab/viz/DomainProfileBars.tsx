'use client';

import type { LabResult } from '@/lib/models/lab';
import { scoreColor } from './scale';

/**
 * DomainProfileBars - the average shape of the whole run across the 10 domains. For each domain it
 * averages the real score over the names that actually cover it, and shows how many of the surfaced
 * names carry that domain (coverage), so a domain that is strong-but-thinly-covered never reads the
 * same as a domain that is strong across the board. A domain covered by nobody is drawn as an explicit
 * gap, never a zero. This is the run's fingerprint: where the batch is strong, weak, or data-starved.
 */

export function DomainProfileBars({ results, focus = [] }: { results: LabResult[]; focus?: string[] }) {
  const ew = results.filter((r) => r.ew);
  if (!ew.length) return null;
  const order = ew[0].ew!.domains.map((d) => ({ key: d.key, label: d.label }));

  const rows = order.map((d) => {
    const covered = ew
      .map((r) => r.ew!.domains.find((x) => x.key === d.key))
      .filter((x) => x && x.coverage !== 'unavailable' && x.score != null) as { score: number }[];
    const avg = covered.length ? covered.reduce((s, x) => s + (x.score ?? 0), 0) / covered.length : null;
    return { ...d, avg, coveredCount: covered.length, total: ew.length };
  });

  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2">
          <span className={`w-24 shrink-0 truncate text-[11px] ${focus.includes(r.key) ? 'font-semibold text-sky-300' : 'text-white/55'}`}>
            {r.label}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            {r.avg != null ? (
              <div className="h-full rounded-full" style={{ width: `${Math.round(r.avg)}%`, backgroundColor: scoreColor(r.avg, 0.85) }} />
            ) : null}
          </div>
          <span className="w-14 shrink-0 text-right font-mono text-[10px] text-white/40">
            {r.avg != null ? Math.round(r.avg) : '-'}
          </span>
          <span className="w-9 shrink-0 text-right text-[9px] text-white/30" title="names covering this domain">
            {r.coveredCount}/{r.total}
          </span>
        </div>
      ))}
    </div>
  );
}
