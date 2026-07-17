'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Radar } from 'lucide-react';

/**
 * The one-line bridge from the Ideas board to the Scout tab. The promotion bar keeps the
 * board sparse on purpose - without this strip, a visitor seeing two cards has no idea an
 * accumulation engine is running behind them. One tap walks the narrative thread
 * (drumbeat -> card) in the other direction. Renders nothing until the feed has substance.
 */

interface BridgeResponse {
  ok: boolean;
  run?: { itemsFetched: number; drumbeats: unknown[] } | null;
}

export function ScoutBridge({ onOpen }: { onOpen: () => void }) {
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/scout/feed', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: BridgeResponse) => {
        if (cancelled || !data.ok || !data.run) return;
        const beats = data.run.drumbeats.length;
        setLine(
          beats > 0
            ? `Scout: ${beats} signal${beats === 1 ? '' : 's'} building toward promotion`
            : `Scout read ${data.run.itemsFetched} items last run - nothing above the bar yet`,
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!line) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="glass-row flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg border border-[#2a4a7a]/50 bg-[#0f1a2c]/50 px-3 text-left transition hover:border-[#2a4a7a] hover:bg-[#0f1a2c]/80"
    >
      <span className="inline-flex min-w-0 items-center gap-2 text-[12px] text-[#a8b5c2]">
        <Radar size={13} className="shrink-0 text-[#7fb0ff]" />
        <span className="truncate">{line}</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-[#7fb0ff]">
        View <ArrowRight size={12} />
      </span>
    </button>
  );
}
