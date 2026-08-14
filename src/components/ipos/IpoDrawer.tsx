'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { DetailDrawer } from '@/components/DetailDrawer';
import { SourceFavicon } from '@/components/SourceFavicon';
import { ipoCategoryLabel, ipoStatusClass, type IpoCompany } from '@/lib/ipos';
import { formatCurrency, formatPercent, formatSignedPercent, formatNumber, toneClass } from '@/lib/format';

interface IpoDrawerProps {
  ipo: IpoCompany | null;
  /** Provenance of the explorer's dataset - sample rows carry editorial/invented terms
   *  and the drawer must say so, not just the 9px toolbar footnote it covers
   *  (2026-08-14 audit; same defect class as the calendar drawer fix). */
  source?: 'live' | 'sample';
  onClose: () => void;
}

function billions(usdM: number): string {
  if (!Number.isFinite(usdM)) return '-';
  return `$${(usdM / 1000).toFixed(1)}B`;
}

/**
 * Dense IPO slide-over. Rides the shared DetailDrawer shell (same as the signal /
 * calendar / smart-money explainers) so it inherits the slide animation, Esc +
 * backdrop close, body scroll lock, dialog semantics, and safe-area padding instead
 * of maintaining a diverging copy of the overlay plumbing.
 */
export function IpoDrawer({ ipo, source = 'sample', onClose }: IpoDrawerProps) {
  if (!ipo) return <DetailDrawer open={false} onClose={onClose} title="">{null}</DetailDrawer>;

  const est = ipo.modelEstimate;
  const ref = ipo.currentPrice ?? ipo.offerPrice;

  return (
    <DetailDrawer open onClose={onClose} title={ipo.companyName} subtitle={`${ipo.symbol} · ${ipo.exchange}`}>
      {source === 'sample' && (
        <div className="rounded-cell border border-accent-border/60 bg-accent-tint px-3 py-2 text-[11px] leading-snug text-accent">
          Sample record - editorial research content, not a live listing. Dates, terms and figures are illustrative.
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <SourceFavicon domain={ipo.domain} sourceName={ipo.companyName} />
        <span className={`rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${ipoStatusClass(ipo.status)}`}>{ipo.status}</span>
        <span className="rounded-full border border-line-strong bg-panel px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2">{ipoCategoryLabel(ipo.category)}</span>
        <span className="rounded-full border border-line-strong bg-panel px-2 py-1 font-mono text-[10px] text-ink-2">IPO {ipo.ipoDate}</span>
      </div>

      <p className="text-xs leading-5 text-ink-2">{ipo.description}</p>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-cell bg-line">
        {[
          ['Valuation', billions(ipo.valuationUsdM)],
          ['Raised', billions(ipo.proceedsUsdM)],
          ['Offer price', formatCurrency(ipo.offerPrice)],
          [ipo.currentPrice ? 'Current' : 'Est. ref', formatCurrency(ref)],
        ].map(([k, v]) => (
          <div className="bg-panel-deep p-2" key={k}>
            <p className="truncate text-[9px] uppercase tracking-[0.12em] text-ink-3">{k}</p>
            <p className="mt-0.5 truncate font-mono text-sm text-ink md:text-base">{v}</p>
          </div>
        ))}
      </div>

      {ipo.returnSinceIpoPct !== undefined && (
        <div className="flex items-center justify-between rounded-cell border border-line-strong bg-panel px-3 py-2 font-mono text-xs">
          <span className="text-ink-3">Return since IPO</span>
          <span className={toneClass(ipo.returnSinceIpoPct)}>{formatSignedPercent(ipo.returnSinceIpoPct)}</span>
        </div>
      )}

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Financials (TTM)</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs">
          <span className="text-ink-3">Revenue</span>
          <span className="text-right text-ink-title">{ipo.revenueTtmUsdM ? billions(ipo.revenueTtmUsdM) : 'n/a'}</span>
          <span className="text-ink-3">Rev growth</span>
          <span className={`text-right ${toneClass(ipo.revenueGrowthPct ?? 0)}`}>{ipo.revenueGrowthPct !== undefined ? formatSignedPercent(ipo.revenueGrowthPct) : 'n/a'}</span>
          <span className="text-ink-3">Gross margin</span>
          <span className="text-right text-ink-title">{ipo.grossMarginPct !== undefined ? formatPercent(ipo.grossMarginPct) : 'n/a'}</span>
          <span className="text-ink-3">Net income</span>
          <span className={`text-right ${toneClass(ipo.netIncomeUsdM ?? 0)}`}>{ipo.netIncomeUsdM !== undefined ? formatCurrency(ipo.netIncomeUsdM) + 'M' : 'n/a'}</span>
          <span className="text-ink-3">Profitable</span>
          <span className={`text-right ${ipo.profitable ? 'text-positive' : 'text-accent'}`}>{ipo.profitable ? 'Yes' : 'Not yet'}</span>
          <span className="text-ink-3">Employees</span>
          <span className="text-right text-ink-title">{ipo.employees ? formatNumber(ipo.employees, 0) : 'n/a'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Products</p>
          <div className="flex flex-wrap gap-1">
            {ipo.products.map((p) => (
              <span key={p} className="rounded-full border border-line-strong bg-panel px-2 py-0.5 font-mono text-[11px] text-ink-title">{p}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Notable projects</p>
          <div className="flex flex-wrap gap-1">
            {ipo.notableProjects.map((p) => (
              <span key={p} className="rounded-full border border-line-strong bg-panel px-2 py-0.5 font-mono text-[11px] text-ink-2">{p}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Key people</p>
          <div className="space-y-0.5 font-mono text-xs text-ink-title">
            {ipo.keyPeople.map((kp) => (
              <div key={kp.name} className="flex justify-between"><span>{kp.name}</span><span className="text-ink-3">{kp.role}</span></div>
            ))}
          </div>
        </div>
      </div>

      {/* Model scenario - research only. Absent when no reference price exists: the
          model never seeds a $0.00 range from a missing offer price (2026-08-14). */}
      {est ? (
        <div className="rounded-cell border border-pending/40 bg-pending/10 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-pending">Model scenario · 12m</p>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">confidence: {est.confidence}</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center font-mono text-xs">
            <div><p className="text-[10px] uppercase text-ink-3">Bear</p><p className="text-negative">{formatCurrency(est.bearPrice)}</p></div>
            <div><p className="text-[10px] uppercase text-ink-3">Base</p><p className="text-ink-title">{formatCurrency(est.basePrice)}</p></div>
            <div><p className="text-[10px] uppercase text-ink-3">Bull</p><p className="text-positive">{formatCurrency(est.bullPrice)}</p></div>
          </div>
          <p className="mt-2 text-[10px] leading-4 text-ink-3">Research scenario only - a deterministic range, not a forecast, price target, or recommendation. Not financial advice.</p>
        </div>
      ) : (
        <p className="rounded-cell border border-line-strong bg-panel px-3 py-2 text-[11px] text-ink-dim">
          No model scenario - this listing has no tracked reference price yet, so no range is modelled.
        </p>
      )}

      <Link href={`/ipos/${ipo.symbol}`} className="inline-flex min-h-[44px] items-center gap-1 rounded-cell border border-line-strong bg-panel px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-2 transition hover:text-ink">
        Full deep-dive <ArrowUpRight size={12} />
      </Link>
    </DetailDrawer>
  );
}
