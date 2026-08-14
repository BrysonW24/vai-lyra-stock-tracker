'use client';

import { useMemo } from 'react';
import type { IntelligenceItem, Sentiment, TickerHype } from '@/lib/intelligence';
import { SourceFavicon } from '@/components/SourceFavicon';
import { relativeTime } from '@/lib/format';

const SENTIMENT_DOT: Record<Sentiment, string> = {
  positive: 'bg-positive',
  neutral: 'bg-ink-3',
  negative: 'bg-negative-soft',
};

const HYPE_TONE: Record<'rising' | 'steady' | 'cooling', { label: string; cls: string }> = {
  rising: { label: 'Hype rising', cls: 'border-positive/40 bg-positive-tint text-positive' },
  steady: { label: 'Hype steady', cls: 'border-line-strong bg-panel text-ink-2' },
  cooling: { label: 'Hype cooling', cls: 'border-negative/50 bg-negative/10 text-negative-soft' },
};

export interface HoldingIntel {
  feed: IntelligenceItem[];
  hypeMap: Record<string, TickerHype>;
  source: 'live' | 'sample';
}

/**
 * Intelligence dossier slide: ticker-tagged news + hype read for one symbol. Fixed in the
 * 2026-08-11 audit: it used to import the bundled demo feed directly, so fabricated
 * Goldman/Reuters headlines and invented hype scores rendered against REAL holdings on
 * live surfaces. Now the caller passes the resolved dataset with its provenance: live rows
 * render as intelligence; sample rows render only on the demo tour (chipped); a live page
 * with no feed says so instead of faking one.
 */
export function HoldingIntelSlide({
  symbol,
  intel = null,
  pageMode = 'demo',
}: {
  symbol: string;
  intel?: HoldingIntel | null;
  pageMode?: 'demo' | 'solo' | 'supabase';
}) {
  const show = intel != null && (intel.source === 'live' || pageMode === 'demo');
  const isSample = show && intel.source !== 'live';

  const items = useMemo<IntelligenceItem[]>(
    () =>
      show
        ? intel.feed
            .filter((item) => item.tickers.includes(symbol))
            .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
            .slice(0, 3)
        : [],
    [show, intel, symbol],
  );
  const hype = show ? intel.hypeMap[symbol] : undefined;

  return (
    <div className="flex h-full flex-col gap-2 rounded-cell border border-line bg-panel-deep p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
          Intelligence · {symbol}
          {isSample ? (
            <span className="rounded border border-accent-border/60 bg-accent-tint px-1.5 py-0.5 text-[9px] font-medium tracking-[0.1em] text-accent">
              Sample
            </span>
          ) : null}
        </p>
        {hype ? (
          <span className={`rounded border px-2 py-0.5 font-mono text-[10px] ${HYPE_TONE[hype.trend].cls}`}>
            {HYPE_TONE[hype.trend].label} · {hype.hypeScore}
          </span>
        ) : null}
      </div>

      {!show ? (
        <p className="flex flex-1 items-center justify-center px-2 text-center text-[11px] leading-snug text-ink-dim">
          Live news feed not connected - nothing is shown here rather than sample headlines.
        </p>
      ) : items.length === 0 ? (
        <p className="flex flex-1 items-center justify-center text-center text-[11px] text-ink-dim">
          No tagged intelligence yet for {symbol}.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="border-b border-line/70 pb-2 last:border-0 last:pb-0">
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${SENTIMENT_DOT[item.sentiment]}`} />
                <span className="rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-ink-3">
                  {item.category}
                </span>
                <span className="ml-auto font-mono text-[9px] text-ink-dim">{relativeTime(item.publishedAt)}</span>
              </div>
              <p className="mt-1 text-[11px] font-medium leading-snug text-ink-title">{item.headline}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-ink-3">
                <SourceFavicon domain={item.sourceDomain} sourceName={item.sourceName} />
                {item.sourceName}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
