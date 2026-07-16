import { describe, expect, it } from 'vitest';
import { safeInternalPath } from '@/lib/auth/safe-redirect';

/**
 * Open-redirect guard for the auth callback: `${origin}${next}` must only ever land on the
 * same origin, so `next` has to be a plain relative path. Anything a browser would resolve to
 * another host (userinfo `@`, protocol-relative `//`, backslash) falls back to `/`.
 */
describe('safeInternalPath', () => {
  it('keeps genuine same-origin paths', () => {
    expect(safeInternalPath('/')).toBe('/');
    expect(safeInternalPath('/radar')).toBe('/radar');
    expect(safeInternalPath('/settings?tab=ai')).toBe('/settings?tab=ai');
  });

  it('rejects the open-redirect payloads', () => {
    expect(safeInternalPath('@evil.com')).toBe('/');
    expect(safeInternalPath('//evil.com')).toBe('/');
    expect(safeInternalPath('/\\evil.com')).toBe('/');
    expect(safeInternalPath('https://evil.com')).toBe('/');
    expect(safeInternalPath('javascript:alert(1)')).toBe('/');
    expect(safeInternalPath(null)).toBe('/');
    expect(safeInternalPath('')).toBe('/');
  });
});
