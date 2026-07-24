'use client';

import { useEffect, useState } from 'react';
import {
  loadLocalWatchlist,
  WATCHLIST_CHANGED_EVENT,
} from '@/lib/local-watchlist';

export function SoloWatchCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => setCount(loadLocalWatchlist().length);
    refresh();
    window.addEventListener(WATCHLIST_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(WATCHLIST_CHANGED_EVENT, refresh);
  }, []);

  return (
    <span className="rounded border border-[#9a6a1f] bg-[#2a1f0f] px-2 py-1 text-[#f3a33a]">
      Watch {count}
    </span>
  );
}
