import { NextResponse } from 'next/server';

/**
 * "Explore the demo first" entry for CONFIGURED deployments. Doctrine says a new user must
 * see the full product BEFORE signing up, but with Supabase configured the middleware walls
 * every product route behind auth - a cold visitor only ever saw the marketing page. This
 * sets the read-only demo cookie the middleware honours and drops the visitor into the
 * console. Read-only is enforced where it always was: every write API requires a session
 * (401) and the UI already degrades those to demo behavior gracefully.
 */
export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL('/', request.url));
  response.cookies.set('lyra_demo', '1', { path: '/', maxAge: 60 * 60 * 24 * 7, sameSite: 'lax' });
  // The demo tour skips the mandatory-onboarding gate - onboarding is for account setup.
  response.cookies.set('lyra_onboarded', '1', { path: '/', maxAge: 60 * 60 * 24 * 7, sameSite: 'lax' });
  return response;
}
