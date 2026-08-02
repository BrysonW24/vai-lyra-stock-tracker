'use client';

import Link from 'next/link';
import { Landmark, Cpu, Wallet, AlertTriangle, ArrowDown } from 'lucide-react';
import { TickerLogo } from '@/components/TickerLogo';
import {
  LIFECYCLE_ORDER,
  LIFECYCLE_LABEL,
  type LifecycleCandidate,
  type LifecycleStage,
  type BackerKind,
  type UpsideTier,
} from '@/lib/small-cap-lifecycle';
import type { CompanyChainPosition, RawMaterial } from '@/lib/value-chain';

/**
 * StoryDrawer - the founder's "super compact depths of detail that build the story" surface. Packs
 * the whole narrative of an inspected small cap into a signal-dense, miniaturised block: where it
 * sits on the lifecycle arc, the emergence sub-scores as micro-bars, who is backing it, its position
 * in the value chain across themes, and the raw materials beneath it. Designed to be felt at a
 * glance, not read line by line. Research only.
 */

const STAGE_DOT: Record<LifecycleStage, string> = {
  concept: 'bg-blue-info',
  funded: 'bg-pending',
  contracted: 'bg-positive',
  scaling: 'bg-accent',
  crowded: 'bg-negative-soft',
};

const BACKER_ICON: Record<BackerKind, React.ReactNode> = {
  government: <Landmark size={9} className="text-pending" />,
  'big-tech': <Cpu size={9} className="text-accent" />,
  'smart-money': <Wallet size={9} className="text-positive" />,
};

function barTone(v: number): string {
  if (v < 0) return 'bg-negative-soft';
  if (v >= 70) return 'bg-positive';
  if (v >= 45) return 'bg-accent';
  return 'bg-ink-dim';
}

/** A micro score bar: label, tiny fill, value - the visual "feel" of a 0-100 (or negative) signal. */
function MiniBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Math.abs(value));
  return (
    <div className="flex items-center gap-1">
      <span className="w-[52px] shrink-0 truncate text-[8px] uppercase tracking-[0.08em] text-ink-3">{label}</span>
      <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-panel">
        <span className={`absolute inset-y-0 left-0 rounded-full ${barTone(value)}`} style={{ width: `${pct}%` }} />
      </span>
      <span className={`numeric w-6 shrink-0 text-right font-mono text-[9px] font-semibold ${value < 0 ? 'text-negative-soft' : 'text-ink-title'}`}>
        {value}
      </span>
    </div>
  );
}

/** The lifecycle spine: 5 dots with THIS name's stage highlighted, so the arc position is instant. */
function StageSpine({ stage }: { stage: LifecycleStage }) {
  const activeIndex = LIFECYCLE_ORDER.indexOf(stage);
  return (
    <div className="flex items-center gap-1">
      {LIFECYCLE_ORDER.map((s, i) => {
        const active = i === activeIndex;
        const passed = i < activeIndex;
        return (
          <div key={s} className="flex items-center gap-1">
            <span
              className={`h-2 w-2 rounded-full ${active ? STAGE_DOT[s] : passed ? 'bg-line-hair' : 'bg-line'} ${
                active ? 'ring-2 ring-inset ring-current' : ''
              }`}
              title={LIFECYCLE_LABEL[s]}
            />
            {i < LIFECYCLE_ORDER.length - 1 && <span className={`h-px w-3 ${passed ? 'bg-line-hair' : 'bg-line'}`} />}
          </div>
        );
      })}
      <span className="ml-1 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-title">{LIFECYCLE_LABEL[stage]}</span>
    </div>
  );
}

