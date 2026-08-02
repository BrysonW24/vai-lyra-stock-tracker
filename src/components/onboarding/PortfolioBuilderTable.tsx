'use client';

import { PortfolioHolding } from '@/lib/onboarding';
import { TickerLogo } from '@/components/TickerLogo';
import { TickerLookupInput, type TickerLookup } from '@/components/onboarding/TickerLookupInput';
import { displaySymbol } from '@/lib/format';
import { X } from 'lucide-react';

interface PortfolioBuilderTableProps {
  portfolio: PortfolioHolding[];
  onChange: (portfolio: PortfolioHolding[]) => void;
  onNext: () => void;
  /** When composed into a combined step, hide the local Continue button. */
  hideContinue?: boolean;
}

function formatPrice(price?: number, currency?: string): string {
  if (price == null) return '';
  const sym = currency === 'AUD' ? 'A$' : currency === 'USD' ? '$' : '';
  return `${sym}${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PortfolioBuilderTable({ portfolio, onChange, onNext, hideContinue }: PortfolioBuilderTableProps) {
  const add = (r: TickerLookup) => {
    onChange([
      ...portfolio,
      { symbol: r.symbol, name: r.name ?? undefined, lastPrice: r.price ?? undefined, currency: r.currency ?? undefined },
    ]);
  };
  const update = (idx: number, patch: Partial<PortfolioHolding>) =>
    onChange(portfolio.map((h, i) => (i === idx ? { ...h, ...patch } : h)));
  const remove = (idx: number) => onChange(portfolio.filter((_, i) => i !== idx));

  const num = (v: string): number | undefined => {
    if (v.trim() === '') return undefined;
    const n = parseFloat(v);
    return Number.isNaN(n) ? undefined : n;
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-snug text-ink-2">
        Add what you own - type any ticker (US or ASX) and we&apos;ll pull it live. Quantity and average price are
        required for portfolio value and performance alerts.
      </p>

      <TickerLookupInput onAdd={add} existing={portfolio.map((h) => h.symbol)} ctaLabel="Add" />

      {portfolio.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Holdings ({portfolio.length})</p>
          <div className="grid gap-1.5">
            {portfolio.map((h, idx) => {
              const cost = h.quantity != null && h.averageBuyPrice != null ? h.quantity * h.averageBuyPrice : null;
              const marketValue = h.quantity != null && h.lastPrice != null ? h.quantity * h.lastPrice : null;
              const pnl = cost != null && marketValue != null ? marketValue - cost : null;
              const pnlPct = pnl != null && cost ? (pnl / cost) * 100 : null;
              return (
              <div key={idx} className="rounded-cell border border-line-strong bg-panel px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <TickerLogo symbol={h.symbol} size={18} />
                    <p className="truncate font-mono text-[13px] font-semibold text-ink">
                      {displaySymbol(h.symbol)}
                      {h.name && <span className="ml-1.5 font-sans text-[11px] font-normal text-ink-3">{h.name}</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {h.lastPrice != null && (
                      <span className="font-mono text-[12px] tabular-nums text-ink-2">{formatPrice(h.lastPrice, h.currency)}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      aria-label={`Remove ${h.symbol}`}
                      className="-m-2 p-2 text-ink-3 transition hover:text-negative"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
                <div className="mt-1.5 flex gap-2">
                  <input
                    inputMode="decimal"
                    placeholder="Qty"
                    value={h.quantity ?? ''}
                    onChange={(e) => update(idx, { quantity: num(e.target.value) })}
                    className="h-7 w-full rounded-cell border border-line-strong bg-well px-2 font-mono text-[12px] tabular-nums text-ink-title placeholder:text-ink-dim outline-none focus:border-accent/50"
                  />
                  <input
                    inputMode="decimal"
                    placeholder="Avg buy price"
                    value={h.averageBuyPrice ?? ''}
                    onChange={(e) => update(idx, { averageBuyPrice: num(e.target.value) })}
                    className="h-7 w-full rounded-cell border border-line-strong bg-well px-2 font-mono text-[12px] tabular-nums text-ink-title placeholder:text-ink-dim outline-none focus:border-accent/50"
                  />
                </div>
                {(cost != null || marketValue != null) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-line pt-1.5 font-mono text-[11px] tabular-nums">
                    {cost != null && (
                      <span className="text-ink-3">Cost <span className="font-semibold text-ink-title">{formatPrice(cost, h.currency)}</span></span>
                    )}
                    {marketValue != null && (
                      <span className="text-ink-3">Value <span className="font-semibold text-ink-title">{formatPrice(marketValue, h.currency)}</span></span>
                    )}
                    {pnl != null && (
                      <span className={pnl >= 0 ? 'text-positive' : 'text-negative'}>
                        {pnl >= 0 ? '+' : '-'}{formatPrice(Math.abs(pnl), h.currency)}
                        {pnlPct != null && ` (${pnl >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)`}
                      </span>
                    )}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-ink-dim">No holdings yet - add what you own, or skip and add them later.</p>
      )}

      {!hideContinue && (
        <button
          onClick={onNext}
          disabled={!portfolio.every(h => h.quantity != null && h.quantity > 0 && h.averageBuyPrice != null && h.averageBuyPrice > 0)}
          className="min-h-[44px] w-full rounded-cell bg-[image:var(--lyra-cta-gradient)] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_-10px_rgba(67,209,139,0.55)] transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      )}
    </div>
  );
}
