import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { dispatchNotificationEvent } from '@/lib/notifications/dispatch';

const demoResponse = () =>
  NextResponse.json({ ok: false, demo: true, error: 'Supabase not configured - test notification not sent.' }, { status: 200 });

const unauthenticated = () =>
  NextResponse.json({ ok: false, error: 'Sign in to send a test notification.' }, { status: 401 });

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return demoResponse();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return unauthenticated();

    const result = await dispatchNotificationEvent(supabase, {
      userId: user.id,
      type: 'test_notification',
      severity: 'low',
      title: 'Lyra test alert',
      body: 'Push notifications are connected.',
      triggerReason: 'You tapped Send test notification.',
      relevanceScore: 100,
      url: '/account',
      dedupeKey: `test_notification:${user.id}:${Date.now()}`,
      payload: { source: 'push_test' },
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
