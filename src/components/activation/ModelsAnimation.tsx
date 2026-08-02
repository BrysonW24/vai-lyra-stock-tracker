'use client';

import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '@/lib/activation/animationTiming';
import { ACTIVATION_SCENES } from '@/lib/activation/activationSteps';

interface ModelsAnimationProps {
  onComplete?: () => void;
}

// The six-model pipeline, in scan order. Mirrors src/lib/models/registry.ts labelling.
const PIPELINE = [
  { key: 'M1', label: 'Domain scores' },
  { key: 'M2', label: 'Winner classifier' },
  { key: 'M3', label: 'Analogues' },
  { key: 'M4', label: 'Archetype & rank' },
  { key: 'M5', label: 'Risk gates' },
  { key: 'M6', label: 'Timing & network' },
];

// Real output from the engine's illustrative demo run (see src/lib/emerging-winner/demo.ts) - not
// invented numbers: QBIT surfaces as the top candidate, HYPE is blocked by the risk gates.
const CANDIDATE = {
  ticker: 'QBIT',
  similarity: 70,
  archetype: 'Breakout archetype',
  domains: [
    { label: 'Technical', value: 78 },
    { label: 'Theme', value: 84 },
    { label: 'Government', value: 61 },
    { label: 'Sponsorship', value: 72 },
  ],
};

const BLOCKED = {
  ticker: 'HYPE',
  reason: 'Tiny float · heavy dilution · thin liquidity',
};

/**
 * Scene 5: Models that earn their way.
 * Staged reveal: header → six-model pipeline chips → candidate scorecard → risk-gate verdicts →
 * shadow-live honesty footer. Same terminal-panel language as the other activation scenes.
 * Research framing only - the scene shows a research queue, never a trade instruction.
 */
export function ModelsAnimation({ onComplete }: ModelsAnimationProps) {
  const reduced = prefersReducedMotion();
  const scene = ACTIVATION_SCENES.models;

  // Staged reveal: 0 → header | 1 → pipeline | 2 → candidate card | 3 → risk verdicts | 4 → footer
  const [stage, setStage] = useState(reduced ? 4 : 0);

  useEffect(() => {
    if (reduced) {
      onComplete?.();
      return;
    }
    const t1 = setTimeout(() => setStage(1), 300);
    const t2 = setTimeout(() => setStage(2), 1300);
    const t3 = setTimeout(() => setStage(3), 2300);
    const t4 = setTimeout(() => setStage(4), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [reduced, onComplete]);

  return (
    <div className="mx-auto w-full max-w-3xl px-1">
      {/* Title */}
      <div className="mb-3 text-center">
        <h2 className="mb-0.5 text-xl font-semibold text-ink md:text-2xl">{scene.title}</h2>
        <p className="text-xs text-ink-2 md:text-sm">{scene.description}</p>
      </div>

      {/* Six-model pipeline strip */}
      <div
        className="mb-2 flex flex-wrap items-center justify-center gap-1.5 transition-all duration-500"
        style={{ opacity: stage >= 1 ? 1 : 0, transform: stage >= 1 ? 'translateY(0)' : 'translateY(10px)' }}
      >
        {PIPELINE.map((m, i) => (
          <span key={m.key} className="flex items-center gap-1.5">
            <span
              className="terminal-panel rounded border border-pending/25 px-2 py-1"
              style={{
                opacity: stage >= 1 ? 1 : 0,
                transition: `opacity 350ms ease ${i * 110}ms`,
              }}
            >
              <span className="font-mono text-[9px] font-semibold text-pending">{m.key}</span>{' '}
              <span className="font-mono text-[9px] text-ink-2">{m.label}</span>
            </span>
            {i < PIPELINE.length - 1 && <span className="font-mono text-[9px] text-ink-dim">→</span>}
          </span>
        ))}
      </div>

      {/* Candidate scorecard */}
      <div
        className="terminal-panel mb-2 overflow-hidden rounded-panel border border-blue-focus/25 transition-all duration-500"
        style={{ opacity: stage >= 2 ? 1 : 0, transform: stage >= 2 ? 'translateY(0)' : 'translateY(12px)' }}
      >
        <div className="flex items-center justify-between border-b border-line bg-chrome px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-focus">
            Emerging Winner Engine · Research queue
          </span>
          <span className="rounded-full border border-blue-focus/30 bg-blue-tint px-2 py-0.5 font-mono text-[9px] text-blue-focus">
            Beta
          </span>
        </div>
        <div className="p-3">
          <div className="mb-2 flex items-baseline gap-3">
            <span className="text-sm font-semibold text-ink">{CANDIDATE.ticker}</span>
            <span className="rounded border border-accent/40 bg-accent-tint px-2 py-0.5 font-mono text-[10px] text-accent">
              {CANDIDATE.archetype}
            </span>
            <span className="ml-auto font-mono text-xs text-ink-2">
              Winner similarity <span className="font-semibold text-positive">{CANDIDATE.similarity}</span>/100
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 md:grid-cols-4">
            {CANDIDATE.domains.map((d, i) => (
              <div key={d.label}>
                <div className="mb-0.5 flex items-baseline justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">{d.label}</span>
                  <span className="font-mono text-[10px] font-semibold text-ink">{d.value}</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-well">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-deep to-positive"
                    style={{
                      width: stage >= 2 ? `${d.value}%` : '0%',
                      transition: `width 600ms ease ${200 + i * 130}ms`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 font-mono text-[9px] text-ink-dim">
            Scored against the shape of past winners · what&apos;s missing is always shown
          </p>
        </div>
      </div>

      {/* Risk gate verdicts - the honest half */}
      <div
        className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-2 transition-all duration-500"
        style={{ opacity: stage >= 3 ? 1 : 0, transform: stage >= 3 ? 'translateY(0)' : 'translateY(10px)' }}
      >
        <div className="terminal-panel rounded-panel border border-positive/30 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-ink">{CANDIDATE.ticker}</span>
            <span className="rounded border border-positive/50 bg-positive-tint px-2 py-0.5 font-mono text-[9px] font-semibold text-positive">
              RISK GATES · PASS
            </span>
          </div>
          <p className="mt-1 font-mono text-[9px] leading-snug text-ink-3">
            Survivability, dilution, manipulation, liquidity, downside - all five gates clear. Surfaced
            for deep research.
          </p>
        </div>
        <div className="terminal-panel rounded-panel border border-negative/30 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-ink">{BLOCKED.ticker}</span>
            <span className="rounded border border-negative/50 bg-negative/10 px-2 py-0.5 font-mono text-[9px] font-semibold text-negative-soft">
              BLOCKED · EXCLUDED
            </span>
          </div>
          <p className="mt-1 font-mono text-[9px] leading-snug text-ink-3">
            {BLOCKED.reason}. The pump signature is caught and kept out of the queue.
          </p>
        </div>
      </div>

      {/* Shadow-live honesty footer */}
      <div
        className="relative overflow-hidden rounded-panel border border-blue-focus/20 bg-gradient-to-r from-ground via-blue-tint to-ground px-4 py-3 transition-all duration-500"
        style={{ opacity: stage >= 4 ? 1 : 0, transform: stage >= 4 ? 'translateY(0)' : 'translateY(8px)' }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-focus/40 to-transparent" />
        <p className="font-mono text-[10px] leading-snug text-ink-dim">
          Every prediction is logged to an immutable ledger and judged against what actually happened.
          A model is promoted only after its track record earns it. Research only - the engine never
          says what to trade, and the risks are always on the card.
        </p>
      </div>
    </div>
  );
}
