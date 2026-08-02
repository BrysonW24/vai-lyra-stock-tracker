'use client';

import { useEffect, useMemo, useState } from 'react';
import { Zap } from 'lucide-react';
import type { SignalRow } from '@/types/scanner';
import { SignalDrawer } from '@/components/SignalDrawer';
import { TickerLogo } from '@/components/TickerLogo';
import { FullSetupLink } from '@/components/FullSetupLink';
import {
  buildEventStories,
  deriveSignalEvents,
  loadPinnedEvents,
  mergePinnedEvents,
  savePinnedEvents,
  RSI_OVERSOLD,
  type SignalEventStory,
} from '@/lib/signal-events';
import { formatSignedNumber, formatSignedPercent } from '@/lib/format';

const TONE_CHIP: Record<'pos' | 'neg' | 'warn', string> = {
  pos: 'border-positive/40 bg-positive-tint text-positive',
  neg: 'border-negative/50 bg-negative/10 text-negative',
  warn: 'border-accent-border bg-accent-tint text-accent',
};

function ageLabel(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m ago`;
  return `${Math.floor(hours)}h ago`;
}

/**
 * SIGNALS - major technical events (MACD crosses, oversold/overbought crossings,
 * recoveries) pinned as static signals for 24 hours, each tracked as a story: what
 * the stock has done since the trigger. These are the decisive-timing events; the
 * deterministic engine detects them (unit-tested in signal-events.test.ts) and
 * nothing here is advice.
 */
export function SignalEventsPanel({ signals }: { signals: SignalRow[] }) {
  const [stories, setStories] = useState<SignalEventStory[]>([]);
  const [selected, setSelected] = useState<SignalRow | null>(null);
  const bySymbol = useMemo(() => new Map(signals.map((s) => [s.symbol, s])), [signals]);

  useEffect(() => {
    const refresh = () => {
      const now = new Date();
      const merged = mergePinnedEvents(loadPinnedEvents(), deriveSignalEvents(signals, now), now);
      savePinnedEvents(merged);
      setStories(buildEventStories(merged, signals, now));
    };
    refresh();
    const id = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(id);
  }, [signals]);

  // Honest "watching" read when no event has fired in the window: who is closest?
  const watching = useMemo(() => {
    if (signals.length === 0) return null;
    const lowestRsi = [...signals].sort((a, b) => a.rsi - b.rsi)[0];
    const nearestCross = [...signals].sort((a, b) => Math.abs(a.macdHistogram) - Math.abs(b.macdHistogram))[0];
    return { lowestRsi, nearestCross };
  }, [signals]);

  return (
    <section className="terminal-panel overflow-hidden rounded-panel">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-cell border border-line-strong bg-panel text-pending">
            <Zap size={14} />
          </span>
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
              Signals
              <span className="relative flex h-1.5 w-1.5" title="Listening for MACD crosses, RSI zone breaks and band breaks">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-positive" />
              </span>
              <span className="font-mono text-[8px] tracking-[0.14em] text-positive">listening</span>
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-ink-2">
              Major events pin here for 24h, then we track the story that follows.
            </p>
          </div>
        </div>
        <span className="shrink-0 font-mono text-[10px] text-ink-3">{stories.length} active</span>
      </div>

      {stories.length === 0 ? (
        <div className="px-3 py-2.5">
          <p className="text-[11px] leading-snug text-ink-3">
            No major events in the last 24h.
            {watching ? (
              <>
                {' '}Closest to triggering:{' '}
                <span className="font-mono text-ink-title">{watching.lowestRsi.symbol}</span> RSI{' '}
                {Math.round(watching.lowestRsi.rsi)} ({Math.max(0, Math.round(watching.lowestRsi.rsi - RSI_OVERSOLD))} from
                oversold) ·{' '}
                <span className="font-mono text-ink-title">{watching.nearestCross.symbol}</span> MACD hist{' '}
                {watching.nearestCross.macdHistogram.toFixed(2)} (nearest a cross).
              </>
            ) : null}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-line/70">
          {stories.map((story) => {
            const signal = bySymbol.get(story.symbol);
            return (
              <div key={story.id} className="px-3 py-2 transition hover:bg-line/30">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => signal && setSelected(signal)}
                    className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-left"
                  >
                    <TickerLogo symbol={story.symbol} companyName={story.companyName} size={13} />
                    <span className="font-mono text-[12px] font-semibold text-ink">{story.symbol}</span>
                    <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] ${TONE_CHIP[story.meta.tone]}`}>
                      {story.meta.chip}
                    </span>
                    <span
                      className={`rounded border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] ${
                        story.confirming
                          ? 'border-positive/40 bg-positive-tint text-positive'
                          : 'border-accent-border bg-accent-tint text-accent'
                      }`}
                    >
                      {story.confirming ? 'Confirming' : 'Diverging'}
                    </span>
                  </button>
                  <FullSetupLink symbol={story.symbol} />
                </div>
                <button
                  type="button"
                  onClick={() => signal && setSelected(signal)}
                  className="mt-1 block w-full text-left"
                >
                  <p className="text-[11px] leading-snug text-ink-2">{story.meta.behaviour}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-ink-3">
                    Since the event:{' '}
                    <span className={story.priceMovePct >= 0 ? 'text-positive' : 'text-negative'}>
                      {formatSignedPercent(story.priceMovePct)}
                    </span>{' '}
                    price · score {formatSignedNumber(story.scoreMove, 0)} · {ageLabel(story.ageHours)} ago · {Math.ceil(story.hoursRemaining)}h left
                  </p>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="border-t border-line px-3 py-1.5 font-mono text-[10px] text-ink-dim">
        Deterministic event detection, unit-tested. Research timing context - never a buy/sell instruction.
      </p>
      <SignalDrawer signal={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
