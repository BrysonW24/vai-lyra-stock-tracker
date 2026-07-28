import { describe, it, expect } from 'vitest';
import { resolveTargetSignalScore, DEFAULT_TARGET_SIGNAL_SCORE } from '@/lib/watchlist-rule';

/**
 * 2026-07-27 audit V4 P1: a bare watch rule (ticker + note only) must NOT persist
 * target_signal_score = 0, which the engine reads as "triggered on every scan" - a false green
 * buy-zone hit the user never set. Blank/0/undefined floors to 60 (a genuine strong setup); an
 * explicit 1-100 is honoured; out-of-range is rejected.
 */
describe('resolveTargetSignalScore', () => {
  it('floors an omitted / blank / null score to the default (60)', () => {
    expect(resolveTargetSignalScore(undefined)).toEqual({ value: DEFAULT_TARGET_SIGNAL_SCORE });
    expect(resolveTargetSignalScore('')).toEqual({ value: 60 });
    expect(resolveTargetSignalScore('   ')).toEqual({ value: 60 });
    expect(resolveTargetSignalScore(null)).toEqual({ value: 60 });
  });

  it('floors an explicit 0 to the default (never auto-trigger)', () => {
    expect(resolveTargetSignalScore(0)).toEqual({ value: 60 });
    expect(resolveTargetSignalScore('0')).toEqual({ value: 60 });
  });

  it('honours an explicit in-range score (string or number)', () => {
    expect(resolveTargetSignalScore('75')).toEqual({ value: 75 });
    expect(resolveTargetSignalScore(42)).toEqual({ value: 42 });
    expect(resolveTargetSignalScore(100)).toEqual({ value: 100 });
    expect(resolveTargetSignalScore(1)).toEqual({ value: 1 });
  });

  it('rejects out-of-range or non-numeric scores', () => {
    expect(resolveTargetSignalScore(101)).toHaveProperty('error');
    expect(resolveTargetSignalScore(-1)).toHaveProperty('error');
    expect(resolveTargetSignalScore('abc')).toHaveProperty('error');
  });
});
