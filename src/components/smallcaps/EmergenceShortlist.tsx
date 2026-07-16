'use client';

import { useState } from 'react';
import { Landmark, Cpu, Wallet, Sparkles } from 'lucide-react';
import { TickerLogo } from '@/components/TickerLogo';
import { HelpDrawer, type HelpTerm } from '@/components/education/HelpDrawer';
import { ValueChainMap } from '@/components/smallcaps/ValueChainMap';
import { StoryDrawer } from '@/components/smallcaps/StoryDrawer';
import { captureInteraction } from '@/lib/twin/capture';
import {
  LIFECYCLE_ORDER,
  LIFECYCLE_LABEL,
  LIFECYCLE_BLURB,
  type LifecycleCandidate,
  type LifecycleStage,
} from '@/lib/small-cap-lifecycle';
import type { ValueChain, CompanyChainPosition } from '@/lib/value-chain';

interface EmergenceShortlistProps {
  shortlist: LifecycleCandidate[];
  /** Stage counts across the WHOLE small-cap universe (for the arc header). */
  distribution: Record<LifecycleStage, number>;
  /** Value chains keyed by theme slug, so selecting a name renders its chain with the name focused. */
  chainsByTheme: Record<string, ValueChain>;
  /** Per-symbol chain position (its nodes across themes + raw materials), for the story drawer. */
  positionsBySymbol: Record<string, CompanyChainPosition>;
}

const STAGE_TONE: Record<LifecycleStage, string> = {
  concept: 'border-[#2a4a7a] bg-[#0f1a2c] text-[#7fb0ff]',
  funded: 'border-[#5a3ca0] bg-[#170f2c] text-[#b79cff]',
  contracted: 'border-[#1f5132] bg-[#0f2417] text-[#5fd08a]',
  scaling: 'border-[#9a6a1f] bg-[#2a1f0f] text-[#f3a33a]',
  crowded: 'border-[#7a2630] bg-[#260f12] text-[#f0758a]',
};

const HELP_TERMS: HelpTerm[] = [
  { term: 'Concept', what: 'Earliest stage - narrative and little hard evidence, no disclosed backing. Highest risk, highest optionality.' },
  { term: 'Funded', what: 'Government or big-tech money is behind it, but revenue evidence is still thin. The bet is on execution.' },
  { term: 'Contracted', what: 'Real contracts, awards or capacity on record. The thesis has left the slide deck.' },
  { term: 'Scaling', what: 'Evidence plus a turning technical - the market is starting to re-rate it.' },
  { term: 'Crowded', what: 'High evidence but the trade is obvious and crowded. Less edge left to capture - shown so you can tell early from late.' },
  { term: 'Government backing', what: 'A government contract or grant names the ticker, or a government body is the disclosed backer. Official spend often moves before consensus.' },
  { term: 'Big-tech backing', what: 'A hyperscaler / big-tech or big-AI player is funding or partnering with the name (from capital events or news-driven smart-money).' },
  { term: 'Smart money', what: 'A tracked institutional filer (13F) holds the name - a new, increased or held position counts as conviction. 13F data is delayed and long-only.' },
  { term: 'Emergence score', what: 'A deterministic 0-100 ranking that rewards EARLY + BACKED + REAL on a genuine bottleneck, and penalises crowding and hype. It is a research rank, never a buy signal.' },
];

function BackingBadges({ candidate }: { candidate: LifecycleCandidate }) {
  const b = candidate.backing;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {b.government && (
        <span className="inline-flex items-center gap-1 rounded border border-[#2a4a7a] bg-[#0f1a2c] px-1 py-0.5 font-mono text-[9px] text-[#8aa2ff]" title="Government contract, grant or backer on record">
          <Landmark size={9} /> Gov
        </span>
      )}
      {b.bigTech && (
        <span className="inline-flex items-center gap-1 rounded border border-[#9a6a1f] bg-[#231708] px-1 py-0.5 font-mono text-[9px] text-[#f3a33a]" title="Hyperscaler / big-tech / big-AI capital or partnership">
          <Cpu size={9} /> Big-tech
        </span>
      )}
      {b.smartMoney && (
        <span className="inline-flex items-center gap-1 rounded border border-[#1f5132] bg-[#0f2417] px-1 py-0.5 font-mono text-[9px] text-[#5fd08a]" title="Tracked 13F institutional filer holds the name">
          <Wallet size={9} /> Smart money
        </span>
      )}
      {b.strength === 0 && (
        <span className="rounded border border-[#263241] bg-[#0d141c] px-1 py-0.5 font-mono text-[9px] text-[#6f7d8a]">No disclosed backing</span>
      )}
    </div>
  );
}

function scoreTone(total: number): string {
  if (total >= 70) return 'text-[#43d18b]';
  if (total >= 55) return 'text-[#f3a33a]';
  if (total >= 42) return 'text-[#a8b5c2]';
  return 'text-[#f0758a]';
}

