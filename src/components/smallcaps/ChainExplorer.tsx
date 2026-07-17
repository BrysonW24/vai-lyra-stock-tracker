'use client';

import { useEffect, useState } from 'react';
import { Network } from 'lucide-react';
import { ValueChainMap } from '@/components/smallcaps/ValueChainMap';
import { captureInteraction } from '@/lib/twin/capture';
import type { ValueChain } from '@/lib/value-chain';

/**
 * Chain Explorer - the interactive end-to-end value chain for EVERY vertical, not just the one the
 * selected shortlist name lives in. A chip row switches between verticals (AGI, Quantum, Robotics,
 * ...); when the explorer is on the same vertical as the selected shortlist name, that name is
 * highlighted where it sits in the chain. Selecting a shortlist name snaps the explorer to its
 * vertical so the trace is always one glance away. Research only.
 */

export interface ChainVertical {
  slug: string;
  name: string;
  emoji: string;
  /** Small/micro caps tracked in this vertical (for the chip count). */
  smallCaps: number;
}

interface ChainExplorerProps {
  /** Full chains for every vertical, keyed by theme slug. */
  chains: Record<string, ValueChain>;
  /** Chip order + metadata for every vertical. */
  verticals: ChainVertical[];
  /** The selected shortlist name's theme - the explorer follows this when it changes. */
  followTheme?: string;
  /** The selected shortlist name - highlighted when the explorer shows its theme. */
  focusSymbol?: string;
}

export function ChainExplorer({ chains, verticals, followTheme, focusSymbol }: ChainExplorerProps) {
  const [selected, setSelected] = useState<string>(followTheme ?? verticals[0]?.slug ?? '');

  // Selecting a shortlist name above snaps the explorer to that name's vertical.
  useEffect(() => {
    if (followTheme && chains[followTheme]) setSelected(followTheme);
  }, [followTheme, chains]);

  const chain = chains[selected];
  const focused: ValueChain | undefined =
    chain && focusSymbol && selected === followTheme
      ? {
          ...chain,
          focusSymbol,
          tiers: chain.tiers.map((t) => ({
            ...t,
            nodes: t.nodes.map((n) => ({
              ...n,
              hasFocus: n.companies.some((c) => c.symbol.toUpperCase() === focusSymbol.toUpperCase()),
            })),
          })),
        }
      : chain;

  return (
    <section id="chain-explorer" className="scroll-mt-20 space-y-2">
      <div className="terminal-panel rounded-md p-2.5">
        <div className="flex items-center gap-2">
          <Network size={14} className="text-[#7fb0ff]" />
          <h3 className="text-[12px] font-semibold text-[#eef3f8]">End-to-end value chains - every vertical</h3>
        </div>
        <p className="mt-1 text-[10px] leading-snug text-[#8190a0]">
          Pick a vertical to walk its whole chain - end demand at the top, down through every tier to the raw
          materials that feed it, with the capital flowing in at each layer. Selecting a shortlist name above
          jumps here with that name highlighted where it sits.
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {verticals.map((v) => {
            const isSel = v.slug === selected;
            return (
              <button
                key={v.slug}
                type="button"
                onClick={() => {
                  setSelected(v.slug);
                  captureInteraction({ eventType: 'drawer_open', entityType: 'theme', entityId: v.slug });
                }}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] transition ${
                  isSel
                    ? 'border-[#43d18b] bg-[#0c1f16] text-[#5fd08a]'
                    : 'border-[#263241] bg-[#0d141c] text-[#a8b5c2] hover:border-[#3a4754] hover:text-[#dbe5ee]'
                }`}
                title={`${v.name} - ${v.smallCaps} small caps tracked`}
              >
                <span aria-hidden>{v.emoji}</span> {v.name}
                <span className={isSel ? 'text-[#43d18b]' : 'text-[#5e6b78]'}>{v.smallCaps}</span>
              </button>
            );
          })}
        </div>
      </div>

      {focused ? (
        <ValueChainMap chain={focused} />
      ) : (
        <section className="terminal-panel rounded-md p-3">
          <p className="text-[11px] text-[#a8b5c2]">No chain is mapped for this vertical yet.</p>
        </section>
      )}
    </section>
  );
}
