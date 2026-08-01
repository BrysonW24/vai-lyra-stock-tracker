'use client';

import { useState } from 'react';
import { Info, Check, Minus, CircleDashed, ChevronRight } from 'lucide-react';
import {
  LAB_MODELS,
  UNIVERSES,
  AVAILABILITY_LABEL,
  getModel,
  sourcesForModel,
  verticalOptions,
  type LabConfig,
  type RunData,
  type Availability,
  type SourceState,
} from '@/lib/models/lab';

/**
 * State A - Configure. The whole first screen: pick the question (model + outcome), define where to
 * look (verticals + universe + optional ticker), see exactly which data sources feed it and what the
 * model looks for, then run. Controlled by the parent so the run state machine and the recommended
 * first-run default live in one place. Honest by construction: it only offers what the engine can
 * actually produce, every availability badge is true, and a Planned outcome cannot arm the Run CTA.
 */

const AVAIL_PILL: Record<Availability, string> = {
  live: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30',
  'shadow-live': 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30',
  reference: 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-300/40',
  planned: 'bg-white/10 text-white/60',
};

function SourceIcon({ state }: { state: SourceState }) {
  if (state === 'connected') return <Check size={13} className="text-emerald-400" />;
  if (state === 'limited') return <Minus size={13} className="text-amber-400" />;
  return <CircleDashed size={13} className="text-white/30" />;
}

