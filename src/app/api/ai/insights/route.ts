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
 * Gated: this aggregates other users' question text, so it requires an authenticated session
 * (never anonymous). In demo mode (no Supabase) there are no other users, so it stays open.
 */
export async function GET() {
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
  if (supabaseConfigured) {
    const user = await getSessionUser().catch(() => null);
    if (!user) return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
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
