'use client';

import { useEffect } from 'react';

/**
 * Fire-and-forget engagement beacon. Alert deep links carry ?nid=<event>&ch=<channel>;
 * arriving with them means the user ACTED on an alert - the one behavioral signal the
 * notification layer accumulates (notification_engagements). Reads window.location
 * directly (no useSearchParams) so it needs no Suspense boundary and never blocks
 * render; strips the params from the URL after sending so refreshes do not re-fire
 * (the unique index would no-op them anyway).
 */
export function NotificationEngagementBeacon() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const nid = params.get('nid');
      if (!nid) return;
      const ch = params.get('ch') ?? 'web';
      void fetch('/api/notifications/engaged', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nid, ch }),
        keepalive: true,
      }).catch(() => {});
      params.delete('nid');
      params.delete('ch');
      const query = params.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    } catch {
      // Never let telemetry break the page.
    }
  }, []);

  return null;
}
