'use client';

import { ArrowDown, Landmark, Building2, Gem } from 'lucide-react';
import { TickerLogo } from '@/components/TickerLogo';
import type { ValueChain, ChainNode, RawMaterial } from '@/lib/value-chain';

/**
 * Value-Chain Map - the end-to-end visual: end demand at the top, flowing down through the
 * supply-chain tiers to the upstream bottleneck, and finally to the RAW MATERIALS that feed the
 * whole thing. The focus company is highlighted wherever it sits, capital flowing into each tier is
 * shown as funding pills, and the raw-materials strip surfaces the commodities (and their source
 * countries) the chain depends on. This is the "all the way back to raw materials" trace.
 */

const money = (m?: number) => (m ? (m >= 1000 ? `$${(m / 1000).toFixed(1)}B` : `$${m}M`) : '');

function RawMaterialPill({ rm }: { rm: RawMaterial }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] ${
        rm.aiLinked
          ? 'border-[#9a6a1f] bg-[#231708] text-[#f3a33a]'
          : 'border-[#263241] bg-[#0d141c] text-[#8190a0]'
      }`}
      title={rm.commodity ? `${rm.name} - from ${rm.from}${rm.aiLinked ? ' (AI/electrification linked)' : ''}` : rm.name}
    >
      {rm.commodity?.emoji ? `${rm.commodity.emoji} ` : ''}
      {rm.name}
    </span>
  );
}

function NodeCard({ node, focusSymbol }: { node: ChainNode; focusSymbol?: string }) {
  return (
    <div
      className={`rounded-md border p-2 ${
        node.hasFocus ? 'border-[#43d18b] bg-[#0c1f16]' : 'border-[#1b2530] bg-[#0d141c]'
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="truncate text-[11px] font-semibold text-[#eef3f8]">{node.node.name}</span>
        <span className="shrink-0 font-mono text-[8px] uppercase tracking-[0.1em] text-[#f3a33a]" title="Bottleneck score">
          btl {node.node.bottleneck}
        </span>
      </div>

      {node.companies.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {node.companies.map((c) => {
            const isFocus = focusSymbol && c.symbol.toUpperCase() === focusSymbol.toUpperCase();
            return (
              <span
                key={c.symbol}
                className={`inline-flex items-center gap-1 rounded border px-1 py-0.5 font-mono text-[9px] ${
                  isFocus
                    ? 'border-[#43d18b] bg-[#0d251b] text-[#43d18b]'
                    : c.sizeBucket === 'small' || c.sizeBucket === 'micro'
                      ? 'border-[#27496b] bg-[#0d1b2b] text-[#7fb0ff]'
                      : 'border-[#263241] bg-[#0d141c] text-[#8190a0]'
                }`}
                title={`${c.name} · ${c.sizeBucket} cap · ${c.exposure}`}
              >
                <TickerLogo symbol={c.symbol} size={11} /> {c.symbol}
              </span>
            );
          })}
        </div>
      )}

      {node.capital.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {node.capital.slice(0, 2).map((ev) => (
            <span
              key={ev.id}
              className="inline-flex items-center gap-1 rounded border border-[#2a4a7a] bg-[#0f1a2c] px-1 py-0.5 font-mono text-[8px] text-[#8aa2ff]"
              title={ev.summary}
            >
              <Building2 size={8} /> {ev.actor}
              {ev.amountUsdM ? ` ${money(ev.amountUsdM)}` : ''}
            </span>
          ))}
        </div>
      )}

      {node.rawMaterials.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-0.5">
          {node.rawMaterials.map((rm) => (
            <RawMaterialPill key={rm.name} rm={rm} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ValueChainMap({ chain }: { chain: ValueChain }) {
  return (
    <section className="terminal-panel space-y-2.5 rounded-md p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[#eef3f8]">
            {chain.themeEmoji} {chain.themeName} - end-to-end value chain
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-[#a8b5c2]">{chain.thesis}</p>
        </div>
      </div>

      {chain.focusSymbol && (
        <div className="flex items-center gap-1.5 rounded border border-[#1d4f3a] bg-[#0c1f16] px-2 py-1">
          <span className="h-2 w-2 rounded-full bg-[#43d18b]" />
          <span className="font-mono text-[10px] text-[#43d18b]">
            Tracing {chain.focusSymbol} - highlighted where it sits in the chain
          </span>
        </div>
      )}

      <div className="space-y-1">
        {chain.tiers.map((tier, i) => (
          <div key={tier.layer}>
            <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[#5e6b78]">{tier.label}</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {tier.nodes.map((node) => (
                <NodeCard key={node.node.id} node={node} focusSymbol={chain.focusSymbol} />
              ))}
            </div>
            {i < chain.tiers.length - 1 && (
              <div className="flex justify-center py-0.5 text-[#3a4754]">
                <ArrowDown size={14} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Raw-materials floor - the physical inputs the whole chain rests on. */}
      <div className="flex justify-center py-0.5 text-[#3a4754]">
        <ArrowDown size={14} />
      </div>
      <div className="rounded-md border border-[#2a1f0f] bg-[#150f06] p-2">
        <div className="flex items-center gap-1.5">
          <Gem size={12} className="text-[#f3a33a]" />
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#f3a33a]">Raw materials the chain depends on</p>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {chain.rawMaterials.map((rm) => (
            <RawMaterialPill key={rm.name} rm={rm} />
          ))}
        </div>
        <p className="mt-1.5 text-[9px] leading-snug text-[#8190a0]">
          Amber = a tradeable, AI/electrification-linked commodity. Hover a material for its source countries.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[#1b2530] pt-2 font-mono text-[9px] text-[#5e6b78]">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#43d18b]" /> traced name</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#7fb0ff]" /> small / micro cap</span>
        <span className="inline-flex items-center gap-1"><Landmark size={9} className="text-[#8aa2ff]" /> capital in</span>
        <span className="ml-auto text-[#f0758a]">Falsifier: {chain.falsifier}</span>
      </div>
    </section>
  );
}
