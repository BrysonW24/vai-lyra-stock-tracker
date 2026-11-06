/**
 * Lyra AI Gateway - provider-and-model-agnostic LLM client.  [AI-01]
 *
 * One server-side entry point (`complete`) used by the live AI surfaces: the Daily Brief
 * and the conversational/agent surfaces. Adding a provider or letting a user bring their
 * own model never touches a feature again.
 *
 * NOT YET WIRED: an alert_composer / AI notification-phrasing capability (AI-03/04) is
 * declared in the policy + agent registry but is intentionally NOT connected to the
 * notification layer - notifications are deterministic by design (the deterministic router
 * owns every alert payload). Do not describe this gateway as the notification composer
 * until that surface is actually wired.
 *
 * SECURITY: server-side only. The API key is either BYOK, forwarded from the user's browser
 * to the chosen provider, or a hosted server-side key resolved by the route. It is never logged
 * or persisted. See docs/ai-engine-plan.md.
 */

import { withRetry, defaultIsRetryable, BackpressureLimiter } from '@/lib/ai/resilience';
import { extractUsage, estimateCostUsd, type TokenUsage } from '@/lib/ai/cost';

export type AiProvider = 'anthropic' | 'openai' | 'openrouter' | 'google' | 'xai' | 'groq' | 'cloudflare';

/** One provider round-trip: the text plus the token usage the provider reported (null if omitted). */
interface CompletionRaw {
  text: string;
  usage: TokenUsage | null;
}

export interface AiCompleteParams {
  provider: AiProvider;
  /** BYOK key for the chosen provider. Never logged or persisted. */
  apiKey: string;
  /** Optional - falls back to DEFAULT_MODELS[provider]. Free-text so a user can name any model. */
  model?: string;
  system: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  /**
   * Retry a 429? True (default) for BYOK - it is the user's own quota. Pass false for
   * hosted/shared-key calls: retrying the house key into a provider rate limit amplifies it.
   */
  retryOn429?: boolean;
  /** Attempts at this one provider (default 3). The free pool passes 1: its chain is the retry. */
  maxAttempts?: number;
  /** Wall-clock ceiling for each attempt, in ms (default 30 000). */
  timeoutMs?: number;
  /**
   * Which queue and circuit breaker the call rides. 'pool' keeps the free pool's anonymous traffic
   * apart from everyone else's: its own (smaller) backpressure queue, and a breaker of its own, so a
   * free tier that is refusing requests can neither stall nor trip the circuit for a reader who
   * brought a key for the same provider. Default 'shared'.
   */
  lane?: 'shared' | 'pool';
}

export interface AiCompleteResult {
  text: string;
  provider: AiProvider;
  /** The model actually used (after default resolution) - useful for usage logging (AI-11). */
  model: string;
  /** Token usage the provider reported, or null when it omitted a usage block. Never estimated. */
  usage: TokenUsage | null;
  /** Estimated USD at list price (real tokens x declared rate), or null when tokens/price unknown. */
  costUsd: number | null;
}

/**
 * Turn a provider HTTP status into a message that names the likely cause, so the chat
 * error path can tell a model-not-found (404 - usually a retired/typo'd model id) apart
 * from a bad key (401/403) without re-parsing a bare status code. The provider name and
 * status are still included for logging; no key is ever included.
 */
function describeProviderError(provider: AiProvider, status: number): string {
  if (status === 404) return `${provider} 404: model not found - check the model id (it may be retired or misspelled)`;
  if (status === 401 || status === 403) return `${provider} ${status}: authentication failed - check the API key`;
  if (status === 429) return `${provider} 429: rate limited - wait and retry`;
  return `${provider} ${status}`;
}

/**
 * A provider's refusal, with the two facts the free pool needs to route around it: the status, and
 * how long the provider asked us to wait (its Retry-After, in seconds, when it sent one). The
 * message is the same cause-naming text every other adapter throws, so failure classification is
 * unchanged. The response body is never read into it.
 */
export class ProviderHttpError extends Error {
  constructor(
    public readonly provider: AiProvider,
    public readonly status: number,
    public readonly retryAfterSec: number | null,
  ) {
    super(describeProviderError(provider, status));
    this.name = 'ProviderHttpError';
  }
}

