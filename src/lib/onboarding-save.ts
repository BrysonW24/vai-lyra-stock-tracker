/**
 * Onboarding save-orchestration decisions, extracted pure so they can be tested (audit V7). The
 * onboarding handleFinish must NEVER swallow a real save failure: a 401 (a server-side cookie that
 * is no longer valid) or a 5xx has to keep the resumable checkpoint and block the "You're all set"
 * beat, or a user sees success while their book silently dropped. A demo-mode response ({demo:true})
 * is expected and never a failure; an "already in your watchlist" duplicate is a soft success.
 *
 * This is the exact classification handleFinish applies to every /api/watchlist and /api/portfolio
 * response - the highest-stakes branch in the vertical, previously inline and untested.
 */

export type SaveOutcome = 'ok' | 'demo' | 'failed';

export interface SaveResponseShape {
  ok?: boolean;
  demo?: boolean;
  error?: string;
}

/**
 * Classify one onboarding save API response. `ok` is res.ok (the HTTP status class); `body` is the
 * parsed JSON (or null/{} when unparseable). A demo body never fails, even on a non-ok HTTP status.
 * A body.error matching `duplicatePattern` is a soft success. Anything that is not a genuine ok+ok
 * is a real failure - so a 401 or 5xx returns 'failed' and cannot be mistaken for a save.
 */
export function classifySaveResponse(opts: {
  ok: boolean;
  body: SaveResponseShape | null | undefined;
  duplicatePattern?: RegExp;
}): SaveOutcome {
  const body = opts.body ?? {};
  if (body.demo) return 'demo';
  if (opts.duplicatePattern && typeof body.error === 'string' && opts.duplicatePattern.test(body.error)) {
    return 'ok';
  }
  if (opts.ok && body.ok) return 'ok';
  return 'failed';
}

/** True when at least one REAL (non-demo) save failed - the flow must not advance to the success beat. */
export function shouldBlockCompletion(realFailures: readonly string[]): boolean {
  return realFailures.length > 0;
}
