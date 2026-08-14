'use client';

import { useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import { ConfigurePanel } from '@/components/models/lab/ConfigurePanel';
import { RunTimeline } from '@/components/models/lab/RunTimeline';
import { ResultsView } from '@/components/models/lab/ResultsView';
import { RunBoard } from '@/components/models/lab/RunBoard';
import { PreviousRuns } from '@/components/models/lab/PreviousRuns';
import { ModelsView } from '@/components/models/ModelsView';
import { ModelVerdict } from '@/components/models/ModelVerdict';
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
 * Model Lab - the /models experience. Three tabs (Run / Previous runs / Models & methods); the Run
 * tab is a three-panel workbench: configure on the left, live model execution in the centre,
 * surfaced candidates on the right, with the full run visuals underneath once a run lands. All the
 * honesty lives one layer down in lab.ts - every number rendered anywhere on this surface is read
 * from the run that lab.ts built over real loaded data; this component just orchestrates state.
 */

type Tab = 'run' | 'previous' | 'methods';
type Phase = 'configure' | 'running' | 'results';

const TABS: { key: Tab; label: string; icon?: boolean }[] = [
  { key: 'run', label: 'Run', icon: true },
  { key: 'previous', label: 'Previous runs' },
  { key: 'methods', label: 'Models & methods' },
];

export function ModelLab({ data, ew }: { data: DashboardData; ew: EmergingWinnerQueue }) {
  const [tab, setTab] = useState<Tab>('run');
  const [phase, setPhase] = useState<Phase>('configure');
  const [config, setConfig] = useState<LabConfig>(RECOMMENDED_CONFIG);
  const [run, setRun] = useState<RunResult | null>(null);
  const [nonce, setNonce] = useState(0);
  const [runMeta, setRunMeta] = useState<{
    id: string;
    startedAt: string;
    modelKey: string;
    modelName: string;
    family: 'radar' | 'ew';
    caption: string;
    outcomeLabel: string;
    focus: string[];
  } | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  const runData: RunData = useMemo(
    () => ({
      signals: data.signals,
      tickers: data.tickers,
      ew,
      watchlist: data.watchlist,
      portfolio: data.portfolio,
      generatedFrom: data.generatedFrom,
    }),
    [data, ew],
  );

  const model = getModel(config.modelKey);
  const outcome = model.outcomes.find((o) => o.key === config.outcomeKey);

  // Idle preview - the real pipeline stages the current config would run, shown queued until Run.
  // buildRun is pure and cheap; nothing here is presented as having executed.
  const preview = useMemo(() => buildRun(config, runData), [config, runData]);

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
    setRunMeta({
      id: newRunId(),
      startedAt: new Date().toISOString(),
      modelKey: model.key,
      modelName: model.name,
      family: model.family,
      caption: model.runCaption,
      outcomeLabel: outcome?.label ?? config.outcomeKey,
      focus: [...(config.domainFocus ?? [])],
    });
    setSelectedSymbol(null);
    setNonce((n) => n + 1);
    setPhase('running');
  }

  function onRunComplete() {
    if (!run || !runMeta) return;
    saveRun({
      id: runMeta.id,
      at: runMeta.startedAt,
      modelKey: runMeta.modelKey,
      modelName: runMeta.modelName,
      outcomeLabel: runMeta.outcomeLabel,
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
    setRunMeta(null);
    setSelectedSymbol(null);
    setPhase('configure');
    setTab('run');
  }

  return (
    <div className="mx-auto w-full max-w-[100rem] px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+6rem)] xl:pb-10">
      {/* Real-universe note - honest about capability and current data state. */}
      <div className="rounded-xl border border-sky-400/20 bg-sky-500/[0.06] p-3 text-[12px] leading-relaxed text-sky-200/90">
        The Emerging Winner engine scans the <span className="font-semibold">real SEC-listed universe</span> - every US
        company that files with the SEC (~10,400, small-caps included), refreshed dynamically so new listings are picked
        up automatically - using free public data (SEC + market data).{' '}
        {ew.demo
          ? 'This surface currently shows illustrative examples; a live run populates the ledger.'
          : 'This surface shows the latest logged run.'}{' '}
        Real <span className="font-semibold">SEC EDGAR fundamentals</span> (margin trend + share dilution, keyed by the
        authoritative CIK) are wired for live runs, and the winner classifier is now{' '}
        <span className="font-semibold">trained on real historical outcomes</span> (a survivor-biased 2016-2025 backtest
        corpus - delisted names still absent); the remaining deep domains (government contracts, insider flow and
        sponsorship, adoption) are still the data gate, so those read{' '}
        <span className="font-mono text-[11px]">unavailable</span> rather than a guessed value.
      </div>

      {/* Tabs */}
      <div className="no-scrollbar mt-4 flex gap-1 overflow-x-auto border-b border-white/10">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`relative flex shrink-0 items-center gap-1.5 px-3 py-2 text-[13px] font-medium transition-colors ${
              tab === t.key ? 'text-white' : 'text-white/45 hover:text-white/70'
            }`}
          >
            {t.icon ? <Play size={12} className={tab === t.key ? 'text-sky-400' : 'text-white/35'} /> : null}
            {t.label}
            {tab === t.key ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-sky-400" /> : null}
          </button>
        ))}
      </div>

      {/* Panels */}
      <div className="mt-5">
        {tab === 'run' ? (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)_minmax(0,22rem)] lg:items-start xl:grid-cols-[minmax(0,23rem)_minmax(0,1fr)_minmax(0,25rem)]">
              <ConfigurePanel
                config={config}
                data={runData}
                onChange={onChange}
                onRun={onRun}
                running={phase === 'running'}
              />

              <RunTimeline
                key={run ? `run-${nonce}` : `idle-${config.modelKey}`}
                run={run ?? preview}
                mode={run ? (phase === 'results' ? 'completed' : 'live') : 'idle'}
                modelName={runMeta && run ? runMeta.modelName : model.name}
                family={runMeta && run ? runMeta.family : model.family}
                caption={runMeta && run ? runMeta.caption : model.runCaption}
                runId={runMeta?.id ?? null}
                startedAt={runMeta?.startedAt ?? null}
                onDone={onRunComplete}
              />

              <ResultsView
                run={phase === 'results' ? run : null}
                pending={phase === 'running'}
                focus={runMeta?.focus ?? []}
                rankLabel={runMeta?.outcomeLabel}
                selectedSymbol={selectedSymbol}
                onSelectSymbol={setSelectedSymbol}
              />
            </div>

            {phase === 'results' && run ? (
              <>
                <RunBoard
                  run={run}
                  focus={runMeta?.focus ?? []}
                  selectedSymbol={selectedSymbol}
                  onSelect={setSelectedSymbol}
                />
                {/* The reveal: does this engine actually predict success? Backtest evidence for the
                    model just run - light-glass verdict surface, every number from model-evidence.json. */}
                <ModelVerdict />
              </>
            ) : null}
          </>
        ) : null}

        {tab === 'previous' ? <PreviousRuns onReplay={onReplay} /> : null}

        {tab === 'methods' ? <ModelsView /> : null}
      </div>
    </div>
  );
}
