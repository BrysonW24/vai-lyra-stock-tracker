/**
 * Hosted-key budget tracker - the production caller evaluateProviderBudget was missing. BYOK
 * requests spend the user's own key and are never budgeted here; requests riding the HOSTED or
 * SHARED server key are metered per rolling UTC day (plus a per-run ceiling) so an authenticated
 * caller cannot run the house key unbounded. In-process accounting, same documented tradeoff as
 * the rate limiter: per-instance on serverless, exact on a single-process deploy, and the
 * per-user rate limit still applies underneath either way.
 *
 * Ceilings are env-tunable and default deliberately generous (they are a runaway backstop, not a
 * quota): LYRA_HOSTED_TOKENS_PER_RUN (default 2000), LYRA_HOSTED_TOKENS_PER_DAY (default 250000).
 */
import { evaluateProviderBudget, type BudgetVerdict } from '@/lib/ai/budget';

const DEFAULT_PER_RUN = 2_000;
const DEFAULT_PER_DAY = 250_000;

const spentByKey = new Map<string, number>();

function intEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function dayKey(source: string, now: Date): string {
  return `${source}:${now.toISOString().slice(0, 10)}`;
}

/**
 * Gate one hosted-key completion estimated at `estimatedTokens`. Allow/warn verdicts record the
 * spend; block does not. Callers turn a block into `{ ok:false, reason:'budget' }`.
 */
export function chargeHostedBudget(source: string, estimatedTokens: number, now: Date = new Date()): BudgetVerdict {
  const key = dayKey(source, now);
  // Drop yesterday's counters so the map never grows past one key per source.
  for (const existing of spentByKey.keys()) {
    if (existing.startsWith(`${source}:`) && existing !== key) spentByKey.delete(existing);
  }

  const verdict = evaluateProviderBudget(
    { perRun: intEnv('LYRA_HOSTED_TOKENS_PER_RUN', DEFAULT_PER_RUN), perDay: intEnv('LYRA_HOSTED_TOKENS_PER_DAY', DEFAULT_PER_DAY) },
    estimatedTokens,
    { day: spentByKey.get(key) ?? 0 },
  );
  if (verdict.decision !== 'block') {
    spentByKey.set(key, (spentByKey.get(key) ?? 0) + estimatedTokens);
  }
  return verdict;
}

/** Test hook - budget state is process-global by design. */
export function resetHostedBudgetForTests(): void {
  spentByKey.clear();
}

/**
 * SHARED (Upstash) hosted-key budget - the production-correct version. The in-memory
 * chargeHostedBudget above is per-lambda on Vercel, so the day ceiling reset on every cold
 * instance and the backstop was mostly decorative. This keeps ONE day counter in Redis so the
 * ceiling holds across instances, and falls back to the in-memory tracker only when Upstash is
 * unconfigured (local/demo) - never fails a call open on a Redis hiccup.
 *
 * The per-run ceiling is checked first (pure, no I/O) so an oversized single call is blocked
 * without touching the counter. The day charge is an atomic INCRBY; if it breaches the ceiling
 * the increment is rolled back so a blocked call is never counted (matching the sync contract).
 */
export async function chargeHostedBudgetShared(
  source: string,
  estimatedTokens: number,
  now: Date = new Date(),
): Promise<BudgetVerdict> {
  const perRun = intEnv('LYRA_HOSTED_TOKENS_PER_RUN', DEFAULT_PER_RUN);
  const perDay = intEnv('LYRA_HOSTED_TOKENS_PER_DAY', DEFAULT_PER_DAY);

  // Per-run ceiling: block before spending anything (never charge a call we reject).
  if (!Number.isFinite(estimatedTokens) || estimatedTokens < 0 || estimatedTokens > perRun) {
    return { decision: 'block', window: 'run', reason: 'per-run ceiling exceeded' };
  }

  let upstashCommand: (cmd: (string | number)[]) => Promise<unknown | null>;
  try {
    ({ upstashCommand } = await import('@/lib/cache'));
  } catch {
    return chargeHostedBudget(source, estimatedTokens, now);
  }

  const key = `budget:${dayKey(source, now)}`;
  let newTotal: number | null;
  try {
    const raw = await upstashCommand(['INCRBY', key, estimatedTokens]);
    newTotal = raw === null ? null : Number(raw);
  } catch {
    newTotal = null;
  }

  // Upstash not configured (or errored): fall back to the exact in-memory accounting.
  if (newTotal === null || !Number.isFinite(newTotal)) {
    return chargeHostedBudget(source, estimatedTokens, now);
  }

  // Expire the counter well after the UTC day so yesterday's key self-cleans (2 days of slack).
  await upstashCommand(['EXPIRE', key, 172_800]).catch(() => null);

  if (newTotal > perDay) {
    // Roll back the increment so a blocked call is not counted against the day.
    await upstashCommand(['INCRBY', key, -estimatedTokens]).catch(() => null);
    return { decision: 'block', window: 'day', reason: 'day ceiling exceeded', utilisation: newTotal / perDay };
  }

  const utilisation = newTotal / perDay;
  return utilisation >= 0.8
    ? { decision: 'warn', window: 'day', utilisation }
    : { decision: 'allow', utilisation };
}
