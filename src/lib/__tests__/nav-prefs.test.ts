import { describe, it, expect } from 'vitest';
import { sanitizePrimaries } from '@/lib/nav-prefs';

/**
 * 2026-07-27 audit V3: sanitizePrimaries (the primary-bar validate/dedupe/clamp seam) was the one
 * shell decision function with zero coverage. It must reject unknown hrefs, drop duplicates, preserve
 * the user's order, and clamp to the cap - so a corrupted or over-long saved bar can never render an
 * unknown link, a repeat, or overflow the rail.
 */
const KNOWN = new Set(['/', '/portfolio', '/watchlist', '/paper-bot', '/radar']);

describe('sanitizePrimaries', () => {
  it('drops hrefs not in the live section map', () => {
    expect(sanitizePrimaries(['/', '/ghost', '/watchlist'], KNOWN, 5)).toEqual(['/', '/watchlist']);
  });

  it('dedupes while preserving first-seen order', () => {
    expect(sanitizePrimaries(['/watchlist', '/', '/watchlist', '/portfolio'], KNOWN, 5)).toEqual([
      '/watchlist',
      '/',
      '/portfolio',
    ]);
  });

  it('clamps to the cap', () => {
    const out = sanitizePrimaries(['/', '/portfolio', '/watchlist', '/paper-bot', '/radar'], KNOWN, 3);
    expect(out).toEqual(['/', '/portfolio', '/watchlist']);
  });

  it('returns empty for an all-invalid or empty list (caller enforces the minimum)', () => {
    expect(sanitizePrimaries(['/nope', '/also-nope'], KNOWN, 5)).toEqual([]);
    expect(sanitizePrimaries([], KNOWN, 5)).toEqual([]);
  });

  it('never yields more than the cap even with duplicates and junk mixed in', () => {
    const out = sanitizePrimaries(['/', '/', '/x', '/portfolio', '/watchlist', '/paper-bot', '/radar'], KNOWN, 4);
    expect(out).toHaveLength(4);
    expect(new Set(out).size).toBe(4); // no duplicates
    for (const h of out) expect(KNOWN.has(h)).toBe(true);
  });
});
