'use client';

import { ALERT_MODES, useAlertPrefs } from '@/lib/alert-prefs';
import { isSupabaseConfigured } from '@/lib/supabase/client';

/** Fired when the badge is tapped, so the account (gecko) menu opens to the controls. */
export const OPEN_ACCOUNT_MENU_EVENT = 'lyra:account-menu-open';

/**
 * Header badge showing the current alert mode and its colour (Live green, Quiet blue,
 * Muted red, Custom purple) so you can see at a glance that alerts are live. Tapping it
 * opens the account (gecko) menu, where the mode controls live.
 */
export function AlertStatusBadge() {
  const soloMode = !isSupabaseConfigured();
  const { activeMode, statusLabel, isMuted } = useAlertPrefs();
  const meta = ALERT_MODES.find((m) => m.value === activeMode) ?? ALERT_MODES[0];

  if (soloMode) {
    return (
      <button
        type="button"
        onClick={() =>
          window.dispatchEvent(new Event(OPEN_ACCOUNT_MENU_EVENT))
        }
        title="Solo: in-console signals only; no background notification delivery"
        className="flex shrink-0 items-center gap-1.5 rounded-cell border border-line-strong bg-panel px-2 py-1.5 text-[11px] font-medium text-ink-2 transition hover:brightness-110"
      >
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ink-3" />
        Solo
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_ACCOUNT_MENU_EVENT))}
      title={`Alerts: ${statusLabel} - tap to change`}
      className={`flex shrink-0 items-center gap-1.5 rounded-cell border px-2 py-1.5 text-[11px] font-medium transition hover:brightness-110 ${meta.tone}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {!isMuted && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: meta.dot }} />
        )}
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} />
      </span>
      {statusLabel}
    </button>
  );
}
