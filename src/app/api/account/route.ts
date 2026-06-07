import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Account profile & settings API. Uses the cookie-aware (RLS-enforced) Supabase client
 * and the signed-in user - NOT the service role - so a user can only ever write/update
 * their own rows. Falls back to a demo response when Supabase isn't configured.
 */

interface AccountRequest {
  displayName?: string;
  email?: string;
  baseCurrency?: string;
  timezone?: string;
  theme?: string;
  defaultTimeframe?: string;
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
  NextResponse.json({ ok: false, error: 'Sign in to save your account settings.' }, { status: 401 });

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return demoResponse();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return unauthenticated();

    const body = (await request.json()) as AccountRequest;

    // Upsert into profiles table (display_name, email, base_currency, timezone).
    // In PostgreSQL, upsert syntax is ON CONFLICT ... DO UPDATE.
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

    // Upsert into user_settings table (theme, default_timeframe, etc.).
    const { error: settingsError } = await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: user.id,
          theme: body.theme || 'dark',
          default_timeframe: body.defaultTimeframe || '1h',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

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
