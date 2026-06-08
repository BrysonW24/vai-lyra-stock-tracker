'use client';

import { useMemo, useState } from 'react';
import { SourceFavicon } from '@/components/SourceFavicon';
import { IpoDrawer } from '@/components/ipos/IpoDrawer';
import {
  getIpos,
  ipoCategoryLabel,
  ipoStatusClass,
  type IpoCompany,
  type IpoCategory,
  type IpoStatus,
} from '@/lib/ipos';
import { formatCurrency, formatSignedPercent, formatPercent, toneClass } from '@/lib/format';

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

  return (
    <div className="space-y-3">
      <section className="grid grid-cols-3 gap-2 md:grid-cols-4 xl:grid-cols-6">
        {[
          ['Tracked IPOs', all.length.toString(), 'text-[#eef3f8]'],
          ['Upcoming', all.filter((i) => i.status === 'upcoming').length.toString(), 'text-[#8aa2ff]'],
          ['Recent', all.filter((i) => i.status === 'recent').length.toString(), 'text-[#43d18b]'],
          ['Top valuation', billions(all[0]?.valuationUsdM ?? 0), 'text-[#eef3f8]'],
          ['Total raised', billions(all.reduce((s, i) => s + i.proceedsUsdM, 0)), 'text-[#f3a33a]'],
          ['Profitable', all.filter((i) => i.profitable).length.toString(), 'text-[#43d18b]'],
        ].map(([label, value, tone]) => (
          <div className="terminal-panel rounded-md p-2" key={label}>
            <p className="truncate text-[10px] uppercase tracking-[0.15em] text-[#8190a0]">{label}</p>
            <p className={`mt-0.5 truncate font-mono text-sm font-semibold md:text-base ${tone}`}>{value}</p>
          </div>
        ))}
      </section>

      <section className="terminal-panel overflow-hidden rounded-md">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#1b2530] px-3 py-3">
          <div>
            <h1 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">IPO radar - sorted by date</h1>
            <p className="mt-1 font-mono text-xs text-[#8190a0]">Upcoming first. Tap a row for the dense detail drawer. Research only - not advice.</p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2 font-mono text-xs">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as IpoStatus | 'all')} className="h-8 rounded border border-[#263241] bg-[#0d141c] px-2 text-[#dbe5ee] outline-none">
              {statuses.map((s) => <option key={s} value={s}>{s === 'all' ? 'All status' : s}</option>)}
            </select>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as IpoCategory | 'all')} className="h-8 rounded border border-[#263241] bg-[#0d141c] px-2 text-[#dbe5ee] outline-none">
              {categories.map((c) => <option key={c} value={c}>{c === 'all' ? 'All sectors' : ipoCategoryLabel(c)}</option>)}
            </select>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="h-8 rounded border border-[#263241] bg-[#0d141c] px-2 text-[#dbe5ee] outline-none">
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
