'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadAlertPrefs, saveAlertPrefs } from '@/lib/alert-prefs';

/**
 * Turns the account's mute off on the SERVER, which is where it is enforced.
 *
 * The alert mode shown in the account menu is a per-device copy (localStorage) that only syncs
 * upward when it is changed on that device - nothing reads the server's state back down. So a mute
 * set on one browser is invisible on every other one: their menus keep saying "Live" while the
 * server holds everything back. This button does not depend on what this device believes.
 */
export function UnmuteAlertsButton() {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'saving' | 'failed'>('idle');

  async function unmute() {
    setState('saving');
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ preferences: { muteAll: false, mutedUntil: null } }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean } | null;
      if (!response.ok || body?.ok === false) throw new Error('unmute rejected');
      // Bring this device's own copy into line, so its menu does not go on claiming "Muted".
      if (loadAlertPrefs().mode === 'muted') saveAlertPrefs({ mode: 'live', mutedUntil: null });
      router.refresh();
    } catch {
      setState('failed');
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={unmute}
        disabled={state === 'saving'}
        className="rounded-cell border border-accent-border bg-panel px-3 py-1.5 text-sm font-medium text-ink transition hover:border-accent disabled:opacity-60"
      >
        {state === 'saving' ? 'Unmuting...' : 'Unmute alerts'}
      </button>
      {state === 'failed' ? (
        <span role="alert" className="text-xs text-negative">
          That did not go through - try again, or pick an alert mode in the account menu.
        </span>
      ) : null}
    </span>
  );
}