export function ConfigurePanel({
  config,
  data,
  onChange,
  onRun,
}: {
  config: LabConfig;
  data: RunData;
  onChange: (patch: Partial<LabConfig>) => void;
  onRun: () => void;
}) {
  const [tickerInfo, setTickerInfo] = useState(false);
  const model = getModel(config.modelKey);
  const outcome = model.outcomes.find((o) => o.key === config.outcomeKey) ?? model.outcomes[0];
  const verticals = verticalOptions(model, data);
  const sources = sourcesForModel(model);
  const canRun = outcome.runnable;

  function toggleVertical(label: string) {
    const next = config.verticals.includes(label)
      ? config.verticals.filter((v) => v !== label)
      : [...config.verticals, label];
    onChange({ verticals: next });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
      {/* LEFT - configuration */}
      <div className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
        {/* Model */}
        <Field label="Model" hint="What kind of question">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {LAB_MODELS.map((m) => {
              const active = m.key === config.modelKey;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => onChange({ modelKey: m.key })}
                  aria-pressed={active}
                  className={`group flex items-center justify-between gap-2 rounded-xl border p-2.5 text-left transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 ${
                    active
                      ? 'border-sky-400/50 bg-sky-500/[0.10] shadow-[0_0_0_1px_rgba(56,189,248,0.15)]'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                  }`}
                >
                  <span className="text-[13px] font-medium text-white/90">{m.name}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${AVAIL_PILL[m.availability]}`}>
                    {AVAILABILITY_LABEL[m.availability]}
                  </span>
                </button>
              );
            })}
          </div>
        </Field>

        {/* Outcome */}
        <Field label="Outcome" hint="Changes with the model">
          <div className="flex flex-wrap gap-2">
            {model.outcomes.map((o) => {
              const active = o.key === config.outcomeKey;
              return (
                <button
                  key={o.key}
                  type="button"
                  disabled={!o.runnable}
                  onClick={() => o.runnable && onChange({ outcomeKey: o.key })}
                  aria-pressed={active}
                  title={o.sub}
                  className={`rounded-lg border px-2.5 py-1.5 text-[12px] transition-all duration-200 ${
                    !o.runnable
                      ? 'cursor-not-allowed border-white/5 bg-white/[0.02] text-white/30'
                      : active
                        ? 'border-sky-400/50 bg-sky-500/[0.12] text-white'
                        : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:text-white/90'
                  }`}
                >
                  {o.label}
                  {!o.runnable ? <span className="ml-1.5 text-[9px] uppercase tracking-wide text-white/40">Planned</span> : null}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-white/45">{outcome.sub}</p>
        </Field>

        {/* Verticals */}
        <Field label={model.family === 'ew' ? 'Verticals / archetypes' : 'Sectors'} hint="Optional - multi-select">
          {verticals.length === 0 ? (
            <p className="text-[12px] text-white/40">No segments available in the current universe.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {verticals.map((v) => {
                const active = config.verticals.includes(v.label);
                const empty = v.count === 0;
                return (
                  <button
                    key={v.label}
                    type="button"
                    onClick={() => toggleVertical(v.label)}
                    aria-pressed={active}
                    className={`rounded-full border px-2.5 py-1 text-[12px] transition-all duration-200 ${
                      active
                        ? 'border-sky-400/50 bg-sky-500/[0.15] text-white'
                        : empty
                          ? 'border-white/5 bg-white/[0.02] text-white/30 hover:text-white/50'
                          : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20'
                    }`}
                  >
                    {v.label}
                    <span className={`ml-1.5 font-mono text-[10px] ${empty ? 'text-white/20' : 'text-white/40'}`}>{v.count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </Field>

        {/* Universe */}
        <Field label="Universe" hint="Where to look">
          <div className="flex flex-wrap gap-2">
            {UNIVERSES.map((u) => {
              const active = u.key === config.universeKey;
              return (
                <button
                  key={u.key}
                  type="button"
                  onClick={() => onChange({ universeKey: u.key })}
                  aria-pressed={active}
                  className={`rounded-lg border px-2.5 py-1.5 text-[12px] transition-all duration-200 ${
                    active
                      ? 'border-sky-400/50 bg-sky-500/[0.12] text-white'
                      : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:text-white/90'
                  }`}
                >
                  {u.label}
                  {!u.real ? <span className="ml-1.5 text-[9px] uppercase tracking-wide text-amber-300/70">target</span> : null}
                </button>
              );
            })}
          </div>
          {UNIVERSES.find((u) => u.key === config.universeKey)?.note ? (
            <p className="mt-1.5 text-[11px] text-amber-300/70">{UNIVERSES.find((u) => u.key === config.universeKey)?.note}</p>
          ) : null}
        </Field>

        {/* Optional ticker */}
        <Field
          label="Optional ticker"
          hint={
            <button
              type="button"
              onClick={() => setTickerInfo((v) => !v)}
              aria-label="What does adding a ticker do?"
              className="inline-flex items-center gap-1 text-white/40 transition hover:text-sky-300"
            >
              <Info size={13} />
            </button>
          }
        >
          <input
            value={config.ticker}
            onChange={(e) => onChange({ ticker: e.target.value })}
            placeholder="e.g. BKSY - blank scans the whole universe"
            className="w-full rounded-lg border border-white/10 bg-[#0d141c] px-2.5 py-1.5 text-[13px] text-white/90 placeholder:text-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
          />
          {tickerInfo ? (
            <p className="mt-1.5 rounded-lg bg-sky-500/[0.08] px-2.5 py-2 text-[11px] leading-relaxed text-sky-100/80 ring-1 ring-sky-400/20">
              Leave this blank to scan the selected universe. Add a ticker to run the selected model against one specific
              company and get a deeper, company-level explanation.
            </p>
          ) : null}
        </Field>

        {/* CTA */}
        <button
          type="button"
          onClick={onRun}
          disabled={!canRun}
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-[14px] font-semibold text-white shadow-lg shadow-sky-500/20 transition-all duration-200 hover:bg-sky-400 hover:shadow-sky-400/30 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          {canRun ? model.cta : 'Pick a runnable outcome'}
          {canRun ? <ChevronRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" /> : null}
        </button>
      </div>

      {/* RIGHT - summary + sources */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">{model.name}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${AVAIL_PILL[model.availability]}`}>
              {AVAILABILITY_LABEL[model.availability]}
            </span>
          </div>
          <dl className="mt-3 space-y-1.5 text-[12px]">
            <Row k="Predicts" v={model.predicts} />
            <Row k="Horizon" v={model.horizon} />
            <Row k="Universe" v={model.universeNote} />
            <Row k="Explainability" v={model.explainability} />
            <Row k="Version" v={model.family === 'ew' ? data.ew.engine_version || model.version : model.version} />
          </dl>
          <div className="mt-3 border-t border-white/5 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">What it looks for</p>
            <ul className="mt-1.5 flex flex-wrap gap-1">
              {model.looksFor.map((l) => (
                <li key={l} className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[11px] text-white/60">
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">Data sources available</p>
          <ul className="mt-2 space-y-1.5">
            {sources.map((s) => (
              <li key={s.key} className="flex items-center gap-2 text-[12px]">
                <SourceIcon state={s.state} />
                <span className={s.state === 'not-connected' ? 'text-white/35' : 'text-white/70'}>{s.label}</span>
                {s.state === 'limited' ? <span className="text-[10px] text-amber-300/70">limited</span> : null}
                {s.state === 'not-connected' ? <span className="text-[10px] text-white/30">not connected</span> : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/50">{label}</span>
        {typeof hint === 'string' ? <span className="text-[10px] text-white/30">{hint}</span> : hint}
      </div>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-white/40">{k}</dt>
      <dd className="text-right text-white/75">{v}</dd>
    </div>
  );
}
