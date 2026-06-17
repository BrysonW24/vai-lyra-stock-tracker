import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface UnsubscribeBody {
  endpoint?: string;
  subscription?: { endpoint?: string };
}

const demoResponse = () =>
  NextResponse.json({ ok: false, demo: true, error: 'Supabase not configured - push subscription not updated.' }, { status: 200 });

const unauthenticated = () =>
  NextResponse.json({ ok: false, error: 'Sign in to disable push notifications.' }, { status: 401 });

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return demoResponse();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return unauthenticated();

    const body = (await request.json().catch(() => ({}))) as UnsubscribeBody;
    const endpoint = body.endpoint || body.subscription?.endpoint;

    let query = supabase
      .from('push_subscriptions')
      .update({
        is_active: false,
        disabled_at: new Date().toISOString(),
        disabled_reason: 'user unsubscribed',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (endpoint) query = query.eq('endpoint', endpoint);

    const { error } = await query;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message || 'Failed to disable push subscription.' }, { status: 400 });
    }

    await supabase
      .from('user_alert_preferences')
      .upsert({ user_id: user.id, push_enabled: false, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
