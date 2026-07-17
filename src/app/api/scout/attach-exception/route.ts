import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { rateLimitShared } from '@/lib/ratelimit';
import { clientIp } from '@/lib/api/ai-guard';

/**
 * Record an attach correction (v3 attach learning): a maintainer rules that `term` must
 * never attach items to `theme` again (the tritium-wastewater-is-not-fusion case). The
 * scout enforces the accumulated exceptions on every future run.
 *
 * RLS is the authority: the insert policy on scout_attach_exceptions requires
 * profiles.role = 'maintainer', so a non-maintainer insert matches the policy's WITH
 * CHECK and fails - this route just translates that refusal to a 403. Usually invoked
 * from the /scout-intel chain (the agent names the offending term); a UI affordance can
 * come later without touching this contract.
 */

export async function POST(request: NextRequest) {
  const rl = await rateLimitShared(`ip:${clientIp(request)}`, { scope: 'attach_exception', capacity: 10, windowMs: 60_000 });
  if (!rl.allowed) return NextResponse.json({ ok: false, error: 'Too many requests.' }, { status: 429 });

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ ok: false, demo: true, error: 'Not available in the demo.' });

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ ok: false, error: 'Sign in required.' }, { status: 401 });

  let body: { theme?: string; term?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
  }
  const theme = (body.theme ?? '').trim().toLowerCase();
  const term = (body.term ?? '').trim().toLowerCase();
  const reason = (body.reason ?? '').trim().slice(0, 500);
  if (!/^[a-z0-9-]{3,60}$/.test(theme)) return NextResponse.json({ ok: false, error: 'theme must be a valid slug.' }, { status: 400 });
  if (term.length < 4 || term.length > 80) return NextResponse.json({ ok: false, error: 'term must be 4-80 characters.' }, { status: 400 });

  const { error } = await supabase.from('scout_attach_exceptions').insert({ theme, term, reason });
  if (error) {
    if (error.code === '23505') return NextResponse.json({ ok: true, existed: true });
    // RLS WITH CHECK failure = not a maintainer.
    if (error.code === '42501' || /row-level security/i.test(error.message || '')) {
      return NextResponse.json({ ok: false, error: 'Maintainer role required.' }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
