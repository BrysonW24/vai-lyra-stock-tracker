/**
 * Client-side attention capture for the trading twin. Fire-and-forget POST to /api/interaction,
 * deduped per page load so a re-render does not double-count. The server enforces auth + the
 * opt-in consent gate; this helper never blocks or surfaces errors. No-op during SSR.
 */
export interface InteractionEvent {
  eventType:
    | 'ticker_open'
    | 'theme_open'
    | 'convergence_expand'
    | 'drawer_open'
    | 'buy_review_shown'
    | 'notification_open'
    | 'lifecycle_inspect'
    | 'session_open'
    | 'filter_apply';
  entityType?: 'ticker' | 'theme' | 'convergence' | 'signal' | 'notification' | 'candidate';
  entityId?: string;
  meta?: Record<string, unknown>;
}

const seen = new Set<string>();

export function captureInteraction(ev: InteractionEvent): void {
  if (typeof window === 'undefined') return;
  const key = `${ev.eventType}:${ev.entityType ?? ''}:${ev.entityId ?? ''}`;
  if (seen.has(key)) return;
  seen.add(key);
  try {
    const body = JSON.stringify({ ...ev, path: window.location?.pathname });
    // keepalive lets the beacon survive an immediate navigation. Errors are intentionally swallowed.
    void fetch('/api/interaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* never let capture break the UI */
  }
}
