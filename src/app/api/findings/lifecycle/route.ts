import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Finding lifecycle writes - promote (set state) or dismiss a projected finding. [Phase 4a]
 * Backed by the set_finding_lifecycle RPC (migration 028), RLS-scoped to the signed-in user. The
 * finding_key is the notification_events.id the finding was projected from. Research-only states.
 */

const VALID_STATES = new Set([
  'Monitor',
  'Watchlist candidate',
  'Deep research candidate',
  'Paper-bot research queue',
  'Review risk',
]);

interface LifecycleRequest {
  findingKey: string;
  state?: string;
  dismiss?: boolean;
  type?: string;
  symbol?: string;
  theme?: string;
  score?: number;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return NextResponse.json({ ok: false, demo: true, error: 'Supabase not configured.' });

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return NextResponse.json({ ok: false, error: 'Sign in to update findings.' }, { status: 401 });

    const body = (await request.json()) as LifecycleRequest;
    if (!body.findingKey) return NextResponse.json({ ok: false, error: 'Missing finding key.' }, { status: 400 });
    if (body.state && !VALID_STATES.has(body.state)) {
      return NextResponse.json({ ok: false, error: 'Unknown finding state.' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('set_finding_lifecycle', {
      p_finding_key: body.findingKey,
      p_state: body.state ?? null,
      p_dismiss: body.dismiss ?? false,
      p_type: body.type ?? null,
      p_symbol: body.symbol ?? null,
      p_theme: body.theme ?? null,
      p_score: typeof body.score === 'number' ? body.score : null,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
