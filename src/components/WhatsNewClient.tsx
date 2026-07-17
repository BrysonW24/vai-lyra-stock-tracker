'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Lightbulb, Sparkles } from 'lucide-react';
import { ProductUpdatesTimeline } from '@/components/ProductUpdatesTimeline';
import { IdeasBoard } from '@/components/community/IdeasBoard';

type Tab = 'updates' | 'ideas';

/**
 * The /whats-new surface: a two-tone switch between Product Updates (the one true changelog,
 * generated from RELEASES) and Ideas (the community voting board). Deep-linkable via ?tab=ideas
 * so the feedback widget's "Idea" flow can jump straight here.
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
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-[#1b2530] bg-[#0b1016] p-1">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-pressed={active}
              className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-semibold transition ${
                active
                  ? 'border border-[#9a6a1f] bg-[#23180b] text-[#f3a33a]'
                  : 'border border-transparent text-[#8190a0] hover:text-[#c8d3de]'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          );
        })}
      </div>

      {tab === 'updates' ? <ProductUpdatesTimeline /> : <IdeasBoard />}
    </div>
  );
}
