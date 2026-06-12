'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { X, ArrowUpRight } from 'lucide-react';
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
 * Wizz-style slide-over drawer: dense, compact, fast. Right-anchored on desktop,
 * full-screen sheet on mobile. Closes on backdrop click or Esc.
 */
export function IpoDrawer({ ipo, onClose }: IpoDrawerProps) {
  // Portal to <body> so the fixed overlay escapes any ancestor backdrop-filter /
  // transform containing block (e.g. .terminal-panel) that would trap it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (ipo) {
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }
  }, [ipo, onClose]);

  if (!ipo || !mounted) return null;

  const est = ipo.modelEstimate;
  const ref = ipo.currentPrice ?? ipo.offerPrice;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[440px] flex-col overflow-y-auto border-l border-[#1b2530] bg-[#0b1016] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#1b2530] bg-[#0b1016]/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <SourceFavicon domain={ipo.domain} sourceName={ipo.companyName} />
            <div className="min-w-0">
              <p className="truncate font-semibold text-[#eef3f8]">{ipo.companyName}</p>
              <p className="font-mono text-xs text-[#8190a0]">{ipo.symbol} · {ipo.exchange}</p>
            </div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded border border-[#263241] text-[#8190a0] transition hover:text-[#eef3f8]" type="button" aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
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

          <Link href={`/ipos/${ipo.symbol}`} className="inline-flex items-center gap-1 rounded border border-[#263241] bg-[#0d141c] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#a8b5c2] transition hover:text-[#eef3f8]">
            Full deep-dive <ArrowUpRight size={12} />
          </Link>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