/** The lifecycle arc - a horizontal maturity timeline with the universe count under each stage. */
function LifecycleArc({ distribution, active }: { distribution: Record<LifecycleStage, number>; active?: LifecycleStage }) {
  return (
    <div className="flex items-stretch gap-1">
      {LIFECYCLE_ORDER.map((stage, i) => (
        <div key={stage} className="flex flex-1 items-center gap-1">
          <div
            className={`flex-1 rounded-md border p-1.5 text-center transition ${STAGE_TONE[stage]} ${
              active === stage ? 'ring-1 ring-inset ring-current' : 'opacity-90'
            }`}
            title={LIFECYCLE_BLURB[stage]}
          >
            <p className="font-mono text-[9px] uppercase tracking-[0.1em]">{LIFECYCLE_LABEL[stage]}</p>
            <p className="numeric font-mono text-sm font-semibold">{distribution[stage]}</p>
          </div>
          {i < LIFECYCLE_ORDER.length - 1 && <span className="shrink-0 text-[10px] text-[#3a4754]">{'->'}</span>}
        </div>
      ))}
    </div>
  );
}

/**
 * Emergence Shortlist - the narrow "select, watch, invest" surface. Ranks early + backed small caps,
 * shows where each sits on the lifecycle arc and who is funding it, and lets you trace the selected
 * name end-to-end through its value chain back to raw materials. Research only.
 */
export function EmergenceShortlist({ shortlist, distribution, chainsByTheme, positionsBySymbol }: EmergenceShortlistProps) {
  const [selected, setSelected] = useState<string | null>(shortlist[0]?.symbol ?? null);
  const active = shortlist.find((c) => c.symbol === selected) ?? shortlist[0] ?? null;
  const activeChain = active ? chainsByTheme[active.theme] : undefined;
  // Re-focus the chain on the selected symbol (chains are cached per theme with a default focus).
  const focusedChain: ValueChain | undefined = activeChain
    ? { ...activeChain, focusSymbol: active?.symbol, tiers: activeChain.tiers.map((t) => ({
        ...t,
        nodes: t.nodes.map((n) => ({ ...n, hasFocus: n.companies.some((c) => c.symbol === active?.symbol) })),
      })) }
    : undefined;

  return (
    <div className="space-y-3">
      <section className="terminal-panel glass-hero rounded-md p-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[#43d18b]" />
          <h2 className="text-sm font-semibold text-[#eef3f8]">Emergence shortlist</h2>
          <span className="ml-auto rounded border border-[#263241] bg-[#0d141c] px-1.5 py-0.5 font-mono text-[9px] text-[#8190a0]">
            {shortlist.length} early + backed
          </span>
          <HelpDrawer
            title="How the shortlist is built"
            subtitle="Lifecycle stages, backing, and the emergence score"
            ariaLabel="How the emergence shortlist is built"
            intro="This is the deliberately narrow list: small and micro caps that are still EARLY in their theme's arc AND already backed by government or big-tech money, on a real supply-chain bottleneck. Here is what each label means."
            terms={HELP_TERMS}
            footnote="Everything here is a deterministic research rank built on disclosed evidence and backing. Small caps carry real liquidity and dilution risk. Nothing here is a buy or sell call. Research only."
          />
        </div>
        <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-[#a8b5c2]">
          Catch them early: names still concept-to-contracted in an emerging market, already carrying government
          or big-tech capital and real evidence, ranked by the emergence engine. Select one to trace it end-to-end.
        </p>

        <div className="mt-2.5">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">
            Lifecycle arc - the whole small-cap universe by stage
          </p>
          <LifecycleArc distribution={distribution} active={active?.stage} />
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,340px)_1fr]">
        {/* Shortlist rows */}
        <section className="terminal-panel space-y-1.5 rounded-md p-2.5">
          {shortlist.map((c) => {
            const isSel = c.symbol === active?.symbol;
            return (
              <button
                key={c.symbol}
                type="button"
                onClick={() => {
                  setSelected(c.symbol);
                  captureInteraction({ eventType: 'drawer_open', entityType: 'candidate', entityId: c.symbol, meta: { stage: c.stage } });
                }}
                className={`w-full rounded-md border p-2 text-left transition ${
                  isSel ? 'border-[#43d18b] bg-[#0c1f16]' : 'border-[#1b2530] bg-[#0d1117] hover:bg-[#101720]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <TickerLogo symbol={c.symbol} companyName={c.name} size={14} />
                  <span className="shrink-0 font-mono text-[12px] font-semibold text-[#eef3f8]">{c.symbol}</span>
                  <span className="min-w-0 flex-1 truncate text-[10px] text-[#8190a0]">{c.name}</span>
                  <span className={`numeric shrink-0 font-mono text-sm font-semibold ${scoreTone(c.emergence.total)}`}>
                    {c.emergence.total}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${STAGE_TONE[c.stage]}`}>
                    {LIFECYCLE_LABEL[c.stage]}
                  </span>
                  <span className="rounded border border-[#263241] bg-[#0d141c] px-1 py-0.5 font-mono text-[9px] text-[#8190a0]" title={c.themeName}>
                    {c.themeEmoji} {c.themeName}
                  </span>
                </div>
                <div className="mt-1.5">
                  <BackingBadges candidate={c} />
                </div>
              </button>
            );
          })}
          {shortlist.length === 0 && (
            <p className="p-2 text-[11px] text-[#a8b5c2]">No early + backed names surfaced from the current data.</p>
          )}
        </section>

        {/* Dense story drawer + full value chain for the selected name */}
        <div className="space-y-3">
          {active ? (
            <StoryDrawer candidate={active} position={positionsBySymbol[active.symbol] ?? null} />
          ) : (
            <section className="terminal-panel rounded-md p-3">
              <p className="text-[11px] text-[#a8b5c2]">Select a name to see its story and trace its value chain.</p>
            </section>
          )}

          {focusedChain && <ValueChainMap chain={focusedChain} />}
        </div>
      </div>
    </div>
  );
}
