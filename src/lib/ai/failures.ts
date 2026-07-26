/**
 * Stable, non-secret AI failure codes shared by the server route and chat UI.
 * Provider response bodies are never returned to the browser or written to logs.
 */
export type AiFailureReason =
  | 'invalid_key'
  | 'invalid_model'
  | 'provider_rate_limited'
  | 'provider_unavailable'
  | 'empty_response'
  | 'error';

const AI_FAILURE_REASONS = new Set<AiFailureReason>([
  'invalid_key',
  'invalid_model',
  'provider_rate_limited',
  'provider_unavailable',
  'empty_response',
  'error',
]);

export function classifyAiFailure(error: unknown): AiFailureReason {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (/\b(401|403)\b|authentication failed|invalid api key|unauthori[sz]ed/.test(message)) return 'invalid_key';
  if (/\b404\b|model not found|unknown model|invalid model/.test(message)) return 'invalid_model';
  if (/\b429\b|rate.?limit|quota exceeded/.test(message)) return 'provider_rate_limited';
  if (
    /timeout|timed out|circuit open|backpressure|fetch failed|network|econn|enotfound|socket|\b5\d\d\b/.test(
      message,
    )
  ) {
    return 'provider_unavailable';
  }
  return 'error';
}

export function normaliseAiFailureReason(reason: unknown): AiFailureReason {
  return typeof reason === 'string' && AI_FAILURE_REASONS.has(reason as AiFailureReason)
    ? (reason as AiFailureReason)
    : 'error';
}

export function aiFailureMessage(reason: AiFailureReason): string {
  switch (reason) {
    case 'invalid_key':
      return 'That key was rejected. Check or replace it in AI settings, then try again.';
    case 'invalid_model':
      return 'That model is unavailable. Clear the custom model in AI settings or choose a current model.';
    case 'provider_rate_limited':
      return 'Your model provider is rate-limiting requests. Wait a moment, then try again.';
    case 'provider_unavailable':
      return 'The model provider is temporarily unavailable. Your local data is safe; try again shortly.';
    case 'empty_response':
      return 'The model returned an empty response. Try once more or choose another model.';
    default:
      return 'That did not go through. Try again; if it repeats, check your AI settings.';
  }
}
