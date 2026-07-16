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
