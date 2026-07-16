import { NextResponse } from 'next/server';
import { summariseQuestionSignals } from '@/lib/ai/question-signals';
import { inMemoryAiRunStore } from '@/lib/ai/audit';
import { getSessionUser } from '@/lib/supabase/server';

/**
 * Founder-facing AI insight: the "Listening layer" demand snapshot (what users are asking - top
 * symbols, categories, recent questions) plus an audit-run health summary (status mix, latency).
 * This is the data source for roadmap recommendations and future app reconfiguration. In-memory
 * per server process today; Supabase-backed when configured. Not for end users.
 *
 * Gated to FOUNDERS, not just any signed-in user: this aggregates OTHER users' verbatim
 * question text (their tickers, positions, intent), so authentication alone is not enough -
 * it needs authorization. Set FOUNDER_EMAILS (comma-separated) to the accounts allowed to see
 * it; with none set the route fails closed in a configured deploy. In demo mode (no Supabase)
 * there are no other users, so it stays open.
 */
function founderAllowlist(): string[] {
  return (process.env.FOUNDER_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function GET() {
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
  if (supabaseConfigured) {
    const user = await getSessionUser().catch(() => null);
    if (!user) return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
    // Authorization: only founders may read cross-tenant question text. Fail closed when the
    // allowlist is unset so a data leak can never be the default in a live deploy.
    const allow = founderAllowlist();
    const email = user.email?.toLowerCase();
    if (!email || !allow.includes(email)) {
      return NextResponse.json({ ok: false, reason: 'forbidden' }, { status: 403 });
    }
  }

  const questions = summariseQuestionSignals();
  const runs = inMemoryAiRunStore.list();
  const okRuns = runs.filter((r) => r.status === 'ok');
  const avgLatencyMs = okRuns.length
    ? Math.round(okRuns.reduce((sum, r) => sum + (r.latencyMs ?? 0), 0) / okRuns.length)
    : null;
  const byStatus = runs.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    questions,
    runs: { total: runs.length, byStatus, avgLatencyMs },
  });
}
