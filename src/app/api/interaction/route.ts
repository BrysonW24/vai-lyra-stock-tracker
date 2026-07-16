import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Attention-capture ingest for the digital trading twin (Phase 0). Fire-and-forget: it ALWAYS
 * returns 200 so a capture never disrupts the UI. Two gates before anything is written:
 *   1. the caller must be signed in (RLS owner), and
 *   2. the user must have opted in (user_settings.twin_capture_enabled) - default off.
 * Only a short slug vocabulary + a symbol/slug id + small typed meta are stored. No free text, no PII.
 */

const EVENT_TYPES = new Set([
  'ticker_open',
  'theme_open',
  'convergence_expand',
  'drawer_open',
  'buy_review_shown',
  'notification_open',
  'lifecycle_inspect',
  'session_open',
  'filter_apply',
]);
const ENTITY_TYPES = new Set(['ticker', 'theme', 'convergence', 'signal', 'notification', 'candidate']);

interface InteractionBody {
  eventType?: string;
  entityType?: string;
  entityId?: string;
  path?: string;
  meta?: Record<string, unknown>;
}

const ok = (extra: Record<string, unknown> = {}) => NextResponse.json({ ok: true, ...extra });
const skipped = (reason: string) => NextResponse.json({ ok: false, skipped: reason });

function cleanString(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.length > 0 ? v.slice(0, max) : null;
}

/** Keep meta tiny + typed - no free text, bounded size. */
function cleanMeta(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const json = JSON.stringify(v);
  if (json.length > 512) return null;
  return v as Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as InteractionBody;

    const eventType = typeof body.eventType === 'string' ? body.eventType : '';
    if (!EVENT_TYPES.has(eventType)) return skipped('invalid-event-type');

    const supabase = await createSupabaseServerClient();
    if (!supabase) return skipped('no-supabase');

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return skipped('unauthenticated');

    // Consent gate: opt-in only. A missing/false flag means no capture.
    const { data: settings } = await supabase
      .from('user_settings')
      .select('twin_capture_enabled')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!settings?.twin_capture_enabled) return skipped('capture-disabled');

    const entityType = typeof body.entityType === 'string' && ENTITY_TYPES.has(body.entityType) ? body.entityType : null;

    const { error } = await supabase.from('interaction_events').insert([
      {
        user_id: user.id,
        event_type: eventType,
        entity_type: entityType,
        entity_id: cleanString(body.entityId, 40),
        path: cleanString(body.path, 120),
        meta: cleanMeta(body.meta),
      },
    ]);
    if (error) return skipped('write-failed');

    return ok();
  } catch {
    // Never surface a capture failure to the UI.
    return skipped('error');
  }
}
