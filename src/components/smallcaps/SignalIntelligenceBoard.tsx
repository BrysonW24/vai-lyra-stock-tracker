'use client';

import { Radar, Landmark, Cpu, Wallet, Building2, Gauge, TrendingUp, Layers } from 'lucide-react';
import { TickerLogo } from '@/components/TickerLogo';
import { HelpDrawer, type HelpTerm } from '@/components/education/HelpDrawer';
import { SIGNAL_KIND_LABEL, type SignalConvergence, type SignalKind, type SignalDataPoint } from '@/lib/signal-intelligence';
import { captureInteraction } from '@/lib/twin/capture';

/**
 * Signal Intelligence Board - the "where attention belongs now" surface. Renders the deterministic
 * cross-signal convergence engine: names where multiple INDEPENDENT signals line up, ranked by
 * conviction, each expandable into the exact data points behind it. This is the reasoning-over-the-
 * multitude layer made visible - dense, compact, signal-first. Research only.
 */

interface SignalIntelligenceBoardProps {
  convergence: SignalConvergence[];
  stats: { entities: number; dataPoints: number; liveDataPoints: number; convergentEntities: number };
  generatedAt: string;
}

const KIND_ICON: Record<SignalKind, React.ReactNode> = {
  'gov-award': <Landmark size={10} className="text-[#8aa2ff]" />,
  'capital-event': <Building2 size={10} className="text-[#8aa2ff]" />,
  'big-tech-backing': <Cpu size={10} className="text-[#f3a33a]" />,
  institutional: <Wallet size={10} className="text-[#5fd08a]" />,
  bottleneck: <Gauge size={10} className="text-[#f3a33a]" />,
  momentum: <TrendingUp size={10} className="text-[#43d18b]" />,
  lifecycle: <Layers size={10} className="text-[#b79cff]" />,
};

const HELP_TERMS: HelpTerm[] = [
  { term: 'Convergence', what: 'When several INDEPENDENT signals (government backing, capital, institutional buying, bottleneck exposure, momentum) point at the same name in a window. Independent agreement is higher-conviction than one loud signal.' },
  { term: 'Conviction', what: 'A deterministic 0-100 score rewarding breadth (how many independent signal kinds align), the strength of the top data points, and disclosed backing. It is a research rank, never a buy signal.' },
  { term: 'Data point', what: 'One independent signal touching a name - a gov award, a capital commitment, a 13F move, a bottleneck, a momentum turn - scored by impact and recency.' },
  { term: 'Live vs sample', what: 'Live signals come from a real-time feed (the scanner today; more feeds as they wire in). Sample signals are curated illustrative data. The board shows which is which so you never mistake one for the other.' },
];

function ConvergenceBar({ score }: { score: number }) {
  const tone = score >= 55 ? 'bg-[#43d18b]' : score >= 40 ? 'bg-[#f3a33a]' : 'bg-[#5e6b78]';
  return (
    <span className="relative h-1.5 w-14 overflow-hidden rounded-full bg-[#0d141c]">
      <span className={`absolute inset-y-0 left-0 rounded-full ${tone}`} style={{ width: `${score}%` }} />
    </span>
  );
}

function DataPointRow({ p }: { p: SignalDataPoint }) {
  return (
    <li className="flex items-start gap-1.5 text-[9px] leading-snug">
      <span className="mt-px shrink-0">{KIND_ICON[p.kind]}</span>
      <span className="min-w-0 flex-1">
        <span className="font-semibold text-[#dbe5ee]">{p.headline}</span>
        <span className="text-[#8190a0]"> - {p.detail}</span>
      </span>
      <span className="shrink-0 font-mono text-[8px] text-[#5e6b78]">{p.date ?? '·'}</span>
      <span className={`shrink-0 rounded px-1 py-px font-mono text-[8px] ${p.freshness === 'live' ? 'bg-[#0d251b] text-[#43d18b]' : 'bg-[#0d141c] text-[#6f7d8a]'}`}>
        {p.freshness === 'live' ? 'live' : 'smpl'}
      </span>
      <span className="numeric w-5 shrink-0 text-right font-mono text-[9px] font-semibold text-[#dbe5ee]">{p.score}</span>
    </li>
  );
}

