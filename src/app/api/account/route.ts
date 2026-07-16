import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Account profile & settings API.
 *
 * - POST   updates the signed-in user's profile + settings (RLS-enforced client, own rows only).
 * - GET    returns everything Lyra holds about the user server-side, in one inspectable object
 *          (the "see what the twin knows about me" read-back the privacy doctrine requires).
 * - DELETE erases the user's server-side account entirely (auth.admin.deleteUser -> on-delete
 *          cascade wipes every user-keyed row). This is the honest backing for the privacy promise;
 *          it can only ever delete the authenticated caller's own account.
 *
 * Doctrine: opt-in, inspectable, deletable (docs/strategy/2026-07-16-digital-trading-twin.md).
 */

interface AccountRequest {
  displayName?: string;
  email?: string;
  baseCurrency?: string;
  timezone?: string;
  theme?: string;
  defaultTimeframe?: string;
  twinCaptureEnabled?: boolean;
}

const demoResponse = () =>
  NextResponse.json(
    {
      ok: false,
      demo: true,
      error: 'Supabase not configured - running in demo mode. Add NEXT_PUBLIC_SUPABASE_URL + anon key to enable persistence.',
    },
    { status: 200 },
  );

const unauthenticated = () =>
  NextResponse.json({ ok: false, error: 'Sign in to manage your account.' }, { status: 401 });

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return demoResponse();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return unauthenticated();

    const body = (await request.json()) as AccountRequest;

    // Upsert into profiles table (display_name, email, base_currency, timezone).
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          display_name: body.displayName || null,
          email: body.email || null,
          base_currency: body.baseCurrency || 'USD',
          timezone: body.timezone || 'UTC',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );

    if (profileError) {
      return NextResponse.json(
        { ok: false, error: `Failed to save profile: ${profileError.message}` },
        { status: 400 },
      );
    }

    // Upsert into user_settings table (theme, default_timeframe, twin capture opt-in).
    // twin_capture_enabled is only written when the caller explicitly sends it, so a plain
    // profile save never silently flips a privacy switch.
    const settingsRow: Record<string, unknown> = {
      user_id: user.id,
      theme: body.theme || 'dark',
      default_timeframe: body.defaultTimeframe || '1h',
      updated_at: new Date().toISOString(),
    };
    if (typeof body.twinCaptureEnabled === 'boolean') {
      settingsRow.twin_capture_enabled = body.twinCaptureEnabled;
    }

    const { error: settingsError } = await supabase
      .from('user_settings')
      .upsert(settingsRow, { onConflict: 'user_id' });

    if (settingsError) {
      return NextResponse.json(
        { ok: false, error: `Failed to save settings: ${settingsError.message}` },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

/**
 * Inspect read-back: return, under RLS, everything Lyra stores about the signed-in user across the
 * stated-preference tables. This is the "you can see what we hold" half of the privacy contract.
 */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return demoResponse();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return unauthenticated();

    const [profile, settings, operator] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('operator_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    ]);

    return NextResponse.json({
      ok: true,
      account: {
        userId: user.id,
        email: user.email ?? null,
        profile: profile.data ?? null,
        settings: settings.data ?? null,
        operatorProfile: operator.data ?? null,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

/**
 * Erase the authenticated user's server-side account. Deletes the auth.users row via the service
 * role; the on-delete cascade from profiles/auth.users through every user-keyed table (paper
 * trades, watchlist, onboarding, settings, ...) removes all of it. Only ever deletes the caller's
 * own id - the id comes from the verified session, never from the request body.
 */
export async function DELETE() {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return demoResponse();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return unauthenticated();

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: 'Server-side deletion is not available (service role not configured).' },
        { status: 503 },
      );
    }

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      return NextResponse.json(
        { ok: false, error: `Failed to delete account: ${error.message}` },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, deleted: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
