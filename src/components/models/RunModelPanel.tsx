'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { STAGE_LABEL, type ModelStage } from '@/lib/models/registry';
import type { SignalRow, TickerSetting } from '@/types/scanner';
import type { EmergingWinnerQueue } from '@/lib/emerging-winner/types';

/**
 * Run a model - the interactive top of /models. You pick an OUTCOME, narrow by market segment and/or
 * the tickers you care about, and Run ranks Lyra's real tracked-universe output. It is honest by
 * construction: the outcome selector carries each model's true stage, and Run only does what that
 * stage allows. The live oversold-recovery score returns real numbers with the full driver breakdown;
 * the shadow-live Emerging Winner stack ranks its illustrative reference queue, loudly labelled; the
 * built and designed models say plainly that they do not score a ticker you pick yet. Nothing here is
 * fabricated and no on-demand fetch runs - it ranks what the engine already computed.
 */

type Mode = 'demo' | 'solo' | 'supabase';
type OutcomeKind = 'radar' | 'emerging' | 'informs' | 'designed';

interface Outcome {
  key: string;
  label: string;
  stage: ModelStage;
  kind: OutcomeKind;
  answers: string;
  /** Where the full per-ticker breakdown lives, when one does. */
  surface?: { href: string; label: string };
}

const OUTCOMES: Outcome[] = [
  {
    key: 'oversold',
    label: 'Oversold-recovery score',
    stage: 'live',
    kind: 'radar',
    answers:
      'The real 0-100 early-turn score: reset-band RSI, an improving-but-negative MACD histogram, and price near its 60-period low. Every number below is the deterministic engine, not an estimate.',
    surface: { href: '/radar', label: 'Signal Radar' },
  },
  {
    key: 'emerging',
    label: 'Emerging-winner resemblance',
    stage: 'shadow-live',
    kind: 'emerging',
    answers:
      'How strongly a name structurally resembles past outsized winners. Illustrative reference v1 - matched against a synthetic reference set, not trained on real winners yet.',
    surface: { href: '/emerging-winners', label: 'Emerging Winners' },
  },
  {
    key: 'recovery',
    label: 'Recovery probability',
    stage: 'built',
    kind: 'informs',
    answers:
      'A calibrated probability that a beaten-down name recovers. Trained on synthetic fixtures for now, so it informs research context only and is not surfaced as a per-ticker number.',
    surface: { href: '/ai-ops', label: 'AI Ops' },
  },
  {
    key: 'event20',
    label: '+20% event forecast',
    stage: 'designed',
    kind: 'designed',
    answers:
      'Probability of a +20% move within 21 / 63 / 126 trading days. Designed only - no event model runs yet, so there is nothing honest to score here today.',
  },
];

/** Component point caps from the score model (LYRA_SCORE_WEIGHTS): 25/30/15/15/15. Bars normalise to these. */
const DRIVER_CAPS = { rsi: 25, macd: 30, price: 15, trend: 15, volume: 15 } as const;

const STAGE_PILL: Record<ModelStage, string> = {
  live: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30',
  'shadow-live': 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30',
  built: 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-300/40',
  designed: 'bg-white/10 text-white/60',
};

function scoreTone(score: number): string {
  if (score >= 70) return 'text-emerald-300';
  if (score >= 50) return 'text-amber-300';
  return 'text-white/55';
}

