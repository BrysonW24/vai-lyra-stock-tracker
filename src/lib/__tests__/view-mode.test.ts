import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseViewMode, DEFAULT_VIEW_MODE, VIEW_MODE_COOKIE, SIMPLE_NAV_HREFS } from '@/lib/view-mode';

describe('view mode', () => {
  it('defaults to simple when no choice is stored', () => {
    // The founder's decision (2026-09-09): a visitor meets the calm view first.
    expect(DEFAULT_VIEW_MODE).toBe('simple');
    expect(parseViewMode(undefined)).toBe('simple');
    expect(parseViewMode(null)).toBe('simple');
    expect(parseViewMode('')).toBe('simple');
  });

  it('honours an explicit stored choice', () => {
    expect(parseViewMode('full')).toBe('full');
    expect(parseViewMode('simple')).toBe('simple');
  });

  it('falls back to the default on a junk/tampered cookie', () => {
    expect(parseViewMode('FULL')).toBe('simple');
    expect(parseViewMode('advanced')).toBe('simple');
    expect(parseViewMode('../../etc/passwd')).toBe('simple');
  });

  it('uses a lyra_-namespaced cookie like the rest of the app', () => {
    expect(VIEW_MODE_COOKIE).toMatch(/^lyra_/);
  });
});

/**
 * Drift guard: Simple view's nav is a hand-written href list, so a route rename would
 * silently give the calm front door a dead link - the one surface where a 404 is most
 * damaging. Assert every destination still exists on disk.
 */
describe('simple nav destinations', () => {
  it.each(SIMPLE_NAV_HREFS)('%s resolves to a real page', (href) => {
    const segment = href === '/' ? '' : href;
    expect(existsSync(join(process.cwd(), 'src/app', segment, 'page.tsx'))).toBe(true);
  });

  it('stays small - Simple view is defined by how little it offers', () => {
    expect(SIMPLE_NAV_HREFS.length).toBeLessThanOrEqual(6);
  });
});
