'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, AlertTriangle, ChevronDown } from 'lucide-react';
import type { ModelFamily, RunResult, RunStage, StageState } from '@/lib/models/lab';

/**
 * Centre panel - Live model execution. An honest, staged reveal of the REAL pipeline that produced
 * the run. Each stage moves queued -> running -> complete (or warning) and shows the actual output
 * that stage produced - counts derived from real data, never invented. Idle mode previews the same
 * real stages queued (metrics read "-") before Run is pressed; completed mode renders the finished
 * run instantly (e.g. returning from another tab) without replaying the animation. The pacing is
 * presentation; the stages, their order, and their outputs are real. The caption states plainly
 * whether this is a live computation (Live models) or a replay of the shadow-live pipeline over an
 * illustrative universe (EW models), so nothing here pretends to scan companies that do not exist.
 */

const STEP_MS = 420;

export type TimelineMode = 'idle' | 'live' | 'completed';

function finalState(seed: StageState): StageState {
  return seed === 'warning' ? 'warning' : 'complete';
}

function nf(n: number): string {
  return n.toLocaleString('en-US');
}

function StageDot({ state }: { state: StageState }) {
  if (state === 'complete') {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald-400/60 bg-emerald-500/10">
        <Check size={11} className="text-emerald-400" />
      </span>
    );
  }
  if (state === 'warning') {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-amber-400/60 bg-amber-500/10">
        <AlertTriangle size={10} className="text-amber-400" />
      </span>
    );
  }
  if (state === 'running') {
    return (
      <span className="relative flex h-5 w-5 items-center justify-center">
        <span className="absolute h-5 w-5 animate-ping rounded-full border border-sky-400/50" />
        <span className="h-5 w-5 rounded-full border-2 border-sky-400/70 bg-sky-500/15" />
        <span className="absolute h-1.5 w-1.5 rounded-full bg-sky-400" />
      </span>
    );
  }
  return <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-white/[0.02]" />;
}

function useCountUp(target: number, durationMs: number, active: boolean): number {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (!active) return;
    let start: number | null = null;
    const tick = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else setValue(target);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, durationMs, active]);
  return value;
}

