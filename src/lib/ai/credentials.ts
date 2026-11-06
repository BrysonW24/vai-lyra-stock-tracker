import { DEFAULT_MODELS, SUPPORTED_PROVIDERS, type AiProvider } from '@/lib/ai/gateway';
import { freePoolAvailable, poolTargets } from '@/lib/ai/free-pool';

type AiMode = 'free' | 'byo' | 'off' | 'hosted';

interface AiCredentialInput {
  mode?: AiMode;
  provider?: AiProvider;
  apiKey?: string;
  model?: string;
}

export interface ResolveOptions {
  /**
   * Whether the caller holds a valid Supabase session. The HOSTED/SHARED server keys are only
   * handed out when this is true - so an anonymous internet caller can never burn Lyra's key
   * (the financial-DoS hole the audit flagged). A user's OWN key (BYOK) is always honoured.
   */
  authenticated: boolean;
  /**
   * Whether THIS user is entitled to Lyra's hosted key (inside their free trial, or granted) -
   * see lib/ai/entitlement.ts. Only an authenticated AND included user gets the house key; an
   * authenticated-but-not-included user falls through to BYOK. A user's OWN key is unaffected.
   */
  aiIncluded: boolean;
  /**
   * Whether this route can answer from the FREE POOL (src/lib/ai/free-pool.ts) when the caller has
   * no key of their own. Opt-in per route: the pool is open without sign-in, so only routes that
   * charge the pool's per-caller caps and run the output guards may use it.
   */
  allowFreePool?: boolean;
}

export interface ResolvedAiCredentials {
  provider: AiProvider;
  apiKey: string;
  model?: string;
  /**
   * `free_pool` carries no key and no single provider: the caller hands the request to
   * completeFromPool(), which picks the provider. `provider` is then only a label for the audit row.
   */
  source: 'user' | 'hosted_openai' | 'shared_google' | 'free_pool' | 'none';
}

/** `value` arrives from a request body: trust nothing about its type. */
function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * A model id as any provider writes one: `gpt-5.5`, `anthropic/claude-3.5-sonnet:beta`,
 * `models/gemini-2.5-pro`, `ft:gpt-4o-mini-2024-07-18:org::id`. Bounded and character-limited
 * because this string is client-supplied and travels into the audit log - before this check an
 * anonymous caller could put ~31 KB of anything in it and have the server store it, 30 times a
 * minute, through the service role (see the 2026-10-05 API audit).
 */
const MODEL_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,95}$/;

/** No real provider key is anywhere near this long; a longer "key" is not a key. */
const MAX_API_KEY_CHARS = 512;

export function getAiRuntimeStatus() {
  const hostedOpenAiModel = clean(process.env.LYRA_HOSTED_OPENAI_MODEL) || DEFAULT_MODELS.openai;
  return {
    hostedOpenAi: Boolean(clean(process.env.OPENAI_API_KEY)),
    hostedOpenAiModel,
    sharedGoogle: Boolean(clean(process.env.GOOGLE_AI_KEY)),
    /** The free pool of open models has at least one key on this deployment. */
    freePool: freePoolAvailable(),
  };
}

/**
 * Server-side AI credential resolution.
 *
 * Priority: a browser-provided BYOK key always wins (the user pays, so any model is fine).
 * Next, on a route that allows it, the FREE POOL of open models - for anyone, signed in or not:
 * it costs nothing, the caller cannot choose its provider or model, and it is capped per caller.
 * It comes before the paid house keys on purpose (2026-11-06: Lyra's AI is free by default).
 * Otherwise, an AUTHENTICATED caller may fall back to Lyra's hosted OpenAI key or the shared
 * Google key - and only then. When a server key is used the model is PINNED server-side
 * (the client cannot select an arbitrary, expensive model on our key). Unauthenticated callers
 * without their own key and without a pool resolve to `source: 'none'` and the route degrades
 * gracefully.
 */
export function resolveAiCredentials(
  input: AiCredentialInput | undefined,
  opts: ResolveOptions,
  defaultProvider: AiProvider = 'openai',
): ResolvedAiCredentials {
  // The provider is one of the five the gateway speaks, or the default - never a client string.
  const provider = SUPPORTED_PROVIDERS.includes(input?.provider as AiProvider)
    ? (input!.provider as AiProvider)
    : defaultProvider;
  const rawKey = clean(input?.apiKey);
  const userKey = rawKey.length <= MAX_API_KEY_CHARS ? rawKey : '';
  if (userKey) {
    // The user's own key: honour their model choice too - when it is shaped like a model id.
    const rawModel = clean(input?.model);
    return { provider, apiKey: userKey, model: MODEL_ID_RE.test(rawModel) ? rawModel : undefined, source: 'user' };
  }

  // The free pool: open to every caller on a route that opted in. No key is handed back - the
  // pool holds its own - so nothing here can be turned into a paid call.
  if (opts.allowFreePool && freePoolAvailable()) {
    return { provider: poolTargets()[0]!.provider, apiKey: '', model: undefined, source: 'free_pool' };
  }

  // Server-key fallback requires an authenticated session AND an AI-included entitlement
  // (trial or granted). A signed-in user past their trial is BYOK-only, exactly like Solo.
  if (!opts.authenticated || !opts.aiIncluded) {
    return { provider, apiKey: '', model: undefined, source: 'none' };
  }

  if (provider === 'openai') {
    const hostedKey = clean(process.env.OPENAI_API_KEY);
    if (hostedKey) {
      // Model is server-pinned; ignore any client-supplied model on our key.
      return {
        provider,
        apiKey: hostedKey,
        model: clean(process.env.LYRA_HOSTED_OPENAI_MODEL) || undefined,
        source: 'hosted_openai',
      };
    }
  }

  if (provider === 'google') {
    const sharedKey = clean(process.env.GOOGLE_AI_KEY);
    if (sharedKey) {
      // Model server-pinned to the configured shared-tier model (or the provider default).
      return {
        provider,
        apiKey: sharedKey,
        model: clean(process.env.LYRA_SHARED_GOOGLE_MODEL) || undefined,
        source: 'shared_google',
      };
    }
  }

  return { provider, apiKey: '', model: undefined, source: 'none' };
}
