/**
 * Contract of the community-board client plumbing: participant keys are ISSUED by the
 * board (never minted locally), cached, and survive blocked storage in-memory; reads only
 * peek at a held key (a visitor who never votes costs no issuance); the API base points
 * Solo (no Supabase env) at the canonical prod board and configured deployments at
 * themselves.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

function makeWindowWithStorage(blocked = false) {
  const store = new Map<string, string>();
  return {
    localStorage: {
      getItem: (k: string) => {
        if (blocked) throw new Error('storage blocked');
        return store.get(k) ?? null;
      },
      setItem: (k: string, v: string) => {
        if (blocked) throw new Error('storage blocked');
        store.set(k, v);
      },
      removeItem: (k: string) => void store.delete(k),
    },
  } as unknown as Window & typeof globalThis;
}

function stubIssuance(key = 'issued-uuid.issued-signature') {
  const fetchMock = vi.fn(async () => ({ json: async () => ({ ok: true, key }) }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('communityParticipantKey', () => {
  it('asks the board once, then serves the cached key with no further issuance', async () => {
    vi.stubGlobal('window', makeWindowWithStorage());
    const fetchMock = stubIssuance();
    const { communityParticipantKey, communityStoredKey } = await import('@/lib/community');
    expect(communityStoredKey()).toBe(''); // peek never issues
    expect(fetchMock).not.toHaveBeenCalled();
    const first = await communityParticipantKey();
    expect(first).toBe('issued-uuid.issued-signature');
    expect(await communityParticipantKey()).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(communityStoredKey()).toBe(first);
  });

  it('keeps the key in memory when storage is blocked - participation still works', async () => {
    vi.stubGlobal('window', makeWindowWithStorage(true));
    stubIssuance();
    const { communityParticipantKey, communityStoredKey } = await import('@/lib/community');
    const key = await communityParticipantKey();
    expect(key).toBe('issued-uuid.issued-signature');
    expect(communityStoredKey()).toBe(key); // ephemeral fallback is peekable too
  });

  it('returns empty (not a throw) when issuance is unreachable', async () => {
    vi.stubGlobal('window', makeWindowWithStorage());
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const { communityParticipantKey } = await import('@/lib/community');
    expect(await communityParticipantKey()).toBe('');
  });

  it('returns empty during SSR (no window) instead of throwing', async () => {
    const { communityParticipantKey, communityStoredKey } = await import('@/lib/community');
    expect(await communityParticipantKey()).toBe('');
    expect(communityStoredKey()).toBe('');
  });

  it('forgetCommunityKey drops a rejected key so the next call re-issues', async () => {
    vi.stubGlobal('window', makeWindowWithStorage());
    const fetchMock = stubIssuance();
    const { communityParticipantKey, forgetCommunityKey } = await import('@/lib/community');
    await communityParticipantKey();
    forgetCommunityKey();
    await communityParticipantKey();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('communityApiBase', () => {
  it('is same-origin when Supabase is configured (this deployment IS the board)', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    const { communityApiBase } = await import('@/lib/community');
    expect(communityApiBase()).toBe('');
  });

  it('points an unconfigured deployment (Lyra Solo) at the canonical prod board', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    const { communityApiBase, COMMUNITY_HOME_ORIGIN } = await import('@/lib/community');
    expect(communityApiBase()).toBe(COMMUNITY_HOME_ORIGIN);
    expect(COMMUNITY_HOME_ORIGIN).toBe('https://lyra.vivacityai.com.au');
  });
});

describe('communitySignupHref', () => {
  it('deep-links to signup on the canonical prod deployment, cross-origin', async () => {
    const { communitySignupHref, COMMUNITY_HOME_ORIGIN } = await import('@/lib/community');
    // Absolute prod URL so it works from Solo (which has no auth of its own).
    expect(communitySignupHref()).toBe(`${COMMUNITY_HOME_ORIGIN}/auth/signup?from=solo`);
    expect(communitySignupHref('notifications')).toBe(`${COMMUNITY_HOME_ORIGIN}/auth/signup?from=notifications`);
  });
});

describe('classifySurface (idea provenance)', () => {
  it('maps the request Origin to the deployment it came from', async () => {
    const { classifySurface, SOLO_ORIGIN, PROD_ORIGIN } = await import('@/lib/community-contract');
    expect(classifySurface(SOLO_ORIGIN)).toBe('solo');
    expect(classifySurface(PROD_ORIGIN)).toBe('community');
    // Unknown / self-host / absent is never guessed as solo or community.
    expect(classifySurface('https://someones-fork.vercel.app')).toBe('other');
    expect(classifySurface(null)).toBe('other');
    expect(classifySurface(undefined)).toBe('other');
    expect(classifySurface('')).toBe('other');
  });
});
