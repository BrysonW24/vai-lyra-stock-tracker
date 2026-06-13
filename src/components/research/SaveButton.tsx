'use client';

import { useEffect, useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { isSaved, QUEUE_EVENT, toggleSave, type SavedKind } from '@/lib/research-queue';

interface SaveButtonProps {
  symbol: string;
  kind?: SavedKind;
  label?: string;
  score?: number;
  price?: number;
}

/**
 * Save-to-research-queue toggle. Snapshots the current score + price so the queue can show
 * what changed since you saved it. Listens for the queue event so every Save button + the
 * queue stay in sync within the tab.
 */
export function SaveButton({ symbol, kind = 'ticker', label, score, price }: SaveButtonProps) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(isSaved(symbol));
    const sync = () => setSaved(isSaved(symbol));
    window.addEventListener(QUEUE_EVENT, sync);
    return () => window.removeEventListener(QUEUE_EVENT, sync);
  }, [symbol]);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSaved(toggleSave({ symbol, kind, label, savedScore: score, savedPrice: price, savedAt: new Date().toISOString() }));
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      title={saved ? 'Saved to your research queue' : 'Save to your research queue'}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] uppercase tracking-[0.1em] transition ${
        saved
          ? 'border-[#f3a33a] bg-[#23180b] text-[#f3a33a]'
          : 'border-[#263241] bg-[#0d141c] text-[#8190a0] hover:border-[#3a4754] hover:text-[#eef3f8]'
      }`}
    >
      {saved ? <BookmarkCheck size={13} /> : <Bookmark size={13} />} {saved ? 'Saved' : 'Save'}
    </button>
  );
}
