'use client';

import type { RunResult, LabResult } from '@/lib/models/lab';
import { ConvictionFunnel } from '@/components/models/lab/viz/ConvictionFunnel';
import { OpportunityMap } from '@/components/models/lab/viz/OpportunityMap';
import { LeaderboardHeatmap } from '@/components/models/lab/viz/LeaderboardHeatmap';
import { DomainProfileBars } from '@/components/models/lab/viz/DomainProfileBars';
import { RiskGateSummary } from '@/components/models/lab/viz/RiskGateSummary';

/**
 * Run visuals - the full-width board under the three-panel workbench once an Emerging Winner run
 * lands: conviction funnel, opportunity map, 10-domain heatmap, average profile and risk gates.
 * Every chart reads straight from this run's logged results; selecting a name here highlights it
 * in the Surfaced candidates panel. Radar-family runs have no EW payload, so the board stays off
 * rather than plotting fields that do not exist for them.
 */

export function RunBoard({
  run,
  focus,
  selectedSymbol,
  onSelect,
}: {
  run: RunResult;
  focus: string[];
  selectedSymbol: string | null;
  onSelect: (symbol: string | null) => void;
}) {
  const hasEw = run.results.some((r) => r.ew);
  if (!hasEw || run.results.length === 0) return null;

  const select = (r: LabResult) => onSelect(r.symbol);

  return (
    <section className="mt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">Run visuals</h2>
        <span className="text-[10px] text-white/35">every chart reads from this run&apos;s logged results</span>
      </div>

      <div className="mt-2 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <VizCard title="Conviction funnel" hint="idea to realised">
            <ConvictionFunnel summary={run.summary} results={run.results} universeNote={run.summary.universeLabel} />
          </VizCard>
          <VizCard title="Opportunity map" hint="resemblance x risk">
            <OpportunityMap results={run.results} selectedSymbol={selectedSymbol ?? undefined} onSelect={select} />
          </VizCard>
        </div>
        <VizCard title="Domain heatmap" hint="every name x 10 domains">
          <LeaderboardHeatmap results={run.results} focus={focus} selectedSymbol={selectedSymbol ?? undefined} onSelect={select} />
        </VizCard>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <VizCard title="Average domain profile" hint="the run's fingerprint">
            <DomainProfileBars results={run.results} focus={focus} />
          </VizCard>
          <VizCard title="Risk gates" hint="how the batch cleared">
            <RiskGateSummary results={run.results} />
          </VizCard>
        </div>
      </div>
    </section>
  );
}

function VizCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="terminal-panel-soft rounded-2xl p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-[12px] font-semibold text-white/80">{title}</h3>
        {hint ? <span className="text-[10px] text-white/35">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}
