'use client';

import { PortfolioHolding, WatchlistItem } from '@/lib/onboarding';
import { PortfolioBuilderTable } from '@/components/onboarding/PortfolioBuilderTable';
import { WatchlistBuilder } from '@/components/onboarding/WatchlistBuilder';
import { BriefcaseBusiness, Star } from 'lucide-react';

interface PortfolioWatchlistStepProps {
  portfolio: PortfolioHolding[];
  watchlist: WatchlistItem[];
  onChangePortfolio: (portfolio: PortfolioHolding[]) => void;
  onChangeWatchlist: (watchlist: WatchlistItem[]) => void;
  onNext: () => void;
}

/**
 * One split screen - portfolio on top, watchlist below - so the user adds the
 * names they actually care about in a single pass. Both reuse the on-demand ticker
 * lookup (any US/ASX symbol, fetched live) and save into onboarding state, which is
 * posted to the watchlist/portfolio APIs on finish and surfaced in the command centre.
 */
export function PortfolioWatchlistStep({
  portfolio,
  watchlist,
  onChangePortfolio,
  onChangeWatchlist,
  onNext,
}: PortfolioWatchlistStepProps) {
  const noop = () => {};

  return (
    <div className="space-y-4">
      <section>
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
          <BriefcaseBusiness size={12} /> Your portfolio
        </p>
        <PortfolioBuilderTable portfolio={portfolio} onChange={onChangePortfolio} onNext={noop} hideContinue />
      </section>

      <section className="border-t border-line pt-4">
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
          <Star size={12} /> Your watchlist
        </p>
        <WatchlistBuilder watchlist={watchlist} onChange={onChangeWatchlist} onNext={noop} hideContinue />
      </section>

      <button
        onClick={onNext}
        className="min-h-[44px] w-full rounded-cell bg-[image:var(--lyra-cta-gradient)] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_-10px_rgba(67,209,139,0.55)] transition hover:brightness-110"
      >
        Continue
      </button>
    </div>
  );
}
