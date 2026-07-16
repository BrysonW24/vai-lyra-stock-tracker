import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const EVENTS = new Set(['onboarding_started', 'path_chosen', 'step_completed', 'onboarding_finished']);

/**
 * Activation telemetry intake - the measurement the funnel never had. Fire-and-forget from
 * the client; a closed slug vocabulary and no free text, so nothing sensitive can land here.
 * Demo mode (no Supabase) is a clean no-op - demo journeys are not tracked anywhere.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { event?: string; step?: number; path?: string };
    if (!body.event || !EVENTS.has(body.event)) {
      return NextResponse.json({ ok: false, error: 'Unknown event.' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) return NextResponse.json({ ok: true, demo: true });
    const { data } = await supabase.auth.getUser();
    if (!data.user) return NextResponse.json({ ok: true, anonymous: true });

    await supabase.from('activation_events').insert({
      user_id: data.user.id,
      event: body.event,
      step: Number.isFinite(body.step) ? body.step : null,
      path: typeof body.path === 'string' ? body.path.slice(0, 40) : null,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 }); // telemetry must never error a client
  }
}
