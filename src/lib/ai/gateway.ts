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

export type AiProvider = 'anthropic' | 'openai' | 'openrouter' | 'google' | 'xai';

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
}

export interface AiCompleteResult {
  text: string;
  provider: AiProvider;
  /** The model actually used (after default resolution) - useful for usage logging (AI-11). */
  model: string;
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

/** Defaults per provider. OpenAI intentionally uses the powerful hosted beta default. */
export const DEFAULT_MODELS: Record<AiProvider, string> = {
  // Current cheap/fast Anthropic default. The old 'claude-3-5-haiku-latest' resolved to
  // the RETIRED claude-3.5-haiku family and hard-failed every BYO-Anthropic request.
  anthropic: 'claude-haiku-4-5',
  openai: 'gpt-5.5',
  openrouter: 'meta-llama/llama-3.1-70b-instruct',
  google: 'gemini-3.1-flash-lite',
  xai: 'grok-2-latest',
};

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
): Promise<string> {
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
  return data.content?.[0]?.text?.trim() ?? '';
}

interface OpenAiResponse {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
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
): Promise<string> {
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
  const outputText = data.output_text?.trim();
  if (outputText) return outputText;
  return (
    data.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? '')
      .join('')
      .trim() ?? ''
  );
}

/** OpenRouter and xAI use the OpenAI chat-completions wire format. */
async function callOpenAiCompatible(
  provider: AiProvider,
  endpoint: string,
  apiKey: string,
  model: string,
  system: string,
  prompt: string,
  maxTokens: number,
  temperature: number | undefined,
  extraHeaders?: Record<string, string>,
): Promise<string> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}`, ...(extraHeaders ?? {}) },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      ...(temperature != null ? { temperature } : {}),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(describeProviderError(provider, res.status));
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

async function callGoogle(
  apiKey: string,
  model: string,
  system: string,
  prompt: string,
  maxTokens: number,
  temperature?: number,
): Promise<string> {
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
  };
  return (
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim() ?? ''
  );
}

// --- public entry point -----------------------------------------------------

/**
 * Run one grounded completion against the chosen provider/model with the user's key.
 * Throws on missing key or any provider/network error - callers decide the fallback
 * (the brief + composer always fall back to the deterministic render).
 */
export async function complete(params: AiCompleteParams): Promise<AiCompleteResult> {
  const { provider, apiKey, system, prompt, temperature } = params;
  if (!apiKey) throw new Error('ai_gateway: missing apiKey');

  const model = resolveModel(provider, params.model);
  const maxTokens = params.maxTokens ?? DEFAULT_MAX_TOKENS;

  let text: string;
  switch (provider) {
    case 'anthropic':
      text = await callAnthropic(apiKey, model, system, prompt, maxTokens, temperature);
      break;
    case 'openai':
      text = await callOpenAiResponses(
        apiKey,
        model,
        system,
        prompt,
        maxTokens,
        temperature,
      );
      break;
    case 'openrouter':
      text = await callOpenAiCompatible(
        provider,
        'https://openrouter.ai/api/v1/chat/completions',
        apiKey,
        model,
        system,
        prompt,
        maxTokens,
        temperature,
        { 'HTTP-Referer': 'https://lyra.vivacity.ai', 'X-Title': 'Lyra' },
      );
      break;
    case 'google':
      text = await callGoogle(apiKey, model, system, prompt, maxTokens, temperature);
      break;
    case 'xai':
      text = await callOpenAiCompatible(
        provider,
        'https://api.x.ai/v1/chat/completions',
        apiKey,
        model,
        system,
        prompt,
        maxTokens,
        temperature,
      );
      break;
    default: {
      const never: never = provider;
      throw new Error(`ai_gateway: unsupported provider ${String(never)}`);
    }
  }

  return { text, provider, model };
}
