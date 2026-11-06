/**
 * One way to get a completion, whoever is paying for it.
 *
 * A route resolves the caller's credentials (src/lib/ai/credentials.ts) and hands them here. There
 * are three kinds, and each has its own fence:
 *   * the caller's OWN key - their quota, their model, retried on a rate limit;
 *   * Lyra's hosted key - the house budget is charged first, and a 429 is never retried into;
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

export type Answer =
  | { ok: true; text: string; provider: AiProvider; model: string; usage: TokenUsage | null; costUsd: number | null }
  | { ok: false; reason: AiFailureReason; provider: AiProvider; model: string };

/** Never throws: a failure is a reason the UI already knows how to explain. */
export async function answerWith(creds: ResolvedAiCredentials, identity: string, request: AnswerRequest): Promise<Answer> {
  if (creds.source === 'none') return { ok: false, reason: 'no_key', provider: creds.provider, model: 'n/a' };

  if (creds.source === 'free_pool') {
    const caps = await chargeFreeCaps(identity);
    if (!caps.ok) return { ok: false, reason: caps.reason, provider: creds.provider, model: 'n/a' };
    const outcome = await completeFromPool({ system: request.system, prompt: request.prompt, maxTokens: request.maxTokens });
    if (!outcome.ok) return { ok: false, reason: outcome.reason, provider: creds.provider, model: 'n/a' };
    const { text, provider, model, usage, costUsd } = outcome.result;
    return { ok: true, text, provider, model, usage, costUsd };
  }

  const model = resolveModel(creds.provider, creds.model);
  if (creds.source !== 'user') {
    const budget = await chargeHostedBudgetShared(creds.source, request.budgetTokens);
    if (budget.decision === 'block') return { ok: false, reason: 'budget', provider: creds.provider, model };
  }
  try {
    const result = await complete({
      provider: creds.provider,
      apiKey: creds.apiKey,
      model: creds.model,
      system: request.system,
      prompt: request.prompt,
      maxTokens: request.maxTokens,
      retryOn429: creds.source === 'user',
    });
    if (!result.text) return { ok: false, reason: 'empty_response', provider: creds.provider, model: result.model };
    return { ok: true, text: result.text, provider: result.provider, model: result.model, usage: result.usage, costUsd: result.costUsd };
  } catch (error) {
    return { ok: false, reason: classifyAiFailure(error), provider: creds.provider, model };
  }
}
