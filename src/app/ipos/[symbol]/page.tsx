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
  const lookup = await getIpoBySymbolLive(symbol);
  if (!lookup) {
    notFound();
  }

  const { ipo, source } = lookup;
  const data = await getDashboardData();
  const est = ipo.modelEstimate;
  const ref = ipo.currentPrice ?? ipo.offerPrice;

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <Link href="/ipos" className="inline-flex items-center gap-1 font-mono text-xs text-ink-3 transition hover:text-ink">
          <ArrowLeft size={12} /> IPO radar
        </Link>

        {source === 'sample' ? (
          <div className="rounded-cell border border-accent-border/60 bg-accent-tint px-3 py-2 text-[11px] leading-snug text-accent">
            Sample record - editorial research content, not a live listing. Dates, terms and figures are
            illustrative until the live IPO sync covers this name.
          </div>
        ) : null}

        <section className="terminal-panel rounded-panel p-4">
          <div className="flex flex-wrap items-center gap-3">
            <SourceFavicon domain={ipo.domain} sourceName={ipo.companyName} />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-ink">{ipo.companyName}</h1>
              <p className="font-mono text-xs text-ink-3">{ipo.symbol} · {ipo.exchange} · IPO {ipo.ipoDate}</p>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <span className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${ipoStatusClass(ipo.status)}`}>{ipo.status}</span>
              <span className="rounded border border-line-strong bg-panel px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{ipoCategoryLabel(ipo.category)}</span>
            </div>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-2">{ipo.description}</p>
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
            <div className="terminal-panel rounded-panel p-2" key={k}>
              <p className="truncate text-[9px] uppercase tracking-[0.12em] text-ink-3">{k}</p>
              <p className="mt-0.5 truncate font-mono text-sm font-semibold text-ink md:text-base">{v}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-3 xl:grid-cols-[1fr_1fr]">
          <div className="terminal-panel rounded-panel p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-title">Financials (TTM)</h2>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-sm">
              <span className="text-ink-3">Revenue</span>
              <span className="text-right text-ink-title">{ipo.revenueTtmUsdM ? billions(ipo.revenueTtmUsdM) : 'n/a'}</span>
              <span className="text-ink-3">Revenue growth</span>
              <span className={`text-right ${toneClass(ipo.revenueGrowthPct ?? 0)}`}>{ipo.revenueGrowthPct !== undefined ? formatSignedPercent(ipo.revenueGrowthPct) : 'n/a'}</span>
              <span className="text-ink-3">Gross margin</span>
              <span className="text-right text-ink-title">{ipo.grossMarginPct !== undefined ? formatPercent(ipo.grossMarginPct) : 'n/a'}</span>
              <span className="text-ink-3">Net income</span>
              <span className={`text-right ${toneClass(ipo.netIncomeUsdM ?? 0)}`}>{ipo.netIncomeUsdM !== undefined ? `${formatCurrency(ipo.netIncomeUsdM)}M` : 'n/a'}</span>
              <span className="text-ink-3">Profitable</span>
              <span className={`text-right ${ipo.profitable ? 'text-positive' : 'text-accent'}`}>{ipo.profitable ? 'Yes' : 'Not yet'}</span>
              <span className="text-ink-3">Employees</span>
              <span className="text-right text-ink-title">{ipo.employees ? formatNumber(ipo.employees, 0) : 'n/a'}</span>
              {ipo.returnSinceIpoPct !== undefined && (<>
                <span className="text-ink-3">Return since IPO</span>
                <span className={`text-right ${toneClass(ipo.returnSinceIpoPct)}`}>{formatSignedPercent(ipo.returnSinceIpoPct)}</span>
              </>)}
            </div>
          </div>

          <div className="terminal-panel rounded-panel border border-pending/40 bg-pending/10 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-pending">Model scenario · {est.horizonMonths}m</h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">confidence: {est.confidence}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center font-mono">
              <div><p className="text-[10px] uppercase text-ink-3">Bear</p><p className="text-base text-negative">{formatCurrency(est.bearPrice)}</p></div>
              <div><p className="text-[10px] uppercase text-ink-3">Base</p><p className="text-base text-ink-title">{formatCurrency(est.basePrice)}</p></div>
              <div><p className="text-[10px] uppercase text-ink-3">Bull</p><p className="text-base text-positive">{formatCurrency(est.bullPrice)}</p></div>
            </div>
            <ul className="mt-3 space-y-1">
              {est.rationale.map((r, i) => (
                <li key={i} className="text-xs leading-5 text-ink-2">• {r}</li>
              ))}
            </ul>
            <p className="mt-3 rounded border border-pending/40 bg-well px-2 py-1 text-[10px] leading-4 text-ink-3">
              This is a deterministic research range, not a forecast, price target, or recommendation. Vivacity is not a financial adviser.
            </p>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <div className="terminal-panel rounded-panel p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-title">Products</h2>
            <ul className="mt-3 space-y-1 font-mono text-xs text-ink-title">
              {ipo.products.map((p) => <li key={p}>• {p}</li>)}
            </ul>
          </div>
          <div className="terminal-panel rounded-panel p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-title">Notable projects</h2>
            <ul className="mt-3 space-y-1 font-mono text-xs text-ink-2">
              {ipo.notableProjects.map((p) => <li key={p}>• {p}</li>)}
            </ul>
          </div>
          <div className="terminal-panel rounded-panel p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-title">Key people</h2>
            <ul className="mt-3 space-y-1 font-mono text-xs text-ink-title">
              {ipo.keyPeople.map((kp) => (
                <li key={kp.name} className="flex justify-between"><span>{kp.name}</span><span className="text-ink-3">{kp.role}</span></li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
