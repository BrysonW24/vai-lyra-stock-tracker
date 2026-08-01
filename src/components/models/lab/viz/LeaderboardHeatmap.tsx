'use client';

import type { LabResult } from '@/lib/models/lab';
import type { EWDomain } from '@/lib/emerging-winner/types';
import { shortDomain, scoreColor } from './scale';

/**
 * LeaderboardHeatmap - the whole run in one grid. Rows = surfaced names (ranked), columns = the 10
 * domains, cell colour = that domain's real 0-100 score. `unavailable` cells are drawn as an explicit
 * hollow slash, never a colour, so a data gap is visible as a gap. Scan 20 names and the pattern of
 * strength/weakness across domains pops out. Click a row to inspect it; focus columns are tinted.
 */

const MAX_ROWS = 24;

function Cell({ domain, focus }: { domain: EWDomain | undefined; focus: boolean }) {
  const covered = domain && domain.coverage !== 'unavailable' && domain.score != null;
  if (!covered) {
    return (
      <div
        className="flex h-6 items-center justify-center rounded-[3px] border border-white/5 bg-white/[0.015]"
        title={domain ? `${domain.label}: unavailable` : 'unavailable'}
      >
        <span className="text-[9px] text-white/20">/</span>
      </div>
    );
  }
  const score = Math.round(domain!.score ?? 0);
  return (
    <div
      className={`flex h-6 items-center justify-center rounded-[3px] ${focus ? 'ring-1 ring-sky-300/60' : ''}`}
      style={{ backgroundColor: scoreColor(score, 0.85) }}
      title={`${domain!.label}: ${score}`}
    >
      <span className="text-[9px] font-semibold text-black/70">{score}</span>
    </div>
  );
}

export function LeaderboardHeatmap({
  results,
  focus = [],
  selectedSymbol,
  onSelect,
}: {
  results: LabResult[];
  focus?: string[];
  selectedSymbol?: string;
  onSelect?: (r: LabResult) => void;
}) {
  const rows = results.filter((r) => r.ew).slice(0, MAX_ROWS);
  if (!rows.length) return null;
  const domainOrder = rows[0].ew!.domains.map((d) => ({ key: d.key, label: d.label }));
  const gridCols = `5.5rem repeat(${domainOrder.length}, minmax(1.7rem, 1fr))`;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[34rem]">
        {/* Header */}
        <div className="grid items-end gap-1 pb-1" style={{ gridTemplateColumns: gridCols }}>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">Name</span>
          {domainOrder.map((d) => (
            <span
              key={d.key}
              className={`text-center text-[9px] leading-tight ${focus.includes(d.key) ? 'font-bold text-sky-300' : 'text-white/40'}`}
              title={d.label}
            >
              {shortDomain(d.key, d.label)}
            </span>
          ))}
        </div>

        {/* Rows */}
        <div className="space-y-1">
          {rows.map((r) => {
            const byKey = new Map(r.ew!.domains.map((d) => [d.key, d]));
            const active = r.symbol === selectedSymbol;
            return (
              <button
                key={r.symbol}
                type="button"
                onClick={() => onSelect?.(r)}
                className={`grid w-full items-center gap-1 rounded-md px-1 py-0.5 text-left transition ${
                  active ? 'bg-sky-500/[0.12] ring-1 ring-sky-400/40' : 'hover:bg-white/[0.04]'
                }`}
                style={{ gridTemplateColumns: gridCols }}
              >
                <span className="flex items-baseline gap-1 truncate">
                  <span className="text-[11px] font-semibold text-white">{r.symbol}</span>
                  <span className="font-mono text-[9px] text-white/40">{r.headlineValue}</span>
                </span>
                {domainOrder.map((d) => (
                  <Cell key={d.key} domain={byKey.get(d.key)} focus={focus.includes(d.key)} />
                ))}
              </button>
            );
          })}
        </div>
      </div>
      {results.filter((r) => r.ew).length > MAX_ROWS ? (
        <p className="mt-1.5 text-[10px] text-white/35">
          Showing the top {MAX_ROWS} of {results.filter((r) => r.ew).length} surfaced names.
        </p>
      ) : null}
    </div>
  );
}
