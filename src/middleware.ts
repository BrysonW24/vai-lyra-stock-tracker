import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Refreshes the Supabase auth session on every request, and gates the app behind
 * sign-in when Supabase is configured: an unauthenticated visitor is redirected to
 * /auth/login. When Supabase isn't configured the app stays in open demo mode (no auth).
 *
 * Public paths (auth screens, the auth API callbacks) are always allowed through so a
 * signed-out user can actually reach the login/sign-up flow.
 */
const PUBLIC_PREFIXES = ['/auth', '/api/auth', '/welcome', '/privacy'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Demo mode - no auth, but onboarding is still mandatory on every route. A
    // visitor who lands on any app route (e.g. straight after a demo "sign in")
    // is funnelled into onboarding until it is finished. Completion is persisted
    // in a cookie the onboarding flow sets (demo has no Supabase metadata).
    const { pathname } = request.nextUrl;
    const isPublic =
      PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
      pathname.startsWith('/api');
    const onboarded = request.cookies.get('lyra_onboarded')?.value === '1';
    if (!onboarded && !isPublic && !pathname.startsWith('/onboarding')) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  const isPublic =
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    pathname.startsWith('/api'); // API routes enforce their own auth (401)

  if (!data.user && !isPublic) {
    // Send signed-out visitors to the public marketing landing (which links to sign in /
    // sign up) rather than straight to the login form.
    const landingUrl = new URL('/welcome', request.url);
    return NextResponse.redirect(landingUrl);
  }

  // Mandatory onboarding: a signed-in user who hasn't finished onboarding is funnelled
  // into it and cannot reach the rest of the app until done. The flag lives on the
  // user's metadata (set when onboarding completes) and is read from the session here,
  // so there is no extra DB query per request.
  const onboarded = Boolean(data.user?.user_metadata?.onboarded);
  if (data.user && !onboarded && !isPublic && !pathname.startsWith('/onboarding')) {
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
