import { describe, it, expect } from 'vitest';
import { statusFor, actionFor, lifecycleFor } from '@/lib/live-signals';

/**
 * 2026-07-27 audit V1: the live-signals display module was untested. These pin the deterministic
 * status/action/lifecycle state machines (thresholds ALERT=75, WATCHLIST=60, CHANGE=8) that mirror
 * the Python signal_engine - the "engine decides" contract the whole app renders against.
 */
describe('statusFor', () => {
  it('classifies by score band', () => {
    expect(statusFor(75, null)).toBe('strong_setup');
    expect(statusFor(60, null)).toBe('watchlist_setup');
    expect(statusFor(74, null)).toBe('watchlist_setup');
    expect(statusFor(59, null)).toBe('no_signal');
  });

  it('marks a name that fell out of a strong setup as invalidated', () => {
    expect(statusFor(55, 80)).toBe('invalidated'); // prev >= 75, now < 60
  });

  it('marks a >8pt drop below the band as weakening, small drops as no_signal', () => {
    expect(statusFor(50, 62)).toBe('weakening'); // fell below 60, dropped 12, prev never strong
    expect(statusFor(55, 57)).toBe('no_signal'); // below band but only dropped 2 - not weakening
  });
});

describe('actionFor', () => {
  it('maps each status to its action state', () => {
    expect(actionFor('strong_setup')).toBe('buy_review');
    expect(actionFor('watchlist_setup')).toBe('watch');
    expect(actionFor('weakening')).toBe('do_not_add');
    expect(actionFor('invalidated')).toBe('invalidated');
    expect(actionFor('no_signal')).toBe('hold');
  });
});

describe('lifecycleFor', () => {
  it('treats a first-seen actionable status as new_signal, else unchanged', () => {
    expect(lifecycleFor('strong_setup', null, 0)).toBe('new_signal');
    expect(lifecycleFor('watchlist_setup', null, 0)).toBe('new_signal');
    expect(lifecycleFor('no_signal', null, 0)).toBe('unchanged');
  });

  it('detects upgrade, downgrade, invalidation and recovery transitions', () => {
    expect(lifecycleFor('strong_setup', 'watchlist_setup', 5)).toBe('upgraded');
    expect(lifecycleFor('watchlist_setup', 'strong_setup', -5)).toBe('downgraded');
    expect(lifecycleFor('invalidated', 'strong_setup', -20)).toBe('invalidated');
    // Rising back INTO a strong setup is classified upgraded (the upgrade branch precedes recovered);
    // recovery is reserved for a climb back into the watchlist band from invalidated/weakening.
    expect(lifecycleFor('strong_setup', 'invalidated', 30)).toBe('upgraded');
    expect(lifecycleFor('watchlist_setup', 'weakening', 12)).toBe('recovered');
    expect(lifecycleFor('watchlist_setup', 'invalidated', 5)).toBe('recovered');
  });

  it('falls back to continuing when the status holds with no material move', () => {
    expect(lifecycleFor('watchlist_setup', 'watchlist_setup', 1)).toBe('continuing');
  });
});
