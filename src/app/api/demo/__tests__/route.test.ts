/**
 * "Explore the demo first" contract. The demo entry used to stamp lyra_onboarded and drop the
 * visitor straight into the command centre - selling none of the experience. It now routes a
 * first-time visitor through the FULL onboarding journey and only skips it for a returning
 * visitor who already finished the tour. RED on the old route (redirected '/' and set
 * lyra_onboarded unconditionally).
 */
import { describe, expect, it } from 'vitest';
import { GET } from '../route';

function req(cookie?: string): Request {
  return new Request('http://localhost/api/demo', { headers: cookie ? { cookie } : {} });
}

describe('GET /api/demo (Explore the demo first)', () => {
  it('a first-time visitor is taken through the FULL onboarding journey', async () => {
    const res = await GET(req());
    expect(res.status).toBeGreaterThanOrEqual(302);
    expect(res.headers.get('location')).toContain('/onboarding');
    const cookies = res.headers.getSetCookie().join('; ');
    expect(cookies).toContain('lyra_demo=1');
    // Onboarding itself earns the onboarded flag - the entry must NOT pre-stamp it.
    expect(cookies).not.toContain('lyra_onboarded');
  });

  it('a returning visitor who finished the tour goes straight to the console', async () => {
    const res = await GET(req('lyra_onboarded=1; other=x'));
    const location = res.headers.get('location') ?? '';
    expect(location.endsWith('/')).toBe(true);
    expect(location).not.toContain('/onboarding');
    expect(res.headers.getSetCookie().join('; ')).toContain('lyra_demo=1');
  });

  it('an unrelated cookie does not count as onboarded', async () => {
    const res = await GET(req('not_lyra_onboarded=1'));
    expect(res.headers.get('location')).toContain('/onboarding');
  });
});
