'use client';

import { useMemo, useState } from 'react';
import { SourceFavicon } from '@/components/SourceFavicon';
import { IpoDrawer } from '@/components/ipos/IpoDrawer';
import { RotatingFaces } from '@/components/RotatingFaces';
import {
  getIpos,
  ipoCategoryLabel,
  ipoStatusClass,
  type IpoCompany,
  type IpoCategory,
  type IpoStatus,
} from '@/lib/ipos';
import { formatCurrency, formatSignedPercent, formatPercent, toneClass } from '@/lib/format';

interface IpoFace {
  label: string;
  value: string;
  detail: string;
  tone: string;
}

function IpoFaceBlock({ face }: { face: IpoFace }) {
  return (
    <div>
      <p className="truncate text-[9px] uppercase tracking-[0.08em] text-[#8190a0]">{face.label}</p>
      <p className={`mt-0.5 truncate font-mono text-sm font-semibold md:text-base ${face.tone}`}>{face.value}</p>
      <p className="mt-0.5 truncate text-[9px] text-[#8190a0]">{face.detail}</p>
    </div>
  );
}

type SortKey = 'valuationUsdM' | 'proceedsUsdM' | 'returnSinceIpoPct' | 'revenueGrowthPct' | 'ipoDate';

function billions(usdM: number): string {
  return `$${(usdM / 1000).toFixed(1)}B`;
}

