import { createSupabaseServerClient } from '@/lib/supabase/server';
import { findingsFromEvents, type FindingLifecycle, type NotificationEventRow } from './from-events';
import type { Finding } from './types';

/**
 * Server-side live findings.  [Phase 4a]
 *
 * Reads the signed-in user's recent notification_events (RLS-scoped), projects them into Findings via
 * the pure adapter, and applies the lifecycle overlay (dismissed drop out, promoted state wins).
 * Returns [] in demo mode / signed-out / on any error, so the page can fall back to demo findings.
 * Read-only and best-effort: the findings table may not exist on an un-migrated DB - that is tolerated.
 */
export async function getLiveFindings(limit = 50): Promise<Finding[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return [];

    const { data: events, error } = await supabase
      .from('notification_events')
      .select(
        'id, type, severity, title, body, trigger_reason, evidence_refs, symbol, theme, related_entity_type, related_entity_id, relevance_score, url, payload, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !events?.length) return [];

    let lifecycle: FindingLifecycle[] = [];
    const { data: lc } = await supabase.from('findings').select('finding_key, state, dismissed_at');
    if (lc) lifecycle = lc as FindingLifecycle[];

    return findingsFromEvents(events as NotificationEventRow[], lifecycle);
  } catch {
    return [];
  }
}
