import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { safeInternalPath } from '@/lib/auth/safe-redirect';

/**
 * Exchanges the email-confirmation / OAuth code for a session, then redirects in.
 * Failures redirect to the login form WITH a reason - the old behavior swallowed the
 * exchange error and bounced an expired/re-used link to /welcome with no explanation,
 * the single most confusing dead end in the funnel.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeInternalPath(searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(`${origin}${next}`); // demo mode - nothing to exchange
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/auth/login?error=confirm_failed`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
