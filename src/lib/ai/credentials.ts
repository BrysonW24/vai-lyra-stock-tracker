import { DEFAULT_MODELS, type AiProvider } from '@/lib/ai/gateway';

type AiMode = 'free' | 'byo' | 'off' | 'hosted';

interface AiCredentialInput {
  mode?: AiMode;
  provider?: AiProvider;
  apiKey?: string;
  model?: string;
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
 * Server-side AI credential resolution. Browser-provided BYOK wins; otherwise beta users can run
 * on Lyra's hosted OpenAI key. The older shared Google key remains as a free-tier fallback.
 */
export function resolveAiCredentials(input?: AiCredentialInput, defaultProvider: AiProvider = 'openai'): ResolvedAiCredentials {
  const provider = input?.provider ?? defaultProvider;
  const userKey = clean(input?.apiKey);
  if (userKey) {
    return { provider, apiKey: userKey, model: clean(input?.model) || undefined, source: 'user' };
  }

  if (provider === 'openai') {
    const hostedKey = clean(process.env.OPENAI_API_KEY);
    if (hostedKey) {
      return {
        provider,
        apiKey: hostedKey,
        model: clean(input?.model) || clean(process.env.LYRA_HOSTED_OPENAI_MODEL) || undefined,
        source: 'hosted_openai',
      };
    }
  }

  if (provider === 'google') {
    const sharedKey = clean(process.env.GOOGLE_AI_KEY);
    if (sharedKey) {
      return { provider, apiKey: sharedKey, model: clean(input?.model) || undefined, source: 'shared_google' };
    }
  }

  return { provider, apiKey: '', model: clean(input?.model) || undefined, source: 'none' };
}