/** Defaults per provider. OpenAI intentionally uses the powerful hosted beta default. */
export const DEFAULT_MODELS: Record<AiProvider, string> = {
  // Current cheap/fast Anthropic default. The old 'claude-3-5-haiku-latest' resolved to
  // the RETIRED claude-3.5-haiku family and hard-failed every BYO-Anthropic request.
  anthropic: 'claude-haiku-4-5',
  openai: 'gpt-5.5',
  openrouter: 'meta-llama/llama-3.1-70b-instruct',
  google: 'gemini-3.1-flash-lite',
  xai: 'grok-2-latest',
  // The free pool's providers (src/lib/ai/free-pool.ts): open-weight models on free hosted tiers.
  groq: 'openai/gpt-oss-120b',
  cloudflare: '@cf/google/gemma-4-26b-a4b-it',
};

/**
 * The providers a USER may choose for their own key - the list the credential resolver checks a
 * client-supplied provider against. Groq and Cloudflare are deliberately not in it: they are
 * reached only through the free pool, with Lyra's own keys, and never by a string from a request.
 */
export const SUPPORTED_PROVIDERS: AiProvider[] = ['anthropic', 'openai', 'openrouter', 'google', 'xai'];

/** Resolve a user-supplied model (which may be blank) to a concrete model id. */
export function resolveModel(provider: AiProvider, model?: string): string {
  const trimmed = model?.trim();
  return trimmed ? trimmed : DEFAULT_MODELS[provider];
}

const DEFAULT_MAX_TOKENS = 300;

// --- provider adapters ------------------------------------------------------

async function callAnthropic(
  apiKey: string,
  model: string,
  system: string,
  prompt: string,
  maxTokens: number,
  temperature?: number,
): Promise<CompletionRaw> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      ...(temperature != null ? { temperature } : {}),
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(describeProviderError('anthropic', res.status));
  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  return { text: data.content?.[0]?.text?.trim() ?? '', usage: extractUsage('anthropic', data) };
}

interface OpenAiResponse {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

function openAiReasoningEffort(): 'none' | 'low' | 'medium' | 'high' | 'xhigh' {
  const effort = process.env.LYRA_OPENAI_REASONING_EFFORT?.trim();
  return effort === 'none' || effort === 'low' || effort === 'medium' || effort === 'high' || effort === 'xhigh'
    ? effort
    : 'low';
}

async function callOpenAiResponses(
  apiKey: string,
  model: string,
  system: string,
  prompt: string,
  maxTokens: number,
  temperature?: number,
): Promise<CompletionRaw> {
  const isGpt5 = /^gpt-5(?:\.|-|$)/i.test(model);
  const body = {
    model,
    instructions: system,
    input: prompt,
    max_output_tokens: maxTokens,
    ...(isGpt5 ? { reasoning: { effort: openAiReasoningEffort() }, text: { verbosity: 'low' } } : {}),
    ...(!isGpt5 && temperature != null ? { temperature } : {}),
  };
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(describeProviderError('openai', res.status));
  const data = (await res.json()) as OpenAiResponse;
  const usage = extractUsage('openai', data);
  const outputText = data.output_text?.trim();
  if (outputText) return { text: outputText, usage };
  const joined =
    data.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? '')
      .join('')
      .trim() ?? '';
  return { text: joined, usage };
}

/**
 * What a reasoning model needs so its thinking neither reaches the reader nor eats the answer's
 * budget (the same fields workers/stock_scanner/open_model.py sends; Groq's docs, read 2026-11-06).
 */
export function reasoningExtras(provider: AiProvider, model: string): Record<string, unknown> | undefined {
  const id = model.toLowerCase();
  if (provider === 'groq') {
    if (id.includes('gpt-oss')) return { reasoning_effort: 'low', include_reasoning: false };
    if (id.startsWith('qwen/')) return { reasoning_effort: 'low', reasoning_format: 'hidden' };
  }
  if (provider === 'cloudflare' && id.includes('gpt-oss')) return { reasoning_effort: 'low' };
  return undefined;
}

/** A model's answer without any reasoning it printed inline. */
export function stripThinking(text: string): string {
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  // An opening tag the server swallowed, the closing one left behind.
  if (/<\/think>/i.test(cleaned)) cleaned = cleaned.replace(/^[\s\S]*?<\/think>/i, '');
  return cleaned.trim();
}

/** A chat message's text: a string, or a list of typed parts whose text parts are joined. */
function messageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string' ? ((part as { text: string }).text) : ''))
    .join('');
}

interface OpenAiCompatibleOptions {
  extraHeaders?: Record<string, string>;
  /** Extra request fields (a reasoning model's effort / visibility controls). */
  extraBody?: Record<string, unknown>;
  /** What the endpoint calls the output ceiling. */
  tokenField?: 'max_tokens' | 'max_completion_tokens';
}

