/**
 * AI-settings copy that depends on whether a HOSTED AI key actually exists on this deployment -
 * NOT on whether Supabase is configured.
 *
 * A deployment can have full accounts, DB, cloud sync and notifications (Supabase set) and yet
 * have no hosted AI key: there, AI is bring-your-own-key only, and the UI must say so rather than
 * promise a hosted model that isn't there. resolveAiCredentials() already enforces this at runtime
 * (it only ever hands out a hosted key that exists); this keeps the words honest to match.
 *
 * `hostedAvailable` is the same signal the chat uses: GET /api/ai/status -> hostedAvailable
 * (= a hosted OpenAI key or a shared Google key is configured server-side).
 *
 * `freeAvailable` (v0.140.0) is the free pool of open models: when it is on, AI works for everyone
 * with no key, and that is what the copy must say first - whatever else is configured.
 */
export interface AiHostingCopy {
  /** Section-header subtitle for the AI settings page. */
  headerSubtitle: string;
  /** Panel subtitle above the model picker. */
  panelSubtitle: string;
  /** Label on the OpenAI optgroup in the model picker. */
  openaiOptgroupLabel: string;
  /** Label on the OpenAI option in the model picker. */
  openaiOptionLabel: string;
}

export function aiHostingCopy(hostedAvailable: boolean, freeAvailable = false): AiHostingCopy {
  if (freeAvailable) {
    return {
      headerSubtitle:
        'Lyra answers with a free open-source model - nothing to set up. Add your own key below to use a model of your choice instead.',
      panelSubtitle:
        'Free by default: an open-source model hosted by Cloudflare or Groq, with a daily allowance shared by everyone. Your own key, if you add one, stays in this browser and has no such limit.',
      openaiOptgroupLabel: 'Your own key',
      openaiOptionLabel: 'OpenAI GPT-5.5 (your key)',
    };
  }
  if (hostedAvailable) {
    return {
      headerSubtitle:
        'Choose the model that powers Lyra explanations - the hosted beta by default, or bring your own key.',
      panelSubtitle: 'Hosted OpenAI beta by default. Optional BYOK when you want control.',
      openaiOptgroupLabel: 'Hosted beta',
      openaiOptionLabel: 'OpenAI GPT-5.5',
    };
  }
  return {
    headerSubtitle:
      'No hosted model on this deployment - choose a provider and add your own key to switch AI on. It stays in this browser.',
    panelSubtitle: 'Bring your own provider key to switch AI on. Lyra stores it only in this browser.',
    openaiOptgroupLabel: 'Your own key',
    openaiOptionLabel: 'OpenAI GPT-5.5 (BYOK)',
  };
}
