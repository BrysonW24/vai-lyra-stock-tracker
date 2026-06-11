'use client';

import { ALERT_MODES, useAlertPrefs } from '@/lib/alert-prefs';

/**
 * Read-only header badge that shows the current alert mode and its colour (Live green,
 * Quiet blue, Muted red, Custom purple) so you can see at a glance that alerts are live.
 * The controls to change it live in the account (gecko) menu, where people actually click.
 */
export function AlertStatusBadge() {
  const { activeMode, statusLabel, isMuted } = useAlertPrefs();
  const meta = ALERT_MODES.find((m) => m.value === activeMode) ?? ALERT_MODES[0];

  return (
    <span
      title={`Alerts: ${statusLabel} - change in the account menu`}
      className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1.5 font-mono text-[11px] ${meta.tone}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {!isMuted && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: meta.dot }} />
        )}
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} />
      </span>
      {statusLabel}
    </span>
  );
}
