import { describe, it, expect } from 'vitest';
import { classifySaveResponse, shouldBlockCompletion } from '@/lib/onboarding-save';

/**
 * 2026-07-27 audit V7: handleFinish's save orchestration - the most user-critical logic in the
 * vertical - had zero tests. The dangerous regression is a swallowed 401: showing "You're all set"
 * while the user's book silently dropped. These pin the exact classification handleFinish applies to
 * every /api/watchlist and /api/portfolio response, and the block-the-success-beat decision.
 */

describe('classifySaveResponse', () => {
  it('a genuine ok+ok response is saved', () => {
    expect(classifySaveResponse({ ok: true, body: { ok: true } })).toBe('ok');
  });

  it('a demo-mode response is never a failure, even on a non-ok status', () => {
    expect(classifySaveResponse({ ok: false, body: { demo: true } })).toBe('demo');
  });

  it('RED: a 401 (no valid session cookie) is a real failure, not a save', () => {
    // The exact swallow the audit warns about: a 401 must never read as saved.
    expect(classifySaveResponse({ ok: false, body: { error: 'HTTP 401' } })).toBe('failed');
  });

  it('RED: a 5xx / empty body is a real failure', () => {
    expect(classifySaveResponse({ ok: false, body: {} })).toBe('failed');
    expect(classifySaveResponse({ ok: false, body: null })).toBe('failed');
  });

  it('an ok HTTP status without body.ok is still a failure (the API did not confirm the write)', () => {
    expect(classifySaveResponse({ ok: true, body: {} })).toBe('failed');
  });

  it('an "already in your watchlist" duplicate is a soft success', () => {
    expect(
      classifySaveResponse({
        ok: true,
        body: { error: 'AMD is already in your watchlist' },
        duplicatePattern: /already in your watchlist/i,
      }),
    ).toBe('ok');
  });
});

describe('shouldBlockCompletion', () => {
  it('does not block when nothing failed', () => {
    expect(shouldBlockCompletion([])).toBe(false);
  });

  it('blocks the success beat when any real failure landed', () => {
    expect(shouldBlockCompletion(['your portfolio holdings'])).toBe(true);
    expect(shouldBlockCompletion(['2 watchlist tickers', 'your profile and preferences'])).toBe(true);
  });
});
