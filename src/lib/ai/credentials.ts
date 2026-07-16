import { DEFAULT_MODELS, type AiProvider } from '@/lib/ai/gateway';

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
}

export interface ResolvedAiCredentials {
  provider: AiProvider;
  apiKey: string;
  model?: string;
  source: 'user' | 'hosted_openai' | 'shared_google' | 'none';
}

function clean(value: string | undefined): string {
  return value?.trim() ?? '';
}

export function getAiRuntimeStatus() {
  const hostedOpenAiModel = clean(process.env.LYRA_HOSTED_OPENAI_MODEL) || DEFAULT_MODELS.openai;
  return {
    hostedOpenAi: Boolean(clean(process.env.OPENAI_API_KEY)),
    hostedOpenAiModel,
    sharedGoogle: Boolean(clean(process.env.GOOGLE_AI_KEY)),
  };
}

/**
 * Server-side AI credential resolution.
 *
 * Priority: a browser-provided BYOK key always wins (the user pays, so any model is fine).
 * Otherwise, an AUTHENTICATED caller may fall back to Lyra's hosted OpenAI key or the shared
 * Google key - and only then. When a server key is used the model is PINNED server-side
 * (the client cannot select an arbitrary, expensive model on our key). Unauthenticated callers
 * without their own key resolve to `source: 'none'` and the route degrades gracefully.
 */
export function resolveAiCredentials(
  input: AiCredentialInput | undefined,
  opts: ResolveOptions,
  defaultProvider: AiProvider = 'openai',
): ResolvedAiCredentials {
  const provider = input?.provider ?? defaultProvider;
  const userKey = clean(input?.apiKey);
  if (userKey) {
    // The user's own key: honour their model choice too.
    return { provider, apiKey: userKey, model: clean(input?.model) || undefined, source: 'user' };
  }

  // Server-key fallback requires an authenticated session.
  if (!opts.authenticated) {
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
