'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { DetailDrawer } from '@/components/DetailDrawer';
import { SourceFavicon } from '@/components/SourceFavicon';
import { ipoCategoryLabel, ipoStatusClass, type IpoCompany } from '@/lib/ipos';
import { formatCurrency, formatPercent, formatSignedPercent, formatNumber, toneClass } from '@/lib/format';

interface IpoDrawerProps {
  ipo: IpoCompany | null;
  onClose: () => void;
}

function billions(usdM: number): string {
  return `$${(usdM / 1000).toFixed(1)}B`;
}

/**
 * Dense IPO slide-over. Rides the shared DetailDrawer shell (same as the signal /
 * calendar / smart-money explainers) so it inherits the slide animation, Esc +
 * backdrop close, body scroll lock, dialog semantics, and safe-area padding instead
 * of maintaining a diverging copy of the overlay plumbing.
 */
export function IpoDrawer({ ipo, onClose }: IpoDrawerProps) {
  if (!ipo) return <DetailDrawer open={false} onClose={onClose} title="">{null}</DetailDrawer>;

  const est = ipo.modelEstimate;
  const ref = ipo.currentPrice ?? ipo.offerPrice;

  return (
    <DetailDrawer open onClose={onClose} title={ipo.companyName} subtitle={`${ipo.symbol} · ${ipo.exchange}`}>
      <div className="flex flex-wrap items-center gap-2">
        <SourceFavicon domain={ipo.domain} sourceName={ipo.companyName} />
        <span className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${ipoStatusClass(ipo.status)}`}>{ipo.status}</span>
        <span className="rounded border border-[#263241] bg-[#0d141c] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#a8b5c2]">{ipoCategoryLabel(ipo.category)}</span>
        <span className="rounded border border-[#263241] bg-[#0d141c] px-2 py-1 font-mono text-[10px] text-[#a8b5c2]">IPO {ipo.ipoDate}</span>
      </div>

      <p className="text-xs leading-5 text-[#a8b5c2]">{ipo.description}</p>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md bg-[#1b2530]">
        {[
          ['Valuation', billions(ipo.valuationUsdM)],
          ['Raised', billions(ipo.proceedsUsdM)],
          ['Offer price', formatCurrency(ipo.offerPrice)],
          [ipo.currentPrice ? 'Current' : 'Est. ref', formatCurrency(ref)],
        ].map(([k, v]) => (
          <div className="bg-[#0d1117] p-2" key={k}>
            <p className="truncate text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">{k}</p>
            <p className="mt-0.5 truncate font-mono text-sm text-[#eef3f8] md:text-base">{v}</p>
          </div>
        ))}
      </div>

      {ipo.returnSinceIpoPct !== undefined && (
        <div className="flex items-center justify-between rounded-md border border-[#263241] bg-[#0d141c] px-3 py-2 font-mono text-xs">
          <span className="text-[#8190a0]">Return since IPO</span>
          <span className={toneClass(ipo.returnSinceIpoPct)}>{formatSignedPercent(ipo.returnSinceIpoPct)}</span>
        </div>
      )}

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Financials (TTM)</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs">
          <span className="text-[#8190a0]">Revenue</span>
          <span className="text-right text-[#dbe5ee]">{ipo.revenueTtmUsdM ? billions(ipo.revenueTtmUsdM) : 'n/a'}</span>
          <span className="text-[#8190a0]">Rev growth</span>
          <span className={`text-right ${toneClass(ipo.revenueGrowthPct ?? 0)}`}>{ipo.revenueGrowthPct !== undefined ? formatSignedPercent(ipo.revenueGrowthPct) : 'n/a'}</span>
          <span className="text-[#8190a0]">Gross margin</span>
          <span className="text-right text-[#dbe5ee]">{ipo.grossMarginPct !== undefined ? formatPercent(ipo.grossMarginPct) : 'n/a'}</span>
          <span className="text-[#8190a0]">Net income</span>
          <span className={`text-right ${toneClass(ipo.netIncomeUsdM ?? 0)}`}>{ipo.netIncomeUsdM !== undefined ? formatCurrency(ipo.netIncomeUsdM) + 'M' : 'n/a'}</span>
          <span className="text-[#8190a0]">Profitable</span>
          <span className={`text-right ${ipo.profitable ? 'text-[#43d18b]' : 'text-[#f8c46b]'}`}>{ipo.profitable ? 'Yes' : 'Not yet'}</span>
          <span className="text-[#8190a0]">Employees</span>
          <span className="text-right text-[#dbe5ee]">{ipo.employees ? formatNumber(ipo.employees, 0) : 'n/a'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Products</p>
          <div className="flex flex-wrap gap-1">
            {ipo.products.map((p) => (
              <span key={p} className="rounded border border-[#263241] bg-[#0d141c] px-2 py-0.5 font-mono text-[11px] text-[#dbe5ee]">{p}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Notable projects</p>
          <div className="flex flex-wrap gap-1">
            {ipo.notableProjects.map((p) => (
              <span key={p} className="rounded border border-[#263241] bg-[#0d141c] px-2 py-0.5 font-mono text-[11px] text-[#a8b5c2]">{p}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8190a0]">Key people</p>
          <div className="space-y-0.5 font-mono text-xs text-[#dbe5ee]">
            {ipo.keyPeople.map((kp) => (
              <div key={kp.name} className="flex justify-between"><span>{kp.name}</span><span className="text-[#8190a0]">{kp.role}</span></div>
            ))}
          </div>
        </div>
      </div>

      {/* Model scenario - research only */}
      <div className="rounded-md border border-[#3b3050] bg-[#15101f] p-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a78bfa]">Model scenario · 12m</p>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#8190a0]">confidence: {est.confidence}</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center font-mono text-xs">
          <div><p className="text-[10px] uppercase text-[#8190a0]">Bear</p><p className="text-[#ff6b6b]">{formatCurrency(est.bearPrice)}</p></div>
          <div><p className="text-[10px] uppercase text-[#8190a0]">Base</p><p className="text-[#dbe5ee]">{formatCurrency(est.basePrice)}</p></div>
          <div><p className="text-[10px] uppercase text-[#8190a0]">Bull</p><p className="text-[#43d18b]">{formatCurrency(est.bullPrice)}</p></div>
        </div>
        <p className="mt-2 text-[10px] leading-4 text-[#8190a0]">Research scenario only - a deterministic range, not a forecast, price target, or recommendation. Not financial advice.</p>
      </div>

      <Link href={`/ipos/${ipo.symbol}`} className="inline-flex min-h-[44px] items-center gap-1 rounded border border-[#263241] bg-[#0d141c] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#a8b5c2] transition hover:text-[#eef3f8]">
        Full deep-dive <ArrowUpRight size={12} />
      </Link>
    </DetailDrawer>
  );
}
