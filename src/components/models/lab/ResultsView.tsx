'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bookmark,
  BookmarkCheck,
  Bot,
  Building2,
  ChevronDown,
  Droplets,
  GitCompare,
  Info,
  Landmark,
  MessageSquare,
  Network,
  Newspaper,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { LabSelect, type LabOption } from '@/components/models/lab/LabSelect';
import { CAP_BANDS, type RunResult, type LabResult, type ResultTone } from '@/lib/models/lab';
import { isSaved, toggleSave, QUEUE_EVENT } from '@/lib/research-queue';
import type { SignalRow } from '@/types/scanner';
import type { EmergingWinnerResult, EWDomain } from '@/lib/emerging-winner/types';
import { DomainRadar } from '@/components/models/lab/viz/DomainRadar';
import { fmtCap } from '@/components/models/lab/viz/scale';

/**
 * Right panel - Surfaced candidates. The run's ranked names: rank 1 expanded with its stats, tags,
 * strongest domains, primary risk and actions; the rest collapsed rows that expand on tap. Every
 * field is real - winner probability is the classifier's logged probability field (never rescaled),
 * resemblance is the logged 0-100 score, and nothing invents a percentile or a baseline. "Open
 * finding" unfolds the full decode (radar, fundamentals inspected, outlook, analogues, provenance).
 * Save goes to the real research queue; actions without a wired handler render disabled and say so.
 */

const DRIVER_CAPS: Record<string, number> = { RSI: 25, MACD: 30, Price: 15, Trend: 15, Volume: 15 };

type SortKey = 'run' | 'probability' | 'resemblance';

function toneClass(t: ResultTone): string {
  if (t === 'strong') return 'text-emerald-300';
  if (t === 'moderate') return 'text-amber-300';
  return 'text-white/55';
}

function nf(n: number): string {
  return n.toLocaleString('en-US');
}

function pctOf(p: number): string {
  return `${Math.round(p * 100)}%`;
}

/** The cap tier the result's REAL market cap falls in (null when cap was never sourced). */
function capTier(cap: number | null | undefined): string | null {
  if (cap == null) return null;
  const band = CAP_BANDS.find(
    (b) => b.key !== 'all' && (b.min == null || cap >= b.min) && (b.max == null || cap < b.max),
  );
  return band ? `${band.label} cap` : null;
}

function domainIcon(label: string) {
  const l = label.toLowerCase();
  if (l.includes('technical')) return Activity;
  if (l.includes('volume') || l.includes('accumulation')) return BarChart3;
  if (l.includes('liquidity')) return Droplets;
  if (l.includes('theme')) return Network;
  if (l.includes('business')) return Building2;
  if (l.includes('capital') || l.includes('surviv')) return Wallet;
  if (l.includes('government') || l.includes('policy')) return Landmark;
  if (l.includes('adoption') || l.includes('traction')) return TrendingUp;
  if (l.includes('sponsor') || l.includes('smart money')) return Users;
  if (l.includes('narrative') || l.includes('attention')) return Newspaper;
  return Sparkles;
}

