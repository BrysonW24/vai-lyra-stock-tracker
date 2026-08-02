'use client';

import { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  FlaskConical,
  Info,
  SlidersHorizontal,
} from 'lucide-react';
import { LabSelect, type LabOption } from '@/components/models/lab/LabSelect';
import {
  LAB_MODELS,
  UNIVERSES,
  MARKETS,
  marketFor,
  CAP_BANDS,
  capBandFor,
  domainOptions,
  DATA_SOURCES,
  AVAILABILITY_LABEL,
  AVAILABILITY_BLURB,
  getModel,
  verticalOptions,
  type LabConfig,
  type LabModel,
  type RunData,
  type Availability,
  type DataSource,
} from '@/lib/models/lab';

/**
 * Left panel - the Model Lab config card. Model + Outcome selectors, the vertical chips, universe,
 * ticker list, the shared data-source availability grid, and the gradient Run CTA (sticky on
 * mobile so the primary action never scrolls away). Advanced narrowing (market, cap band, focus
 * domains) stays one tap away under Refine; "Why this model?" opens the model's honest dossier.
 * Every availability state shown here is read from lab.ts - nothing is invented in this file.
 */

const AVAIL_TONE: Record<Availability, 'live' | 'shadow-live' | 'reference' | 'planned'> = {
  live: 'live',
  'shadow-live': 'shadow-live',
  reference: 'reference',
  planned: 'planned',
};

/** Compact display names + one-line descriptors for the shared source catalogue (presentation only -
 * the keys and connection states come straight from DATA_SOURCES in lab.ts). */
const SOURCE_DISPLAY: Record<string, { name: string; blurb: string }> = {
  market: { name: 'Market data', blurb: 'Price, volume and indicator history' },
  signals: { name: 'Lyra signals', blurb: 'Deterministic engine scores' },
  themes: { name: 'Theme maps', blurb: 'Theme and supply-chain mappings' },
  fundamentals: { name: 'Fundamentals', blurb: 'SEC EDGAR margins and dilution' },
  government: { name: 'Government contracts', blurb: 'Contract and award evidence' },
  insider: { name: 'Insider / smart money', blurb: 'Insider and sponsorship flow' },
  hiring: { name: 'Hiring history', blurb: 'Job-posting history' },
};