export function IpoExplorer() {
  const all = useMemo(() => getIpos(), []);
  const [statusFilter, setStatusFilter] = useState<IpoStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<IpoCategory | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('ipoDate');
  const [selected, setSelected] = useState<IpoCompany | null>(null);

  const rows = useMemo(() => {
    const filtered = all.filter(
      (i) =>
        (statusFilter === 'all' || i.status === statusFilter) &&
        (categoryFilter === 'all' || i.category === categoryFilter),
    );
    return [...filtered].sort((a, b) => {
      const av = (a[sortKey] ?? -Infinity) as number | string;
      const bv = (b[sortKey] ?? -Infinity) as number | string;
      if (sortKey === 'ipoDate') return String(bv).localeCompare(String(av));
      return (bv as number) - (av as number);
    });
  }, [all, statusFilter, categoryFilter, sortKey]);

  const categories: (IpoCategory | 'all')[] = [
    'all', 'ai_infrastructure', 'semiconductor', 'software', 'cloud_data', 'cybersecurity', 'consumer_internet', 'fintech_tech',
  ];
  const statuses: (IpoStatus | 'all')[] = ['all', 'recent', 'priced', 'upcoming'];

  // Rotating stat-tile faces - derived once from the full set (3 sides per tile).
  const upcomingIpos = all.filter((i) => i.status === 'upcoming');
  const recentIpos = all.filter((i) => i.status === 'recent');
  const pricedIpos = all.filter((i) => i.status === 'priced');
  const profitableIpos = all.filter((i) => i.profitable);
  const sectorCount = new Set(all.map((i) => i.category)).size;
  const topIpo = all[0];
  const nextUp = [...upcomingIpos].sort((a, b) => a.ipoDate.localeCompare(b.ipoDate))[0];
  const biggestUpcoming = [...upcomingIpos].sort((a, b) => b.valuationUsdM - a.valuationUsdM)[0];
  const withReturns = all.filter((i) => i.returnSinceIpoPct !== undefined);
  const bestReturn = [...withReturns].sort((a, b) => (b.returnSinceIpoPct ?? 0) - (a.returnSinceIpoPct ?? 0))[0];
  const worstReturn = [...withReturns].sort((a, b) => (a.returnSinceIpoPct ?? 0) - (b.returnSinceIpoPct ?? 0))[0];
  const largestRaise = [...all].sort((a, b) => b.proceedsUsdM - a.proceedsUsdM)[0];
  const totalRaisedM = all.reduce((s, i) => s + i.proceedsUsdM, 0);
  const fastestGrowth = [...all]
    .filter((i) => i.revenueGrowthPct !== undefined)
    .sort((a, b) => (b.revenueGrowthPct ?? 0) - (a.revenueGrowthPct ?? 0))[0];
  const top5ValM = all.slice(0, 5).reduce((s, i) => s + i.valuationUsdM, 0);
  const medianValM = [...all].sort((a, b) => a.valuationUsdM - b.valuationUsdM)[Math.floor(all.length / 2)]?.valuationUsdM ?? 0;

  const statTiles: { key: string; faces: IpoFace[] }[] = [
    {
      key: 'tracked',
      faces: [
        { label: 'Tracked IPOs', value: all.length.toString(), detail: `${sectorCount} sectors covered`, tone: 'text-[#eef3f8]' },
        { label: 'Priced', value: pricedIpos.length.toString(), detail: 'Terms set, not trading', tone: 'text-[#7fb0ff]' },
        { label: 'Top 5 value', value: billions(top5ValM), detail: 'Five largest combined', tone: 'text-[#dbe5ee]' },
      ],
    },
    {
      key: 'upcoming',
      faces: [
        { label: 'Upcoming', value: upcomingIpos.length.toString(), detail: 'On the runway', tone: 'text-[#8aa2ff]' },
        nextUp
          ? { label: 'Next up', value: nextUp.symbol, detail: `IPO ${nextUp.ipoDate}`, tone: 'text-[#8aa2ff]' }
          : { label: 'Next up', value: '-', detail: 'Nothing scheduled', tone: 'text-[#8190a0]' },
        biggestUpcoming
          ? { label: 'Biggest ahead', value: biggestUpcoming.symbol, detail: `${billions(biggestUpcoming.valuationUsdM)} estimated`, tone: 'text-[#eef3f8]' }
          : { label: 'Biggest ahead', value: '-', detail: 'Nothing scheduled', tone: 'text-[#8190a0]' },
      ],
    },
    {
      key: 'recent',
      faces: [
        { label: 'Recent', value: recentIpos.length.toString(), detail: 'Traded their debut', tone: 'text-[#43d18b]' },
        bestReturn
          ? { label: 'Best return', value: bestReturn.symbol, detail: formatSignedPercent(bestReturn.returnSinceIpoPct ?? 0), tone: 'text-[#43d18b]' }
          : { label: 'Best return', value: '-', detail: 'No returns yet', tone: 'text-[#8190a0]' },
        worstReturn
          ? { label: 'Worst return', value: worstReturn.symbol, detail: formatSignedPercent(worstReturn.returnSinceIpoPct ?? 0), tone: 'text-[#f0758a]' }
          : { label: 'Worst return', value: '-', detail: 'No returns yet', tone: 'text-[#8190a0]' },
      ],
    },
    {
      key: 'valuation',
      faces: [
        { label: 'Top valuation', value: billions(topIpo?.valuationUsdM ?? 0), detail: topIpo ? topIpo.companyName : '-', tone: 'text-[#eef3f8]' },
        topIpo
          ? { label: 'Who it is', value: topIpo.symbol, detail: ipoCategoryLabel(topIpo.category), tone: 'text-[#dbe5ee]' }
          : { label: 'Who it is', value: '-', detail: '-', tone: 'text-[#8190a0]' },
        { label: 'Median size', value: billions(medianValM), detail: 'Middle of the set', tone: 'text-[#a8b5c2]' },
      ],
    },
    {
      key: 'raised',
      faces: [
        { label: 'Total raised', value: billions(totalRaisedM), detail: 'All tracked deals', tone: 'text-[#f3a33a]' },
        largestRaise
          ? { label: 'Largest raise', value: largestRaise.symbol, detail: billions(largestRaise.proceedsUsdM), tone: 'text-[#f3a33a]' }
          : { label: 'Largest raise', value: '-', detail: '-', tone: 'text-[#8190a0]' },
        { label: 'Average raise', value: billions(all.length ? totalRaisedM / all.length : 0), detail: 'Per deal', tone: 'text-[#dbe5ee]' },
      ],
    },
    {
      key: 'profitable',
      faces: [
        { label: 'Profitable', value: profitableIpos.length.toString(), detail: `${Math.round((profitableIpos.length / Math.max(1, all.length)) * 100)}% of the set`, tone: 'text-[#43d18b]' },
        fastestGrowth
          ? { label: 'Top grower', value: fastestGrowth.symbol, detail: `${formatPercent(fastestGrowth.revenueGrowthPct ?? 0)} revenue YoY`, tone: 'text-[#43d18b]' }
          : { label: 'Top grower', value: '-', detail: '-', tone: 'text-[#8190a0]' },
        { label: 'Pre-profit', value: (all.length - profitableIpos.length).toString(), detail: 'Story stage - mind risk', tone: 'text-[#f3a33a]' },
      ],
    },
  ];

  return (
    <div className="space-y-3">
      {/* Rotating stat tiles - same 3-sided roll as the Command metric strip. */}
      <section className="grid grid-cols-3 gap-2 md:grid-cols-4 xl:grid-cols-6">
        {statTiles.map((tile, i) => (
          <div className="terminal-panel rounded-md p-2" key={tile.key}>
            <RotatingFaces faces={tile.faces.map((face, fi) => <IpoFaceBlock key={fi} face={face} />)} intervalMs={5000} offsetMs={i * 120} />
          </div>
        ))}
      </section>
      <section className="terminal-panel overflow-hidden rounded-md">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#1b2530] px-3 py-3">
          <div>
            <h1 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">IPO radar - sorted by date</h1>
            <p className="mt-1 font-mono text-xs text-[#8190a0]">Upcoming first. Tap a row for the dense detail drawer. Research only - not advice.</p>
          </div>
          <div className="ml-auto flex w-full flex-nowrap gap-1 font-mono sm:w-auto">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as IpoStatus | 'all')} className="h-6 min-w-0 flex-1 rounded border border-[#263241] bg-[#0d141c] px-1.5 text-[10px] text-[#dbe5ee] outline-none sm:flex-none">
              {statuses.map((s) => <option key={s} value={s}>{s === 'all' ? 'All status' : s}</option>)}
            </select>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as IpoCategory | 'all')} className="h-6 min-w-0 flex-1 rounded border border-[#263241] bg-[#0d141c] px-1.5 text-[10px] text-[#dbe5ee] outline-none sm:flex-none">
              {categories.map((c) => <option key={c} value={c}>{c === 'all' ? 'All sectors' : ipoCategoryLabel(c)}</option>)}
            </select>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="h-6 min-w-0 flex-1 rounded border border-[#263241] bg-[#0d141c] px-1.5 text-[10px] text-[#dbe5ee] outline-none sm:flex-none">
              <option value="valuationUsdM">Sort: Valuation</option>
              <option value="proceedsUsdM">Sort: Raised</option>
              <option value="returnSinceIpoPct">Sort: Return</option>
              <option value="revenueGrowthPct">Sort: Rev growth</option>
              <option value="ipoDate">Sort: Date</option>
            </select>
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-[1040px] text-left text-xs">
            <thead className="bg-[#0b1016] font-mono uppercase text-[#8190a0]">
              <tr>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">IPO Date</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Offer</th>
                <th className="px-3 py-2">Raised</th>
                <th className="px-3 py-2">Valuation</th>
                <th className="px-3 py-2">Return</th>
                <th className="px-3 py-2">Revenue</th>
                <th className="px-3 py-2">Growth</th>
                <th className="px-3 py-2">Profit</th>
                <th className="px-3 py-2">Sector</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1b2530]">
              {rows.map((ipo) => (
                <tr key={ipo.symbol} className="cursor-pointer font-mono text-[#dbe5ee] hover:bg-[#101720]" onClick={() => setSelected(ipo)}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <SourceFavicon domain={ipo.domain} sourceName={ipo.companyName} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#eef3f8]">{ipo.companyName}</p>
                        <p className="text-[10px] text-[#8190a0]">{ipo.symbol}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">{ipo.ipoDate}</td>
                  <td className="px-3 py-2"><span className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${ipoStatusClass(ipo.status)}`}>{ipo.status}</span></td>
                  <td className="px-3 py-2">{formatCurrency(ipo.offerPrice)}</td>
                  <td className="px-3 py-2">{billions(ipo.proceedsUsdM)}</td>
                  <td className="px-3 py-2 font-semibold text-[#eef3f8]">{billions(ipo.valuationUsdM)}</td>
                  <td className={`px-3 py-2 ${toneClass(ipo.returnSinceIpoPct ?? 0)}`}>{ipo.returnSinceIpoPct !== undefined ? formatSignedPercent(ipo.returnSinceIpoPct) : '-'}</td>
                  <td className="px-3 py-2">{ipo.revenueTtmUsdM ? billions(ipo.revenueTtmUsdM) : '-'}</td>
                  <td className={`px-3 py-2 ${toneClass(ipo.revenueGrowthPct ?? 0)}`}>{ipo.revenueGrowthPct !== undefined ? formatPercent(ipo.revenueGrowthPct) : '-'}</td>
                  <td className={`px-3 py-2 ${ipo.profitable ? 'text-[#43d18b]' : 'text-[#8190a0]'}`}>{ipo.profitable ? '●' : '○'}</td>
                  <td className="px-3 py-2 text-[#a8b5c2]">{ipoCategoryLabel(ipo.category)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="divide-y divide-[#1b2530] md:hidden">
          {rows.map((ipo) => (
            <button key={ipo.symbol} onClick={() => setSelected(ipo)} className="block w-full px-3 py-3 text-left" type="button">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <SourceFavicon domain={ipo.domain} sourceName={ipo.companyName} />
                  <div className="min-w-0">
                    <p className="truncate font-mono font-semibold text-[#eef3f8]">{ipo.companyName}</p>
                    <p className="font-mono text-[10px] text-[#8190a0]">{ipo.symbol} · {ipo.ipoDate}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] uppercase ${ipoStatusClass(ipo.status)}`}>{ipo.status}</span>
              </div>
              <p className="mt-2 font-mono text-xs text-[#a8b5c2]">
                Val {billions(ipo.valuationUsdM)} · Raised {billions(ipo.proceedsUsdM)} · <span className={toneClass(ipo.returnSinceIpoPct ?? 0)}>{ipo.returnSinceIpoPct !== undefined ? formatSignedPercent(ipo.returnSinceIpoPct) : '-'}</span>
              </p>
            </button>
          ))}
        </div>
      </section>

      <IpoDrawer ipo={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
