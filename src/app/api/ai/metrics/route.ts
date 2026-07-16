import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/supabase/server';
import { inMemoryAiRunStore } from '@/lib/ai/audit';
import { aggregateAiRuns } from '@/lib/ai/metrics';
import { providerBreakerStatus } from '@/lib/ai/gateway';
import { RECOVERY_MODEL_META } from '@/lib/ml/recovery-probability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * AI operational metrics - the observability readout over the audit trail. Aggregates this process's
 * AiRunRecords (throughput, latency percentiles, refusal / guardrail-block / error rates, per-agent
 * and per-provider breakdown) and surfaces the resilience config (circuit breaker state) and the ML
 * model card. Auth-gated: it exposes no secrets and no user prompts (hashes only), but it is an
 * operator view, so it requires a signed-in user.
 *
 * Note: reads THIS process's in-memory audit store; cross-instance aggregation reads the ai_runs
 * table (migration 019) - a documented next step, not faked here.
 */
export async function GET() {
  const user = await getSessionUser().catch(() => null);
  if (!user) return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });

  const report = aggregateAiRuns(inMemoryAiRunStore.list());
  return NextResponse.json({
    ok: true,
    scope: 'process',
    report,
    resilience: {
      breakers: providerBreakerStatus(),
      config: { backpressureMaxConcurrent: 6, retryMaxAttempts: 3, attemptTimeoutMs: 30_000 },
    },
    model: RECOVERY_MODEL_META,
  });
}
