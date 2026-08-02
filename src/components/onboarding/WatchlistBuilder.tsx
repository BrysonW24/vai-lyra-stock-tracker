'use client';

import { DEFAULT_WATCHLIST_ALERT_PCTS, WatchlistItem } from '@/lib/onboarding';
import { TickerLogo } from '@/components/TickerLogo';
import { TickerLookupInput, type TickerLookup } from '@/components/onboarding/TickerLookupInput';
import { displaySymbol } from '@/lib/format';
import { X } from 'lucide-react';

interface WatchlistBuilderProps {
  watchlist: WatchlistItem[];
  onChange: (watchlist: WatchlistItem[]) => void;
  onNext: () => void;
  /** When composed into a combined step, hide the local Continue button. */
  hideContinue?: boolean;
}

function formatPrice(price?: number, currency?: string): string {
  if (price == null) return '';
  const sym = currency === 'AUD' ? 'A$' : currency === 'USD' ? '$' : '';
  return `${sym}${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function WatchlistBuilder({ watchlist, onChange, onNext, hideContinue }: WatchlistBuilderProps) {
  const add = (r: TickerLookup) => {
    onChange([
      ...watchlist,
      {
        symbol: r.symbol,
        name: r.name ?? undefined,
        lastPrice: r.price ?? undefined,
        currency: r.currency ?? undefined,
        alertPcts: DEFAULT_WATCHLIST_ALERT_PCTS,
      },
    ]);
  };
  const remove = (symbol: string) => onChange(watchlist.filter((w) => w.symbol !== symbol));

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-snug text-ink-2">
        Add the companies you want to watch closely - type any ticker (US or ASX) and we&apos;ll pull it live. Targets
        and signal rules can come later.
      </p>

      <TickerLookupInput onAdd={add} existing={watchlist.map((w) => w.symbol)} ctaLabel="Add" />

      {watchlist.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">Watchlist ({watchlist.length})</p>
          <div className="grid gap-1.5">
            {watchlist.map((item) => {
              const alerts = item.alertPcts ?? [];
              const toggleAlert = (pct: number) =>
                onChange(
                  watchlist.map((w) => {
                    if (w.symbol !== item.symbol) return w;
                    const cur = w.alertPcts ?? [];
                    const next = cur.includes(pct) ? cur.filter((p) => p !== pct) : [...cur, pct].sort((a, b) => a - b);
                    return { ...w, alertPcts: next.length ? next : undefined };
                  }),
                );
              return (
              <div key={item.symbol} className="rounded-cell border border-line-strong bg-panel px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <TickerLogo symbol={item.symbol} size={18} />
                    <p className="truncate font-mono text-[13px] font-semibold text-ink">
                      {displaySymbol(item.symbol)}
                      {item.name && <span className="ml-1.5 font-sans text-[11px] font-normal text-ink-3">{item.name}</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.lastPrice != null && (
                      <span className="font-mono text-[12px] tabular-nums text-ink-2">{formatPrice(item.lastPrice, item.currency)}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(item.symbol)}
                      aria-label={`Remove ${item.symbol}`}
                      className="-m-2 p-2 text-ink-3 transition hover:text-negative"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>

                {/* Price-move alert thresholds */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">Notify</span>
                  {DEFAULT_WATCHLIST_ALERT_PCTS.map((pct) => {
                    const active = alerts.includes(pct);
                    const up = pct >= 0;
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => toggleAlert(pct)}
                        className={`rounded-cell px-2 py-1 font-mono text-[11px] font-semibold tabular-nums transition ${
                          active
                            ? up
                              ? 'border border-positive/40 bg-positive-tint text-positive'
                              : 'border border-negative/40 bg-negative/10 text-negative'
                            : 'border border-line-strong bg-chrome text-ink-3 hover:border-line-hair'
                        }`}
                      >
                        {up ? '+' : ''}{pct}%
                      </button>
                    );
                  })}
                </div>

                {alerts.length > 0 && item.lastPrice != null && (
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px]">
                    <span className="text-ink-dim">Notify at</span>
                    {alerts.map((pct) => (
                      <span key={pct} className={pct >= 0 ? 'text-positive' : 'text-negative'}>
                        {formatPrice(item.lastPrice! * (1 + pct / 100), item.currency)}
                        <span className="text-ink-dim"> ({pct > 0 ? '+' : ''}{pct}%)</span>
                      </span>
                    ))}
                  </p>
                )}
              </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-ink-dim">No tickers yet - add a few you care about, or skip and add them later.</p>
      )}

      {!hideContinue && (
        <button
          onClick={onNext}
          className="min-h-[44px] w-full rounded-cell bg-[image:var(--lyra-cta-gradient)] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_-10px_rgba(67,209,139,0.55)] transition hover:brightness-110"
        >
          Continue
        </button>
      )}
    </div>
  );
}
