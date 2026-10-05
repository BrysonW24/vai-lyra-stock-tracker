import { afterEach, describe, expect, it, vi } from 'vitest';
import { AI_TRIAL_DAYS, aiTrialDaysLeft, isAiIncluded } from '@/lib/ai/entitlement';
import * as entitlement from '@/lib/ai/entitlement';

/** Env stubs must not leak between tests. */
function afterEachEnv(): void {
  afterEach(() => vi.unstubAllEnvs());
}

const DAY = 86_400_000;
const signup = '2026-07-01T00:00:00.000Z';
const t0 = Date.parse(signup);

describe('AI entitlement - free trial + grant', () => {
  it('a granted user is included forever, even long past the trial', () => {
    expect(isAiIncluded({ accountCreatedAt: signup, granted: true, now: t0 + 100 * DAY })).toBe(true);
  });

  it('a new account is included through the trial and BYOK once it lapses', () => {
    expect(isAiIncluded({ accountCreatedAt: signup, granted: false, now: t0 + 1 * DAY })).toBe(true); // day 1
    expect(isAiIncluded({ accountCreatedAt: signup, granted: false, now: t0 + 13 * DAY })).toBe(true); // day 13
    // exactly AI_TRIAL_DAYS in => lapsed (strict <)
    expect(isAiIncluded({ accountCreatedAt: signup, granted: false, now: t0 + AI_TRIAL_DAYS * DAY })).toBe(false);
    expect(isAiIncluded({ accountCreatedAt: signup, granted: false, now: t0 + 30 * DAY })).toBe(false);
  });

  it('an unknown or malformed created_at is never included unless granted', () => {
    expect(isAiIncluded({ accountCreatedAt: null, granted: false, now: t0 })).toBe(false);
    expect(isAiIncluded({ accountCreatedAt: 'not-a-date', granted: false, now: t0 })).toBe(false);
    expect(isAiIncluded({ accountCreatedAt: null, granted: true, now: t0 })).toBe(true);
  });

  it('reports whole trial days left, ceiling, flooring to 0 once lapsed', () => {
    expect(aiTrialDaysLeft({ accountCreatedAt: signup, now: t0 })).toBe(14);
    expect(aiTrialDaysLeft({ accountCreatedAt: signup, now: t0 + 13 * DAY })).toBe(1);
    expect(aiTrialDaysLeft({ accountCreatedAt: signup, now: t0 + 13.5 * DAY })).toBe(1); // ceil(0.5)
    expect(aiTrialDaysLeft({ accountCreatedAt: signup, now: t0 + 14 * DAY })).toBe(0);
    expect(aiTrialDaysLeft({ accountCreatedAt: signup, now: t0 + 20 * DAY })).toBe(0);
    expect(aiTrialDaysLeft({ accountCreatedAt: null, now: t0 })).toBe(0);
  });
});

describe('resolveHostedEntitlement - the whole decision, from server-held facts only', () => {
  const NOW = Date.parse('2026-10-05T00:00:00Z');
  afterEachEnv();

  it('includes an account inside its trial and counts the days left', () => {
    const result = entitlement.resolveHostedEntitlement({ email: 'new@example.com', created_at: '2026-10-01T00:00:00Z' }, NOW);
    expect(result).toEqual({ included: true, granted: false, trialDaysLeft: 10 });
  });

  it('excludes an account past its trial with no grant', () => {
    const result = entitlement.resolveHostedEntitlement({ email: 'old@example.com', created_at: '2026-06-14T00:00:00Z' }, NOW);
    expect(result).toEqual({ included: false, granted: false, trialDaysLeft: 0 });
  });

  it('includes an allowlisted account indefinitely, whatever its age', () => {
    vi.stubEnv('AI_INCLUDED_EMAILS', 'owner@example.com, Comp@Example.com');
    expect(entitlement.resolveHostedEntitlement({ email: 'OWNER@example.com', created_at: '2026-06-14T00:00:00Z' }, NOW)).toEqual({
      included: true, granted: true, trialDaysLeft: 0,
    });
  });

  it('takes nothing but the session facts - there is no parameter a profile row could reach', () => {
    // The hole this closes: a user could set profiles.ai_included = true on their own row and keep
    // the house key forever. The resolver has no input for that flag; a self-granted row is inert.
    const selfGranted = { email: 'old@example.com', created_at: '2026-06-14T00:00:00Z', ai_included: true };
    expect(entitlement.resolveHostedEntitlement(selfGranted, NOW).included).toBe(false);
  });
});
