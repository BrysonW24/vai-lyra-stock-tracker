/**
 * Contract of /api/community/ideas - the ONE global community board.
 * The load-bearing rules pinned here:
 *   - the default listing is HUMAN ideas only (external scout signals never mix in),
 *   - ?origin=scout is a separate, scout-only listing,
 *   - an unconfigured deployment still renders the board (the two standing examples),
 *   - anonymous posting is validated (title caps, well-formed device key) and degrades
 *     with a clear message when the service role is absent,
 *   - responses carry open CORS headers so Lyra Solo can join cross-origin.
 */
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXAMPLE_IDEA_IDS } from '@/lib/community-contract';
import { issueCommunityKey } from '@/lib/community-key';

function getRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/community/ideas${query}`);
}

function postRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/community/ideas', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** A properly server-signed key - the only kind the routes accept. */
function signedKey(): string {
  vi.stubEnv('COMMUNITY_KEY_SECRET', 'test-secret');
  return issueCommunityKey()!;
}

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.doUnmock('@/lib/supabase/server');
});

describe('GET /api/community/ideas (unconfigured deployment)', () => {
  it('serves the two standing examples, human-only, with CORS open', async () => {
    const { GET } = await import('../route');
    const response = await GET(getRequest());
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    const data = (await response.json()) as { ok: boolean; demo: boolean; ideas: { id: string; origin: string }[] };
    expect(data.ok).toBe(true);
    expect(data.demo).toBe(true);
    expect(data.ideas.every((i) => i.origin === 'human')).toBe(true);
    const ids = data.ideas.map((i) => i.id);
    for (const id of EXAMPLE_IDEA_IDS) expect(ids).toContain(id);
  });

  it('?origin=scout lists only scout proposals - never the community ideas', async () => {
    const { GET } = await import('../route');
    const response = await GET(getRequest('?origin=scout'));
    const data = (await response.json()) as { ok: boolean; ideas: { origin: string }[] };
    expect(data.ok).toBe(true);
    expect(data.ideas.length).toBeGreaterThan(0);
    expect(data.ideas.every((i) => i.origin === 'scout')).toBe(true);
  });

  it('OPTIONS preflight answers 204 with the CORS contract', async () => {
    const { OPTIONS } = await import('../route');
    const response = OPTIONS();
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
  });
});

describe('POST /api/community/ideas', () => {
  it('unconfigured deployment: explains the shared board instead of failing', async () => {
    const { POST } = await import('../route');
    const response = await POST(postRequest({ title: 'A perfectly fine idea', vk: signedKey() }));
    expect(response.status).toBe(200);
    const data = (await response.json()) as { ok: boolean; demo?: boolean };
    expect(data.ok).toBe(false);
    expect(data.demo).toBe(true);
  });

  it('rejects a too-short title before touching auth (400)', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
    }));
    const { POST } = await import('../route');
    const response = await POST(postRequest({ title: 'ab', vk: signedKey() }));
    expect(response.status).toBe(400);
  });

  it('rejects an oversized body before parsing (413, not the field-level 400)', async () => {
    const { POST } = await import('../route');
    // 20KB body: over the 16KB pre-parse gate. A 400 here would mean the body was parsed
    // and field validation ran - exactly what the size gate exists to prevent.
    const response = await POST(postRequest({ title: 'x', description: 'a'.repeat(20_000) }));
    expect(response.status).toBe(413);
  });

  it('anonymous post rejects a client-minted (unsigned) key with badKey (400)', async () => {
    vi.stubEnv('COMMUNITY_KEY_SECRET', 'test-secret');
    vi.doMock('@/lib/supabase/server', () => ({
      createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
    }));
    const { POST } = await import('../route');
    const response = await POST(postRequest({ title: 'A perfectly fine idea', vk: '3f9a2b1c-4d5e-4f6a-8b7c-9d0e1f2a3b4c' }));
    expect(response.status).toBe(400);
    const data = (await response.json()) as { badKey?: boolean };
    expect(data.badKey).toBe(true);
  });

  it('anonymous post degrades clearly when the service role is absent (503)', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
    }));
    const { POST } = await import('../route');
    const response = await POST(postRequest({ title: 'A perfectly fine idea', vk: signedKey() }));
    expect(response.status).toBe(503);
  });
});
