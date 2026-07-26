import { describe, expect, it } from 'vitest';
import { AI_TRIAL_DAYS, aiTrialDaysLeft, isAiIncluded } from '@/lib/ai/entitlement';

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
