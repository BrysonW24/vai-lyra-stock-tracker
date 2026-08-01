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
        <h2 className="mb-0.5 text-xl font-semibold text-[#eef3f8] md:text-2xl">{scene.title}</h2>
        <p className="text-xs text-[#a8b5c2] md:text-sm">{scene.description}</p>
      </div>

      {/* Six-model pipeline strip */}
      <div
        className="mb-2 flex flex-wrap items-center justify-center gap-1.5 transition-all duration-500"
        style={{ opacity: stage >= 1 ? 1 : 0, transform: stage >= 1 ? 'translateY(0)' : 'translateY(10px)' }}
      >
        {PIPELINE.map((m, i) => (
          <span key={m.key} className="flex items-center gap-1.5">
            <span
              className="terminal-panel rounded border border-[#8aa2ff]/25 px-2 py-1"
              style={{
                opacity: stage >= 1 ? 1 : 0,
                transition: `opacity 350ms ease ${i * 110}ms`,
              }}
            >
              <span className="font-mono text-[9px] font-semibold text-[#8aa2ff]">{m.key}</span>{' '}
              <span className="font-mono text-[9px] text-[#a8b5c2]">{m.label}</span>
            </span>
            {i < PIPELINE.length - 1 && <span className="font-mono text-[9px] text-[#4a5868]">→</span>}
          </span>
        ))}
      </div>

      {/* Candidate scorecard */}
      <div
        className="terminal-panel mb-2 overflow-hidden rounded-md border border-[#5bc8ff]/25 transition-all duration-500"
        style={{ opacity: stage >= 2 ? 1 : 0, transform: stage >= 2 ? 'translateY(0)' : 'translateY(12px)' }}
      >
        <div className="flex items-center justify-between border-b border-[#1b2530] bg-[#0b1016] px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5bc8ff]">
            Emerging Winner Engine · Research queue
          </span>
          <span className="rounded-full border border-[#5bc8ff]/30 bg-[#0d1a2a] px-2 py-0.5 font-mono text-[9px] text-[#5bc8ff]">
            Beta
          </span>
        </div>
        <div className="p-3">
          <div className="mb-2 flex items-baseline gap-3">
            <span className="text-sm font-semibold text-[#eef3f8]">{CANDIDATE.ticker}</span>
            <span className="rounded border border-[#f3a33a]/40 bg-[#2a1f0d] px-2 py-0.5 font-mono text-[10px] text-[#f3a33a]">
              {CANDIDATE.archetype}
            </span>
            <span className="ml-auto font-mono text-xs text-[#a8b5c2]">
              Winner similarity <span className="font-semibold text-[#43d18b]">{CANDIDATE.similarity}</span>/100
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 md:grid-cols-4">
            {CANDIDATE.domains.map((d, i) => (
              <div key={d.label}>
                <div className="mb-0.5 flex items-baseline justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#8190a0]">{d.label}</span>
                  <span className="font-mono text-[10px] font-semibold text-[#eef3f8]">{d.value}</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-[#141c25]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#3b5bdb] to-[#43d18b]"
                    style={{
                      width: stage >= 2 ? `${d.value}%` : '0%',
                      transition: `width 600ms ease ${200 + i * 130}ms`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 font-mono text-[9px] text-[#4a5868]">
            Scored against the shape of past winners · what&apos;s missing is always shown
          </p>
        </div>
      </div>

      {/* Risk gate verdicts - the honest half */}
      <div
        className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-2 transition-all duration-500"
        style={{ opacity: stage >= 3 ? 1 : 0, transform: stage >= 3 ? 'translateY(0)' : 'translateY(10px)' }}
      >
        <div className="terminal-panel rounded-md border border-[#1d7f55]/40 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-[#eef3f8]">{CANDIDATE.ticker}</span>
            <span className="rounded border border-[#1d7f55] bg-[#0d251b] px-2 py-0.5 font-mono text-[9px] font-semibold text-[#43d18b]">
              RISK GATES · PASS
            </span>
          </div>
          <p className="mt-1 font-mono text-[9px] leading-snug text-[#8190a0]">
            Survivability, dilution, manipulation, liquidity, downside - all five gates clear. Surfaced
            for deep research.
          </p>
        </div>
        <div className="terminal-panel rounded-md border border-[#7f2f3a]/50 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-[#eef3f8]">{BLOCKED.ticker}</span>
            <span className="rounded border border-[#7f2f3a] bg-[#2a0f15] px-2 py-0.5 font-mono text-[9px] font-semibold text-[#ff8a8a]">
              BLOCKED · EXCLUDED
            </span>
          </div>
          <p className="mt-1 font-mono text-[9px] leading-snug text-[#8190a0]">
            {BLOCKED.reason}. The pump signature is caught and kept out of the queue.
          </p>
        </div>
      </div>

      {/* Shadow-live honesty footer */}
      <div
        className="relative overflow-hidden rounded-md border border-[#5bc8ff]/20 bg-gradient-to-r from-[#07090c] via-[#0d1a2a] to-[#07090c] px-4 py-3 transition-all duration-500"
        style={{ opacity: stage >= 4 ? 1 : 0, transform: stage >= 4 ? 'translateY(0)' : 'translateY(8px)' }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#5bc8ff]/40 to-transparent" />
        <p className="font-mono text-[10px] leading-snug text-[#4a6a88]">
          Every prediction is logged to an immutable ledger and judged against what actually happened.
          A model is promoted only after its track record earns it. Research only - the engine never
          says what to trade, and the risks are always on the card.
        </p>
      </div>
    </div>
  );
}
