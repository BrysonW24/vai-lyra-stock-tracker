import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isAllowedPushEndpoint } from '@/lib/push/server';

interface SubscribeBody {
  subscription?: {
    endpoint?: string;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };
  platform?: string;
}

const demoResponse = () =>
  NextResponse.json({ ok: false, demo: true, error: 'Supabase not configured - push subscription not saved.' }, { status: 200 });

const unauthenticated = () =>
  NextResponse.json({ ok: false, error: 'Sign in to enable push notifications.' }, { status: 401 });

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return demoResponse();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return unauthenticated();

    const body = (await request.json()) as SubscribeBody;
    const endpoint = body.subscription?.endpoint?.trim();
    const p256dh = body.subscription?.keys?.p256dh?.trim();
    const auth = body.subscription?.keys?.auth?.trim();

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ ok: false, error: 'Invalid push subscription payload.' }, { status: 400 });
    }

    // SSRF fence: only persist endpoints on a real push service (https). Without this a
    // caller could store an internal URL and make the server POST to it on every dispatch.
    if (!isAllowedPushEndpoint(endpoint)) {
      return NextResponse.json({ ok: false, error: 'Push endpoint is not a recognised push service.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh,
          auth,
          user_agent: request.headers.get('user-agent'),
          platform: body.platform ?? null,
          is_active: true,
          failure_count: 0,
          disabled_at: null,
          disabled_reason: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,endpoint' },
      )
      .select('id, endpoint, created_at, updated_at')
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message || 'Failed to save push subscription.' }, { status: 400 });
    }

    await supabase
      .from('user_alert_preferences')
      .upsert({ user_id: user.id, push_enabled: true, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
