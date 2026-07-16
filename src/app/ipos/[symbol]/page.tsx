import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { SourceFavicon } from '@/components/SourceFavicon';
import { getDashboardData } from '@/lib/data';
import { getIpoBySymbolLive } from '@/lib/ipos-live';
import { ipoCategoryLabel, ipoStatusClass } from '@/lib/ipos';
import { formatCurrency, formatPercent, formatSignedPercent, formatNumber, toneClass } from '@/lib/format';

export const revalidate = 3600;

function billions(usdM: number): string {
  return `$${(usdM / 1000).toFixed(1)}B`;
}

export default async function IpoDetailPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const ipo = await getIpoBySymbolLive(symbol);
  if (!ipo) {
    notFound();
  }

  const data = await getDashboardData();
  const est = ipo.modelEstimate;
  const ref = ipo.currentPrice ?? ipo.offerPrice;

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <Link href="/ipos" className="inline-flex items-center gap-1 font-mono text-xs text-[#8190a0] transition hover:text-[#eef3f8]">
          <ArrowLeft size={12} /> IPO radar
        </Link>

        <section className="terminal-panel rounded-md p-4">
          <div className="flex flex-wrap items-center gap-3">
            <SourceFavicon domain={ipo.domain} sourceName={ipo.companyName} />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-[#eef3f8]">{ipo.companyName}</h1>
              <p className="font-mono text-xs text-[#8190a0]">{ipo.symbol} · {ipo.exchange} · IPO {ipo.ipoDate}</p>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <span className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${ipoStatusClass(ipo.status)}`}>{ipo.status}</span>
              <span className="rounded border border-[#263241] bg-[#0d141c] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#a8b5c2]">{ipoCategoryLabel(ipo.category)}</span>
            </div>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#a8b5c2]">{ipo.description}</p>
        </section>

        <section className="grid grid-cols-3 gap-1.5 md:grid-cols-3 xl:grid-cols-6">
          {[
            ['Valuation', billions(ipo.valuationUsdM)],
            ['Raised', billions(ipo.proceedsUsdM)],
            ['Offer price', formatCurrency(ipo.offerPrice)],
            [ipo.currentPrice ? 'Current price' : 'Est. reference', formatCurrency(ref)],
            ['Shares offered', `${formatNumber(ipo.sharesOfferedM, 1)}M`],
            ['First-day close', ipo.firstDayClosePct !== undefined ? formatSignedPercent(ipo.firstDayClosePct) : '-'],
          ].map(([k, v]) => (
            <div className="terminal-panel rounded-md p-2" key={k}>
              <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">{k}</p>
              <p className="mt-0.5 truncate font-mono text-sm font-semibold text-[#eef3f8] md:text-base">{v}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-3 xl:grid-cols-[1fr_1fr]">
          <div className="terminal-panel rounded-md p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Financials (TTM)</h2>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-sm">
              <span className="text-[#8190a0]">Revenue</span>
              <span className="text-right text-[#dbe5ee]">{ipo.revenueTtmUsdM ? billions(ipo.revenueTtmUsdM) : 'n/a'}</span>
              <span className="text-[#8190a0]">Revenue growth</span>
              <span className={`text-right ${toneClass(ipo.revenueGrowthPct ?? 0)}`}>{ipo.revenueGrowthPct !== undefined ? formatSignedPercent(ipo.revenueGrowthPct) : 'n/a'}</span>
              <span className="text-[#8190a0]">Gross margin</span>
              <span className="text-right text-[#dbe5ee]">{ipo.grossMarginPct !== undefined ? formatPercent(ipo.grossMarginPct) : 'n/a'}</span>
              <span className="text-[#8190a0]">Net income</span>
              <span className={`text-right ${toneClass(ipo.netIncomeUsdM ?? 0)}`}>{ipo.netIncomeUsdM !== undefined ? `${formatCurrency(ipo.netIncomeUsdM)}M` : 'n/a'}</span>
              <span className="text-[#8190a0]">Profitable</span>
              <span className={`text-right ${ipo.profitable ? 'text-[#43d18b]' : 'text-[#f8c46b]'}`}>{ipo.profitable ? 'Yes' : 'Not yet'}</span>
              <span className="text-[#8190a0]">Employees</span>
              <span className="text-right text-[#dbe5ee]">{ipo.employees ? formatNumber(ipo.employees, 0) : 'n/a'}</span>
              {ipo.returnSinceIpoPct !== undefined && (<>
                <span className="text-[#8190a0]">Return since IPO</span>
                <span className={`text-right ${toneClass(ipo.returnSinceIpoPct)}`}>{formatSignedPercent(ipo.returnSinceIpoPct)}</span>
              </>)}
            </div>
          </div>

          <div className="terminal-panel rounded-md border border-[#3b3050] bg-[#15101f] p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#a78bfa]">Model scenario · {est.horizonMonths}m</h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#8190a0]">confidence: {est.confidence}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center font-mono">
              <div><p className="text-[10px] uppercase text-[#8190a0]">Bear</p><p className="text-base text-[#ff6b6b]">{formatCurrency(est.bearPrice)}</p></div>
              <div><p className="text-[10px] uppercase text-[#8190a0]">Base</p><p className="text-base text-[#dbe5ee]">{formatCurrency(est.basePrice)}</p></div>
              <div><p className="text-[10px] uppercase text-[#8190a0]">Bull</p><p className="text-base text-[#43d18b]">{formatCurrency(est.bullPrice)}</p></div>
            </div>
            <ul className="mt-3 space-y-1">
              {est.rationale.map((r, i) => (
                <li key={i} className="text-xs leading-5 text-[#a8b5c2]">• {r}</li>
              ))}
            </ul>
            <p className="mt-3 rounded border border-[#3b3050] bg-[#0d0a14] px-2 py-1 text-[10px] leading-4 text-[#8190a0]">
              This is a deterministic research range, not a forecast, price target, or recommendation. Vivacity is not a financial adviser.
            </p>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <div className="terminal-panel rounded-md p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Products</h2>
            <ul className="mt-3 space-y-1 font-mono text-xs text-[#dbe5ee]">
              {ipo.products.map((p) => <li key={p}>• {p}</li>)}
            </ul>
          </div>
          <div className="terminal-panel rounded-md p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Notable projects</h2>
            <ul className="mt-3 space-y-1 font-mono text-xs text-[#a8b5c2]">
              {ipo.notableProjects.map((p) => <li key={p}>• {p}</li>)}
            </ul>
          </div>
          <div className="terminal-panel rounded-md p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Key people</h2>
            <ul className="mt-3 space-y-1 font-mono text-xs text-[#dbe5ee]">
              {ipo.keyPeople.map((kp) => (
                <li key={kp.name} className="flex justify-between"><span>{kp.name}</span><span className="text-[#8190a0]">{kp.role}</span></li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