export function SignalIntelligenceBoard({ convergence, stats, generatedAt }: SignalIntelligenceBoardProps) {
  const top = convergence.filter((c) => c.kinds.length >= 2).slice(0, 8);

  return (
    <section className="terminal-panel space-y-2.5 rounded-md p-3">
      <div className="flex items-center gap-2">
        <Radar size={16} className="text-[#43d18b]" />
        <h2 className="text-sm font-semibold text-[#eef3f8]">Signal intelligence</h2>
        <span
          className="ml-auto rounded border border-[#263241] bg-[#0d141c] px-1.5 py-0.5 font-mono text-[9px] text-[#8190a0]"
          title={`Generated ${generatedAt}`}
        >
          {stats.dataPoints} signals · {stats.convergentEntities} converging
        </span>
        <HelpDrawer
          title="How signal intelligence works"
          subtitle="Cross-signal convergence, scored deterministically"
          ariaLabel="How signal intelligence works"
          intro="This board scans every independent signal across the universe and surfaces the names where several of them line up at once. Convergence of independent signals is the highest-conviction 'look here' event."
          terms={HELP_TERMS}
          footnote="Every score here is deterministic. The AI can explain a convergence but never invents one. Research only - nothing here is a buy or sell call."
        />
      </div>
      <p className="text-[10px] leading-snug text-[#a8b5c2]">
        Where multiple independent signals line up right now - government backing, capital, institutional buying,
        supply-chain bottlenecks and turning momentum - ranked by conviction. The most effective data points, first.
      </p>

      <div className="space-y-1.5">
        {top.map((c) => (
          <details
            key={c.entity}
            className="group overflow-hidden rounded-md border border-[#1b2530] bg-[#0d1117]"
            onToggle={(e) => {
              if (e.currentTarget.open) {
                captureInteraction({ eventType: 'convergence_expand', entityType: 'convergence', entityId: c.entity });
              }
            }}
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2 transition hover:bg-[#101720]">
              <TickerLogo symbol={c.entity} companyName={c.name} size={13} />
              <span className="shrink-0 font-mono text-[11px] font-semibold text-[#eef3f8]">{c.entity}</span>
              <span className="min-w-0 flex-1 truncate text-[10px] text-[#8190a0]">{c.narrative}</span>
              <span className="hidden shrink-0 items-center gap-1 sm:flex">
                {c.kinds.map((k) => (
                  <span key={k} title={SIGNAL_KIND_LABEL[k]}>{KIND_ICON[k]}</span>
                ))}
              </span>
              <ConvergenceBar score={c.convergenceScore} />
              <span className="numeric w-6 shrink-0 text-right font-mono text-sm font-semibold text-[#eef3f8]">{c.convergenceScore}</span>
            </summary>
            <div className="border-t border-[#1b2530] px-2.5 py-2">
              <ul className="space-y-1">
                {c.points.map((p, i) => (
                  <DataPointRow key={`${p.kind}-${i}`} p={p} />
                ))}
              </ul>
            </div>
          </details>
        ))}
        {top.length === 0 && (
          <p className="p-2 text-[11px] text-[#a8b5c2]">No multi-signal convergence in the current data window.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[#1b2530] pt-2 font-mono text-[9px] text-[#5e6b78]">
        <span className="inline-flex items-center gap-1"><Landmark size={9} className="text-[#8aa2ff]" /> gov</span>
        <span className="inline-flex items-center gap-1"><Cpu size={9} className="text-[#f3a33a]" /> big-tech</span>
        <span className="inline-flex items-center gap-1"><Wallet size={9} className="text-[#5fd08a]" /> institutional</span>
        <span className="inline-flex items-center gap-1"><Gauge size={9} className="text-[#f3a33a]" /> bottleneck</span>
        <span className="inline-flex items-center gap-1"><TrendingUp size={9} className="text-[#43d18b]" /> momentum</span>
        <span className="ml-auto">{stats.liveDataPoints} live of {stats.dataPoints}</span>
      </div>
    </section>
  );
}
