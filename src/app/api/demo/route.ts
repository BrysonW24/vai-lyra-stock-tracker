import { NextResponse } from 'next/server';

/**
 * "Explore the demo first" entry for CONFIGURED deployments. Doctrine says a new user must
 * see the full product BEFORE signing up, but with Supabase configured the middleware walls
 * every product route behind auth - a cold visitor only ever saw the marketing page. This
 * sets the read-only demo cookie the middleware honours and takes the visitor through the
 * FULL onboarding journey (reveal -> primer -> questionnaire) before the console - the demo
 * used to skip straight to the command centre, which sold none of the experience. Onboarding
 * runs session-less in demo: cloud saves are skipped, everything persists locally, and
 * completion sets lyra_onboarded. Read-only stays enforced where it always was: every write
 * API requires a session (401) and the UI degrades those gracefully.
 */
export async function GET(request: Request) {
  // A returning demo visitor who already finished the tour goes straight to the console -
  // re-running the questionnaire on every "Explore the demo" tap would punish curiosity.
  // Keyed on lyra_demo_toured, which ONLY the onboarding completion sets. The pre-v0.67 demo
  // route stamped lyra_onboarded on entry, so every earlier demo visitor carries a false
  // "already toured" signal - keying on that would silently skip the journey for all of them.
  const toured = /(?:^|;\s*)lyra_demo_toured=1(?:;|$)/.test(request.headers.get('cookie') ?? '');
  const response = NextResponse.redirect(new URL(toured ? '/' : '/onboarding', request.url));
  response.cookies.set('lyra_demo', '1', { path: '/', maxAge: 60 * 60 * 24 * 7, sameSite: 'lax' });
  return response;
}
