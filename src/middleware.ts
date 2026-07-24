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
/**
 * Paths reachable without signing in.
 *
 * /support and /terms were added 2026-07-20. Their absence here was the real defect: the
 * pages could have existed and still been unreachable, because middleware redirected every
 * non-public path to /welcome. Externally that looked like a 307 to a 186KB page that was
 * byte-identical to a nonsense path, so any status-code check reported "200, healthy".
 *
 * These three MUST stay public. App Store Connect requires a support URL and a privacy
 * policy URL, and a reviewer opens both without an account. A legal page behind a login is
 * the same as no legal page.
 */
// /whats-new is public on purpose: the changelog and the no-account community Ideas board
// live there - walling them behind sign-in would contradict "post and vote without an account".
const PUBLIC_PREFIXES = ['/auth', '/api/auth', '/welcome', '/privacy', '/support', '/terms', '/whats-new'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Demo mode - no auth. A first-time visitor lands on the public marketing
    // page (/welcome) rather than being dropped straight into onboarding; its
    // "Set up my console" CTA carries them into /onboarding. Onboarding is still
    // mandatory before the app proper unlocks - completion is persisted in a
    // cookie the onboarding flow sets (demo has no Supabase metadata).
    const { pathname } = request.nextUrl;
    const isPublic =
      PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
      pathname.startsWith('/api');
    const onboarded = request.cookies.get('lyra_onboarded')?.value === '1';
    if (!onboarded && !isPublic && !pathname.startsWith('/onboarding')) {
      return NextResponse.redirect(new URL('/welcome', request.url));
    }
    return response;
  }

  const { pathname } = request.nextUrl;
  const isPublic =
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    pathname.startsWith('/api'); // API routes enforce their own auth (401)

  // Resolve the session, but NEVER let a Supabase/edge hiccup crash the middleware. Before this
  // guard, `getUser()` throwing (auth service blip, edge fetch failure, malformed env at the edge)
  // returned MIDDLEWARE_INVOCATION_FAILED - a 500 on EVERY route, a total site outage from one
  // failed network call. A gate is not allowed to take down the whole app. On any failure we
  // FAIL SAFE: API/public paths pass through (they enforce their own auth), and app pages are
  // treated as signed-out - redirected to the public landing, never served, never 500.
  let user: { user_metadata?: Record<string, unknown> } | null = null;
  try {
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
    user = data.user;
  } catch {
    // Auth unavailable. Public/API through; app pages fail closed to /welcome (a demo-tour
    // cookie still gets the read-only tour, matching the signed-out branch below).
    if (isPublic || request.cookies.get('lyra_demo')?.value === '1') return response;
    return NextResponse.redirect(new URL('/welcome', request.url));
  }

  if (!user && !isPublic) {
    // Read-only demo tour (set by /api/demo): doctrine says a visitor sees the product
    // BEFORE signing up. Reads work via the anon key's read-only RLS; every write API
    // still requires a session, so the tour cannot touch data.
    if (request.cookies.get('lyra_demo')?.value === '1') {
      return response;
    }
    // Send signed-out visitors to the public marketing landing (which links to sign in /
    // sign up) rather than straight to the login form.
    const landingUrl = new URL('/welcome', request.url);
    return NextResponse.redirect(landingUrl);
  }

  // Mandatory onboarding: a signed-in user who hasn't finished onboarding is funnelled
  // into it and cannot reach the rest of the app until done. The flag lives on the
  // user's metadata (set when onboarding completes) and is read from the session here,
  // so there is no extra DB query per request.
  const onboarded = Boolean(user?.user_metadata?.onboarded);
  if (user && !onboarded && !isPublic && !pathname.startsWith('/onboarding')) {
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
