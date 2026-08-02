'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Lightbulb, Radar, Sparkles } from 'lucide-react';
import { ProductUpdatesTimeline } from '@/components/ProductUpdatesTimeline';
import { IdeasBoard } from '@/components/community/IdeasBoard';
import { ScoutFeed } from '@/components/community/ScoutFeed';
import { ScoutProposals } from '@/components/community/ScoutProposals';
import { APP_VERSION } from '@/lib/version';

type Tab = 'updates' | 'ideas' | 'scout';

/**
 * The /whats-new surface: one glass hero carrying the title, the live version, and a sliding
 * switch across three surfaces - Product Updates (the one true changelog, generated from
 * RELEASES), Ideas (PURELY the community board: what people want built inside Lyra, votable
 * without an account), and Scout (everything external: the AI scout's proposal cards plus the
 * perception stream of what it read). The split is doctrine, not layout: an external news
 * signal must never appear on the Ideas tab - community wishes and world signals are
 * different questions. Deep-linkable via ?tab=ideas / ?tab=scout.
 *
 * The hero and the switch are deliberately ONE panel: they were three stacked bordered boxes
 * (header / blurb / toggle) which read as clumped chrome and cost three blur passes on mobile.
 */
export function WhatsNewClient() {
  const params = useSearchParams();
  const initial = params.get('tab');
  const [tab, setTab] = useState<Tab>(initial === 'ideas' ? 'ideas' : initial === 'scout' ? 'scout' : 'updates');

  const tabs: { id: Tab; label: string; icon: typeof Sparkles }[] = [
    { id: 'updates', label: 'Updates', icon: Sparkles },
    { id: 'ideas', label: 'Ideas', icon: Lightbulb },
    { id: 'scout', label: 'Scout', icon: Radar },
  ];
  const activeIndex = tabs.findIndex((t) => t.id === tab);

  return (
    <div className="space-y-3">
      <section className="terminal-panel glass-hero overflow-hidden rounded-lg">
        <div className="flex items-start justify-between gap-3 px-3.5 pt-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-accent-border/70 bg-gradient-to-br from-[#2e2010] to-[#191108] text-accent shadow-[0_8px_20px_-10px_rgba(243,163,58,0.65)]">
              <Sparkles size={16} />
            </span>
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold leading-tight tracking-tight text-ink">Product updates</h1>
              <p className="mt-0.5 text-[11px] leading-snug text-ink-3">Everything that shipped - and what you want next.</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-positive/50 bg-positive-tint/70 px-2 py-0.5 font-mono text-[10px] text-positive">
            v{APP_VERSION}
          </span>
        </div>

        <div className="px-3.5 pb-3 pt-3">
          <div className="glass-segment relative grid grid-cols-3 gap-1 rounded-lg p-1" role="tablist">
            {/* Sliding thumb - the active tab's glass carrier. translate-x % is relative to
                the thumb's OWN width, so each step is one thumb-width plus the 0.25rem gap. */}
            <span
              aria-hidden
              className="glass-thumb pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-1rem)/3)] rounded-md transition-transform duration-300 ease-out motion-reduce:transition-none"
              style={{ transform: `translateX(calc(${activeIndex * 100}% + ${activeIndex * 0.25}rem))` }}
            />
            {tabs.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(id)}
                  className={`relative z-10 inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md px-2 text-[12px] font-semibold transition-colors ${
                    active ? 'text-accent' : 'text-ink-3 hover:text-ink-title'
                  }`}
                >
                  <Icon size={14} /> {label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {tab === 'updates' && <ProductUpdatesTimeline />}
      {tab === 'ideas' && <IdeasBoard />}
      {tab === 'scout' && (
        <div className="space-y-3">
          <ScoutProposals />
          <ScoutFeed />
        </div>
      )}
    </div>
  );
}
