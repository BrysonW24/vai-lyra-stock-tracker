'use client';

import { useState } from 'react';
import { Activity, CalendarDays, Newspaper } from 'lucide-react';
import { relativeTime } from '@/lib/format';
import type { FeedItem, FeedKind, FeedTone } from '@/lib/feed';

const TONE: Record<FeedTone, string> = {
  pos: 'text-positive',
  neg: 'text-negative',
  warn: 'text-accent',
  neutral: 'text-pending',
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
    <section className="terminal-panel overflow-hidden rounded-panel">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">Live wire</p>
          <p className="mt-0.5 text-[10px] text-ink-2">Every signal change + market headlines, newest first</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-positive">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-positive" />
          </span>
          Live
        </span>
      </div>

      {/* Small minimal filters */}
      <div className="flex flex-wrap gap-1 border-b border-line px-3 py-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-2 py-0.5 font-mono text-[10px] transition ${
              filter === f.key
                ? 'border-accent-border bg-accent-tint text-accent'
                : 'border-line bg-panel text-ink-3 hover:text-ink-title'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="divide-y divide-line">
        {shown.map((item) => {
          const Icon = KIND_ICON[item.kind];
          return (
            <div key={item.id} className="flex items-start gap-2 px-3 py-2">
              <span className={`mt-0.5 shrink-0 ${TONE[item.tone]}`}>
                <Icon size={13} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] leading-snug text-ink-title">
                  {item.ticker && <span className="font-mono font-semibold text-ink">{item.ticker} </span>}
                  {item.text}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-ink-3">
                  {relativeTime(item.time)} · {item.source}
                  {item.sample ? ' · sample' : ''}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="border-t border-line px-3 py-1.5 font-mono text-[10px] text-ink-dim">
        {intelligenceIsSample
          ? 'Signal changes are live from the engine. The news + macro/policy wire is an illustrative sample until live newsflow (Finnhub + AI) lands - sample items are tagged "· sample".'
          : 'Signal changes and ticker news are live; the macro/policy wire is a sample until it wires in - sample items are tagged "· sample".'}
      </p>
    </section>
  );
}
