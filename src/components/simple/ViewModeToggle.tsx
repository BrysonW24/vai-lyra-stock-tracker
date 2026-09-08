'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { LayoutGrid, Rows3 } from 'lucide-react';
import { VIEW_MODE_COOKIE, VIEW_MODE_MAX_AGE, type ViewMode } from '@/lib/view-mode';

/**
 * The one switch between the calm front door and the full desk.
 *
 * Writes a cookie (not localStorage) so the SERVER renders the right shell next paint -
 * no flash of the dense app before the simple one arrives. router.refresh() re-runs the
 * server components in place, so the swap costs no full page load.
 */
export function ViewModeToggle({ mode }: { mode: ViewMode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<ViewMode>(mode);

  function set(next: ViewMode) {
    if (next === optimistic) return;
    setOptimistic(next);
    // SameSite=Lax so the choice survives a normal navigation back into the app.
    document.cookie = `${VIEW_MODE_COOKIE}=${next}; path=/; max-age=${VIEW_MODE_MAX_AGE}; SameSite=Lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div
      className="inline-flex shrink-0 items-center rounded-full border border-line-strong bg-panel p-0.5"
      role="group"
      aria-label="View density"
    >
      <button
        type="button"
        onClick={() => set('simple')}
        aria-pressed={optimistic === 'simple'}
        title="Simple view - the calm essentials"
        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition ${
          optimistic === 'simple' ? 'bg-accent-tint text-accent' : 'text-ink-3 hover:text-ink'
        } ${pending ? 'opacity-70' : ''}`}
      >
        <Rows3 size={12} /> Simple
      </button>
      <button
        type="button"
        onClick={() => set('full')}
        aria-pressed={optimistic === 'full'}
        title="Full view - every surface Lyra has"
        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition ${
          optimistic === 'full' ? 'bg-accent-tint text-accent' : 'text-ink-3 hover:text-ink'
        } ${pending ? 'opacity-70' : ''}`}
      >
        <LayoutGrid size={12} /> Full
      </button>
    </div>
  );
}
