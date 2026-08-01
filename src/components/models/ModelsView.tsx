'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import {
  MODEL_GROUPS,
  ROADMAP,
  STAGE_LABEL,
  type ModelEntry,
  type ModelStage,
  type PhaseStatus,
} from '@/lib/models/registry';

/**
 * Models & methods - Lyra's model catalogue, now collapsed and visual. Each model is a scannable row
 * you tap to deep-dive: the stage chip (how far it shipped) and one-line answer are always visible,
 * and expanding reveals what it answers, where the numbers come from, and its surface. The registry
 * is the single source of truth and this view invents nothing - a reference heuristic can never pass
 * itself off as a trained model because its true stage and provenance travel with it.
 */

const STAGE_STYLE: Record<ModelStage, string> = {
  live: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30',
  'shadow-live': 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30',
  built: 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-300/40',
  designed: 'bg-white/10 text-white/60',
};

const PHASE_STYLE: Record<PhaseStatus, string> = {
  done: 'bg-emerald-500/15 text-emerald-300',
  next: 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30',
  pending: 'bg-white/10 text-white/50',
  ongoing: 'bg-amber-400/15 text-amber-300',
};

const PHASE_STATUS_LABEL: Record<PhaseStatus, string> = {
  done: 'Done',
  next: 'Next',
  pending: 'Pending',
  ongoing: 'Ongoing',
};

function ModelRow({ entry }: { entry: ModelEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] transition-colors hover:border-white/15">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-semibold text-white">{entry.name}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STAGE_STYLE[entry.stage]}`}>
              {STAGE_LABEL[entry.stage]}
            </span>
          </div>
          {!open ? <p className="mt-0.5 truncate text-[11px] text-white/45">{entry.answers}</p> : null}
        </div>
        <ChevronDown size={15} className={`shrink-0 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="border-t border-white/5 px-3 py-3">
          <p className="text-[11px] uppercase tracking-wide text-white/40">{entry.family}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/80">{entry.answers}</p>
          <div className="mt-3 rounded-lg border border-white/5 bg-white/[0.03] p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">Where the numbers come from</p>
            <p className="mt-1 text-[12px] leading-relaxed text-white/60">{entry.provenance}</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
            {entry.surface ? (
              <Link
                href={entry.surface.href}
                className="rounded-full bg-white/10 px-2.5 py-1 font-medium text-white/80 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
              >
                Open {entry.surface.label} →
              </Link>
            ) : (
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-white/40">No surface yet</span>
            )}
            <span className="truncate font-mono text-[10px] text-white/30" title={entry.code}>
              {entry.code}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ModelsView() {
  return (
    <div className="w-full">
      <header>
        <h2 className="text-lg font-semibold text-white">Models &amp; methods</h2>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-white/60">
          Every model in Lyra, with its honest status. The deterministic engine decides; models inform. Research only -
          nothing here recommends a trade or prints a price target. Tap any model to deep-dive.
        </p>
      </header>

      <div
        role="note"
        className="mt-4 rounded-2xl border border-sky-400/20 bg-sky-500/[0.06] p-3 text-[12px] leading-relaxed text-sky-200/90"
      >
        A model earns its way to a surface: Beta first (runs for real, logged to an immutable ledger), promoted to Live
        only after its track record supports it. Stages and provenance below are stated exactly as they are.
      </div>

      {MODEL_GROUPS.map((group) => (
        <section key={group.key} aria-labelledby={`models-${group.key}`} className="mt-6">
          <h3 id={`models-${group.key}`} className="text-sm font-semibold uppercase tracking-wide text-white/70">
            {group.title}
          </h3>
          <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-white/50">{group.blurb}</p>
          <div className="mt-2.5 space-y-2">
            {group.entries.map((entry) => (
              <ModelRow key={entry.key} entry={entry} />
            ))}
          </div>
        </section>
      ))}

      <section aria-labelledby="models-roadmap" className="mt-8">
        <h3 id="models-roadmap" className="text-sm font-semibold uppercase tracking-wide text-white/70">
          Emerging Winner Engine roadmap
        </h3>
        <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-white/50">
          The phased build plan, stated honestly. Phase 1 is partially delivered: a survivor-biased free-data corpus now
          backs the trained classifier (real-v1); the delisted-inclusive corpus and live ledger maturation remain the
          gates.
        </p>
        <ol className="mt-3 space-y-2">
          {ROADMAP.map((p) => (
            <li
              key={p.phase}
              className="flex flex-wrap items-baseline gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2"
            >
              <span className="font-mono text-[11px] text-white/40">Phase {p.phase}</span>
              <span className="text-[13px] font-medium text-white/85">{p.title}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PHASE_STYLE[p.status]}`}>
                {PHASE_STATUS_LABEL[p.status]}
              </span>
              <span className="basis-full text-[12px] text-white/50 sm:basis-auto">{p.note}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
