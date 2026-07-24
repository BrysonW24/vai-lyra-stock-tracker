/**
 * Contract of the signed participant key: the whole point is that a client CANNOT mint a
 * key the server accepts - issuance is server-side, verification rejects tampering, and
 * a deployment with no secret material issues nothing rather than something weak.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VOTER_KEY_PATTERN } from '@/lib/community-contract';
import { issueCommunityKey, verifyCommunityKey } from '@/lib/community-key';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('community participant keys', () => {
  it('round-trips: an issued key verifies to its uuid half', () => {
    vi.stubEnv('COMMUNITY_KEY_SECRET', 'test-secret');
    const key = issueCommunityKey();
    expect(key).toBeTruthy();
    const uuid = verifyCommunityKey(key);
    expect(uuid).toBeTruthy();
    expect(uuid).toMatch(VOTER_KEY_PATTERN);
    expect(key!.startsWith(`${uuid}.`)).toBe(true);
  });

  it('rejects a client-minted (unsigned) uuid - the vote-inflation vector', () => {
    vi.stubEnv('COMMUNITY_KEY_SECRET', 'test-secret');
    expect(verifyCommunityKey('3f9a2b1c-4d5e-4f6a-8b7c-9d0e1f2a3b4c')).toBeNull();
    expect(verifyCommunityKey('3f9a2b1c-4d5e-4f6a-8b7c-9d0e1f2a3b4c.0000000000000000000000000000000f')).toBeNull();
  });

  it('rejects a tampered uuid under a valid-looking signature', () => {
    vi.stubEnv('COMMUNITY_KEY_SECRET', 'test-secret');
    const key = issueCommunityKey()!;
    const [uuid, sig] = key.split('.');
    const flipped = uuid!.startsWith('a') ? `b${uuid!.slice(1)}` : `a${uuid!.slice(1)}`;
    expect(verifyCommunityKey(`${flipped}.${sig}`)).toBeNull();
  });

  it('keys signed under a different secret do not verify (rotation invalidates)', () => {
    vi.stubEnv('COMMUNITY_KEY_SECRET', 'old-secret');
    const key = issueCommunityKey()!;
    vi.stubEnv('COMMUNITY_KEY_SECRET', 'new-secret');
    expect(verifyCommunityKey(key)).toBeNull();
  });

  it('with no secret material at all: issues nothing, verifies nothing', () => {
    vi.stubEnv('COMMUNITY_KEY_SECRET', '');
    vi.stubEnv('AUTH_SECRET', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect(issueCommunityKey()).toBeNull();
    expect(verifyCommunityKey('anything.anything')).toBeNull();
  });
});
