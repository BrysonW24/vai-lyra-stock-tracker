import { describe, expect, it } from 'vitest';
import { NOTIFICATION_TYPES, isNotificationType } from '../types';

/**
 * Drift guard. The periodic reviews shipped to every renderer while the dispatch route's
 * hand-written allowlist still rejected them as "type is invalid" - the union grew, four
 * exhaustive Records forced themselves updated, and the one hand-maintained Set did not.
 * These pin the roster as the single runtime source of truth for what a valid type is.
 */
describe('notification type roster', () => {
  it('accepts every type it advertises', () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(isNotificationType(type)).toBe(true);
    }
  });

  it('rejects anything not on the roster', () => {
    for (const bogus of ['', 'nope', 'SIGNAL_ALERT', 'signal-alert', null, undefined, 42, {}]) {
      expect(isNotificationType(bogus)).toBe(false);
    }
  });

  it('carries the periodic reviews - the exact members the old allowlist dropped', () => {
    for (const type of ['weekly_report', 'monthly_review', 'quarterly_review', 'yearly_review']) {
      expect(NOTIFICATION_TYPES).toContain(type);
      expect(isNotificationType(type)).toBe(true);
    }
  });

  it('has no duplicates and is non-empty', () => {
    expect(NOTIFICATION_TYPES.length).toBeGreaterThan(0);
    expect(new Set(NOTIFICATION_TYPES).size).toBe(NOTIFICATION_TYPES.length);
  });

  it('does not inherit from Object.prototype - "toString" is not a notification type', () => {
    // hasOwnProperty guards this; a naive `value in ROSTER` check would wrongly pass.
    expect(isNotificationType('toString')).toBe(false);
    expect(isNotificationType('constructor')).toBe(false);
  });
});