function SourceStatus({ source }: { source: DataSource }) {
  if (source.state === 'connected') {
    return <CheckCircle2 size={15} className="shrink-0 text-emerald-400" aria-label="Available" />;
  }
  if (source.state === 'limited') {
    return (
      <span className="shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium text-amber-300 ring-1 ring-amber-300/40">
        Limited
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-300 ring-1 ring-violet-400/30">
      Not connected
    </span>
  );
}

export function ConfigurePanel({
  config,
  data,
  onChange,
  onRun,
  running = false,
}: {
  config: LabConfig;
  data: RunData;
  onChange: (patch: Partial<LabConfig>) => void;
  onRun: () => void;
  running?: boolean;
}) {
  const [refineOpen, setRefineOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [tickerInfo, setTickerInfo] = useState(false);

  const model = getModel(config.modelKey);
  const outcome = model.outcomes.find((o) => o.key === config.outcomeKey) ?? model.outcomes[0];
  const verticals = verticalOptions(model, data);
  const canRun = outcome.runnable && !running;
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

  // Right-aligned universe note - the real filter behind the selection (lab.ts caps small-micro at $2B).
  const universeNote = config.universeKey === 'small-micro' ? 'Market cap under $2B' : null;

  // The shared availability catalogue, in a stable display order. States come from lab.ts.
  const allSources = Object.keys(SOURCE_DISPLAY)
    .map((k) => DATA_SOURCES[k])
    .filter(Boolean);
  const modelSourceNames = model.sources.map((k) => SOURCE_DISPLAY[k]?.name ?? DATA_SOURCES[k]?.label ?? k);

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
    <section className="terminal-panel rounded-2xl p-4">
      <header>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-white">
          <FlaskConical size={17} className="text-sky-400" /> Model Lab
        </h1>
        <p className="mt-1 text-[12px] leading-relaxed text-white/55">
          Choose the question, define the search, watch Lyra investigate.
        </p>
        <p className="mt-0.5 text-[11px] text-white/35">Research only - the deterministic engine decides, models inform.</p>
      </header>

      <div className="mt-4 space-y-4">
        {/* Model */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Model</span>
            <button
              type="button"
              onClick={() => setAboutOpen((v) => !v)}
              aria-expanded={aboutOpen}
              className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-white/55 transition hover:border-white/25 hover:text-white/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
            >
              Why this model?
            </button>
          </div>
          <LabSelect value={config.modelKey} options={modelOptions} onChange={(v) => onChange({ modelKey: v })} ariaLabel="Model" />
          {aboutOpen ? <AboutModel model={model} engineVersion={data.ew.engine_version} /> : null}
        </div>

        {/* Outcome */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Outcome</span>
            <span className="text-[10px] text-white/30">changes with the model</span>
          </div>
          <LabSelect value={config.outcomeKey} options={outcomeOptions} onChange={(v) => onChange({ outcomeKey: v })} ariaLabel="Outcome" />
          <p className="mt-1.5 text-[11px] leading-relaxed text-white/40">{outcome.sub}.</p>
        </div>

        {/* Archetype / Vertical chips */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/50">
              {isEw ? 'Archetype / Vertical' : 'Sectors'}
            </span>
            {config.verticals.length ? (
              <button type="button" onClick={() => onChange({ verticals: [] })} className="text-[10px] text-white/40 hover:text-sky-300">
                clear
              </button>
            ) : null}
          </div>
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
                        ? 'border-sky-400/60 bg-sky-500/25 text-white shadow-[0_0_12px_rgba(56,189,248,0.15)]'
                        : 'border-white/12 bg-transparent text-white/60 hover:border-white/30 hover:text-white/85'
                    }`}
                  >
                    {v.label}
                    <span className={`ml-1.5 font-mono text-[10px] ${active ? 'text-sky-200/80' : 'text-white/35'}`}>{v.count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Universe */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Universe</span>
            {universeNote ? <span className="text-[10px] text-white/35">{universeNote}</span> : null}
          </div>
          <LabSelect value={config.universeKey} options={universeOptions} onChange={(v) => onChange({ universeKey: v })} ariaLabel="Universe" />
        </div>

        {/* Ticker list */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Ticker symbol (optional)</span>
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
            placeholder="e.g. BKSY, RKLB, ACHR"
            className="glass-well w-full rounded-xl px-3 py-2.5 text-[13px] text-white/90 placeholder:text-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
          />
          <p className="mt-1.5 text-[11px] text-white/40">Leave blank to search the full universe.</p>
          {tickerInfo ? (
            <p className="mt-1.5 rounded-lg bg-sky-500/[0.08] px-2.5 py-2 text-[11px] leading-relaxed text-sky-100/80 ring-1 ring-sky-400/20">
              Enter one name for a deep, company-level read, or a comma-separated list (e.g. BKSY, RKLB, ACHR) to curate
              exactly the names you want compared side by side.
            </p>
          ) : null}
        </div>

        {/* Refine (collapsed) - market, cap band, focus domains */}
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
                            ? 'border-sky-400/60 bg-sky-500/25 text-white'
                            : 'border-white/12 bg-transparent text-white/60 hover:border-white/30'
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-white/40">
                  {capBandFor(config.capBand).hint} · filters on the real market cap; unknown-cap names are excluded from a specific band.
                </p>
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
                            ? 'border-sky-400/60 bg-sky-500/25 text-white'
                            : 'border-white/12 bg-transparent text-white/60 hover:border-white/30'
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
          </div>
        </Collapsible>

        {/* Available data sources - the shared availability truth from lab.ts */}
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">Available data sources</p>
          <div className="grid grid-cols-2 gap-1.5">
            {allSources.map((s) => {
              const display = SOURCE_DISPLAY[s.key] ?? { name: s.label, blurb: '' };
              return (
                <div key={s.key} className="glass-well flex items-start justify-between gap-1.5 rounded-lg px-2 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium text-white/85" title={s.label}>
                      {display.name}
                    </p>
                    <p className="truncate text-[10px] text-white/40" title={display.blurb}>
                      {display.blurb}
                    </p>
                  </div>
                  <SourceStatus source={s} />
                </div>
              );
            })}
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-white/35">
            {model.name} reads: {modelSourceNames.join(', ')}.
          </p>
        </div>
      </div>

      {/* Run CTA - sticky on small screens so the primary action stays in reach */}
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-10 mt-4 lg:static">
        <button
          type="button"
          onClick={onRun}
          disabled={!canRun}
          className={`group flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[15px] font-bold text-white transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${
            canRun
              ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:via-teal-400 hover:to-sky-400 hover:shadow-emerald-400/30'
              : 'cursor-not-allowed bg-white/10 text-white/40'
          }`}
        >
          {running ? 'Running...' : outcome.runnable ? model.cta : 'Planned - not yet buildable'}
          {canRun ? <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-0.5" /> : null}
        </button>
      </div>
      <p className="mt-2 text-center text-[11px] text-white/35">Runs on the currently loaded data with the settings above.</p>
    </section>
  );
}

function refineSubtitle(config: LabConfig): string {
  const parts: string[] = [];
  const market = marketFor(config.market);
  if (market.key !== 'us') parts.push(market.label);
  if ((config.capBand ?? 'all') !== 'all') parts.push(`${capBandFor(config.capBand).label} cap`);
  if ((config.domainFocus?.length ?? 0) > 0) parts.push(`${config.domainFocus!.length} focus`);
  return parts.join(' · ') || 'market · cap band · focus domains';
}

function AboutModel({ model, engineVersion }: { model: LabModel; engineVersion: string }) {
  return (
    <div className="glass-well mt-2 space-y-3 rounded-xl p-2.5">
      <p className="text-[11px] leading-relaxed text-white/60">{AVAILABILITY_BLURB[model.availability]}</p>
      <dl className="space-y-1.5 text-[12px]">
        <Row k="Predicts" v={model.predicts} />
        <Row k="Horizon" v={model.horizon} />
        <Row k="Universe" v={model.universeNote} />
        <Row k="Explainability" v={model.explainability} />
        <Row k="Version" v={model.family === 'ew' ? engineVersion || model.version : model.version} />
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
