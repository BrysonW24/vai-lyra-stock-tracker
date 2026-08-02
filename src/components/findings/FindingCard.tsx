'use client';

import type { Finding } from '@/lib/findings/types';
import { stateTone } from '@/lib/findings/types';

/**
 * Compact, actionable Opportunity Finding card for the /intelligence feed. Answers, at a glance:
 * what surfaced, why, the score breakdown, and the lead action. Tapping it opens the finding
 * drawer (the investigation entry point). Dense dark aesthetic to match the command centre.
 */
export function FindingCard({ finding, onOpen }: { finding: Finding; onOpen: (id: string) => void }) {
  const s = finding.scores;
  const scoreChips: [string, number | undefined][] = [
    ['Gov', s.government],
    ['Vol', s.volume],
    ['Tech', s.technical],
    ['Theme', s.themeFit],
    ['Risk', s.riskPenalty],
  ];

  return (
    <button
      type="button"
      onClick={() => onOpen(finding.id)}
      className="terminal-panel block w-full rounded-panel border border-line p-3 text-left transition hover:border-line-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {finding.symbol && <span className="font-mono text-sm font-semibold text-ink">{finding.symbol}</span>}
            <span className={`text-[10px] uppercase tracking-[0.12em] ${stateTone(finding.state)}`}>{finding.state}</span>
          </div>
          <p className="mt-1 truncate text-[11px] text-ink-2">{finding.title}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="numeric font-mono text-base font-semibold tabular-nums text-ink">{s.total > 0 ? s.total : 'NR'}</p>
          <p className="text-[9px] uppercase tracking-[0.12em] text-ink-3">{s.total > 0 ? 'score' : 'not rated'}</p>
        </div>
      </div>

      <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-ink-3">{finding.summary}</p>

      <div className="mt-2 flex flex-wrap gap-1">
        {scoreChips
          .filter(([, v]) => typeof v === 'number')
          .map(([label, v]) => (
            <span
              key={label}
              className="rounded-cell bg-well px-1.5 py-0.5 font-mono text-[9px] tabular-nums text-ink-3"
            >
              {label} {v}
            </span>
          ))}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-blue-focus">Why surfaced - {finding.whySurfaced.length} reasons</span>
        <span className="text-[10px] text-ink-3">Open finding -&gt;</span>
      </div>
    </button>
  );
}
