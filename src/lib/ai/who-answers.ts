/**
 * Who would answer this reader when they bring no key of their own - worked out in the browser,
 * from what GET /api/ai/status reports and the provider they have selected in settings.
 *
 * It exists so the UI can say truthfully, BEFORE anything is sent, where a question will go: the
 * chat sheet shows the free-model disclosure (and, without an account, the "Include my book"
 * choice) only when the free pool is the one that answers. It must therefore agree with the
 * resolver that actually decides (resolveAiCredentials, src/lib/ai/credentials.ts) case for case -
 * including the one a per-deployment flag gets wrong: the house holds a key for ONE provider, the
 * reader has selected the other, and the free pool answers instead. A parity test pins the two
 * together.
 */
export interface AiStatusFacts {
  /** A session exists. Absent or false for a signed-out or no-account caller. */
  authenticated?: boolean;
  /** The free pool of open models is on for this deployment. */
  freeAvailable?: boolean;
  /** This signed-in reader is entitled to the house key (inside their trial, or granted). */
  aiIncluded?: boolean;
  /** The house holds an OpenAI key / a Google key. Reported to signed-in callers only. */
  hostedOpenAi?: boolean;
  sharedGoogle?: boolean;
}

export type Answerer = 'hosted' | 'free' | 'none';

export function whoAnswers(status: AiStatusFacts | null | undefined, provider: string | null | undefined): Answerer {
  if (!status) return 'none';
  const houseHoldsProvider = (provider === 'openai' && status.hostedOpenAi === true) || (provider === 'google' && status.sharedGoogle === true);
  if (status.authenticated === true && status.aiIncluded === true && houseHoldsProvider) return 'hosted';
  return status.freeAvailable === true ? 'free' : 'none';
}
