/**
 * Contract of /api/community/key - the anonymous-participation choke point. Issues signed
 * keys (CORS-open for Lyra Solo); a deployment without secret material answers 503.
 */
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyCommunityKey } from '@/lib/community-key';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('GET /api/community/key', () => {
  it('issues a key that verifies, with CORS open', async () => {
    vi.stubEnv('COMMUNITY_KEY_SECRET', 'test-secret');
    const { GET } = await import('../route');
    const response = await GET(new NextRequest('http://localhost/api/community/key'));
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    const data = (await response.json()) as { ok: boolean; key: string };
    expect(data.ok).toBe(true);
    expect(verifyCommunityKey(data.key)).toBeTruthy();
  });

  it('answers 503 when the deployment has no secret material', async () => {
    vi.stubEnv('COMMUNITY_KEY_SECRET', '');
    vi.stubEnv('AUTH_SECRET', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    const { GET } = await import('../route');
    const response = await GET(new NextRequest('http://localhost/api/community/key'));
    expect(response.status).toBe(503);
  });

  it('OPTIONS preflight answers 204', async () => {
    const { OPTIONS } = await import('../route');
    expect(OPTIONS().status).toBe(204);
  });
});
