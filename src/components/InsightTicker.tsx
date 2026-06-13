'use client';

import { Lightbulb } from 'lucide-react';
import { FINANCE_FACTS } from '@/lib/finance-facts';

// A stable slice for the tape (the full library is large); duplicated for a seamless loop.
const TAPE_FACTS = FINANCE_FACTS.slice(0, 28);

/**
 * Insight ticker - the "Good to know" facts as a continuous marquee, matching the
 * Markets / Macro / Intel tapes (same intel-marquee shell, reusing the slow intel-track so
 * the sentences are readable as they pass). Pauses on hover; static under reduced-motion.
 * A slider variant of the GoodToKnow panel for comparison.
 */
export function InsightTicker() {
  return (
    <div className="intel-marquee terminal-panel relative flex items-center overflow-hidden rounded-md">
      {/* Fixed left label - the tape scrolls behind it, same treatment as the other tapes. */}
      <div className="z-20 flex shrink-0 items-center gap-1.5 border-r border-[#1b2530] bg-[#0b1016] px-3 py-1.5">
        <Lightbulb size={11} className="text-[#f3a33a]" />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8aa2ff]">Insight</span>
      </div>

      <div className="relative min-w-0 flex-1 overflow-hidden py-1.5">
        <div className="intel-track flex w-max items-center">
          {[...TAPE_FACTS, ...TAPE_FACTS].map((f, i) => (
            <span
              key={`${f.id}-${i}`}
              className="inline-flex shrink-0 items-baseline gap-1.5 border-r border-[#1b2530] px-4"
            >
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
