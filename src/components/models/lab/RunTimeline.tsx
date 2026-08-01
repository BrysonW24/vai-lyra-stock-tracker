'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, AlertTriangle, Loader2, ChevronDown } from 'lucide-react';
import type { RunResult, RunStage, StageState } from '@/lib/models/lab';

/**
 * State B - watch it work. An honest, staged reveal of the REAL pipeline that produced the run.
 * Each stage moves queued -> running -> complete (or warning), and on completion shows the actual
 * output that stage produced - counts derived from real data, never invented. The pacing is
 * presentation; the stages, their order, and their outputs are real. The caption states plainly
 * whether this is a live computation (Live models) or a replay of the shadow-live pipeline over an
 * illustrative universe (EW models), so nothing here pretends to scan companies that do not exist.
 */

const STEP_MS = 420;

function finalState(seed: StageState): StageState {
  return seed === 'warning' ? 'warning' : 'complete';
}

function StageIcon({ state }: { state: StageState }) {
  if (state === 'complete') return <Check size={14} className="text-emerald-400" />;
  if (state === 'warning') return <AlertTriangle size={14} className="text-amber-400" />;
  if (state === 'running') return <Loader2 size={14} className="animate-spin text-sky-400" />;
  return <span className="block h-2 w-2 rounded-full border border-white/25" />;
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

export function RunTimeline({
  run,
  modelName,
  caption,
  onDone,
}: {
  run: RunResult;
  modelName: string;
  caption: string;
  onDone: () => void;
}) {
  const [states, setStates] = useState<StageState[]>(() => run.stages.map(() => 'queued'));
  const [elapsed, setElapsed] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const startedRef = useRef(false);

  const totalMs = run.stages.length * STEP_MS + 300;

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
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

  const reviewed = useCountUp(run.summary.reviewed, totalMs, true);
  const passed = useCountUp(run.summary.passed, totalMs, true);
  const surfaced = useCountUp(run.summary.surfaced, totalMs, true);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {!done ? <Loader2 size={15} className="animate-spin text-sky-400" /> : <Check size={15} className="text-emerald-400" />}
          <h3 className="text-sm font-semibold text-white">{done ? `${modelName} complete` : `${modelName} running`}</h3>
        </div>
        <span className="font-mono text-[12px] tabular-nums text-white/45">{(elapsed / 1000).toFixed(1)}s</span>
      </div>

      <p className="mt-1.5 text-[11px] leading-relaxed text-white/45">{caption}</p>

      {/* Real counters */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Counter label="Reviewed" value={reviewed} />
        <Counter label="Cleared" value={passed} />
        <Counter label="Surfaced" value={surfaced} tone="emerald" />
      </div>

      {/* Stage list */}
      <ol className="mt-4 space-y-1">
        {run.stages.map((stage, i) => (
          <StageRow
            key={stage.id}
            stage={stage}
            state={states[i]}
            open={open === stage.id}
            onToggle={() => setOpen((cur) => (cur === stage.id ? null : stage.id))}
          />
        ))}
      </ol>
    </section>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone?: 'emerald' }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
      <div className={`text-lg font-bold tabular-nums ${tone === 'emerald' ? 'text-emerald-300' : 'text-white'}`}>
        {value.toLocaleString('en-US')}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-white/40">{label}</div>
    </div>
  );
}

function StageRow({
  stage,
  state,
  open,
  onToggle,
}: {
  stage: RunStage;
  state: StageState;
  open: boolean;
  onToggle: () => void;
}) {
  const revealed = state === 'complete' || state === 'warning' || state === 'running';
  return (
    <li
      className={`rounded-xl border transition-all duration-300 ${
        state === 'running'
          ? 'border-sky-400/30 bg-sky-500/[0.06]'
          : state === 'complete' || state === 'warning'
            ? 'border-white/8 bg-white/[0.02]'
            : 'border-transparent bg-transparent'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={!revealed}
        className="flex w-full items-center gap-3 px-3 py-2 text-left disabled:cursor-default"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
          <StageIcon state={state} />
        </span>
        <span className={`flex-1 text-[13px] ${state === 'queued' ? 'text-white/35' : 'text-white/85'}`}>{stage.label}</span>
        {revealed ? (
          <span className="hidden truncate text-[11px] text-white/45 sm:block">{stage.output}</span>
        ) : null}
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