export function ResultsView({
  run,
  pending = false,
  focus = [],
  rankLabel,
  selectedSymbol,
  onSelectSymbol,
}: {
  run: RunResult | null;
  pending?: boolean;
  focus?: string[];
  rankLabel?: string;
  selectedSymbol?: string | null;
  onSelectSymbol?: (symbol: string | null) => void;
}) {
  const [sort, setSort] = useState<SortKey>('run');
  const [showAll, setShowAll] = useState(false);

  const results = useMemo(() => run?.results ?? [], [run]);
  const hasEw = results.some((r) => r.ew);

  const sorted = useMemo(() => {
    if (sort === 'probability') return [...results].sort((a, b) => (b.ew?.probability ?? -1) - (a.ew?.probability ?? -1));
    if (sort === 'resemblance') return [...results].sort((a, b) => (b.ew?.winner_similarity ?? -1) - (a.ew?.winner_similarity ?? -1));
    return results;
  }, [results, sort]);

  const expandedSymbol = selectedSymbol && sorted.some((r) => r.symbol === selectedSymbol) ? selectedSymbol : sorted[0]?.symbol ?? null;

  // A selection made from the full-width visuals may sit past the collapsed cut - reveal it.
  useEffect(() => {
    if (!selectedSymbol) return;
    const idx = sorted.findIndex((r) => r.symbol === selectedSymbol);
    if (idx >= 3) setShowAll(true);
  }, [selectedSymbol, sorted]);

  const visible = showAll ? sorted.slice(0, 25) : sorted.slice(0, 3);

  const sortOptions: LabOption[] = hasEw
    ? [
        { value: 'run', label: rankLabel ? `Run ranking - ${rankLabel}` : 'Run ranking' },
        { value: 'probability', label: 'Winner probability' },
        { value: 'resemblance', label: 'Winner resemblance' },
      ]
    : [{ value: 'run', label: rankLabel ? `Run ranking - ${rankLabel}` : 'Run ranking' }];

  const subtitle =
    sort === 'probability'
      ? 'Top results ranked by winner probability.'
      : sort === 'resemblance'
        ? 'Top results ranked by winner resemblance.'
        : rankLabel
          ? `Top results ranked by this run's outcome: ${rankLabel}.`
          : "Top results in this run's ranking order.";

  return (
    <section className="terminal-panel rounded-2xl p-4">
      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          Surfaced candidates
          {run ? (
            <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-violet-300 ring-1 ring-violet-400/30">
              {nf(results.length)}
            </span>
          ) : null}
        </h2>
        <p className="mt-1 text-[11px] text-white/45">{run ? subtitle : 'Results land here when a run completes.'}</p>
      </div>

      {run ? (
        <>
          {/* Provenance + scope - honest about what this run was */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {run.summary.illustrative ? (
              <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium text-sky-300 ring-1 ring-sky-400/30">
                illustrative
              </span>
            ) : (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-400/30">
                real
              </span>
            )}
            {run.summary.marketLabel ? <ScopeChip k="Market" v={run.summary.marketLabel} /> : null}
            {run.summary.capBandLabel && run.summary.capBandLabel !== 'All caps' ? <ScopeChip k="Cap" v={run.summary.capBandLabel} /> : null}
            {run.summary.focusLabels?.length ? <ScopeChip k="Focus" v={run.summary.focusLabels.join(', ')} tone="sky" /> : null}
          </div>

          {run.summary.notes?.length ? (
            <ul className="mt-2 space-y-1 rounded-xl border border-amber-400/15 bg-amber-500/[0.05] px-3 py-2">
              {run.summary.notes.map((n, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-200/80">
                  <Info size={12} className="mt-0.5 shrink-0" /> {n}
                </li>
              ))}
            </ul>
          ) : null}

          {results.length > 0 ? (
            <>
              {/* Sort */}
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-white/40">Sort by</span>
                <div className="w-52 max-w-full">
                  <LabSelect compact value={sort} options={sortOptions} onChange={(v) => setSort(v as SortKey)} ariaLabel="Sort candidates" />
                </div>
              </div>

              {/* Candidate list */}
              <ul className="mt-3 space-y-2">
                {visible.map((r) => {
                  const rank = sorted.indexOf(r) + 1;
                  const expanded = r.symbol === expandedSymbol;
                  return (
                    <li key={r.symbol}>
                      {expanded ? (
                        <CandidateCard result={r} rank={rank} focus={focus} />
                      ) : (
                        <CollapsedRow result={r} rank={rank} onSelect={() => onSelectSymbol?.(r.symbol)} />
                      )}
                    </li>
                  );
                })}
              </ul>

              {hasEw ? (
                <p className="mt-2 text-[10px] leading-relaxed text-white/35">
                  Winner probability is the real-v1 classifier&apos;s logged output; resemblance is the logged 0-100 score.
                  Research only - not advice.
                </p>
              ) : null}

              {sorted.length > 3 ? (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-[12px] font-medium text-white/70 transition hover:border-white/25 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
                >
                  {showAll ? 'Show top 3' : `View all surfaced candidates (${nf(sorted.length)})`}
                  <ChevronDown size={13} className={`transition-transform ${showAll ? 'rotate-180' : ''}`} />
                </button>
              ) : null}
            </>
          ) : (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-5 text-center">
              <p className="text-[13px] text-white/70">No candidates matched this run.</p>
              <p className="mt-1 text-[11px] text-white/45">
                Widen the market or cap band, clear the verticals or focus, or remove the ticker list and run again.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
          <p className="text-[13px] text-white/60">{pending ? 'Run in progress.' : 'No candidates yet.'}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/40">
            {pending
              ? 'Candidates appear here the moment the pipeline completes.'
              : 'Configure a run on the left and press Run - surfaced names appear here with the full why behind each one.'}
          </p>
        </div>
      )}
    </section>
  );
}

function ScopeChip({ k, v, tone }: { k: string; v: string; tone?: 'sky' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
        tone === 'sky' ? 'border-sky-400/30 bg-sky-500/10 text-sky-200' : 'border-white/12 bg-white/[0.03] text-white/60'
      }`}
    >
      <span className="uppercase tracking-wide text-white/35">{k}</span> {v}
    </span>
  );
}

function RankChip({ n, size = 'md' }: { n: number; size?: 'sm' | 'md' }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg bg-violet-500/15 font-mono font-semibold text-violet-300 ring-1 ring-violet-400/25 ${
        size === 'md' ? 'h-7 w-7 text-[12px]' : 'h-6 w-6 text-[11px]'
      }`}
    >
      {n}
    </span>
  );
}

function Monogram({ symbol, size = 'md' }: { symbol: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg bg-white/[0.07] font-semibold text-white/75 ring-1 ring-white/10 ${
        size === 'md' ? 'h-9 w-9 text-[12px]' : 'h-7 w-7 text-[10px]'
      }`}
      aria-hidden
    >
      {symbol.slice(0, 2).toUpperCase()}
    </span>
  );
}

function TagPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/60">{children}</span>
  );
}

/** Save to the real research queue (src/lib/research-queue.ts) - the same store the Saved page reads. */
function SaveGhost({ result }: { result: LabResult }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(isSaved(result.symbol));
    const sync = () => setSaved(isSaved(result.symbol));
    window.addEventListener(QUEUE_EVENT, sync);
    return () => window.removeEventListener(QUEUE_EVENT, sync);
  }, [result.symbol]);

  return (
    <button
      type="button"
      onClick={() =>
        setSaved(
          toggleSave({
            symbol: result.symbol,
            kind: 'ticker',
            label: result.companyName !== result.symbol ? result.companyName : undefined,
            savedScore: result.headlineValue,
            savedAt: new Date().toISOString(),
          }),
        )
      }
      aria-pressed={saved}
      title={saved ? 'Saved to your research queue' : 'Save to your research queue'}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 ${
        saved
          ? 'border-amber-400/40 bg-amber-500/10 text-amber-300'
          : 'border-white/12 bg-white/[0.03] text-white/70 hover:border-white/25 hover:text-white'
      }`}
    >
      {saved ? <BookmarkCheck size={12} /> : <Bookmark size={12} />} {saved ? 'Saved' : 'Save'}
    </button>
  );
}

function GhostLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-white/70 transition hover:border-white/25 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
    >
      {icon} {label}
    </Link>
  );
}

function GhostDisabled({ icon, label, title }: { icon: React.ReactNode; label: string; title: string }) {
  return (
    <button
      type="button"
      disabled
      title={title}
      className="inline-flex cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5 text-[11px] font-medium text-white/30"
    >
      {icon} {label}
    </button>
  );
}

function CollapsedRow({ result, rank, onSelect }: { result: LabResult; rank: number; onSelect: () => void }) {
  const r = result;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] p-2.5 text-left transition-all duration-200 hover:border-white/20 hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
    >
      <RankChip n={rank} size="sm" />
      <Monogram symbol={r.symbol} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5">
          <span className="text-[13px] font-semibold text-white">{r.symbol}</span>
          {r.companyName !== r.symbol ? <span className="truncate text-[11px] text-white/40">{r.companyName}</span> : null}
        </span>
        <span className="mt-0.5 flex flex-wrap gap-1">
          <TagPill>{r.group}</TagPill>
          {capTier(r.marketCap) ? <TagPill>{capTier(r.marketCap)}</TagPill> : null}
        </span>
      </span>
      <span className="shrink-0 text-right">
        {r.ew ? (
          <>
            <span className="block text-[14px] font-bold tabular-nums text-white">{pctOf(r.ew.probability)}</span>
            <span className="block text-[9px] uppercase tracking-wide text-white/35">Winner probability</span>
          </>
        ) : (
          <>
            <span className={`block text-[14px] font-bold tabular-nums ${toneClass(r.tone)}`}>{r.headlineValue}</span>
            <span className="block text-[9px] uppercase tracking-wide text-white/35">{r.headlineLabel}</span>
          </>
        )}
      </span>
      <ChevronDown size={14} className="shrink-0 text-white/30" />
    </button>
  );
}

