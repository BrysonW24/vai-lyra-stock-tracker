'use client';

import { useMemo } from 'react';
import {
  demoIntelligenceFeed,
  demoTickerHypeMap,
  type IntelligenceItem,
  type Sentiment,
} from '@/lib/intelligence';
import { SourceFavicon } from '@/components/SourceFavicon';
import { relativeTime } from '@/lib/format';

const SENTIMENT_DOT: Record<Sentiment, string> = {
  positive: 'bg-[#5fd08a]',
  neutral: 'bg-[#8190a0]',
  negative: 'bg-[#f0758a]',
};

const HYPE_TONE: Record<'rising' | 'steady' | 'cooling', { label: string; cls: string }> = {
  rising: { label: 'Hype rising', cls: 'border-[#1f5132] bg-[#0f2417] text-[#5fd08a]' },
  steady: { label: 'Hype steady', cls: 'border-[#263241] bg-[#0d141c] text-[#a8b5c2]' },
  cooling: { label: 'Hype cooling', cls: 'border-[#7a2630] bg-[#260f12] text-[#f0758a]' },
};

/** Intelligence dossier slide: ticker-tagged news + hype read for one symbol. */
export function HoldingIntelSlide({ symbol }: { symbol: string }) {
  const items = useMemo<IntelligenceItem[]>(
    () =>
      demoIntelligenceFeed
        .filter((item) => item.tickers.includes(symbol))
        .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
        .slice(0, 3),
    [symbol],
  );
  const hype = demoTickerHypeMap[symbol];

  return (
    <div className="flex h-full flex-col gap-2 rounded border border-[#1b2530] bg-[#0d1117] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#8190a0]">Intelligence · {symbol}</p>
        {hype ? (
          <span className={`rounded border px-2 py-0.5 font-mono text-[10px] ${HYPE_TONE[hype.trend].cls}`}>
            {HYPE_TONE[hype.trend].label} · {hype.hypeScore}
          </span>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="flex flex-1 items-center justify-center text-center text-[11px] text-[#5f6b78]">
          No tagged intelligence yet for {symbol}.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="border-b border-[#161e27] pb-2 last:border-0 last:pb-0">
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${SENTIMENT_DOT[item.sentiment]}`} />
                <span className="rounded border border-[#263241] bg-[#0d141c] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-[#8190a0]">
                  {item.category}
                </span>
                <span className="ml-auto font-mono text-[9px] text-[#5f6b78]">{relativeTime(item.publishedAt)}</span>
              </div>
              <p className="mt-1 text-[11px] font-medium leading-snug text-[#dbe5ee]">{item.headline}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[#8190a0]">
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
