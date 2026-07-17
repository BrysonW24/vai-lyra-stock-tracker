/**
 * AI token usage + cost model. [AI-11]
 *
 * Two pure, deterministic pieces that turn a provider response into an auditable cost:
 *
 *   extractUsage(provider, rawResponse) -> { inputTokens, outputTokens } | null
 *     Reads the usage block each provider returns in ITS OWN shape. Missing/garbage usage
 *     returns null - the honest "we don't know", never a guess. This is what makes the token
 *     counts REAL (straight from the provider), not estimated.
 *
 *   estimateCostUsd(provider, model, usage) -> number | null
 *     Multiplies real token counts by a declared per-model list price. The tokens are measured;
 *     the RATE is a static, dated constant (list prices drift, so this is an ESTIMATE at list
 *     price, clearly labelled as such in the UI). A model with no price rule returns null -
 *     "cost unknown", counted separately so the dashboard's denominator stays honest.
 *
 * No I/O, no network - safe to call in the request path and unit-test directly.
 */
import type { AiProvider } from './gateway';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * Pull the usage block out of a provider's raw JSON response. Each provider names it differently:
 *   anthropic / openai-responses : usage.input_tokens / usage.output_tokens
 *   openrouter / xai (chat)       : usage.prompt_tokens / usage.completion_tokens
 *   google                        : usageMetadata.promptTokenCount / candidatesTokenCount
 * Returns null when the block is absent or non-numeric (older API, streamed omission, error body).
 */
export function extractUsage(provider: AiProvider, raw: unknown): TokenUsage | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;

  const usage = data.usage as Record<string, unknown> | undefined;
  const meta = data.usageMetadata as Record<string, unknown> | undefined;

  const pick = (...vals: unknown[]): number | null => {
    for (const v of vals) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) return n;
    }
    return null;
  };

  let input: number | null = null;
  let output: number | null = null;

  switch (provider) {
    case 'anthropic':
    case 'openai':
      input = pick(usage?.input_tokens);
      output = pick(usage?.output_tokens);
      break;
    case 'openrouter':
    case 'xai':
      input = pick(usage?.prompt_tokens);
      output = pick(usage?.completion_tokens);
      break;
    case 'google':
      input = pick(meta?.promptTokenCount);
      output = pick(meta?.candidatesTokenCount);
      break;
    default: {
      const never: never = provider;
      void never;
      return null;
    }
  }

  if (input === null || output === null) return null;
  return { inputTokens: input, outputTokens: output };
}

/** USD per 1,000,000 tokens. Ordered most-specific first; the first matching rule wins per provider. */
interface PriceRule {
  provider: AiProvider;
  /** Lowercased-model predicate. */
  match: (model: string) => boolean;
  inUsdPerM: number;
  outUsdPerM: number;
}

/**
 * List prices as of 2026-07 (USD / 1M tokens). These are declared constants, not live-fetched - the
 * UI labels every figure "estimated at list price". Update this table when a provider re-prices;
 * an unpriced model surfaces as "cost unknown" rather than a wrong number.
 */
export const PRICING_AS_OF = '2026-07';

const PRICE_RULES: readonly PriceRule[] = [
  // Anthropic - mini/haiku before sonnet before opus so the cheapest match is not shadowed.
  { provider: 'anthropic', match: (m) => m.includes('haiku'), inUsdPerM: 1.0, outUsdPerM: 5.0 },
  { provider: 'anthropic', match: (m) => m.includes('opus'), inUsdPerM: 15.0, outUsdPerM: 75.0 },
  { provider: 'anthropic', match: (m) => m.includes('sonnet'), inUsdPerM: 3.0, outUsdPerM: 15.0 },
  { provider: 'anthropic', match: () => true, inUsdPerM: 3.0, outUsdPerM: 15.0 }, // unknown claude -> sonnet-class

  // OpenAI - mini/nano before the base family.
  { provider: 'openai', match: (m) => m.includes('mini') || m.includes('nano'), inUsdPerM: 0.15, outUsdPerM: 0.6 },
  { provider: 'openai', match: (m) => /gpt-5/.test(m), inUsdPerM: 1.25, outUsdPerM: 10.0 },
  { provider: 'openai', match: (m) => /gpt-4o/.test(m), inUsdPerM: 2.5, outUsdPerM: 10.0 },
  { provider: 'openai', match: () => true, inUsdPerM: 1.25, outUsdPerM: 10.0 },

  // Google Gemini - flash-lite before flash before pro.
  { provider: 'google', match: (m) => m.includes('flash-lite') || m.includes('lite'), inUsdPerM: 0.075, outUsdPerM: 0.3 },
  { provider: 'google', match: (m) => m.includes('flash'), inUsdPerM: 0.15, outUsdPerM: 0.6 },
  { provider: 'google', match: (m) => m.includes('pro'), inUsdPerM: 1.25, outUsdPerM: 5.0 },
  { provider: 'google', match: () => true, inUsdPerM: 0.15, outUsdPerM: 0.6 },

  // OpenRouter is a router across many models; a coarse open-weights default. xAI Grok.
  { provider: 'openrouter', match: () => true, inUsdPerM: 0.4, outUsdPerM: 0.4 },
  { provider: 'xai', match: () => true, inUsdPerM: 2.0, outUsdPerM: 10.0 },
];

/** The list-price rule for a provider+model, or null when nothing matches (cost unknown). */
export function priceFor(provider: AiProvider, model: string): { inUsdPerM: number; outUsdPerM: number } | null {
  const m = (model || '').toLowerCase();
  const rule = PRICE_RULES.find((r) => r.provider === provider && r.match(m));
  return rule ? { inUsdPerM: rule.inUsdPerM, outUsdPerM: rule.outUsdPerM } : null;
}

/**
 * Estimated USD cost of one completion at list price. null when usage is unknown OR the model has
 * no price rule - never a fabricated figure. Rounded to 6dp (sub-cent granularity for tiny calls).
 */
export function estimateCostUsd(provider: AiProvider, model: string, usage: TokenUsage | null): number | null {
  if (!usage) return null;
  const price = priceFor(provider, model);
  if (!price) return null;
  const usd = (usage.inputTokens / 1_000_000) * price.inUsdPerM + (usage.outputTokens / 1_000_000) * price.outUsdPerM;
  return Math.round(usd * 1_000_000) / 1_000_000;
}