function RawPill({ rm }: { rm: RawMaterial }) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded px-1 py-px font-mono text-[8px] ${
        rm.aiLinked ? 'bg-accent-tint text-accent' : 'bg-panel text-ink-3'
      }`}
      title={rm.from ? `${rm.name} - ${rm.from}` : rm.name}
    >
      {rm.commodity?.emoji ?? ''}{rm.name}
    </span>
  );
}

interface StoryDrawerProps {
  candidate: LifecycleCandidate;
  position: CompanyChainPosition | null;
}

function scoreTone(total: number): string {
  if (total >= 70) return 'text-positive';
  if (total >= 55) return 'text-accent';
  if (total >= 42) return 'text-ink-2';
  return 'text-negative-soft';
}

const UPSIDE_TIER_LABEL: Record<UpsideTier, string> = {
  lottery: 'Lottery-tier',
  asymmetric: 'Asymmetric',
  balanced: 'Balanced',
  limited: 'Limited',
};

const UPSIDE_TIER_TONE: Record<UpsideTier, string> = {
  lottery: 'text-negative-soft',
  asymmetric: 'text-positive',
  balanced: 'text-accent',
  limited: 'text-ink-3',
};

export function StoryDrawer({ candidate: c, position }: StoryDrawerProps) {
  const e = c.emergence;
  const u = c.upside;
  return (
    <section className="terminal-panel space-y-2 rounded-panel p-2.5">
      {/* Header line */}
      <div className="flex items-center gap-2">
        <TickerLogo symbol={c.symbol} companyName={c.name} size={16} />
        <span className="font-mono text-[12px] font-semibold text-ink">{c.symbol}</span>
        <span className="min-w-0 flex-1 truncate text-[10px] text-ink-3">{c.name}</span>
        <span className="shrink-0 text-[10px]" title={c.themeName}>{c.themeEmoji}</span>
        <span className={`numeric shrink-0 font-mono text-lg font-semibold ${scoreTone(e.total)}`}>{e.total}</span>
      </div>

      {/* Story line + lifecycle spine */}
      <p className="text-[10px] leading-snug text-ink-title">{c.whyNow}</p>
      <StageSpine stage={c.stage} />

      {/* Emergence sub-scores as micro-bars (two columns to stay compact) */}
      <div className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
        <MiniBar label="Early" value={e.earliness} />
        <MiniBar label="Backing" value={e.backing} />
        <MiniBar label="Evidence" value={e.evidence} />
        <MiniBar label="Bottleneck" value={e.bottleneck} />
        <MiniBar label="Momentum" value={e.momentum} />
        <MiniBar label="Penalty" value={-e.riskPenalty} />
      </div>

      {/* Upside asymmetry - a deterministic MODEL estimate of shape, never a price target */}
      <div className="rounded border border-line bg-panel-deep p-1.5">
        <div className="mb-1 flex items-center gap-1">
          <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-ink-3">Upside asymmetry</p>
          <span className={`ml-auto font-mono text-[9px] font-semibold ${UPSIDE_TIER_TONE[u.tier]}`}>{UPSIDE_TIER_LABEL[u.tier]}</span>
        </div>
        <div className="grid grid-cols-3 gap-1 text-center">
          <div className="rounded bg-panel py-1">
            <p className="text-[7px] uppercase tracking-[0.1em] text-ink-3">Bear</p>
            <p className="numeric font-mono text-[11px] font-semibold text-negative-soft">{u.bearMultiple}x</p>
          </div>
          <div className="rounded bg-panel py-1">
            <p className="text-[7px] uppercase tracking-[0.1em] text-ink-3">Base</p>
            <p className="numeric font-mono text-[11px] font-semibold text-ink-title">{u.baseMultiple}x</p>
          </div>
          <div className="rounded bg-panel py-1">
            <p className="text-[7px] uppercase tracking-[0.1em] text-ink-3">Bull</p>
            <p className="numeric font-mono text-[11px] font-semibold text-positive">{u.bullMultiple}x</p>
          </div>
        </div>
        <p className="mt-1 font-mono text-[9px] text-ink-2">
          +{Math.round(u.impliedUpsidePct)}% base upside vs -{Math.round(u.downsideRiskPct)}% downside · {u.asymmetryRatio}:1 asymmetry
        </p>
        <p className="mt-0.5 text-[8px] leading-snug text-ink-dim">
          Deterministic model estimate of payoff shape from disclosed factors - not a price target, forecast, or proven return.
        </p>
      </div>

      {/* Backing story - dense rows */}
      {c.backing.sources.length > 0 && (
        <div className="rounded border border-line bg-panel-deep p-1.5">
          <p className="mb-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-ink-3">Backing</p>
          <ul className="space-y-0.5">
            {c.backing.sources.map((s, i) => (
              <li key={`${s.kind}-${s.name}-${i}`} className="flex items-start gap-1 text-[9px] leading-snug text-ink-2">
                <span className="mt-px shrink-0">{BACKER_ICON[s.kind]}</span>
                <span className="line-clamp-2"><span className="font-semibold text-ink-title">{s.name}</span> {s.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Value-chain position - where it sits, across themes, with raw materials beneath */}
      {position && position.positions.length > 0 && (
        <div className="rounded border border-line bg-panel-deep p-1.5">
          <p className="mb-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-ink-3">
            Chain position{position.positions.length > 1 ? ' (cross-theme)' : ''}
          </p>
          <ul className="space-y-1">
            {position.positions.map((p) => (
              <li key={`${p.themeSlug}-${p.node.id}`} className="text-[9px] leading-snug">
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-ink-dim">{p.tierLabel}</span>
                  <span className="truncate font-semibold text-ink-title">{p.node.name}</span>
                  <span className="shrink-0 font-mono text-[8px] text-accent" title="Bottleneck score">btl {p.node.bottleneck}</span>
                  <span className="ml-auto shrink-0 truncate text-[8px] text-ink-3">{p.themeName}</span>
                </div>
                {p.node.commodities.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-0.5">
                    {p.node.commodities.map((cm) => (
                      <RawPill key={cm} rm={{ name: cm, aiLinked: false }} />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {position.rawMaterials.length > 0 && (
            <div className="mt-1.5 border-t border-line pt-1.5">
              <p className="mb-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-accent">Raw materials beneath</p>
              <div className="flex flex-wrap gap-0.5">
                {position.rawMaterials.map((rm) => (
                  <RawPill key={rm.name} rm={rm} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Risks - compact */}
      {c.risks.length > 0 && (
        <div className="flex items-start gap-1">
          <AlertTriangle size={9} className="mt-0.5 shrink-0 text-negative-soft" />
          <p className="text-[9px] leading-snug text-ink-3">{c.risks.join(' · ')}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={() => document.getElementById('chain-explorer')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="inline-flex items-center gap-1 rounded border border-positive/40 bg-positive-tint px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-positive transition hover:bg-positive/15"
          title="Jump to the end-to-end value chain with this name highlighted"
        >
          Trace the full chain <ArrowDown size={9} />
        </button>
        <Link
          href={`/tickers/${c.symbol}`}
          className="rounded border border-blue-info/40 bg-blue-tint px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-blue-info transition hover:bg-blue/15"
        >
          Ticker detail {'->'}
        </Link>
        <Link
          href={`/themes/${c.theme}`}
          className="rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-2 transition hover:text-ink-title"
        >
          Theme dossier {'->'}
        </Link>
      </div>
    </section>
  );
}
