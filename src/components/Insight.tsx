'use client';

import { useEffect, useState } from 'react';
import { Lightbulb, Settings2 } from 'lucide-react';
import { FINANCE_FACTS, type FactCategory } from '@/lib/finance-facts';

type InsightMode = 'panel' | 'slider';

const MODE_KEY = 'lyra.insightMode.v1';
const TAPE_FACTS = FINANCE_FACTS.slice(0, 28);

const CATEGORY_LABEL: Record<FactCategory, string> = {
  definition: 'Definition',
  history: 'History',
  mechanics: 'How it works',
  concept: 'Concept',
  au: 'Australia',
  fun: 'Fun fact',
};

/**
 * Insight - a rotating finance fact under the Intel banner, in two switchable views:
 *  - panel (default): calm, readable - one fact at a time, tap the body for another.
 *  - slider: a continuous marquee matching the Markets / Macro / Intel tapes.
 * Tap the INSIGHT letters or the small cog (top-right) to switch; the choice persists.
 * Default + first paint is the panel (deterministic, so no hydration mismatch).
 */
export function Insight() {
  const [mode, setMode] = useState<InsightMode>('panel');
  const [mounted, setMounted] = useState(false);
  const [order, setOrder] = useState<number[]>([]);
  const [pos, setPos] = useState(0);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = window.localStorage.getItem(MODE_KEY);
      if (saved === 'slider' || saved === 'panel') setMode(saved);
    } catch {
      /* ignore */
    }
    const shuffled = FINANCE_FACTS.map((_, i) => i);
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setOrder(shuffled);
    const id = window.setInterval(() => setPos((p) => p + 1), 20000);
    return () => window.clearInterval(id);
  }, []);

  const toggle = () =>
    setMode((m) => {
      const next: InsightMode = m === 'panel' ? 'slider' : 'panel';
      try {
        window.localStorage.setItem(MODE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });

  if (FINANCE_FACTS.length === 0) return null;

  // --- Slider view -----------------------------------------------------------
  if (mode === 'slider') {
    return (
      <div className="intel-marquee terminal-panel relative flex items-center overflow-hidden rounded-md">
        <div className="z-20 flex shrink-0 items-center gap-1.5 border-r border-[#1b2530] bg-[#0b1016] px-3 py-1.5">
          <Lightbulb size={11} className="text-[#f3a33a]" />
          <button type="button" onClick={toggle} title="Switch to panel" className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8aa2ff] transition hover:text-[#eef3f8]">
            Insight
          </button>
          <button type="button" onClick={toggle} aria-label="Switch insight view" className="text-[#5e6b78] transition hover:text-[#a8b5c2]">
            <Settings2 size={11} />
          </button>
        </div>
        <div className="relative min-w-0 flex-1 overflow-hidden py-1.5">
          <div className="intel-track flex w-max items-center">
            {[...TAPE_FACTS, ...TAPE_FACTS].map((f, i) => (
              <span key={`${f.id}-${i}`} className="inline-flex shrink-0 items-baseline gap-1.5 border-r border-[#1b2530] px-4">
                <span className="font-mono text-[11px] font-semibold text-[#eef3f8]">{f.term}</span>
                <span className="text-[11px] text-[#a8b5c2]">{f.body}</span>
              </span>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#0b1016] to-transparent" />
        </div>
      </div>
    );
  }

  // --- Panel view (default) --------------------------------------------------
  const fact = mounted && order.length ? FINANCE_FACTS[order[pos % order.length]] : FINANCE_FACTS[0];

  return (
    <section className="terminal-panel rounded-md p-3">
      <div className="flex items-center gap-1.5">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-[#263241] bg-[#0d141c] text-[#f3a33a]">
          <Lightbulb size={13} />
        </span>
        <button type="button" onClick={toggle} title="Switch to slider" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8190a0] transition hover:text-[#eef3f8]">
          Insight
        </button>
        <span className="rounded border border-[#263241] bg-[#0d141c] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[#7fb0ff]">
          {CATEGORY_LABEL[fact.category]}
        </span>
        <span className="ml-auto font-mono text-[9px] text-[#5e6b78]">tap for another</span>
        <button type="button" onClick={toggle} aria-label="Switch insight view" title="Switch view" className="text-[#5e6b78] transition hover:text-[#a8b5c2]">
          <Settings2 size={12} />
        </button>
      </div>
      <button type="button" onClick={() => order.length && setPos((p) => p + 1)} className="mt-2 block w-full text-left">
        <p className="text-[13px] font-semibold text-[#eef3f8]">{fact.term}</p>
        <p className="mt-0.5 text-[12px] leading-snug text-[#a8b5c2]">{fact.body}</p>
      </button>
    </section>
  );
}
