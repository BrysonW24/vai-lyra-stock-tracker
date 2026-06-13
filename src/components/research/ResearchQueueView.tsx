'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bookmark, Trash2 } from 'lucide-react';
import { loadQueue, QUEUE_EVENT, removeSaved, updateNote, type SavedItem } from '@/lib/research-queue';
import { TickerLogo } from '@/components/TickerLogo';
import { formatSignedNumber, formatSignedPercent, relativeTime, toneClass } from '@/lib/format';

export interface CurrentSnapshot {
  score: number;
  scoreDelta: number;
  close: number;
  companyName: string;
  status: string;
}

/**
 * Research queue - the saved-dossier list. Reads saved items from localStorage and merges
 * them with the current signal snapshot passed from the server to show "what changed since
 * you saved it" (score + price deltas). Each item is editable (note) and removable.
 */
export function ResearchQueueView({ current }: { current: Record<string, CurrentSnapshot> }) {
  const [items, setItems] = useState<SavedItem[] | null>(null);

  useEffect(() => {
    setItems(loadQueue());
    const sync = () => setItems(loadQueue());
    window.addEventListener(QUEUE_EVENT, sync);
    return () => window.removeEventListener(QUEUE_EVENT, sync);
  }, []);

  if (items === null) return <div className="terminal-panel h-32 animate-pulse rounded-md" aria-hidden />;

  if (items.length === 0) {
    return (
      <section className="terminal-panel rounded-md p-5 text-center">
        <Bookmark className="mx-auto text-[#5e6b78]" size={22} />
        <p className="mt-2 text-sm font-semibold text-[#eef3f8]">Your research queue is empty</p>
        <p className="mx-auto mt-1 max-w-sm text-[11px] leading-snug text-[#8190a0]">
          Tap <span className="text-[#f3a33a]">Save</span> on any ticker. Come back and Lyra shows what has changed since
          you saved it - score, price, and your own notes.
        </p>
      </section>
    );
  }

  return (
    <section className="terminal-panel overflow-hidden rounded-md">
      <div className="border-b border-[#1b2530] px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Research queue · {items.length}</p>
        <p className="mt-0.5 font-mono text-[10px] text-[#a8b5c2]">Saved ideas, and what has changed since you saved them.</p>
      </div>
      <div className="divide-y divide-[#141c25]">
        {items.map((item) => {
          const cur = current[item.symbol];
          const scoreSince = cur && item.savedScore != null ? cur.score - item.savedScore : null;
          const priceSince = cur && item.savedPrice ? ((cur.close - item.savedPrice) / item.savedPrice) * 100 : null;
          return (
            <div key={item.symbol} className="px-3 py-2.5">
              <div className="flex items-center gap-2">
                <TickerLogo symbol={item.symbol} companyName={item.label} size={16} />
                <Link href={`/tickers/${item.symbol}?view=setup`} className="font-mono text-[12px] font-semibold text-[#eef3f8]">
                  {item.symbol}
                </Link>
                {cur && <span className="font-mono text-[10px] text-[#a8b5c2]">{cur.score}/100</span>}
                <span className="ml-auto font-mono text-[9px] text-[#5e6b78]">saved {relativeTime(item.savedAt)}</span>
                <button
                  type="button"
                  onClick={() => removeSaved(item.symbol)}
                  aria-label={`Remove ${item.symbol}`}
                  className="text-[#5e6b78] transition hover:text-[#ff6b6b]"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <p className="mt-1 font-mono text-[10px] text-[#8190a0]">
                Since saved:{' '}
                {scoreSince != null ? (
                  <span className={toneClass(scoreSince)}>score {formatSignedNumber(scoreSince, 0)}</span>
                ) : (
                  <span>score n/a</span>
                )}
                {priceSince != null && (
                  <>
                    {' · '}
                    <span className={toneClass(priceSince)}>{formatSignedPercent(priceSince)} price</span>
                  </>
                )}
              </p>

              <input
                defaultValue={item.note ?? ''}
                placeholder="Add a note..."
                onBlur={(e) => updateNote(item.symbol, e.target.value)}
                className="mt-1.5 w-full rounded border border-[#1b2530] bg-[#0b1016] px-2 py-1 text-[11px] text-[#dbe5ee] outline-none placeholder:text-[#5d6b79] focus:border-[#f3a33a]/40"
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
