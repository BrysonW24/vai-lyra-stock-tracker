'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, X } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import {
  loadLocalWatchlist,
  removeLocalWatchItem,
  WATCHLIST_CHANGED_EVENT,
  type LocalWatchItem,
} from '@/lib/local-watchlist';
import { formatCurrency } from '@/lib/format';
import { TickerLogo } from '@/components/TickerLogo';

/**
 * Solo/demo-mode watchlist visibility. The local-watchlist store existed but nothing on
 * the watchlist page ever read it back - items were saved and then invisible, which is
 * only half a fix. This renders the browser-local rules as their own honest panel rather
 * than faking rows in the trigger table: local items have no worker-computed trigger or
 * overlay state, and pretending otherwise would put made-up numbers next to real ones.
 * In live (Supabase) mode this renders nothing - the DB-backed table is the truth.
 */
export function LocalWatchRules() {
  const [items, setItems] = useState<LocalWatchItem[]>([]);

  useEffect(() => {
    if (isSupabaseConfigured()) return;
    const sync = () => setItems(loadLocalWatchlist());
    sync();
    window.addEventListener(WATCHLIST_CHANGED_EVENT, sync);
    return () => window.removeEventListener(WATCHLIST_CHANGED_EVENT, sync);
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="terminal-panel rounded-md p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#eef3f8]">Your watch rules</h2>
        <span className="text-[9px] uppercase tracking-[0.12em] text-[#8190a0]">on this device</span>
      </div>
      <ul className="mt-2 divide-y divide-[#1b2530]">
        {items.map((item) => (
          <li className="flex items-center gap-2 py-1.5" key={item.symbol}>
            <Link href={`/tickers/${item.symbol}`} className="flex min-w-0 flex-1 items-center gap-2">
              <TickerLogo symbol={item.symbol} size={18} />
              <span className="font-mono text-xs font-semibold text-[#eef3f8]">{item.symbol}</span>
              {item.targetBuyPrice !== undefined && (
                <span className="font-mono text-[10px] text-[#f3a33a]">target {formatCurrency(item.targetBuyPrice)}</span>
              )}
              {item.notes && <span className="truncate text-[10px] text-[#8190a0]">{item.notes}</span>}
              <ArrowUpRight size={10} className="shrink-0 text-[#4a5a6a]" />
            </Link>
            <button
              type="button"
              aria-label={`Stop watching ${item.symbol}`}
              onClick={() => removeLocalWatchItem(item.symbol)}
              className="rounded p-1 text-[#5e6b78] transition-colors hover:bg-[#101720] hover:text-[#ff6b6b]"
            >
              <X size={12} />
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] leading-relaxed text-[#5e6b78]">
        Stored in this browser only. Hourly trigger states come from the hosted scanner, so these
        rules show here without live trigger tracking.
      </p>
    </section>
  );
}
