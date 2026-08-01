'use client';

import { useMemo, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { ConfigurePanel } from '@/components/models/lab/ConfigurePanel';
import { RunTimeline } from '@/components/models/lab/RunTimeline';
import { ResultsView } from '@/components/models/lab/ResultsView';
import { PreviousRuns } from '@/components/models/lab/PreviousRuns';
import { ModelsView } from '@/components/models/ModelsView';
import {
  buildRun,
  getModel,
  RECOMMENDED_CONFIG,
  type LabConfig,
  type RunData,
  type RunResult,
} from '@/lib/models/lab';
import { saveRun, newRunId } from '@/lib/models/lab-history';
import type { DashboardData } from '@/types/scanner';
import type { EmergingWinnerQueue } from '@/lib/emerging-winner/types';

/**
 * Model Lab - the /models experience. Three tabs (Run / Previous runs / Models & methods) and a
 * config -> running -> results state machine. The catalogue that used to BE this page now lives in
 * Models & methods, so the primary surface is "tell Lyra what to discover, watch it work, inspect
 * why each name surfaced" rather than a wall of architecture. All the honesty lives one layer down
 * in lab.ts: this component just orchestrates state.
 */

type Tab = 'run' | 'previous' | 'methods';
type Phase = 'configure' | 'running' | 'results';

const TABS: { key: Tab; label: string }[] = [
  { key: 'run', label: 'Run' },
  { key: 'previous', label: 'Previous runs' },
  { key: 'methods', label: 'Models & methods' },
];

export function ModelLab({ data, ew }: { data: DashboardData; ew: EmergingWinnerQueue }) {
  const [tab, setTab] = useState<Tab>('run');
  const [phase, setPhase] = useState<Phase>('configure');
  const [config, setConfig] = useState<LabConfig>(RECOMMENDED_CONFIG);
  const [run, setRun] = useState<RunResult | null>(null);
  const [nonce, setNonce] = useState(0);

  const runData: RunData = useMemo(
    () => ({
      signals: data.signals,
      tickers: data.tickers,
      ew,
      watchlist: data.watchlist,
      portfolio: data.portfolio,
    }),
    [data, ew],
  );

  const model = getModel(config.modelKey);

  function onChange(patch: Partial<LabConfig>) {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      if (patch.modelKey && patch.modelKey !== prev.modelKey) {
        const m = getModel(patch.modelKey);
        const firstRunnable = m.outcomes.find((o) => o.runnable) ?? m.outcomes[0];
        next.outcomeKey = firstRunnable.key;
        next.verticals = [];
      }
      return next;
    });
  }

  function onRun() {
    const result = buildRun(config, runData);
    setRun(result);
    setNonce((n) => n + 1);
    setPhase('running');
  }

  function onRunComplete() {
    if (!run) return;
    const outcome = model.outcomes.find((o) => o.key === config.outcomeKey);
    saveRun({
      id: newRunId(),
      at: new Date().toISOString(),
      modelKey: model.key,
      modelName: model.name,
      outcomeLabel: outcome?.label ?? config.outcomeKey,
      universeLabel: run.summary.universeLabel,
      reviewed: run.summary.reviewed,
      surfaced: run.summary.surfaced,
      version: run.summary.version,
      config,
    });
    setPhase('results');
  }

  function onReplay(cfg: LabConfig) {
    setConfig(cfg);
    setRun(null);
    setPhase('configure');
    setTab('run');
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+6rem)] xl:pb-10">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-white">
            <FlaskConical size={18} className="text-sky-400" /> Model Lab
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-white/60">
            Tell Lyra what you want to discover, define where it should look, watch it investigate, and inspect exactly why
            each company surfaced. Research only - the deterministic engine decides, models inform.
          </p>
        </div>
      </header>

      {/* Real-universe note - honest about capability and current data state. */}
      <div className="mt-3 rounded-xl border border-sky-400/20 bg-sky-500/[0.06] p-3 text-[12px] leading-relaxed text-sky-200/90">
        The Emerging Winner engine scans the <span className="font-semibold">real SEC-listed universe</span> - every US
        company that files with the SEC (~10,400, small-caps included), refreshed dynamically so new listings are picked
        up automatically - using free public data (SEC + market data).{' '}
        {ew.demo
          ? 'This surface currently shows illustrative examples; a live run populates the ledger.'
          : 'This surface shows the latest logged run.'}{' '}
        Real <span className="font-semibold">SEC EDGAR fundamentals</span> (margin trend + share dilution, keyed by the
        authoritative CIK) are now wired for live runs; the remaining deep domains (insider flow, government contracts,
        delisted history) are the data gate, so those read <span className="font-mono text-[11px]">unavailable</span>{' '}
        rather than a guessed value.
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 border-b border-white/10">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`relative px-3 py-2 text-[13px] font-medium transition-colors ${
              tab === t.key ? 'text-white' : 'text-white/45 hover:text-white/70'
            }`}
          >
            {t.label}
            {tab === t.key ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-sky-400" /> : null}
          </button>
        ))}
      </div>

      {/* Panels */}
      <div className="mt-5">
        {tab === 'run' ? (
          <div className="space-y-4">
            {phase === 'configure' ? (
              <ConfigurePanel config={config} data={runData} onChange={onChange} onRun={onRun} />
            ) : null}

            {phase === 'running' && run ? (
              <RunTimeline key={nonce} run={run} modelName={model.name} caption={model.runCaption} onDone={onRunComplete} />
            ) : null}

            {phase === 'results' && run ? (
              <ResultsView run={run} modelName={model.name} focus={config.domainFocus ?? []} onNewRun={() => setPhase('configure')} />
            ) : null}
          </div>
        ) : null}

        {tab === 'previous' ? <PreviousRuns onReplay={onReplay} /> : null}

        {tab === 'methods' ? <ModelsView /> : null}
      </div>
    </div>
  );
}
