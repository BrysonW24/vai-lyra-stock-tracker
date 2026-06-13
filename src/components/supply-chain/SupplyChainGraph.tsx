'use client';

import { useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { TickerLogo } from '@/components/TickerLogo';
import { getNodesForTheme, getThemeCompanies, getThemes, type ExposureType } from '@/lib/world-radar';

const EXPOSURE_CLASS: Record<ExposureType, string> = {
  direct: 'border-[#1d4f3a] bg-[#0d251b] text-[#43d18b]',
  supplier: 'border-[#27496b] bg-[#0d1b2b] text-[#7fb0ff]',
  'second-order': 'border-[#263241] bg-[#0d141c] text-[#8190a0]',
};

function tierLabel(index: number, total: number): string {
  if (index === 0) return 'Demand';
  if (index === total - 1) return 'Upstream / bottleneck';
  return `Tier ${index + 1}`;
}

/**
 * Supply-chain graph - the thesis -> bottleneck -> company map the doc calls the most
 * differentiated research layer. Reads the World Radar theme data (themes -> layered
 * supply-chain nodes -> companies) and lays it out as flow tiers from demand down to the
 * physical bottleneck, with each company tagged by exposure. Switch themes up top.
 */
export function SupplyChainGraph() {
  const themes = getThemes();
  const [slug, setSlug] = useState(themes[0]?.slug ?? '');
  const theme = themes.find((t) => t.slug === slug) ?? themes[0];
  if (!theme) return null;

  const nodes = getNodesForTheme(theme.slug);
  const companies = getThemeCompanies(theme.slug);
  const layers = [...new Set(nodes.map((n) => n.layer))].sort((a, b) => a - b);
  const companiesForNode = (id: string) => companies.filter((c) => c.nodes.includes(id));

  return (
    <section className="terminal-panel space-y-3 rounded-md p-3">
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {themes.map((t) => (
          <button
            key={t.slug}
            type="button"
            onClick={() => setSlug(t.slug)}
            className={`shrink-0 rounded-md border px-2.5 py-1 font-mono text-[10px] transition ${
              t.slug === theme.slug ? 'border-[#f3a33a] bg-[#23180b] text-[#f3a33a]' : 'border-[#263241] bg-[#0d141c] text-[#8190a0] hover:text-[#eef3f8]'
            }`}
          >
            {t.emoji} {t.name}
          </button>
        ))}
      </div>

      <div>
        <p className="text-[13px] font-semibold text-[#eef3f8]">{theme.emoji} {theme.name}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-[#a8b5c2]">{theme.thesis}</p>
        <p className="mt-1 text-[10px] leading-snug text-[#f0758a]">
          <span className="font-semibold uppercase tracking-[0.1em]">Falsifier:</span> {theme.falsifier}
        </p>
      </div>

      <div className="space-y-1">
        {layers.map((layer, i) => (
          <div key={layer}>
            <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[#5e6b78]">{tierLabel(i, layers.length)}</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {nodes
                .filter((n) => n.layer === layer)
                .map((node) => {
                  const nodeCompanies = companiesForNode(node.id);
                  return (
                    <div key={node.id} className="rounded-md border border-[#1b2530] bg-[#0d141c] p-2">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-[11px] font-semibold text-[#eef3f8]">{node.name}</span>
                        <span className="shrink-0 font-mono text-[8px] uppercase tracking-[0.1em] text-[#f3a33a]" title="Bottleneck score">btl {node.bottleneck}</span>
                      </div>
                      {nodeCompanies.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {nodeCompanies.map((c) => (
                            <span key={c.symbol} className={`inline-flex items-center gap-1 rounded border px-1 py-0.5 font-mono text-[9px] ${EXPOSURE_CLASS[c.exposure]}`} title={`${c.name} · ${c.exposure}`}>
                              <TickerLogo symbol={c.symbol} size={11} /> {c.symbol}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
            {i < layers.length - 1 && (
              <div className="flex justify-center py-0.5 text-[#3a4754]">
                <ArrowDown size={14} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[#1b2530] pt-2 font-mono text-[9px] text-[#5e6b78]">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#43d18b]" /> direct</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#7fb0ff]" /> supplier</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#5e6b78]" /> second-order</span>
        <span className="ml-auto">Demand flows down to the bottleneck. Research only.</span>
      </div>
    </section>
  );
}
