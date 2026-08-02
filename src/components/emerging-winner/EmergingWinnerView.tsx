'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Info, FlaskConical, ArrowRight } from 'lucide-react';
import type {
  EmergingWinnerQueue,
  EmergingWinnerResult,
  EWDomain,
  EWGate,
} from '@/lib/emerging-winner/types';

/**
 * Emerging Winner Engine research surface (shadow-live). List-first + progressive disclosure:
 * every candidate is a scannable collapsed row that expands into plain-English sections. The rules
 * this file lives by:
 *   - Provenance loud, before the score. Every card says what it is (illustrative / shadow-live,
 *     trained on a survivor-biased real-outcome corpus) at the TOP, before it prints a resemblance
 *     number.
 *   - No naked jargon. "P(2x·24m)" and "winner similarity" are decoded to plain English; the exact
 *     definition sits one tap away under a "?" toggle, never in the default view.
 *   - Nothing recalculates. Every number is engine-computed and read from the ledger. The AI/UI
 *     phrases; the deterministic engine decides. Research framing only, never buy/sell, never a target.
 *   - The risk half is always reachable, never hidden.
 */

const STAGE_STYLE: Record<number, string> = {
  0: 'bg-line text-ink-3',
  1: 'bg-blue-tint text-blue-info ring-1 ring-blue-focus/30',
  2: 'bg-positive-tint text-positive ring-1 ring-positive/30',
  3: 'bg-accent-tint text-accent ring-1 ring-accent/40',
};

const RISK_STYLE: Record<string, string> = {
  pass: 'bg-positive-tint text-positive',
  review: 'bg-accent-tint text-accent',
  block: 'bg-negative/10 text-negative-soft',
  insufficient: 'bg-line text-ink-3',
};

const RISK_WORD: Record<string, string> = {
  pass: 'gates pass',
  review: 'needs review',
  block: 'blocked',
};

