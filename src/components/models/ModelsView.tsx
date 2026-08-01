import Link from 'next/link';
import {
  MODEL_GROUPS,
  ROADMAP,
  STAGE_LABEL,
  type ModelEntry,
  type ModelStage,
  type PhaseStatus,
} from '@/lib/models/registry';
import { RunModelPanel } from '@/components/models/RunModelPanel';
import type { DashboardData } from '@/types/scanner';
import type { EmergingWinnerQueue } from '@/lib/emerging-winner/types';

/**
 * The /models surface - Lyra's model catalogue, rendered straight from the registry. Purely
 * presentational: the registry is the single source of truth and this component invents nothing.
 * The stage chip (how far it shipped) and the provenance line (where the numbers come from) are
 * always shown together, so a reference heuristic can never pass itself off as a trained model.
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

function ModelCard({ entry }: { entry: ModelEntry }) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{entry.name}</h3>
          <p className="mt-0.5 text-[11px] text-white/45">{entry.family}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STAGE_STYLE[entry.stage]}`}
        >
          {STAGE_LABEL[entry.stage]}
        </span>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-white/75">{entry.answers}</p>

      <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.03] p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">Where the numbers come from</p>
        <p className="mt-1 text-[12px] leading-relaxed text-white/60">{entry.provenance}</p>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3 text-[11px]">
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
    </article>
  );
}

export function ModelsView({ data, ew }: { data: DashboardData; ew: EmergingWinnerQueue }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6">
      <header>
        <h1 className="text-xl font-semibold text-white">Models</h1>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-white/60">
          Every model in Lyra, with its honest status. The deterministic engine decides; models inform.
          Research only - nothing here recommends a trade or prints a price target.
        </p>
      </header>

      <RunModelPanel signals={data.signals} tickers={data.tickers} mode={data.mode} ew={ew} />

      <div
        role="note"
        className="mt-4 rounded-2xl border border-sky-400/20 bg-sky-500/[0.06] p-3 text-[12px] leading-relaxed text-sky-200/90"
      >
        A model earns its way to a surface: shadow-live first, logged to an immutable ledger, promoted only
        after its track record supports it. Stages and provenance below are stated exactly as they are.
      </div>

      {MODEL_GROUPS.map((group) => (
        <section key={group.key} aria-labelledby={`models-${group.key}`} className="mt-8">
          <h2 id={`models-${group.key}`} className="text-sm font-semibold uppercase tracking-wide text-white/70">
            {group.title}
          </h2>
          <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-white/50">{group.blurb}</p>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.entries.map((entry) => (
              <ModelCard key={entry.key} entry={entry} />
            ))}
          </div>
        </section>
      ))}

      <section aria-labelledby="models-roadmap" className="mt-10">
        <h2 id="models-roadmap" className="text-sm font-semibold uppercase tracking-wide text-white/70">
          Emerging Winner Engine roadmap
        </h2>
        <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-white/50">
          The phased build plan, stated honestly. Phase 1 is the gate: until the point-in-time dataset
          exists, the learned models stay reference v1.
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