function timeAgo(iso: string, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

export function RunTimeline({
  run,
  mode,
  modelName,
  family,
  caption,
  runId,
  startedAt,
  onDone,
}: {
  run: RunResult;
  mode: TimelineMode;
  modelName: string;
  family: ModelFamily;
  caption: string;
  runId: string | null;
  startedAt: string | null;
  onDone: () => void;
}) {
  const [states, setStates] = useState<StageState[]>(() =>
    run.stages.map((s) => (mode === 'completed' ? finalState(s.state) : 'queued')),
  );
  const [doneAt, setDoneAt] = useState<(number | null)[]>(() => run.stages.map(() => null));
  const [elapsed, setElapsed] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [allLogsOpen, setAllLogsOpen] = useState(false);
  const [done, setDone] = useState(mode === 'completed');
  const [now, setNow] = useState(() => Date.now());

  const totalMs = run.stages.length * STEP_MS + 300;

  // StrictMode-safe: no started guard - the cleanup clears every timer, so the dev double-mount
  // simply restarts the reveal from zero instead of freezing it. Deps are [] on purpose: one reveal
  // per mounted run instance (the parent re-keys per run).
  useEffect(() => {
    if (mode !== 'live') return;
    setStates(run.stages.map(() => 'queued'));
    setDoneAt(run.stages.map(() => null));
    const timers: ReturnType<typeof setTimeout>[] = [];

    run.stages.forEach((stage, i) => {
      timers.push(
        setTimeout(() => {
          setStates((prev) => prev.map((s, idx) => (idx === i ? 'running' : s)));
        }, i * STEP_MS),
      );
      timers.push(
        setTimeout(
          () => {
            setStates((prev) => prev.map((s, idx) => (idx === i ? finalState(stage.state) : s)));
            setDoneAt((prev) => prev.map((v, idx) => (idx === i ? (i * STEP_MS + STEP_MS * 0.62) / 1000 : v)));
          },
          i * STEP_MS + STEP_MS * 0.62,
        ),
      );
    });

    timers.push(
      setTimeout(() => {
        setDone(true);
        onDone();
      }, totalMs),
    );

    const started = performance.now();
    const clock = setInterval(() => setElapsed(performance.now() - started), 50);
    timers.push(setTimeout(() => clearInterval(clock), totalMs) as unknown as ReturnType<typeof setTimeout>);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(clock);
    };
    // Run once for this run instance (parent re-keys on each run).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the "Started Xm ago" footer honest without a fast clock.
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [startedAt]);

  const idle = mode === 'idle';
  const finished = done || mode === 'completed';
  const active = mode === 'live';

  const reviewedC = useCountUp(run.summary.reviewed, totalMs, active);
  const passedC = useCountUp(run.summary.passed, totalMs, active);
  const surfacedC = useCountUp(run.summary.surfaced, totalMs, active);
  // 4th cell - the real per-stage workload the pipeline states in its own logs
  // (EW: 10 domains x names; radar: 5 drivers x names).
  const unitsPerName = family === 'ew' ? 10 : 5;
  const workC = useCountUp(run.summary.reviewed * unitsPerName, totalMs, active);

  const reviewed = idle ? null : mode === 'completed' ? run.summary.reviewed : reviewedC;
  const passed = idle ? null : mode === 'completed' ? run.summary.passed : passedC;
  const surfaced = idle ? null : mode === 'completed' ? run.summary.surfaced : surfacedC;
  const work = idle ? null : mode === 'completed' ? run.summary.reviewed * unitsPerName : workC;

  const subtitle = idle
    ? `${modelName} ready - press Run to watch the pipeline work.`
    : finished
      ? `${modelName} complete - every number below is from this run.`
      : `${modelName} running - Lyra is investigating your universe.`;

  return (
    <section className="terminal-panel rounded-2xl p-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">Live model execution</h2>
          {idle ? (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/50">Idle</span>
          ) : finished ? (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-400/30">
              Complete
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-400/30">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live
            </span>
          )}
          {active ? <span className="font-mono text-[11px] tabular-nums text-white/40">{(elapsed / 1000).toFixed(1)}s</span> : null}
        </div>
        <div className="glass-well rounded-xl px-3 py-1.5 text-right">
          <div className="text-[9px] uppercase tracking-wide text-white/40">Universe</div>
          <div className="text-[13px] font-semibold tabular-nums text-white">
            {reviewed == null ? '-' : `${nf(reviewed)} ${reviewed === 1 ? 'company' : 'companies'}`}
          </div>
        </div>
      </div>

      <p className="mt-1.5 text-[12px] text-white/60">{subtitle}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-white/40">{caption}</p>

      {/* Stage stepper */}
      <ol className="mt-4 space-y-1">
        {run.stages.map((stage, i) => (
          <StageRow
            key={stage.id}
            stage={stage}
            state={states[i]}
            doneAt={doneAt[i]}
            last={i === run.stages.length - 1}
            open={allLogsOpen || open === stage.id}
            onToggle={() => setOpen((cur) => (cur === stage.id ? null : stage.id))}
          />
        ))}
      </ol>

      {/* Stats strip */}
      <div className="glass-well mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl sm:grid-cols-4">
        <StatCell label="Companies considered" value={reviewed} />
        <StatCell label={family === 'ew' ? 'Domain scores computed' : 'Driver scores computed'} value={work} />
        <StatCell label={family === 'ew' ? 'Passing risk gates' : 'Cleared for ranking'} value={passed} tone={family === 'ew' ? 'emerald' : undefined} />
        <StatCell label="Surfaced candidates" value={surfaced} tone="emerald" />
      </div>

      {/* Footer */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2.5">
        <p className="min-w-0 truncate text-[11px] text-white/40">
          {idle || !runId || !startedAt ? (
            'No run yet.'
          ) : (
            <>
              Started {timeAgo(startedAt, now)} · Run ID:{' '}
              <span className="font-mono text-[10px] text-white/50" title={runId}>
                {runId.slice(0, 8)}
              </span>
              {' · '}
              <span className="font-mono text-[10px] text-white/35">{run.summary.version}</span>
            </>
          )}
        </p>
        {!idle ? (
          <button
            type="button"
            onClick={() => setAllLogsOpen((v) => !v)}
            className="shrink-0 text-[11px] font-medium text-sky-300 transition hover:text-sky-200"
          >
            {allLogsOpen ? 'Hide run log' : 'View run log'}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function StatCell({ label, value, tone }: { label: string; value: number | null; tone?: 'emerald' }) {
  return (
    <div className="bg-[#0b1016]/60 px-3 py-2.5">
      <div className={`text-lg font-bold tabular-nums ${value == null ? 'text-white/25' : tone === 'emerald' ? 'text-emerald-300' : 'text-white'}`}>
        {value == null ? '-' : nf(value)}
      </div>
      <div className="text-[9px] uppercase tracking-wide text-white/40">{label}</div>
    </div>
  );
}

function StageRow({
  stage,
  state,
  doneAt,
  last,
  open,
  onToggle,
}: {
  stage: RunStage;
  state: StageState;
  doneAt: number | null;
  last: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const revealed = state === 'complete' || state === 'warning' || state === 'running';
  const statusLine =
    state === 'complete'
      ? `Completed${doneAt != null ? ` · ${doneAt.toFixed(1)}s` : ''}`
      : state === 'warning'
        ? `Completed with warnings${doneAt != null ? ` · ${doneAt.toFixed(1)}s` : ''}`
        : state === 'running'
          ? 'Running'
          : 'Queued';

  return (
    <li
      className={`relative rounded-xl border transition-all duration-300 ${
        state === 'running'
          ? 'border-sky-400/30 bg-sky-500/[0.06]'
          : state === 'complete' || state === 'warning'
            ? 'border-white/8 bg-white/[0.02]'
            : 'border-transparent bg-transparent'
      }`}
    >
      {!last ? <span aria-hidden className="absolute bottom-[-0.3rem] left-[1.36rem] top-[2.15rem] w-px bg-white/8" /> : null}
      <button
        type="button"
        onClick={onToggle}
        disabled={!revealed}
        className="flex w-full items-center gap-3 px-3 py-2 text-left disabled:cursor-default"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
          <StageDot state={state} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[13px] ${state === 'queued' ? 'text-white/35' : 'text-white/85'}`}>{stage.label}</span>
          <span
            className={`block text-[10px] ${
              state === 'running' ? 'text-sky-300/80' : state === 'warning' ? 'text-amber-300/70' : state === 'complete' ? 'text-emerald-300/60' : 'text-white/25'
            }`}
          >
            {statusLine}
          </span>
        </span>
        <span className="hidden max-w-[45%] shrink-0 truncate text-right text-[11px] tabular-nums text-white/45 sm:block">
          {revealed ? stage.output : '-'}
        </span>
        {revealed ? (
          <ChevronDown size={13} className={`shrink-0 text-white/30 transition-transform ${open ? 'rotate-180' : ''}`} />
        ) : null}
      </button>
      {open && revealed ? (
        <div className="border-t border-white/5 px-3 py-2 pl-11">
          <p className="text-[11px] text-white/70 sm:hidden">{stage.output}</p>
          {stage.logs && stage.logs.length ? (
            <>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white/35">What this step did</p>
              <ul className="mt-1 space-y-0.5">
                {stage.logs.map((l, i) => (
                  <li key={i} className="flex gap-1.5 text-[11px] leading-relaxed text-white/60">
                    <span className="text-white/25">·</span>
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-white/35">Sources used</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {stage.sources.map((src) => (
              <span key={src} className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[11px] text-white/55">
                {src}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </li>
  );
}