const ACTION_LABEL: Record<string, string> = {
  deep_research: 'Deep research',
  paper_bot_candidate: 'Paper-bot candidate',
  watchlist_candidate: 'Watchlist',
  needs_review: 'Needs review',
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** One scannable line describing the card, built from the numbers - no jargon. */
function resemblanceWord(sim: number): string {
  if (sim >= 60) return 'Strong resemblance to past winners';
  if (sim >= 40) return 'Moderate resemblance to past winners';
  return 'Weak resemblance - closer to past failures';
}

/** Compact value formatter for the inspectable sub-signal table. */
function fmtVal(v: number | string | null): string {
  if (v === null) return 'n/a';
  if (typeof v === 'string') return v.replace(/_/g, ' ');
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${Math.round(v / 1000)}k`;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

/** A "?" toggle that reveals a one-line plain-English definition on tap. Start simple, expand to complex. */
function Explain({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      <span>{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Hide explanation' : 'What does this mean?'}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-line text-ink-3 hover:text-ink-title"
      >
        <Info size={10} />
      </button>
      {open && (
        <span className="mt-1 block w-full text-[11px] leading-snug text-ink-3">{children}</span>
      )}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-dim">
      {children}
    </div>
  );
}

/** A nested "show more" disclosure for the long lists (full scorecard, every risk gate). */
function Collapsible({ summary, count, children }: { summary: string; count?: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-cell border border-line bg-well">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px] text-ink-3 hover:text-ink-title"
      >
        <span>
          {summary}
          {typeof count === 'number' && <span className="ml-1 text-ink-dim">({count})</span>}
        </span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-line px-3 py-2.5">{children}</div>}
    </div>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div
        className="h-full rounded-full bg-blue-info"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

const COVERAGE_STYLE: Record<string, string> = {
  full: 'text-positive/80',
  partial: 'text-accent/80',
  unavailable: 'text-ink-dim',
};

function DomainRow({ domain }: { domain: EWDomain }) {
  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] text-ink-2">{domain.label}</span>
        <span className="text-[12px] tabular-nums text-ink-title">
          {domain.score === null ? (
            <span className={COVERAGE_STYLE.unavailable}>not yet assessed</span>
          ) : (
            <>
              {Math.round(domain.score)}
              <span className={`ml-1.5 text-[10px] ${COVERAGE_STYLE[domain.coverage] ?? ''}`}>
                {domain.coverage}
              </span>
            </>
          )}
        </span>
      </div>
      {domain.reason && <div className="mt-0.5 text-[11px] text-ink-dim">{domain.reason}</div>}
      {domain.subsignals.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] text-ink-dim">
          {domain.subsignals.map((s) => (
            <span key={s.name}>
              {s.name.replace(/_/g, ' ')} {fmtVal(s.value)}
              {s.score !== null && <span className="text-ink-dim"> · {Math.round(s.score)}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function GateRow({ gate }: { gate: EWGate }) {
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-ink-2">{gate.label}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${RISK_STYLE[gate.verdict] ?? ''}`}>
          {gate.verdict}
        </span>
      </div>
      {gate.reasons.length > 0 && (
        <ul className="mt-0.5 space-y-0.5 text-[11px] text-ink-dim">
          {gate.reasons.map((r, i) => (
            <li key={i}>· {r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The loud, before-the-score provenance banner. What this card actually is. */
function ProvenanceBanner({ demo, provenance }: { demo: boolean; provenance: string }) {
  return (
    <div
      className={`mb-3 rounded-cell border px-3 py-2 text-[11px] leading-snug ${
        demo
          ? 'border-accent-border/50 bg-accent-tint/60 text-ink-2'
          : 'border-blue-info/30 bg-blue-tint/60 text-ink-2'
      }`}
    >
      <span className="font-semibold">
        {demo ? 'Illustrative example.' : 'Beta prediction.'}
      </span>{' '}
      {demo
        ? 'Sample data generated by the real engine over an illustrative candidate set - not a live market pick.'
        : 'Computed and logged to an immutable ledger, but not surfaced as truth until live calibration on matured ledger outcomes earns it.'}{' '}
      <span className="text-ink-3">{provenance}</span>{' '}
      <span className="font-medium text-ink-2">
        Classifier trained on real historical outcomes (survivor-biased corpus); surfacing is still not earned.
      </span>
    </div>
  );
}

function Card({ result, rank, demo }: { result: EmergingWinnerResult; rank: number; demo: boolean }) {
  const [open, setOpen] = useState(false);
  const d = result;
  const dist = d.outcome_distribution;
  const topDrivers = d.contributions.slice(0, 4);
  const winners = d.analogues.nearest_winners.slice(0, 3);
  const failures = d.analogues.nearest_failures.slice(0, 3);
  const riskWord = RISK_WORD[d.risk.verdict] ?? d.risk.verdict;

  return (
    <article className={`terminal-panel rounded-panel ${d.surfaced ? '' : 'opacity-70'}`}>
      {/* Collapsed row: scannable, list-first. Tap anywhere to expand. */}
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full px-4 py-3 text-left">
        <div className="mb-1.5 flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              demo ? 'bg-accent-tint text-accent' : 'bg-blue-tint text-blue-info'
            }`}
          >
            {demo ? 'Illustrative example' : 'Beta'}
          </span>
          <span className="text-[10px] text-ink-dim">trained on real outcomes · survivor-biased corpus</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-ink-dim">#{rank}</span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold text-ink">{d.symbol}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STAGE_STYLE[d.ordinal_stage] ?? ''}`}>
                  {d.stage_label}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-ink-3">{resemblanceWord(d.winner_similarity)}</div>
              <div className="mt-0.5 text-[11px] text-ink-dim">
                risk {riskWord} · {Math.round(d.completeness * 100)}% data · {ACTION_LABEL[d.action] ?? d.action}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-2xl font-semibold text-ink">{Math.round(d.winner_similarity)}</div>
              <div className="text-[10px] uppercase tracking-wide text-ink-dim">resemblance</div>
            </div>
            <ChevronDown size={18} className={`text-ink-dim transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </button>

      {/* Expanded body: everything inspectable, decoded, section by section. */}
      {open && (
        <div className="space-y-4 border-t border-line px-4 py-4">
          <ProvenanceBanner demo={demo} provenance={d.analogues.provenance} />

          {/* What the score means */}
          <div>
            <SectionTitle>What the score means</SectionTitle>
            <div className="space-y-1.5 text-[12px] text-ink-2">
              <div>
                <Explain label={`Winner-resemblance score ${Math.round(d.winner_similarity)} / 100`}>
                  0-100. How structurally similar this name is to the reference winner profiles. It is
                  NOT a probability, NOT a return, and NOT a price target - it is a similarity measure.
                </Explain>
              </div>
              <div className="text-ink-3">
                Conviction: <span className="text-ink-title">{d.stage_label}</span> · confidence{' '}
                <span className="text-ink-title">{d.confidence}</span> · archetype{' '}
                <span className="text-ink-title">{d.archetype}</span>
              </div>
            </div>
          </div>

          {/* Top drivers + full scorecard */}
          {topDrivers.length > 0 && (
            <div>
              <SectionTitle>What drove the score</SectionTitle>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {topDrivers.map((c) => (
                  <span
                    key={c.domain}
                    className={`rounded px-1.5 py-0.5 text-[11px] ${
                      c.contribution >= 0 ? 'bg-positive-tint text-positive' : 'bg-negative/10 text-negative-soft'
                    }`}
                  >
                    {c.label} {c.contribution >= 0 ? '+' : ''}
                    {Math.round(c.contribution)}
                  </span>
                ))}
              </div>
              <div className="mb-2">
                <div className="mb-1 text-[10px] text-ink-dim">
                  <Explain label="Data completeness">
                    How many of the 10 winner domains have real data behind them. A domain with no
                    pipeline yet reads &quot;not yet assessed&quot; and is never counted as a weakness.
                  </Explain>
                </div>
                <Bar value={d.completeness * 100} />
              </div>
              <Collapsible summary="Full 10-domain scorecard" count={d.domains.length}>
                <div className="divide-y divide-line">
                  {d.domains.map((dom) => (
                    <DomainRow key={dom.key} domain={dom} />
                  ))}
                </div>
              </Collapsible>
            </div>
          )}

          {/* Modelled outlook - the decoded probabilities */}
          <div>
            <SectionTitle>
              <Explain label="Modelled outlook">
                A coarse distribution derived from the classifier probability and the risk penalty - NOT
                a trained competing-risk model. A modelled estimate, never a promise.
              </Explain>
            </SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <OutlookStat title="Doubles (2x)" sub="within 24 months" value={pct(dist.p_2x_24m)} />
              <OutlookStat title="5x" sub="within 36 months" value={pct(dist.p_5x_36m)} />
              <OutlookStat title="10x" sub="within 60 months" value={pct(dist.p_10x_60m)} />
              <OutlookStat title="Ruin" sub="down 80%+ / delisting" value={pct(dist.p_ruin)} danger />
            </div>
            <div className="mt-1.5 text-[11px] text-ink-dim">
              Survivability {dist.survivability} · expected catalyst ~{dist.expected_time_to_catalyst_months} months ·
              typical drawdown {Math.round(dist.expected_max_drawdown_pct)}%
            </div>
          </div>

          {/* Resemblances */}
          <div>
            <SectionTitle>
              <Explain label="What it resembles">
                Nearest reference profiles by shape. &quot;(ref)&quot; means an illustrative reference
                archetype, not a real company - it marks what the score compares against until the real
                point-in-time dataset lands. Winner-vs-failure ratio above 1 = closer to past winners.
              </Explain>
            </SectionTitle>
            <div className="space-y-1.5 text-[12px]">
              {winners.length > 0 && (
                <div className="text-ink-2">
                  <span className="text-positive/80">Closest winners:</span>{' '}
                  {winners.map((w) => `${w.name} (${Math.round(w.similarity)})`).join(', ')}
                </div>
              )}
              {failures.length > 0 && (
                <div className="text-ink-2">
                  <span className="text-negative-soft/80">Closest failures:</span>{' '}
                  {failures.map((w) => `${w.name} (${Math.round(w.similarity)})`).join(', ')}
                </div>
              )}
              <div className="text-ink-dim">
                Winner-vs-failure resemblance {d.analogues.winner_failure_ratio.toFixed(2)}
                {d.analogues.missing_vs_top_winner.length > 0 && (
                  <> · closest winner had, this is missing: {d.analogues.missing_vs_top_winner.join(', ')}</>
                )}
              </div>
            </div>
          </div>

          {/* Risks / what's missing - always reachable */}
          {(d.risks.length > 0 || d.missing_domains.length > 0) && (
            <div>
              <SectionTitle>Risks / what&apos;s missing</SectionTitle>
              <div className="rounded-cell border border-accent-border/50 bg-accent-tint/50 p-2.5">
                <ul className="space-y-0.5 text-[11px] text-ink-3">
                  {d.risks.slice(0, 5).map((r, i) => (
                    <li key={i}>· {r}</li>
                  ))}
                </ul>
              </div>
              {d.risk.gates.length > 0 && (
                <div className="mt-2">
                  <Collapsible summary="Every risk gate" count={d.risk.gates.length}>
                    <div className="divide-y divide-line">
                      {d.risk.gates.map((g) => (
                        <GateRow key={g.key} gate={g} />
                      ))}
                    </div>
                  </Collapsible>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1 text-[10px] text-ink-dim">
            <span>{d.engine_version}</span>
            <Link href="/models" className="inline-flex items-center gap-1 text-ink-dim hover:text-ink-2">
              How this model works <ArrowRight size={11} />
            </Link>
          </div>
        </div>
      )}
    </article>
  );
}

function OutlookStat({ title, sub, value, danger }: { title: string; sub: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-cell bg-well p-2 text-center">
      <div className={`text-base font-semibold ${danger ? 'text-negative-soft' : 'text-ink'}`}>{value}</div>
      <div className="text-[11px] text-ink-2">{title}</div>
      <div className="text-[10px] text-ink-dim">{sub}</div>
    </div>
  );
}

/** The honest "what is this trained on?" panel. Collapsed by default; the truth, plainly. */
function TrainedOnPanel({ demo }: { demo: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-5 terminal-panel-soft rounded-panel">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-ink-title">
          <FlaskConical size={15} className="text-accent/80" /> What is this model trained on?
        </span>
        <ChevronDown size={16} className={`text-ink-dim transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-line px-4 py-3 text-[12.5px] leading-relaxed text-ink-2">
          <p>
            <span className="font-semibold text-ink">Today: real historical outcomes, with a known
            bias.</span>{' '}
            The winner classifier (champion emerging-winner-classifier-real-v1) is a calibrated logistic
            trained on a point-in-time backtest corpus: 991 US symbols, 27,420 quarterly rows (2016-2025),
            matured 12-month first-touch labels, and EDGAR facts as-of entry dates. The corpus is
            survivor-biased - delisted names are absent - so precision is an optimistic bound, and curated
            names were quarantined from training. Every card still shows which domains drove the call:
            same inputs, same output, no black box.
          </p>
          <p>
            <span className="font-semibold text-ink">The backtest evidence, exactly.</span>{' '}
            Purged walk-forward on 2016-2023 dev data: 1.31x lift at top-5% (symbol-clustered 90% CI
            1.09-1.56). One-shot untouched holdout (2024Q1-2025Q2): 1.72x lift (90% CI 1.38-2.05),
            ROC-AUC 0.585, ECE 0.042. The prior bootstrap-synthetic champion and the deterministic
            reference scorecard were refuted on the same data (lift 0.70-0.81x, CIs excluding 1.0) -
            which is exactly why the real-trained model was promoted.
          </p>
          <p>
            <span className="font-semibold text-ink">What is still illustrative or missing.</span>{' '}
            The analogue library is unchanged: names marked &quot;(ref)&quot; are illustrative reference
            archetypes, not real tickers, until the real point-in-time snapshot store lands. The deep
            domains (government contracts, insider flow and sponsorship, adoption) are still unwired, so
            coverage is partial and reads &quot;not yet assessed&quot; rather than a guessed value. And
            the engine stays shadow-live: the worst quarterly cohort precision is still weak and the
            live-calibration gate has no matured ledger pairs yet, so nothing here is surfaced as truth,
            advice, or a price target.
          </p>
          <p className="text-ink-3">
            {demo
              ? 'You are viewing illustrative demo output (no live run configured). Every card is sample data generated by the real engine.'
              : 'You are viewing beta output: real predictions logged to an immutable ledger, not surfaced as truth until they earn it.'}
          </p>
          <Link href="/models" className="inline-flex items-center gap-1 text-sm text-blue-info hover:text-blue-focus">
            See the full six-model stack and each model&apos;s stage <ArrowRight size={13} />
          </Link>
        </div>
      )}
    </div>
  );
}

export function EmergingWinnerView({ queue }: { queue: EmergingWinnerQueue }) {
  const surfaced = queue.queue.filter((r) => r.surfaced);
  const blocked = queue.queue.filter((r) => !r.surfaced);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-ink">Emerging Winners</h1>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] ${
              queue.demo ? 'bg-accent-tint text-accent' : 'bg-blue-tint text-blue-info'
            }`}
          >
            {queue.demo ? 'Illustrative demo data' : 'Beta'}
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-3">
          Small caps that structurally resemble the companies that became outsized winners - a 10-domain
          scorecard, a winner classifier, historical analogues and a risk-gate stack, ranked for research.
          Tap any name to inspect exactly why it is here.
        </p>
        <Link
          href="/models"
          className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-blue-info hover:text-blue-focus"
        >
          Part of the Emerging Winner Engine - see how the six models work <ArrowRight size={12} />
        </Link>
      </header>

      <TrainedOnPanel demo={queue.demo} />

      {surfaced.length === 0 && blocked.length === 0 && (
        <p className="text-sm text-ink-3">No candidates in the current run.</p>
      )}

      <div className="space-y-3">
        {surfaced.map((r, i) => (
          <Card key={r.symbol} result={r} rank={i + 1} demo={queue.demo} />
        ))}
      </div>

      {blocked.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-medium text-ink-3">
            Filtered out by the risk gates ({blocked.length})
          </h2>
          <div className="space-y-3">
            {blocked.map((r, i) => (
              <Card key={r.symbol} result={r} rank={surfaced.length + i + 1} demo={queue.demo} />
            ))}
          </div>
        </>
      )}

      {queue.engine_version && (
        <p className="mt-6 text-center text-[10px] text-ink-dim">
          {queue.engine_version}
          {queue.generated_at ? ` · ${new Date(queue.generated_at).toLocaleString()}` : ''}
        </p>
      )}
    </div>
  );
}