function DriverBar({ label, value, cap }: { label: string; value: number; cap: number }) {
  const pct = Math.max(0, Math.min(100, (value / cap) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[10px] uppercase tracking-wide text-white/40">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-sky-400/70" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right font-mono text-[10px] text-white/50">
        {Math.round(value)}/{cap}
      </span>
    </div>
  );
}

export function RunModelPanel({
  signals,
  tickers,
  mode,
  ew,
}: {
  signals: SignalRow[];
  tickers: TickerSetting[];
  mode: Mode;
  ew: EmergingWinnerQueue;
}) {
  const [outcomeKey, setOutcomeKey] = useState<string>('oversold');
  const [segment, setSegment] = useState<string>('any');
  const [tickerText, setTickerText] = useState<string>('');
  const [run, setRun] = useState<{ kind: OutcomeKind; segment: string; symbols: string[] } | null>(null);

  const outcome = OUTCOMES.find((o) => o.key === outcomeKey) ?? OUTCOMES[0];

  const sectorBySymbol = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tickers) {
      const sec = t.sector || t.category;
      if (sec) m.set(t.symbol.toUpperCase(), sec);
    }
    return m;
  }, [tickers]);

  // "Segment of the market" adapts to the outcome: sector for the radar, winner archetype for the
  // Emerging Winner stack. The built/designed outcomes have no per-ticker universe to segment.
  const segmentOptions = useMemo(() => {
    if (outcome.kind === 'radar') {
      const set = new Set<string>();
      for (const s of signals) {
        const sec = sectorBySymbol.get(s.symbol.toUpperCase());
        if (sec) set.add(sec);
      }
      return Array.from(set).sort();
    }
    if (outcome.kind === 'emerging') {
      const set = new Set<string>();
      for (const r of ew.queue) if (r.archetype) set.add(r.archetype);
      return Array.from(set).sort();
    }
    return [];
  }, [outcome.kind, signals, ew.queue, sectorBySymbol]);

  const segmentLabel = outcome.kind === 'emerging' ? 'Archetype' : 'Segment';
  const canRun = outcome.kind === 'radar' || outcome.kind === 'emerging';

  function selectOutcome(key: string) {
    setOutcomeKey(key);
    setSegment('any');
    setRun(null); // stale results must never outlive a stage change
  }

  function onRun() {
    const symbols = tickerText
      .split(/[\s,]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    setRun({ kind: outcome.kind, segment, symbols });
  }

  return (
    <section
      aria-labelledby="run-a-model"
      className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="run-a-model" className="text-sm font-semibold text-white">
          Run a model
        </h2>
        <span className="text-[11px] text-white/45">
          Ranks Lyra&apos;s tracked universe - no live fetch, nothing fabricated
        </span>
      </div>

      {/* Outcome selector */}
      <div className="mt-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">What do you want to predict?</p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {OUTCOMES.map((o) => {
            const active = o.key === outcomeKey;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => selectOutcome(o.key)}
                aria-pressed={active}
                className={`flex items-start justify-between gap-2 rounded-xl border p-2.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 ${
                  active ? 'border-sky-400/40 bg-sky-500/[0.08]' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                }`}
              >
                <span className="text-[13px] font-medium text-white/85">{o.label}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STAGE_PILL[o.stage]}`}>
                  {STAGE_LABEL[o.stage]}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-white/55">{outcome.answers}</p>
      </div>

      {/* Inputs */}
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">{segmentLabel}</span>
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
            disabled={!canRun || segmentOptions.length === 0}
            className="min-w-[10rem] rounded-lg border border-white/10 bg-[#0d141c] px-2.5 py-1.5 text-[13px] text-white/85 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            <option value="any">Any {segmentLabel.toLowerCase()}</option>
            {segmentOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
            Tickers (optional, comma-separated)
          </span>
          <input
            value={tickerText}
            onChange={(e) => setTickerText(e.target.value)}
            disabled={!canRun}
            placeholder="e.g. IONQ, SOUN, BBAI - blank = whole universe"
            className="min-w-[12rem] rounded-lg border border-white/10 bg-[#0d141c] px-2.5 py-1.5 text-[13px] text-white/85 placeholder:text-white/25 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
          />
        </label>

        <button
          type="button"
          onClick={onRun}
          disabled={!canRun}
          className="rounded-lg bg-sky-500/90 px-4 py-1.5 text-[13px] font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          Run model
        </button>
      </div>

      {/* Results */}
      {run ? (
        <div className="mt-4 border-t border-white/10 pt-4">
          {run.kind === 'radar' ? (
            <RadarResults signals={signals} sectorBySymbol={sectorBySymbol} run={run} mode={mode} />
          ) : run.kind === 'emerging' ? (
            <EmergingResults ew={ew} run={run} />
          ) : null}
        </div>
      ) : !canRun ? (
        <NotRunnable outcome={outcome} />
      ) : null}
    </section>
  );
}

function RadarResults({
  signals,
  sectorBySymbol,
  run,
  mode,
}: {
  signals: SignalRow[];
  sectorBySymbol: Map<string, string>;
  run: { segment: string; symbols: string[] };
  mode: Mode;
}) {
  const rows = signals
    .filter((s) => run.symbols.length === 0 || run.symbols.includes(s.symbol.toUpperCase()))
    .filter((s) => run.segment === 'any' || sectorBySymbol.get(s.symbol.toUpperCase()) === run.segment)
    .slice()
    .sort((a, b) => b.score - a.score);

  const knownSymbols = new Set(signals.map((s) => s.symbol.toUpperCase()));
  const unknown = run.symbols.filter((sym) => !knownSymbols.has(sym));

  return (
    <div>
      <div
        className={`rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
          mode === 'demo'
            ? 'bg-amber-400/10 text-amber-200/90 ring-1 ring-amber-300/25'
            : 'bg-emerald-500/10 text-emerald-200/90 ring-1 ring-emerald-400/25'
        }`}
      >
        {mode === 'demo'
          ? 'Illustrative sample data - configure Supabase + a market-data source to run this on your real book.'
          : 'Your tracked universe - real deterministic output from the latest scan.'}
      </div>

      {unknown.length > 0 ? (
        <p className="mt-2 text-[12px] text-white/45">
          Not in your tracked universe (skipped, tracked-universe mode does no live fetch):{' '}
          <span className="font-mono text-white/60">{unknown.join(', ')}</span>
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="mt-3 text-[13px] text-white/55">
          No tracked names match this run. Try &quot;Any segment&quot; or clear the ticker filter.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.slice(0, 25).map((s, i) => (
            <li
              key={s.symbol}
              className="rounded-xl border border-white/5 bg-white/[0.03] p-3"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 shrink-0 text-center font-mono text-[11px] text-white/35">#{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <span className="text-[14px] font-semibold text-white">{s.symbol}</span>
                  <span className="ml-2 truncate text-[11px] text-white/45">{s.companyName}</span>
                </div>
                <span className={`shrink-0 text-lg font-bold tabular-nums ${scoreTone(s.score)}`}>{s.score}</span>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-x-6">
                <DriverBar label="RSI" value={s.scoreBreakdown.rsiScore} cap={DRIVER_CAPS.rsi} />
                <DriverBar label="MACD" value={s.scoreBreakdown.macdScore} cap={DRIVER_CAPS.macd} />
                <DriverBar label="Price" value={s.scoreBreakdown.priceLocationScore} cap={DRIVER_CAPS.price} />
                <DriverBar label="Trend" value={s.scoreBreakdown.trendScore} cap={DRIVER_CAPS.trend} />
                <DriverBar label="Volume" value={s.scoreBreakdown.volumeScore} cap={DRIVER_CAPS.volume} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/45">
                <span>RSI {s.rsi.toFixed(1)}</span>
                <span>{s.distanceFromLow.toFixed(1)}% off 60-low</span>
                <span>vol {s.volumeRatio.toFixed(2)}x</span>
                <span className="text-white/35">{s.status.replace(/_/g, ' ')}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-white/35">
        The score is a deterministic sum of the five drivers above (caps 25/30/15/15/15). Same inputs, same output -{' '}
        <Link href="/radar" className="text-sky-300 hover:underline">
          open the Signal Radar
        </Link>{' '}
        for the full per-ticker view.
      </p>
    </div>
  );
}

function EmergingResults({
  ew,
  run,
}: {
  ew: EmergingWinnerQueue;
  run: { segment: string; symbols: string[] };
}) {
  const rows = ew.queue
    .filter((r) => run.symbols.length === 0 || run.symbols.includes(r.symbol.toUpperCase()))
    .filter((r) => run.segment === 'any' || r.archetype === run.segment)
    .slice()
    .sort((a, b) => b.winner_similarity - a.winner_similarity);

  return (
    <div>
      <div className="rounded-xl bg-sky-500/10 px-3 py-2 text-[12px] leading-relaxed text-sky-200/90 ring-1 ring-sky-400/25">
        {ew.demo ? 'Illustrative example' : 'Shadow-live'} - not trained on real winners yet. These resemblances are
        matched against a reproducible synthetic reference set, not a vector index over real historical snapshots. The
        numbers are inspectable but they do not predict a real outcome.
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 text-[13px] text-white/55">
          Nothing in the current reference queue matches this run. Try &quot;Any archetype&quot; or clear the ticker
          filter.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.slice(0, 25).map((r, i) => (
            <li key={r.symbol} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3">
              <span className="w-6 shrink-0 text-center font-mono text-[11px] text-white/35">#{i + 1}</span>
              <div className="min-w-0 flex-1">
                <span className="text-[14px] font-semibold text-white">{r.symbol}</span>
                <span className="ml-2 text-[11px] text-white/45">{r.stage_label}</span>
                <div className="truncate text-[11px] text-white/40">
                  {r.archetype} · {Math.round(r.completeness * 100)}% data completeness
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className={`text-lg font-bold tabular-nums ${scoreTone(r.winner_similarity)}`}>
                  {Math.round(r.winner_similarity)}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-white/35">resemblance</div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-white/35">
        Resemblance is a 0-100 similarity score, not a probability or price target.{' '}
        <Link href="/emerging-winners" className="text-sky-300 hover:underline">
          Open Emerging Winners
        </Link>{' '}
        for the full 10-domain scorecard, risks, and provenance per name.
      </p>
    </div>
  );
}

function NotRunnable({ outcome }: { outcome: Outcome }) {
  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STAGE_PILL[outcome.stage]}`}>
            {STAGE_LABEL[outcome.stage]}
          </span>
          <span className="text-[13px] font-medium text-white/85">{outcome.label}</span>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-white/55">
          {outcome.kind === 'informs'
            ? 'This model is built but trained on synthetic fixtures, so it is not honest to score a ticker you pick with it yet. It informs research context behind the scenes only.'
            : 'This model is designed, not built - nothing runs. Running it on a ticker would fabricate a number, which Lyra does not do.'}
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
          {outcome.surface ? (
            <Link href={outcome.surface.href} className="text-sky-300 hover:underline">
              {outcome.surface.label} →
            </Link>
          ) : null}
          <a href="#models-roadmap" className="text-white/45 hover:text-white/70">
            See where it sits on the roadmap ↓
          </a>
        </div>
      </div>
    </div>
  );
}
