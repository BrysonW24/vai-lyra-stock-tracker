'use client';

import { useState } from 'react';
import { Activity, CalendarDays, Newspaper } from 'lucide-react';
import { relativeTime } from '@/lib/format';
import type { FeedItem, FeedKind, FeedTone } from '@/lib/feed';

const TONE: Record<FeedTone, string> = {
  pos: 'text-[#43d18b]',
  neg: 'text-[#ff6b6b]',
  warn: 'text-[#f3a33a]',
  neutral: 'text-[#8aa2ff]',
};

const KIND_ICON: Record<FeedKind, typeof Activity> = {
  signal: Activity,
  news: Newspaper,
  event: CalendarDays,
};

const FILTERS: Array<{ key: 'all' | FeedKind; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'signal', label: 'Signals' },
  { key: 'news', label: 'News' },
  { key: 'event', label: 'Events' },
];

/**
 * Live Wire feed - dense rolling stream of every signal change + market/policy headlines,
 * newest first, with small minimal kind filters.
 */
export function LiveWire({
  items,
  intelligenceIsSample = true,
}: {
  items: FeedItem[];
  /** True when the ticker-news stream is the bundled illustrative sample (no live worker rows). */
  intelligenceIsSample?: boolean;
}) {
  const [filter, setFilter] = useState<'all' | FeedKind>('all');
  const shown = filter === 'all' ? items : items.filter((i) => i.kind === filter);

  return (
    <section className="terminal-panel overflow-hidden rounded-md">
      <div className="flex items-center justify-between gap-2 border-b border-[#1b2530] px-3 py-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Live wire</p>
          <p className="mt-0.5 text-[10px] text-[#a8b5c2]">Every signal change + market headlines, newest first</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#43d18b]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#43d18b] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#43d18b]" />
          </span>
          Live
        </span>
      </div>

      {/* Small minimal filters */}
      <div className="flex gap-1 border-b border-[#1b2530] px-3 py-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded border px-1.5 py-0.5 font-mono text-[10px] transition ${
              filter === f.key
                ? 'border-[#f3a33a] bg-[#23180b] text-[#f3a33a]'
                : 'border-[#1b2530] bg-[#0d141c] text-[#8190a0] hover:text-[#dbe5ee]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="divide-y divide-[#141c25]">
        {shown.map((item) => {
          const Icon = KIND_ICON[item.kind];
          return (
            <div key={item.id} className="flex items-start gap-2 px-3 py-2">
              <span className={`mt-0.5 shrink-0 ${TONE[item.tone]}`}>
                <Icon size={13} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] leading-snug text-[#dbe5ee]">
                  {item.ticker && <span className="font-mono font-semibold text-[#eef3f8]">{item.ticker} </span>}
                  {item.text}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-[#8190a0]">
                  {relativeTime(item.time)} · {item.source}
                  {item.sample ? ' · sample' : ''}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="border-t border-[#1b2530] px-3 py-1.5 font-mono text-[10px] text-[#5e6b78]">
        {intelligenceIsSample
          ? 'Signal changes are live from the engine. The news + macro/policy wire is an illustrative sample until live newsflow (Finnhub + AI) lands - sample items are tagged "· sample".'
          : 'Signal changes and ticker news are live; the macro/policy wire is a sample until it wires in - sample items are tagged "· sample".'}
      </p>
    </section>
  );
}
