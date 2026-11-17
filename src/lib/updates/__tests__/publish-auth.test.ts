/**
 * The signature on a publish request. Pinned to the vector both sides share
 * (contracts/updates/signature-vector.json), and to what it must refuse: a request without a
 * signature, a malformed one, one too old to be live, and one whose body changed.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import vector from '../../../../contracts/updates/signature-vector.json';
import { publishSecret, signBody, signatureHeader, TOLERANCE_SECONDS, verifySignature } from '../publish-auth';

const NOW_MS = vector.timestamp * 1000 + 30_000;

describe('the signature', () => {
  it('matches the vector the worker signs', () => {
    expect(signatureHeader(vector.secret, vector.timestamp, vector.body)).toBe(vector.header);
    expect(verifySignature(vector.secret, vector.header, vector.body, NOW_MS)).toEqual({ ok: true });
  });

  it('refuses what it should', () => {
    expect(verifySignature(vector.secret, null, vector.body, NOW_MS)).toEqual({ ok: false, reason: 'missing' });
    expect(verifySignature(vector.secret, 'v1=abc', vector.body, NOW_MS)).toEqual({ ok: false, reason: 'malformed' });
    expect(verifySignature(vector.secret, vector.header, vector.body + ' ', NOW_MS)).toEqual({ ok: false, reason: 'mismatch' });
    expect(verifySignature('another-secret-that-is-long-enough-to-count-00', vector.header, vector.body, NOW_MS)).toEqual({ ok: false, reason: 'mismatch' });
    expect(verifySignature(vector.secret, vector.header, vector.body, NOW_MS + (TOLERANCE_SECONDS + 5) * 1000)).toEqual({ ok: false, reason: 'stale' });
    expect(verifySignature(vector.secret, vector.header, vector.body, NOW_MS - (TOLERANCE_SECONDS + 60) * 1000)).toEqual({ ok: false, reason: 'stale' });
  });

  it('signs the timestamp and the body together, so neither can be swapped', () => {
    expect(signBody(vector.secret, vector.timestamp + 1, vector.body)).not.toBe(signBody(vector.secret, vector.timestamp, vector.body));
  });
});

describe('publishSecret', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is the env secret only when it is long enough to be one', () => {
    vi.stubEnv('UPDATES_PUBLISH_SECRET', '');
    expect(publishSecret()).toBeNull();
    vi.stubEnv('UPDATES_PUBLISH_SECRET', 'short');
    expect(publishSecret()).toBeNull();
    vi.stubEnv('UPDATES_PUBLISH_SECRET', vector.secret);
    expect(publishSecret()).toBe(vector.secret);
  });
});
