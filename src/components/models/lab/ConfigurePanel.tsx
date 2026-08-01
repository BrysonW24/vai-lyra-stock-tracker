'use client';

import { useState } from 'react';
import { Info, Check, Minus, CircleDashed, ChevronRight, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { LabSelect, type LabOption } from '@/components/models/lab/LabSelect';
import {
  LAB_MODELS,
  UNIVERSES,
  MARKETS,
  marketFor,
  CAP_BANDS,
  capBandFor,
  domainOptions,
  AVAILABILITY_LABEL,
  AVAILABILITY_BLURB,
  getModel,
  sourcesForModel,
  verticalOptions,
  type LabConfig,
  type RunData,
  type Availability,
  type SourceState,
} from '@/lib/models/lab';

/**
 * State A - Configure, minimal. Two clean selectors (Model, Outcome) and one big Run button are all
 * you see by default; the complexity (verticals, universe, ticker, and the model's own detail +
 * sources) is one tap away under Refine and About. Every vertical is selectable - nothing greyed -
 * so all features are available; a vertical with no matches just shows a 0. A Planned outcome stays
 * visible but cannot arm a run. Controlled by the parent so the run state machine lives in one place.
 */

const AVAIL_TONE: Record<Availability, 'live' | 'shadow-live' | 'reference' | 'planned'> = {
  live: 'live',
  'shadow-live': 'shadow-live',
  reference: 'reference',
  planned: 'planned',
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
  const [refineOpen, setRefineOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [tickerInfo, setTickerInfo] = useState(false);

  const model = getModel(config.modelKey);
  const outcome = model.outcomes.find((o) => o.key === config.outcomeKey) ?? model.outcomes[0];
  const verticals = verticalOptions(model, data);
  const sources = sourcesForModel(model);
  const canRun = outcome.runnable;
  const isEw = model.family === 'ew';
  const domains = domainOptions(data);
  const focus = config.domainFocus ?? [];

  const marketOptions: LabOption[] = MARKETS.map((m) => ({
    value: m.key,
    label: m.label,
    badge: m.live ? { text: 'Live', tone: 'live' } : { text: 'Soon', tone: 'planned' },
  }));

  const modelOptions: LabOption[] = LAB_MODELS.map((m) => ({
    value: m.key,
    label: m.name,
    badge: { text: AVAILABILITY_LABEL[m.availability], tone: AVAIL_TONE[m.availability] },
  }));

  const outcomeOptions: LabOption[] = model.outcomes.map((o) => ({
    value: o.key,
    label: o.label,
    sub: o.sub,
    disabled: !o.runnable,
    badge: o.runnable ? undefined : { text: 'Planned', tone: 'planned' },
  }));

  const universeOptions: LabOption[] = UNIVERSES.map((u) => ({
    value: u.key,
    label: u.label,
    badge: u.real ? undefined : { text: 'target', tone: 'reference' },
  }));

  function toggleVertical(label: string) {
    const next = config.verticals.includes(label)
      ? config.verticals.filter((v) => v !== label)
      : [...config.verticals, label];
    onChange({ verticals: next });
  }

  function toggleFocus(key: string) {
    const next = focus.includes(key) ? focus.filter((k) => k !== key) : [...focus, key];
    onChange({ domainFocus: next });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      {/* Model */}
      <Labelled label="Model">
        <LabSelect value={config.modelKey} options={modelOptions} onChange={(v) => onChange({ modelKey: v })} ariaLabel="Model" />
      </Labelled>

      {/* Outcome */}
      <Labelled label="Outcome" hint="changes with the model">
        <LabSelect value={config.outcomeKey} options={outcomeOptions} onChange={(v) => onChange({ outcomeKey: v })} ariaLabel="Outcome" />
      </Labelled>

      {/* Run */}
      <button
        type="button"
        onClick={onRun}
        disabled={!canRun}
        className="group mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-3 text-[15px] font-semibold text-white shadow-lg shadow-sky-500/20 transition-all duration-200 hover:bg-sky-400 hover:shadow-sky-400/30 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        {canRun ? model.cta : 'Planned - not yet buildable'}
        {canRun ? <ChevronRight size={17} className="transition-transform duration-200 group-hover:translate-x-0.5" /> : null}
      </button>

      {/* Refine (collapsed) */}
      <Collapsible
        open={refineOpen}
        onToggle={() => setRefineOpen((v) => !v)}
        icon={<SlidersHorizontal size={14} className="text-white/50" />}
        title="Refine"
        subtitle={refineSubtitle(config)}
      >
        <div className="space-y-4 pt-1">
          {/* Global market */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">Global market</p>
            <LabSelect value={config.market ?? 'us'} options={marketOptions} onChange={(v) => onChange({ market: v })} ariaLabel="Market" />
            {!marketFor(config.market).live ? (
              <p className="mt-1.5 text-[11px] text-amber-300/70">
                {marketFor(config.market).label} arrives with the international dataset. The engine scans US (SEC) today, so
                this market returns nothing yet - the control is here so you can see the roadmap.
              </p>
            ) : config.market === 'global' ? (
              <p className="mt-1.5 text-[11px] text-white/40">
                Same checks, larger source. Today the available universe is US-listed (SEC, ~10,400 names); more markets land
                as the international dataset connects.
              </p>
            ) : null}
          </div>

          {/* Market-cap band (EW - the engine that carries a real market cap) */}
          {isEw ? (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">Market-cap band</p>
              <div className="flex flex-wrap gap-1.5">
                {CAP_BANDS.map((c) => {
                  const active = (config.capBand ?? 'all') === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => onChange({ capBand: c.key })}
                      aria-pressed={active}
                      title={c.hint}
                      className={`rounded-full border px-2.5 py-1 text-[12px] transition-all duration-200 ${
                        active
                          ? 'border-sky-400/50 bg-sky-500/[0.15] text-white'
                          : 'border-white/12 bg-white/[0.03] text-white/70 hover:border-white/25'
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-white/40">{capBandFor(config.capBand).hint} · filters on the real market cap; unknown-cap names are excluded from a specific band.</p>
            </div>
          ) : null}

          {/* Domain focus (EW - the 10 fundamentals; prioritise the ones you care about) */}
          {isEw ? (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Focus domains</span>
                {focus.length ? (
                  <button type="button" onClick={() => onChange({ domainFocus: [] })} className="text-[10px] text-white/40 hover:text-sky-300">
                    clear
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {domains.map((d) => {
                  const active = focus.includes(d.key);
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => toggleFocus(d.key)}
                      aria-pressed={active}
                      className={`rounded-full border px-2.5 py-1 text-[12px] transition-all duration-200 ${
                        active
                          ? 'border-sky-400/50 bg-sky-500/[0.15] text-white'
                          : 'border-white/12 bg-white/[0.03] text-white/70 hover:border-white/25'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-white/40">
                {focus.length ? 'Results re-rank by strength in these domains.' : 'Pick the fundamentals that matter to you; results re-rank to lead with them.'}
              </p>
            </div>
          ) : null}

          {/* Verticals - all selectable */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">
              {model.family === 'ew' ? 'Verticals / archetypes' : 'Sectors'}
            </p>
            {verticals.length === 0 ? (
              <p className="text-[12px] text-white/40">No segments in the current universe.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {verticals.map((v) => {
                  const active = config.verticals.includes(v.label);
                  return (
                    <button
                      key={v.label}
                      type="button"
                      onClick={() => toggleVertical(v.label)}
                      aria-pressed={active}
                      className={`rounded-full border px-2.5 py-1 text-[12px] transition-all duration-200 ${
                        active
                          ? 'border-sky-400/50 bg-sky-500/[0.15] text-white'
                          : 'border-white/12 bg-white/[0.03] text-white/70 hover:border-white/25'
                      }`}
                    >
                      {v.label}
                      <span className="ml-1.5 font-mono text-[10px] text-white/40">{v.count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Universe */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">Universe</p>
            <LabSelect
              value={config.universeKey}
              options={universeOptions}
              onChange={(v) => onChange({ universeKey: v })}
              ariaLabel="Universe"
            />
            {UNIVERSES.find((u) => u.key === config.universeKey)?.note ? (
              <p className="mt-1.5 text-[11px] text-amber-300/70">{UNIVERSES.find((u) => u.key === config.universeKey)?.note}</p>
            ) : null}
          </div>

          {/* Curated ticker list */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Your ticker list</span>
              <button
                type="button"
                onClick={() => setTickerInfo((v) => !v)}
                aria-label="What does the ticker list do?"
                className="text-white/40 transition hover:text-sky-300"
              >
                <Info size={13} />
              </button>
            </div>
            <input
              value={config.ticker}
              onChange={(e) => onChange({ ticker: e.target.value })}
              placeholder="e.g. BKSY, RKLB, ACHR - blank scans the whole universe"
              className="w-full rounded-lg border border-white/12 bg-[#0d141c] px-2.5 py-2 text-[13px] text-white/90 placeholder:text-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
            />
            {tickerInfo ? (
              <p className="mt-1.5 rounded-lg bg-sky-500/[0.08] px-2.5 py-2 text-[11px] leading-relaxed text-sky-100/80 ring-1 ring-sky-400/20">
                Leave blank to scan the whole selected universe. Enter one name for a deep, company-level read, or a
                comma-separated list (e.g. BKSY, RKLB, ACHR) to curate exactly the names you want compared side by side.
              </p>
            ) : null}
          </div>
        </div>
      </Collapsible>

      {/* About this model (collapsed) */}
      <Collapsible
        open={aboutOpen}
        onToggle={() => setAboutOpen((v) => !v)}
        icon={<Info size={14} className="text-white/50" />}
        title="About this model"
        subtitle={`${AVAILABILITY_LABEL[model.availability]} · ${model.predicts}`}
      >
        <div className="space-y-3 pt-1">
          <p className="rounded-lg bg-white/[0.03] px-2.5 py-2 text-[11px] leading-relaxed text-white/60 ring-1 ring-white/10">
            {AVAILABILITY_BLURB[model.availability]}
          </p>
          <dl className="space-y-1.5 text-[12px]">
            <Row k="Predicts" v={model.predicts} />
            <Row k="Horizon" v={model.horizon} />
            <Row k="Universe" v={model.universeNote} />
            <Row k="Explainability" v={model.explainability} />
            <Row k="Version" v={model.family === 'ew' ? data.ew.engine_version || model.version : model.version} />
          </dl>
          <div className="border-t border-white/5 pt-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">What it looks for</p>
            <ul className="mt-1.5 flex flex-wrap gap-1">
              {model.looksFor.map((l) => (
                <li key={l} className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[11px] text-white/60">
                  {l}
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t border-white/5 pt-2.5">
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
      </Collapsible>
    </div>
  );
}

function refineSubtitle(config: LabConfig): string {
  const parts: string[] = [];
  const market = marketFor(config.market);
  if (market.key !== 'us') parts.push(market.label);
  if ((config.capBand ?? 'all') !== 'all') parts.push(`${capBandFor(config.capBand).label} cap`);
  if ((config.domainFocus?.length ?? 0) > 0) parts.push(`${config.domainFocus!.length} focus`);
  if (config.verticals.length) parts.push(`${config.verticals.length} vertical${config.verticals.length === 1 ? '' : 's'}`);
  const uni = UNIVERSES.find((u) => u.key === config.universeKey);
  if (uni && config.universeKey !== 'tracked') parts.push(uni.label.toLowerCase());
  if (config.ticker.trim()) parts.push(config.ticker.trim().toUpperCase());
  return parts.join(' · ') || 'markets · cap · domains · list';
}

function Labelled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/50">{label}</span>
        {hint ? <span className="text-[10px] text-white/30">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function Collapsible({
  open,
  onToggle,
  icon,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03]">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        {icon}
        <span className="text-[13px] font-medium text-white/85">{title}</span>
        {subtitle && !open ? <span className="min-w-0 flex-1 truncate text-[11px] text-white/40">{subtitle}</span> : <span className="flex-1" />}
        <ChevronDown size={15} className={`shrink-0 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? <div className="border-t border-white/5 px-3 pb-3">{children}</div> : null}
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
