'use client';

import Link from 'next/link';
import { type IntelligenceItem, type Sentiment } from '@/lib/intelligence';
import { TickerLogo } from '@/components/TickerLogo';

/**
 * Intelligence ticker-tape - a continuous right-to-left marquee of ticker-tagged
 * market intelligence, sitting under the market-regime bar so signals stream over
 * the data. Pauses on hover. Honours prefers-reduced-motion (static, scrollable).
 *
 * Honesty rule (2026-08-14 audit): the tape takes the resolved feed + provenance as
 * props - it used to hardcode the bundled demo feed and stream fabricated Goldman/
 * Reuters headlines under a pulsing green dot on live pages. Live rows stream as
 * intelligence; sample rows stream only on the demo tour under a Sample chip; a
 * live/solo page with no feed renders an honest "not connected" strip.
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

export function IntelligenceTicker({
  feed,
  source = 'sample',
  pageMode = 'demo',
}: {
  feed?: IntelligenceItem[] | null;
  /** Provenance of the feed - 'sample' is the bundled demo set. */
  source?: 'live' | 'sample';
  /** The page's data mode - sample headlines may only stream on the demo tour. */
  pageMode?: 'demo' | 'solo' | 'supabase';
}) {
  const isLive = source === 'live';
  const items = feed && (isLive || pageMode === 'demo') ? feed : [];

  if (items.length === 0) {
    return (
      <div className="terminal-panel flex items-center gap-2 rounded-panel px-3 py-1.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink-dim" />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">Intel</span>
        <span className="text-[11px] text-ink-dim">
          Live news feed not connected - nothing streams here rather than sample headlines.
        </span>
      </div>
    );
  }

  return (
    <div className="intel-marquee terminal-panel relative flex items-center overflow-hidden rounded-panel">
      {/* Fixed left label - the tape scrolls behind it */}
      <div className="z-20 flex shrink-0 items-center gap-1.5 border-r border-line bg-chrome px-3 py-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'animate-pulse bg-positive' : 'bg-accent'}`} />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-pending">Intel</span>
        {!isLive && (
          <span className="rounded-full border border-accent-border bg-accent-tint px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-accent">
            Sample
          </span>
        )}
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
