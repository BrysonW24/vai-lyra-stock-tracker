'use client';

import { useEffect, useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { loadRuns, clearRuns, type RunHistoryEntry } from '@/lib/models/lab-history';
import type { LabConfig } from '@/lib/models/lab';

/**
 * Previous runs - the user's own Model Lab history, read from local storage. Each row can be
 * reopened, which restores its exact configuration into the Run tab. Honest: this is the browser's
 * record of runs you have executed, not a server ledger.
 */

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function PreviousRuns({ onReplay }: { onReplay: (config: LabConfig) => void }) {
  const [runs, setRuns] = useState<RunHistoryEntry[]>([]);

  useEffect(() => {
    setRuns(loadRuns());
  }, []);

  if (runs.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
        <p className="text-[14px] text-white/70">No runs yet.</p>
        <p className="mt-1 text-[12px] text-white/45">Runs you execute in the Run tab are saved here, on this device.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-white/45">{runs.length} run{runs.length === 1 ? '' : 's'} on this device</p>
        <button
          type="button"
          onClick={() => {
            clearRuns();
            setRuns([]);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-white/50 transition hover:border-rose-400/30 hover:text-rose-300"
        >
          <Trash2 size={12} /> Clear
        </button>
      </div>

      <ul className="space-y-2">
        {runs.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-semibold text-white">{r.modelName}</span>
                <span className="text-[11px] text-white/45">{r.outcomeLabel}</span>
              </div>
              <div className="mt-0.5 truncate text-[11px] text-white/40">
                {r.universeLabel} · {r.reviewed.toLocaleString('en-US')} reviewed · {r.surfaced.toLocaleString('en-US')} surfaced ·{' '}
                <span className="font-mono">{r.version}</span>
              </div>
            </div>
            <span className="shrink-0 text-[11px] text-white/35">{timeAgo(r.at)}</span>
            <button
              type="button"
              onClick={() => onReplay(r.config)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/80 transition hover:bg-white/10"
            >
              <RotateCcw size={12} /> Open
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
