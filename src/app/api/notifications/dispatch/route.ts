import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { dispatchNotificationEvent, sweepNotifications, type DispatchNotificationInput } from '@/lib/notifications/dispatch';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';
import { isNotificationType } from '@/lib/notifications/types';

/**
 * Derived from the roster in types.ts, never hand-maintained. The previous hand-written Set
 * silently fell out of sync the moment new types were added (the periodic reviews were
 * rejected here as "type is invalid" while every renderer already supported them) because
 * a Set cannot be exhaustiveness-checked. The roster is a Record, so it can.
 */
const isValidType = isNotificationType;

function validateBody(body: Partial<DispatchNotificationInput>): string | null {
  if (!body.userId) return 'userId is required.';
  if (!isValidType(body.type)) return 'type is invalid.';
  if (!body.title?.trim()) return 'title is required.';
  if (!body.body?.trim()) return 'body is required.';
  return null;
}

/** Constant-time secret comparison - same standard the webhook routes already hold. */
function secretMatches(configured: string | undefined, supplied: string | null | undefined): boolean {
  if (!configured || !supplied) return false;
  const configuredBuffer = Buffer.from(configured);
  const suppliedBuffer = Buffer.from(supplied);
  if (configuredBuffer.length !== suppliedBuffer.length) return false;
  return timingSafeEqual(configuredBuffer, suppliedBuffer);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<DispatchNotificationInput> & { sweep?: boolean };

    const configuredSecret = process.env.NOTIFICATION_DISPATCH_SECRET;
    const suppliedSecret = request.headers.get('x-notification-secret') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const serviceAllowed = secretMatches(configuredSecret, suppliedSecret);

    // Maintenance sweep (service-only): release held events for every user and retry-once
    // recent failed chat deliveries. Scheduled by the nightly-maintenance workflow.
    if (body.sweep === true) {
      if (!serviceAllowed) {
        return NextResponse.json({ ok: false, error: 'Sweep requires the dispatch secret.' }, { status: 401 });
      }
      const serviceClient = createSupabaseServiceClient();
      if (!serviceClient) return NextResponse.json({ ok: false, error: 'Service Supabase client is not configured.' }, { status: 500 });
      const sweep = await sweepNotifications(serviceClient);
      return NextResponse.json({ ok: sweep.errors.length === 0, ...sweep });
    }

    const validationError = validateBody(body);
    if (validationError) return NextResponse.json({ ok: false, error: validationError }, { status: 400 });

    if (serviceAllowed) {
      const serviceClient = createSupabaseServiceClient();
      if (!serviceClient) return NextResponse.json({ ok: false, error: 'Service Supabase client is not configured.' }, { status: 500 });
      const result = await dispatchNotificationEvent(serviceClient, body as DispatchNotificationInput);
      return NextResponse.json(result);
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) return NextResponse.json({ ok: false, demo: true, error: 'Supabase not configured.' }, { status: 200 });

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Sign in to dispatch notifications.' }, { status: 401 });
    if (body.userId !== user.id) {
      return NextResponse.json({ ok: false, error: 'Cannot dispatch notifications for another user.' }, { status: 403 });
    }

    const result = await dispatchNotificationEvent(supabase, body as DispatchNotificationInput);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