function CandidateCard({ result, rank, focus }: { result: LabResult; rank: number; focus: string[] }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const r = result;
  const ew = r.ew;
  const tier = capTier(r.marketCap);
  const trait = ew?.present_traits[0];
  const strongest = ew ? ew.strongest_domains.slice(0, 4) : r.strongest;
  const riskVerdict = ew?.risk.verdict;

  return (
    <article className="rounded-2xl border border-violet-400/35 bg-violet-500/[0.04] p-3 shadow-[0_0_28px_rgba(139,92,246,0.14)] ring-1 ring-violet-400/15">
      {/* Identity row */}
      <div className="flex items-start gap-2.5">
        <RankChip n={rank} />
        <Monogram symbol={r.symbol} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[16px] font-bold text-white">{r.symbol}</span>
            {r.companyName !== r.symbol ? <span className="truncate text-[11px] text-white/45">{r.companyName}</span> : null}
          </div>
          <p className="truncate text-[11px] text-white/40">{r.subtitle}</p>
        </div>
        {r.tone === 'strong' ? (
          <span className="shrink-0 rounded-full border border-emerald-400/40 bg-emerald-500/[0.06] px-2 py-0.5 text-[10px] font-medium text-emerald-300">
            Strong candidate
          </span>
        ) : null}
      </div>

      {/* Tags */}
      <div className="mt-2 flex flex-wrap gap-1">
        <TagPill>{r.group}</TagPill>
        {tier ? <TagPill>{tier}</TagPill> : null}
        {r.marketCap != null ? <TagPill>{fmtCap(r.marketCap)}</TagPill> : null}
        {r.confidence ? <TagPill>{r.confidence} confidence</TagPill> : null}
      </div>

      {/* Distinguishing trait (real: the engine's present_traits) */}
      {trait ? (
        <p className="mt-2 w-full rounded-lg border border-emerald-400/20 bg-emerald-500/[0.07] px-2.5 py-1.5 text-[11px] text-emerald-200/85">
          {trait}
        </p>
      ) : null}

      {/* Stat cells */}
      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        {ew ? (
          <>
            <StatCell big value={pctOf(ew.probability)} label="Winner probability" />
            <StatCell value={String(Math.round(ew.winner_similarity))} label="Resemblance (0-100)" />
            <StatCell value={r.confidence ?? '-'} label="Confidence" />
          </>
        ) : r.radar ? (
          <>
            <StatCell big value={String(r.radar.score)} label="Recovery score" />
            <StatCell value={r.radar.rsi.toFixed(1)} label="RSI" />
            <StatCell value={`${r.radar.volumeRatio.toFixed(2)}x`} label="Volume ratio" />
          </>
        ) : null}
      </div>

      {/* Strongest domains */}
      {strongest.length ? (
        <div className="mt-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
            {ew ? 'Strongest domains' : 'Strongest drivers'}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {strongest.map((d) => {
              const IconCmp = domainIcon(d);
              return (
                <span
                  key={d}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-200/80"
                >
                  <IconCmp size={10} /> {d}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Primary risk */}
      <div className="mt-2.5 flex items-start justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5">
        <span className="flex min-w-0 items-start gap-1.5 text-[11px] text-white/65">
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-400" />
          <span className="min-w-0">
            <span className="mr-1 text-[9px] font-semibold uppercase tracking-wide text-white/35">Primary risk</span>
            {r.primaryRisk}
          </span>
        </span>
        {riskVerdict ? (
          <span
            className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide ${
              riskVerdict === 'block' ? 'text-rose-300' : riskVerdict === 'review' ? 'text-amber-300' : 'text-emerald-300'
            }`}
          >
            {riskVerdict}
          </span>
        ) : null}
      </div>

      {/* Actions */}
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => setDetailOpen((v) => !v)}
          aria-expanded={detailOpen}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-violet-500 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:bg-violet-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          {detailOpen ? 'Close finding' : 'Open finding'}
        </button>
        <SaveGhost result={r} />
        <GhostLink href="/comparison" icon={<GitCompare size={12} />} label="Compare" />
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <GhostDisabled
          icon={<MessageSquare size={12} />}
          label="Ask Lyra"
          title="Ask Lyra opens from the floating launcher - a per-candidate deep link is not wired yet"
        />
        <GhostLink href="/paper-bot" icon={<Bot size={12} />} label="Paper Bot" />
      </div>

      {/* Full finding decode */}
      {detailOpen ? (
        <div className="mt-3 border-t border-white/10 pt-1">
          {ew ? <EwDetail r={ew} focus={focus} /> : r.radar ? <RadarDetail s={r.radar} /> : null}
        </div>
      ) : null}
    </article>
  );
}

function StatCell({ value, label, big }: { value: string; label: string; big?: boolean }) {
  return (
    <div className="glass-well rounded-lg px-2 py-1.5 text-center">
      <div className={`font-bold tabular-nums text-white ${big ? 'text-[17px]' : 'text-[14px]'}`}>{value}</div>
      <div className="mt-0.5 text-[8px] uppercase tracking-wide text-white/40">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 border-t border-white/5 pt-3 first:mt-0 first:border-t-0 first:pt-2">
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
          <span>
            vs SMA200 {s.priceVsSma200 >= 0 ? '+' : ''}
            {s.priceVsSma200.toFixed(1)}%
          </span>
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
        <p className="text-[11px] text-white/45">Deterministic score (TS + Python golden-vector parity). Last updated {s.lastUpdated}.</p>
        <Link href={`/tickers/${s.symbol}`} className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-sky-300 hover:underline">
          Open full ticker view <ArrowRight size={12} />
        </Link>
      </Section>
    </>
  );
}

/** Notable sub-signals to surface as "fundamentals inspected" - real values the engine actually read. */
function inspectedSubsignals(domains: EWDomain[]): { label: string; value: string; score: number | null }[] {
  const out: { label: string; value: string; score: number | null }[] = [];
  for (const d of domains) {
    if (d.coverage === 'unavailable') continue;
    for (const s of d.subsignals) {
      if (s.value == null && s.score == null) continue;
      const value =
        typeof s.value === 'number'
          ? Math.abs(s.value) >= 1000
            ? s.value.toLocaleString('en-US')
            : String(Number(s.value.toFixed(2)))
          : String(s.value ?? '-');
      out.push({ label: s.name.replace(/_/g, ' '), value, score: s.score });
    }
  }
  return out.slice(0, 10);
}

function EwDetail({ r, focus }: { r: EmergingWinnerResult; focus: string[] }) {
  const pct = (p: number) => `${Math.round(p * 100)}%`;
  const covered = r.domains.filter((d) => d.coverage !== 'unavailable');
  const funds = inspectedSubsignals(r.domains);
  return (
    <>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-white">{Math.round(r.winner_similarity)}</span>
        <span className="text-[11px] text-white/45">winner resemblance (0-100, not a probability)</span>
      </div>
      <p className="mt-1 text-[11px] text-white/50">
        {r.stage_label} · {r.confidence} confidence · {Math.round(r.completeness * 100)}% data complete
      </p>

      {/* The 10-domain radar - the headline "map across the fundamentals we analyse" */}
      <Section title={`10-domain map (${covered.length}/${r.domains.length} covered)`}>
        <DomainRadar domains={r.domains} focus={focus} size={220} />
      </Section>

      <Section title="What drove the resemblance">
        <div className="space-y-1.5">
          {r.contributions.slice(0, 6).map((c) => (
            <Bar
              key={c.domain}
              label={c.label}
              value={Math.max(0, c.contribution)}
              cap={Math.max(1, r.contributions[0]?.contribution || 1)}
              tone="emerald"
            />
          ))}
        </div>
      </Section>

      <Section title="Domain scorecard">
        <div className="space-y-1.5">
          {r.domains.map((d) => (
            <div key={d.key} className="flex items-center gap-2">
              <span className={`w-24 shrink-0 truncate text-[11px] ${focus.includes(d.key) ? 'font-semibold text-sky-300' : 'text-white/50'}`}>
                {d.label}
              </span>
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

      {funds.length ? (
        <Section title="Fundamentals inspected">
          <div className="space-y-1">
            {funds.map((f, i) => (
              <div key={i} className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="truncate text-white/55">{f.label}</span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className="font-mono text-white/70">{f.value}</span>
                  {f.score != null ? <span className="w-8 text-right font-mono text-[10px] text-white/35">{Math.round(f.score)}</span> : null}
                </span>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Modelled outlook (real-v1 derived, research only)">
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <Stat k="Double / 12m" v={pct(r.outcome_distribution.p_2x_12m)} />
          <Stat k="Double / 24m" v={pct(r.outcome_distribution.p_2x_24m)} />
          <Stat k="5x / 36m" v={pct(r.outcome_distribution.p_5x_36m)} />
          <Stat k="10x / 60m" v={pct(r.outcome_distribution.p_10x_60m)} />
          <Stat k="Ruin (down 80%+)" v={pct(r.outcome_distribution.p_ruin)} danger />
          <Stat k="Catalyst" v={`~${r.outcome_distribution.expected_time_to_catalyst_months}mo`} />
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
