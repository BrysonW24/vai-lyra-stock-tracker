'use client';

import Link from 'next/link';
import { demoIntelligenceFeed, type IntelligenceItem, type Sentiment } from '@/lib/intelligence';
import { TickerLogo } from '@/components/TickerLogo';

/**
 * Intelligence ticker-tape - a continuous right-to-left marquee of ticker-tagged
 * market intelligence, sitting under the market-regime bar so signals stream over
 * the data. Pauses on hover. Honours prefers-reduced-motion (static, scrollable).
 */

const SENTIMENT_DOT: Record<Sentiment, string> = {
  positive: 'bg-positive',
  neutral: 'bg-ink-3',
  negative: 'bg-negative',
};

function TapeItem({ item }: { item: IntelligenceItem }) {
  return (
    <Link
      href="/intelligence"
      className="inline-flex shrink-0 items-center gap-2 border-r border-line px-4 transition hover:bg-line/30"
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${SENTIMENT_DOT[item.sentiment]}`} />
      <TickerLogo symbol={item.tickers[0]} size={14} />
      <span className="font-mono text-[11px] font-semibold text-ink">{item.tickers.join(' ')}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-3">{item.category}</span>
      <span className="text-[11px] text-ink-2">{item.headline}</span>
    </Link>
  );
}

export function IntelligenceTicker() {
  const items = demoIntelligenceFeed;

  return (
    <div className="intel-marquee terminal-panel relative flex items-center overflow-hidden rounded-panel">
      {/* Fixed left label - the tape scrolls behind it */}
      <div className="z-20 flex shrink-0 items-center gap-1.5 border-r border-line bg-chrome px-3 py-1.5">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-positive" />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-pending">Intel</span>
      </div>

      {/* Scrolling track (items duplicated for a seamless loop) */}
      <div className="relative min-w-0 flex-1 overflow-hidden py-1.5">
        <div className="intel-track flex w-max items-center">
          {[...items, ...items].map((item, i) => (
            <TapeItem key={`${item.id}-${i}`} item={item} />
          ))}
        </div>
        {/* Right edge fade */}
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-chrome to-transparent" />
      </div>
    </div>
  );
}