/** OpenRouter, xAI, Groq and Cloudflare Workers AI all speak the OpenAI chat-completions wire format. */
async function callOpenAiCompatible(
  provider: AiProvider,
  endpoint: string,
  apiKey: string,
  model: string,
  system: string,
  prompt: string,
  maxTokens: number,
  temperature: number | undefined,
  options: OpenAiCompatibleOptions = {},
): Promise<CompletionRaw> {
  const post = (extraBody: Record<string, unknown> | undefined) =>
    fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}`, ...(options.extraHeaders ?? {}) },
      body: JSON.stringify({
        model,
        [options.tokenField ?? 'max_tokens']: maxTokens,
        ...(temperature != null ? { temperature } : {}),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        ...(extraBody ?? {}),
      }),
    });
  let res = await post(options.extraBody);
  // An endpoint that does not know a reasoning field refuses the whole request: ask once more plainly.
  if (res.status === 400 && options.extraBody && Object.keys(options.extraBody).length > 0) res = await post(undefined);
  if (!res.ok) {
    const retryAfter = Number(res.headers?.get?.('retry-after'));
    throw new ProviderHttpError(provider, res.status, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return { text: stripThinking(messageText(data?.choices?.[0]?.message?.content)), usage: extractUsage(provider, data) };
}

async function callGoogle(
  apiKey: string,
  model: string,
  system: string,
  prompt: string,
  maxTokens: number,
  temperature?: number,
): Promise<CompletionRaw> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, ...(temperature != null ? { temperature } : {}) },
    }),
  });
  if (!res.ok) throw new Error(describeProviderError('google', res.status));
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim() ?? '';
  return { text, usage: extractUsage('google', data) };
}

// --- resilience helpers -----------------------------------------------------

/** Per-attempt wall-clock ceiling for a completion. */
const ATTEMPT_TIMEOUT_MS = 30_000;

/**
 * Bound a completion's latency. Note: this races a timer against the provider call, so it bounds how
 * long the CALLER waits (and stops a hung request wedging a route) - it does not abort the socket.
 * That is the right tradeoff here: every caller falls back to the deterministic render on rejection.
 */
async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: timeout after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Shared backpressure limiter across the whole process: at most 6 provider calls in flight at once,
 * so a burst of agent/chat requests cannot fan out unbounded into the providers. Excess calls queue
 * (bounded); a runaway queue rejects with BackpressureError rather than growing memory.
 */
const providerLimiter = new BackpressureLimiter(6, 500);
/** The free pool's own queue: anonymous traffic never takes a slot a reader's own key is waiting for. */
const poolLimiter = new BackpressureLimiter(4, 100);

// --- public entry point -----------------------------------------------------

/** Dispatch to the chosen provider adapter (one attempt, no retry/timeout). */
async function dispatchCompletion(params: AiCompleteParams, model: string, maxTokens: number): Promise<CompletionRaw> {
  const { provider, apiKey, system, prompt, temperature } = params;
  switch (provider) {
    case 'anthropic':
      return callAnthropic(apiKey, model, system, prompt, maxTokens, temperature);
    case 'openai':
      return callOpenAiResponses(apiKey, model, system, prompt, maxTokens, temperature);
    case 'openrouter':
      return callOpenAiCompatible(
        provider,
        'https://openrouter.ai/api/v1/chat/completions',
        apiKey,
        model,
        system,
        prompt,
        maxTokens,
        temperature,
        { extraHeaders: { 'HTTP-Referer': 'https://lyra.vivacity.ai', 'X-Title': 'Lyra' } },
      );
    case 'google':
      return callGoogle(apiKey, model, system, prompt, maxTokens, temperature);
    case 'xai':
      return callOpenAiCompatible(provider, 'https://api.x.ai/v1/chat/completions', apiKey, model, system, prompt, maxTokens, temperature);
    case 'groq':
      return callOpenAiCompatible(provider, 'https://api.groq.com/openai/v1/chat/completions', apiKey, model, system, prompt, maxTokens, temperature, {
        extraBody: reasoningExtras(provider, model),
        tokenField: 'max_completion_tokens',
      });
    case 'cloudflare': {
      const account = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
      if (!account) throw new Error('ai_gateway: cloudflare account id is not configured');
      return callOpenAiCompatible(
        provider,
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/ai/v1/chat/completions`,
        apiKey,
        model,
        system,
        prompt,
        maxTokens,
        temperature,
        { extraBody: reasoningExtras(provider, model) },
      );
    }
    default: {
      const never: never = provider;
      throw new Error(`ai_gateway: unsupported provider ${String(never)}`);
    }
  }
}

