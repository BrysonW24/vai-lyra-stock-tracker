'use client';

import type { LabResult, RunSummary } from '@/lib/models/lab';

/**
 * ConvictionFunnel - the pipeline from idea to realised performance, made visible AND honest at every
 * stage. The upstream stages carry this run's real counts (reviewed -> risk-cleared -> surfaced ->
 * strong). The downstream stages (watchlist -> position -> realised) are drawn as explicitly OPEN:
 * they close only when the user acts and outcomes mature over 12 months via the immutable ledger. We
 * never fake a number there - an empty forward stage is the truth about where conviction currently is.
 */

function nf(n: number): string {
  return n.toLocaleString('en-US');
}

export function ConvictionFunnel({
  summary,
  results,
  universeNote,
}: {
  summary: RunSummary;
  results: LabResult[];
  universeNote?: string;
}) {
  const strong = results.filter((r) => r.tone === 'strong').length;
  const base = Math.max(summary.reviewed, 1);

  const filled = [
    { label: 'Reviewed', value: summary.reviewed, tone: 'sky' as const },
    { label: 'Risk-cleared', value: summary.passed, tone: 'sky' as const },
    { label: 'Surfaced', value: summary.surfaced, tone: 'emerald' as const },
    { label: 'Strong signal', value: strong, tone: 'emerald' as const },
  ];

  const open = [
    { label: 'Watchlist', hint: 'you decide what to track' },
    { label: 'Position', hint: 'sized by conviction x risk gates' },
    { label: 'Realised', hint: 'matures over 12m via the ledger' },
  ];

  return (
    <div className="space-y-2">
      {universeNote ? (
        <div className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-3 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">Universe</span>
          <span className="text-[11px] text-white/55">{universeNote}</span>
        </div>
      ) : null}

      <div className="space-y-1.5">
        {filled.map((s) => {
          const pct = Math.max(6, Math.round((s.value / base) * 100));
          return (
            <div key={s.label} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-[11px] text-white/55">{s.label}</span>
              <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-white/[0.03]">
                <div
                  className={`h-full rounded-md ${s.tone === 'emerald' ? 'bg-emerald-400/30' : 'bg-sky-400/25'}`}
                  style={{ width: `${pct}%` }}
                />
                <span className="absolute inset-y-0 left-2 flex items-center text-[11px] font-semibold tabular-nums text-white/85">
                  {nf(s.value)}
                </span>
              </div>
            </div>
          );
        })}

        {/* Open forward stages - honest placeholders, never a faked count */}
        {open.map((s) => (
          <div key={s.label} className="flex items-center gap-2 opacity-70">
            <span className="w-24 shrink-0 text-[11px] text-white/40">{s.label}</span>
            <div className="flex h-6 flex-1 items-center rounded-md border border-dashed border-white/12 px-2">
              <span className="text-[10px] text-white/35">open · {s.hint}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
