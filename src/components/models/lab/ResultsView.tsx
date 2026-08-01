'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ArrowRight, RotateCcw, X } from 'lucide-react';
import type { RunResult, LabResult, ResultTone } from '@/lib/models/lab';
import type { SignalRow } from '@/types/scanner';
import type { EmergingWinnerResult } from '@/lib/emerging-winner/types';

/**
 * State C - results as the hero. A ranked list on the left, a finding drawer on the right, and an
 * honest success strip. Every field shown is real: the radar drawer decodes the five deterministic
 * drivers, the Emerging Winner drawer surfaces the real 10-domain scorecard, drivers, outlook,
 * analogues, risks and provenance. Nothing invents a percentile, a baseline, or a trained-model
 * probability. The full per-name card lives on /emerging-winners; this drawer links there.
 */

const DRIVER_CAPS: Record<string, number> = { RSI: 25, MACD: 30, Price: 15, Trend: 15, Volume: 15 };

function toneClass(t: ResultTone): string {
  if (t === 'strong') return 'text-emerald-300';
  if (t === 'moderate') return 'text-amber-300';
  return 'text-white/55';
}

export function ResultsView({
  run,
  modelName,
  onNewRun,
}: {
  run: RunResult;
  modelName: string;
  onNewRun: () => void;
}) {
  const [selected, setSelected] = useState<LabResult | null>(run.results[0] ?? null);
  const [showStages, setShowStages] = useState(false);

  return (
    <div className="space-y-4">
      {/* Success strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] px-4 py-3">
        <div className="text-[13px] text-emerald-100/90">
          <span className="font-semibold">{modelName} complete</span>
          <span className="mx-2 text-emerald-200/40">·</span>
          {run.summary.reviewed.toLocaleString('en-US')} reviewed · {run.summary.passed.toLocaleString('en-US')} cleared ·{' '}
          {run.summary.surfaced.toLocaleString('en-US')} surfaced
          {run.summary.illustrative ? (
            <span className="ml-2 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium text-sky-300 ring-1 ring-sky-400/30">
              illustrative
            </span>
          ) : (
            <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-400/30">
              real
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onNewRun}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] font-medium text-white/80 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
        >
          <RotateCcw size={13} /> Configure another run
        </button>
      </div>

      {/* How this run computed (collapsible, honest) */}
      <div className="rounded-xl border border-white/8 bg-white/[0.02]">
        <button
          type="button"
          onClick={() => setShowStages((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2 text-left"
        >
          <span className="text-[12px] font-medium text-white/70">How this run was computed · {run.summary.version}</span>
          <ChevronDown size={14} className={`text-white/40 transition-transform ${showStages ? 'rotate-180' : ''}`} />
        </button>
        {showStages ? (
          <ol className="space-y-1 border-t border-white/5 px-3 py-2">
            {run.stages.map((s) => (
              <li key={s.id} className="flex flex-wrap items-baseline gap-x-2 text-[11px]">
                <span className="font-medium text-white/70">{s.label}</span>
                <span className="text-white/45">{s.output}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      {run.results.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <p className="text-[14px] text-white/70">No candidates matched this run.</p>
          <p className="mt-1 text-[12px] text-white/45">
            Widen the universe, clear the verticals, or remove the ticker filter and run again.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_22rem]">
          {/* Ranked list */}
          <ul className="space-y-2">
            {run.results.slice(0, 25).map((r, i) => (
              <li key={r.symbol}>
                <button
                  type="button"
                  onClick={() => setSelected(r)}
                  className={`w-full rounded-xl border p-3 text-left transition-all duration-200 ${
                    selected?.symbol === r.symbol
                      ? 'border-sky-400/40 bg-sky-500/[0.06]'
                      : 'border-white/8 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 shrink-0 text-center font-mono text-[11px] text-white/35">#{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[14px] font-semibold text-white">{r.symbol}</span>
                        <span className="truncate text-[11px] text-white/45">{r.companyName}</span>
                      </div>
                      <div className="truncate text-[11px] text-white/40">
                        {r.subtitle} · {r.group}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={`text-lg font-bold tabular-nums ${toneClass(r.tone)}`}>{r.headlineValue}</div>
                      <div className="text-[10px] uppercase tracking-wide text-white/35">{r.headlineLabel}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {r.strongest.map((d) => (
                      <span key={d} className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-200/80">
                        {d}
                      </span>
                    ))}
                    <span className="text-[10px] text-white/35">{r.evidence}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {/* Finding drawer */}
          <div className="lg:sticky lg:top-4 lg:self-start">
            {selected ? <FindingDrawer result={selected} onClose={() => setSelected(null)} /> : null}
          </div>
        </div>
      )}
    </div>
  );
}

function FindingDrawer({ result, onClose }: { result: LabResult; onClose: () => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-bold text-white">{result.symbol}</h3>
          <p className="text-[11px] text-white/45">{result.group}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="text-white/30 transition hover:text-white/70 lg:hidden">
          <X size={16} />
        </button>
      </div>

      {result.ew ? <EwDetail r={result.ew} /> : result.radar ? <RadarDetail s={result.radar} /> : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 border-t border-white/5 pt-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">{title}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Bar({ label, value, cap, tone = 'sky' }: { label: string; value: number; cap: number; tone?: 'sky' | 'emerald' }) {
  const pct = Math.max(0, Math.min(100, (value / cap) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 truncate text-[11px] text-white/50">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${tone === 'emerald' ? 'bg-emerald-400/70' : 'bg-sky-400/70'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-[10px] text-white/45">{Math.round(value)}</span>
    </div>
  );
}

function RadarDetail({ s }: { s: SignalRow }) {
  const b = s.scoreBreakdown;
  return (
    <>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-white">{s.score}</span>
        <span className="text-[11px] text-white/45">recovery score</span>
      </div>

      <Section title="What drove the score">
        <div className="space-y-1.5">
          <Bar label="RSI reset" value={b.rsiScore} cap={DRIVER_CAPS.RSI} />
          <Bar label="MACD turn" value={b.macdScore} cap={DRIVER_CAPS.MACD} />
          <Bar label="Price location" value={b.priceLocationScore} cap={DRIVER_CAPS.Price} />
          <Bar label="Trend" value={b.trendScore} cap={DRIVER_CAPS.Trend} />
          <Bar label="Volume" value={b.volumeScore} cap={DRIVER_CAPS.Volume} />
        </div>
      </Section>

      <Section title="Evidence">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/55">
          <span>RSI {s.rsi.toFixed(1)}</span>
          <span>{s.distanceFromLow.toFixed(1)}% off 60-low</span>
          <span>vol {s.volumeRatio.toFixed(2)}x</span>
          <span>{s.macdState}</span>
          <span>vs SMA200 {s.priceVsSma200 >= 0 ? '+' : ''}{s.priceVsSma200.toFixed(1)}%</span>
        </div>
      </Section>

      {s.explanation.triggeredBecause.length ? (
        <Section title="Why it surfaced">
          <ul className="space-y-1 text-[11px] text-white/60">
            {s.explanation.triggeredBecause.map((t, i) => (
              <li key={i}>· {t}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {s.explanation.missingConfirmation.length ? (
        <Section title="Missing confirmation">
          <ul className="space-y-1 text-[11px] text-amber-200/70">
            {s.explanation.missingConfirmation.map((t, i) => (
              <li key={i}>· {t}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {s.explanation.riskNotes.length ? (
        <Section title="Risks">
          <ul className="space-y-1 text-[11px] text-rose-200/70">
            {s.explanation.riskNotes.map((t, i) => (
              <li key={i}>· {t}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Provenance">
        <p className="text-[11px] text-white/45">
          Deterministic score (TS + Python golden-vector parity). Last updated {s.lastUpdated}.
        </p>
        <Link href={`/tickers/${s.symbol}`} className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-sky-300 hover:underline">
          Open full ticker view <ArrowRight size={12} />
        </Link>
      </Section>
    </>
  );
}

function EwDetail({ r }: { r: EmergingWinnerResult }) {
  const pct = (p: number) => `${Math.round(p * 100)}%`;
  const covered = r.domains.filter((d) => d.coverage !== 'unavailable');
  return (
    <>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-white">{Math.round(r.winner_similarity)}</span>
        <span className="text-[11px] text-white/45">winner resemblance (0-100, not a probability)</span>
      </div>
      <p className="mt-1 text-[11px] text-white/50">
        {r.stage_label} · {r.confidence} confidence · {Math.round(r.completeness * 100)}% data complete
      </p>

      <Section title="What drove the resemblance">
        <div className="space-y-1.5">
          {r.contributions.slice(0, 6).map((c) => (
            <Bar key={c.domain} label={c.label} value={Math.max(0, c.contribution)} cap={Math.max(1, r.contributions[0]?.contribution || 1)} tone="emerald" />
          ))}
        </div>
      </Section>

      <Section title={`10-domain scorecard (${covered.length}/${r.domains.length} covered)`}>
        <div className="space-y-1.5">
          {r.domains.map((d) => (
            <div key={d.key} className="flex items-center gap-2">
              <span className="w-24 shrink-0 truncate text-[11px] text-white/50">{d.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${d.coverage === 'unavailable' ? 'bg-white/15' : 'bg-sky-400/70'}`}
                  style={{ width: `${d.coverage === 'unavailable' ? 0 : Math.round(d.score ?? 0)}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-[9px] uppercase tracking-wide text-white/35">{d.coverage}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Modelled outlook (reference-v1, illustrative)">
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <Stat k="Double / 24m" v={pct(r.outcome_distribution.p_2x_24m)} />
          <Stat k="5x / 36m" v={pct(r.outcome_distribution.p_5x_36m)} />
          <Stat k="10x / 60m" v={pct(r.outcome_distribution.p_10x_60m)} />
          <Stat k="Ruin (down 80%+)" v={pct(r.outcome_distribution.p_ruin)} danger />
        </div>
      </Section>

      <Section title="What it resembles">
        <div className="space-y-1 text-[11px]">
          {r.analogues.nearest_winners.slice(0, 2).map((a, i) => (
            <p key={`w${i}`} className="text-emerald-200/70">
              ↑ {a.name} · {a.archetype} · {Math.round(a.similarity)}
            </p>
          ))}
          {r.analogues.nearest_failures.slice(0, 1).map((a, i) => (
            <p key={`f${i}`} className="text-rose-200/70">
              ↓ {a.name} · {a.archetype} · {Math.round(a.similarity)}
            </p>
          ))}
          {r.analogues.missing_vs_top_winner.length ? (
            <p className="text-white/45">Missing vs top winner: {r.analogues.missing_vs_top_winner.slice(0, 3).join(', ')}</p>
          ) : null}
        </div>
      </Section>

      {r.risks.length ? (
        <Section title="Risks / what's missing">
          <ul className="space-y-1 text-[11px] text-rose-200/70">
            {r.risks.slice(0, 4).map((t, i) => (
              <li key={i}>· {t}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Provenance">
        <p className="text-[11px] leading-relaxed text-white/45">{r.analogues.provenance}</p>
        <p className="mt-1 text-[10px] text-white/35">
          {r.engine_version} · {r.generated_at}
        </p>
        <Link href="/emerging-winners" className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-sky-300 hover:underline">
          Open the full card in Emerging Winners <ArrowRight size={12} />
        </Link>
      </Section>
    </>
  );
}

function Stat({ k, v, danger }: { k: string; v: string; danger?: boolean }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] px-2 py-1.5">
      <div className={`text-[15px] font-bold ${danger ? 'text-rose-300' : 'text-white'}`}>{v}</div>
      <div className="text-[10px] text-white/40">{k}</div>
    </div>
  );
}
