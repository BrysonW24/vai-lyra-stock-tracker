/**
 * One way to get a completion, whoever is paying for it.
 *
 * A route resolves the caller's credentials (src/lib/ai/credentials.ts) and hands them here. There
 * are three kinds, and each has its own fence:
 *   * the caller's OWN key - their quota, their model, retried on a rate limit;
 *   * Lyra's hosted key - the house budget is charged first, and a 429 is never retried into. When
 *     the house cannot answer and the route may use the pool, the request moves there;
 *   * the FREE POOL of open models - the per-caller and pool-wide caps are charged first, and the
 *     pool picks the provider (src/lib/ai/free-pool.ts).
 * Every route used to carry its own copy of the first two; the pool made a third, so they live in
 * one place. The answer comes back unguarded - running guardProse on it is still the route's job,
 * because only the route knows what the model was shown.
 */
import { complete, resolveModel, type AiProvider } from '@/lib/ai/gateway';
import type { TokenUsage } from '@/lib/ai/cost';
import { chargeHostedBudgetShared } from '@/lib/ai/budget-tracker';
import { classifyAiFailure, type AiFailureReason } from '@/lib/ai/failures';
import { chargeFreeCaps, completeFromPool } from '@/lib/ai/free-pool';
import type { ResolvedAiCredentials } from '@/lib/ai/credentials';

export interface AnswerRequest {
  system: string;
  prompt: string;
  maxTokens: number;
  /** What to charge the house budget for this call when it rides Lyra's hosted key. */
  budgetTokens: number;
}

/** Which fence produced the outcome: the caller's own key, Lyra's hosted key, or the free pool. */
export type AnswerVia = 'user' | 'hosted' | 'free_pool' | 'none';

export type Answer =
  | { ok: true; text: string; provider: AiProvider; model: string; usage: TokenUsage | null; costUsd: number | null; via: AnswerVia }
  | { ok: false; reason: AiFailureReason; provider: AiProvider; model: string; via: AnswerVia };

/**
 * The house's own reasons for not answering - its budget is spent, its credit has run out, its key
 * is wrong, the provider is refusing or down. None is the caller's doing, so when the route may use
 * the free pool the request goes there instead of failing.
 */
const HOUSE_FAILURES: ReadonlySet<AiFailureReason> = new Set<AiFailureReason>([
  'budget',
  'provider_rate_limited',
  'provider_unavailable',
  'invalid_key',
  'invalid_model',
  'empty_response',
  'error',
]);

async function fromPool(creds: ResolvedAiCredentials, identity: string, request: AnswerRequest): Promise<Answer> {
  const caps = await chargeFreeCaps(identity);
  if (!caps.ok) return { ok: false, reason: caps.reason, provider: creds.provider, model: 'n/a', via: 'free_pool' };
  const outcome = await completeFromPool({ system: request.system, prompt: request.prompt, maxTokens: request.maxTokens });
  if (!outcome.ok) return { ok: false, reason: outcome.reason, provider: creds.provider, model: 'n/a', via: 'free_pool' };
  const { text, provider, model, usage, costUsd } = outcome.result;
  return { ok: true, text, provider, model, usage, costUsd, via: 'free_pool' };
}

/** Never throws: a failure is a reason the UI already knows how to explain. */
export async function answerWith(creds: ResolvedAiCredentials, identity: string, request: AnswerRequest): Promise<Answer> {
  if (creds.source === 'none') return { ok: false, reason: 'no_key', provider: creds.provider, model: 'n/a', via: 'none' };
  if (creds.source === 'free_pool') return fromPool(creds, identity, request);

  const own = creds.source === 'user';
  const via: AnswerVia = own ? 'user' : 'hosted';
  const model = resolveModel(creds.provider, creds.model);
  const failed = (reason: AiFailureReason, usedModel: string = model): Promise<Answer> | Answer =>
    !own && creds.poolFallback && HOUSE_FAILURES.has(reason)
      ? fromPool(creds, identity, request)
      : { ok: false, reason, provider: creds.provider, model: usedModel, via };

  if (!own) {
    const budget = await chargeHostedBudgetShared(creds.source, request.budgetTokens);
    if (budget.decision === 'block') return failed('budget');
  }
  try {
    const result = await complete({
      provider: creds.provider,
      apiKey: creds.apiKey,
      model: creds.model,
      system: request.system,
      prompt: request.prompt,
      maxTokens: request.maxTokens,
      retryOn429: own,
    });
    if (!result.text) return failed('empty_response', result.model);
    return { ok: true, text: result.text, provider: result.provider, model: result.model, usage: result.usage, costUsd: result.costUsd, via };
  } catch (error) {
    return failed(classifyAiFailure(error));
  }
}
