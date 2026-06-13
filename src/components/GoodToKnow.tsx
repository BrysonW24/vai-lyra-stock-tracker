'use client';

import { useEffect, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { FINANCE_FACTS, type FactCategory } from '@/lib/finance-facts';

const CATEGORY_LABEL: Record<FactCategory, string> = {
  definition: 'Definition',
  history: 'History',
  mechanics: 'How it works',
  concept: 'Concept',
  au: 'Australia',
  fun: 'Fun fact',
};

/**
 * Good to know - a rotating finance fact under the Intel banner. Cycles every ~20s through
 * a shuffled backlog (tap for another), keeping things a little lighter and educational.
 * Shuffle is client-only so SSR/first paint stays deterministic (no hydration mismatch).
 */
export function GoodToKnow({ intervalMs = 20000 }: { intervalMs?: number }) {
  const [order, setOrder] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const shuffled = FINANCE_FACTS.map((_, i) => i);
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setOrder(shuffled);
    const id = window.setInterval(() => setPos((p) => p + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  if (FINANCE_FACTS.length === 0) return null;
  const fact = mounted && order.length ? FINANCE_FACTS[order[pos % order.length]] : FINANCE_FACTS[0];

  return (
    <button
      type="button"
      onClick={() => order.length && setPos((p) => p + 1)}
      className="terminal-panel block w-full rounded-md p-3 text-left transition hover:border-[#3a4754]"
    >
      <div className="flex items-center gap-1.5">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-[#263241] bg-[#0d141c] text-[#f3a33a]">
          <Lightbulb size={13} />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">Insight</p>
        <span className="rounded border border-[#263241] bg-[#0d141c] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[#7fb0ff]">
          {CATEGORY_LABEL[fact.category]}
        </span>
        <span className="ml-auto font-mono text-[9px] text-[#5e6b78]">tap for another</span>
      </div>
      <div key={fact.id} className="mt-2">
        <p className="text-[13px] font-semibold text-[#eef3f8]">{fact.term}</p>
        <p className="mt-0.5 text-[12px] leading-snug text-[#a8b5c2]">{fact.body}</p>
      </div>
    </button>
  );
}
