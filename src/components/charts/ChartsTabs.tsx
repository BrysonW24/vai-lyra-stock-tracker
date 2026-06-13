'use client';

import { useState, type ReactNode } from 'react';
import { MiniSparkline } from '@/components/ChartPrimitives';
import { SourceFavicon } from '@/components/SourceFavicon';
import { CHART_PACK_SAMPLE, COMMODITIES_EXTRA, ECONOMY, MARKETS, type MacroIndicator } from '@/lib/chart-pack';
import { COMMODITIES_BOARD, EXCHANGES_BOARD, RATES_BOARD, type BoardItem } from '@/lib/market-board';
import { formatSignedPercent, toneClass } from '@/lib/format';

const TABS = ['Portfolio', 'Economy', 'Markets', 'Commodities'] as const;
type Tab = (typeof TABS)[number];

function MacroTile({ ind }: { ind: MacroIndicator }) {
  const arrow = ind.direction === 'up' ? '▲' : ind.direction === 'down' ? '▼' : '–';
  return (
    <div className="rounded-md border border-[#1b2530] bg-[#0d141c] p-2">
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[11px] font-semibold text-[#eef3f8]">{ind.label}</span>
        <span className="shrink-0 rounded border border-[#263241] bg-[#0b1016] px-1 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[#8190a0]">{ind.region}</span>
      </div>
      <MiniSparkline values={ind.series} color="#7fb0ff" height={24} />
      <div className="mt-0.5 flex items-baseline justify-between gap-1">
        <span className="font-mono text-[13px] font-semibold text-[#dbe5ee]">{ind.value}</span>
        <span className="font-mono text-[10px] text-[#8190a0]">{arrow} {ind.delta}</span>
      </div>
      <p className="mt-0.5 text-[9px] leading-snug text-[#5e6b78]">{ind.note}</p>
    </div>
  );
}

function PriceTile({ item }: { item: BoardItem }) {
  return (
    <div className="rounded-md border border-[#1b2530] bg-[#0d141c] p-2">
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[11px] font-semibold text-[#eef3f8]">{item.label}</span>
        <span className={`shrink-0 font-mono text-[10px] ${toneClass(item.changePct)}`}>{formatSignedPercent(item.changePct)}</span>
      </div>
      <MiniSparkline values={item.series} color={item.changePct >= 0 ? '#43d18b' : '#ff6b6b'} height={24} />
      <div className="mt-0.5 flex items-center justify-between gap-1 font-mono text-[10px]">
        <span className="text-[#dbe5ee]">{item.value}</span>
        <span className="truncate text-[#5e6b78]">{item.meta}</span>
      </div>
    </div>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">{children}</p>;
}

function SampleNote() {
  if (!CHART_PACK_SAMPLE) return null;
  return (
    <p className="border-t border-[#1b2530] pt-1.5 font-mono text-[10px] text-[#5e6b78]">
      Illustrative sample series until live FRED / RBA / market feeds wire in. Research context, never advice.
    </p>
  );
}

/**
 * Charts tabs - an RBA/FRED-style chart pack. Portfolio (your book, passed in from the
 * server) plus macro tabs: Economy (growth/inflation/labour), Markets (curves, credit,
 * volatility, indices, policy rates), and Commodities. Mobile-first: swipe the tab row.
 */
export function ChartsTabs({ portfolio }: { portfolio: ReactNode }) {
  const [tab, setTab] = useState<Tab>('Portfolio');

  return (
    <div className="space-y-3">
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-md border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] transition ${
              tab === t ? 'border-[#f3a33a] bg-[#23180b] text-[#f3a33a]' : 'border-[#263241] bg-[#0d141c] text-[#8190a0] hover:text-[#eef3f8]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Portfolio' && portfolio}

      {tab === 'Economy' && (
        <section className="terminal-panel space-y-2 rounded-md p-3">
          <Heading>Growth, inflation & labour</Heading>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {ECONOMY.map((i) => (
              <MacroTile key={i.key} ind={i} />
            ))}
          </div>
          <SampleNote />
        </section>
      )}

      {tab === 'Markets' && (
        <section className="terminal-panel space-y-3 rounded-md p-3">
          <div>
            <Heading>Rates, curves, credit & volatility</Heading>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {MARKETS.map((i) => (
                <MacroTile key={i.key} ind={i} />
              ))}
            </div>
          </div>
          <div>
            <Heading>Global exchanges</Heading>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {EXCHANGES_BOARD.map((i) => (
                <PriceTile key={i.key} item={i} />
              ))}
            </div>
          </div>
          <div>
            <Heading>Policy rates</Heading>
            <div className="grid gap-2 sm:grid-cols-3">
              {RATES_BOARD.map((rate) => (
                <a key={rate.key} href={rate.sourceUrl} target="_blank" rel="noreferrer" className="rounded-md border border-[#1b2530] bg-[#0d141c] p-2 transition hover:border-[#3a4754]">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-semibold text-[#eef3f8]">{rate.label}</span>
                    <span className={`shrink-0 font-mono text-[10px] ${rate.direction === 'down' ? 'text-[#43d18b]' : rate.direction === 'up' ? 'text-[#ff6b6b]' : 'text-[#8190a0]'}`}>{rate.change}</span>
                  </div>
                  <p className="mt-0.5 font-mono text-sm font-semibold text-[#dbe5ee]">{rate.value}</p>
                  <p className="mt-0.5 text-[10px] leading-snug text-[#8190a0]">{rate.implication}</p>
                  <p className="mt-1 flex items-center gap-1 font-mono text-[9px] text-[#5e6b78]">
                    <SourceFavicon domain={new URL(rate.sourceUrl).hostname} sourceName={rate.source} /> {rate.source}
                  </p>
                </a>
              ))}
            </div>
          </div>
          <SampleNote />
        </section>
      )}

      {tab === 'Commodities' && (
        <section className="terminal-panel space-y-2 rounded-md p-3">
          <Heading>Energy, metals & materials</Heading>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {[...COMMODITIES_BOARD, ...COMMODITIES_EXTRA].map((i) => (
              <PriceTile key={i.key} item={i} />
            ))}
          </div>
          <SampleNote />
        </section>
      )}
    </div>
  );
}
