'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Lightbulb, Sparkles } from 'lucide-react';
import { ProductUpdatesTimeline } from '@/components/ProductUpdatesTimeline';
import { IdeasBoard } from '@/components/community/IdeasBoard';
import { APP_VERSION } from '@/lib/version';

type Tab = 'updates' | 'ideas';

/**
 * The /whats-new surface: one glass hero carrying the title, the live version, and a sliding
 * two-tone switch between Product Updates (the one true changelog, generated from RELEASES)
 * and Ideas (the community voting board). Deep-linkable via ?tab=ideas so the feedback
 * widget's "Idea" flow can jump straight here.
 *
 * The hero and the switch are deliberately ONE panel: they were three stacked bordered boxes
 * (header / blurb / toggle) which read as clumped chrome and cost three blur passes on mobile.
 */
export function WhatsNewClient() {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'ideas' ? 'ideas' : 'updates');

  const tabs: { id: Tab; label: string; icon: typeof Sparkles }[] = [
    { id: 'updates', label: 'Product Updates', icon: Sparkles },
    { id: 'ideas', label: 'Ideas', icon: Lightbulb },
  ];

  return (
    <div className="space-y-3">
      <section className="terminal-panel glass-hero overflow-hidden rounded-lg">
        <div className="flex items-start justify-between gap-3 px-3.5 pt-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#9a6a1f]/70 bg-gradient-to-br from-[#2e2010] to-[#191108] text-[#f3a33a] shadow-[0_8px_20px_-10px_rgba(243,163,58,0.65)]">
              <Sparkles size={16} />
            </span>
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold leading-tight tracking-tight text-[#eef3f8]">Product updates</h1>
              <p className="mt-0.5 text-[11px] leading-snug text-[#8190a0]">Everything that shipped - and what you want next.</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-[#1d7f55]/70 bg-[#0d251b]/70 px-2 py-0.5 font-mono text-[10px] text-[#43d18b]">
            v{APP_VERSION}
          </span>
        </div>

        <div className="px-3.5 pb-3 pt-3">
          <div className="glass-segment relative grid grid-cols-2 gap-1 rounded-lg p-1" role="tablist">
            {/* Sliding thumb - the active tab's glass carrier. */}
            <span
              aria-hidden
              className={`glass-thumb pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.375rem)] rounded-md transition-transform duration-300 ease-out motion-reduce:transition-none ${
                tab === 'ideas' ? 'translate-x-[calc(100%+0.25rem)]' : 'translate-x-0'
              }`}
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
                  className={`relative z-10 inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md px-3 text-[12px] font-semibold transition-colors ${
                    active ? 'text-[#f3a33a]' : 'text-[#8190a0] hover:text-[#c8d3de]'
                  }`}
                >
                  <Icon size={14} /> {label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {tab === 'updates' ? <ProductUpdatesTimeline /> : <IdeasBoard />}
    </div>
  );
}