// --- per-provider circuit breaker --------------------------------------------
// A hard-down provider used to cost EVERY request up to 3 attempts x 30s, and six hung
// calls saturate the shared limiter - stalling all AI surfaces process-wide. The breaker
// opens after N consecutive failed completions and fast-fails during a cooldown; after
// the cooldown one half-open probe is allowed (success closes it, failure re-opens).

const BREAKER_THRESHOLD = 5;
const BREAKER_COOLDOWN_MS = 60_000;

interface BreakerState {
  consecutiveFailures: number;
  openedAt: number | null;
}

/** Keyed by provider for own-key and hosted calls, and by `pool:<provider>` for the free pool. */
const breakers = new Map<string, BreakerState>();

export class CircuitOpenError extends Error {
  constructor(provider: AiProvider) {
    super(`ai_gateway: ${provider} circuit open - provider is failing, retry after cooldown`);
    this.name = 'CircuitOpenError';
  }
}

function breakerFor(key: string): BreakerState {
  let state = breakers.get(key);
  if (!state) {
    state = { consecutiveFailures: 0, openedAt: null };
    breakers.set(key, state);
  }
  return state;
}

/** Breaker visibility for the (authenticated) status route. */
export function providerBreakerStatus(): Record<string, { open: boolean; consecutiveFailures: number }> {
  const now = Date.now();
  const out: Record<string, { open: boolean; consecutiveFailures: number }> = {};
  for (const [provider, state] of breakers) {
    out[provider] = {
      open: state.openedAt !== null && now - state.openedAt < BREAKER_COOLDOWN_MS,
      consecutiveFailures: state.consecutiveFailures,
    };
  }
  return out;
}

/** Test hook - breaker state is process-global by design. */
export function resetProviderBreakersForTests(): void {
  breakers.clear();
}

/**
 * Run one grounded completion against the chosen provider/model with the user's key. Each attempt is
 * time-bounded and runs under a shared backpressure limiter; a TRANSIENT failure (429 / 5xx /
 * network) is retried with bounded exponential backoff + jitter (withRetry). Throws on missing key,
 * an open circuit, or a permanent/exhausted error - callers decide the fallback (the brief +
 * composer always fall back to the deterministic render).
 */
export async function complete(params: AiCompleteParams): Promise<AiCompleteResult> {
  const { provider, apiKey } = params;
  if (!apiKey) throw new Error('ai_gateway: missing apiKey');

  const model = resolveModel(provider, params.model);
  const maxTokens = params.maxTokens ?? DEFAULT_MAX_TOKENS;

  const pooled = params.lane === 'pool';
  const breaker = breakerFor(pooled ? `pool:${provider}` : provider);
  if (breaker.openedAt !== null) {
    if (Date.now() - breaker.openedAt < BREAKER_COOLDOWN_MS) throw new CircuitOpenError(provider);
    breaker.openedAt = null; // cooldown elapsed - half-open: this call is the probe
  }

  const retryOn429 = params.retryOn429 ?? true;
  const isRetryable = (err: unknown): boolean => {
    if (!retryOn429 && /\b429\b/.test(err instanceof Error ? err.message : String(err))) return false;
    return defaultIsRetryable(err);
  };
  const limiter = pooled ? poolLimiter : providerLimiter;
  const timeoutMs = params.timeoutMs && params.timeoutMs > 0 ? params.timeoutMs : ATTEMPT_TIMEOUT_MS;
  const maxAttempts = params.maxAttempts && params.maxAttempts > 0 ? Math.floor(params.maxAttempts) : 3;

  try {
    const raw = await withRetry(
      () => limiter.run(() => withTimeout(dispatchCompletion(params, model, maxTokens), timeoutMs, `${provider} completion`)),
      { policy: { maxAttempts, baseDelayMs: 400, maxDelayMs: 4000 }, isRetryable },
    );
    breaker.consecutiveFailures = 0;
    breaker.openedAt = null;
    return { text: raw.text, provider, model, usage: raw.usage, costUsd: estimateCostUsd(provider, model, raw.usage) };
  } catch (error) {
    breaker.consecutiveFailures += 1;
    if (breaker.consecutiveFailures >= BREAKER_THRESHOLD) {
      breaker.openedAt = Date.now();
    }
    throw error;
  }
}
