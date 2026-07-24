/**
 * Contract of /api/community/vote - voting without an account.
 * Pins: anonymous votes need a well-formed device key; the pre-migration-053 database
 * answers with a clear 503 (never a 500); a valid anonymous toggle writes the voter_key
 * row and returns the trigger-maintained tally; CORS stays open for Lyra Solo.
 */
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { issueCommunityKey } from '@/lib/community-key';

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/community/vote', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** A properly server-signed key - the only kind the route accepts. */
function signedKey(): string {
  vi.stubEnv('COMMUNITY_KEY_SECRET', 'test-secret');
  return issueCommunityKey()!;
}

function mockSignedOutServer() {
  vi.doMock('@/lib/supabase/server', () => ({
    createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
  }));
}

/** Minimal chainable fake for the exact call shapes the route makes. */
function fakeAdmin(opts: {
  lookup: { data?: { id: string } | null; error?: { code?: string; message?: string } | null };
  insertError?: { code?: string; message?: string } | null;
  voteCount?: number;
}) {
  return {
    from(table: string) {
      if (table === 'community_idea_votes') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.lookup.data ?? null, error: opts.lookup.error ?? null }) }) }) }),
          insert: async () => ({ error: opts.insertError ?? null }),
          delete: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
        };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { vote_count: opts.voteCount ?? 0 } }) }) }) };
    },
  };
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('@/lib/supabase/server');
  vi.unstubAllEnvs();
  vi.doUnmock('@/lib/supabase/admin');
});

describe('POST /api/community/vote', () => {
  it('unconfigured deployment: explains the shared board instead of failing', async () => {
    const { POST } = await import('../route');
    const response = await POST(request({ ideaId: 'x', vk: signedKey() }));
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    const data = (await response.json()) as { ok: boolean; demo?: boolean };
    expect(data.ok).toBe(false);
    expect(data.demo).toBe(true);
  });

  it('anonymous vote needs a well-formed device key (400 on garbage)', async () => {
    mockSignedOutServer();
    const { POST } = await import('../route');
    const response = await POST(request({ ideaId: 'x', vk: 'garbage' }));
    expect(response.status).toBe(400);
  });

  it('pre-053 database (voter_key column missing) answers 503, never 500', async () => {
    mockSignedOutServer();
    vi.doMock('@/lib/supabase/admin', () => ({
      createSupabaseAdminClient: () => fakeAdmin({ lookup: { error: { code: '42703', message: 'column community_idea_votes.voter_key does not exist' } } }),
    }));
    const { POST } = await import('../route');
    const response = await POST(request({ ideaId: 'x', vk: signedKey() }));
    expect(response.status).toBe(503);
    const data = (await response.json()) as { ok: boolean };
    expect(data.ok).toBe(false);
  });

  it('valid anonymous toggle-on returns voted:true with the authoritative tally', async () => {
    mockSignedOutServer();
    vi.doMock('@/lib/supabase/admin', () => ({
      createSupabaseAdminClient: () => fakeAdmin({ lookup: { data: null }, voteCount: 5 }),
    }));
    const { POST } = await import('../route');
    const response = await POST(request({ ideaId: 'x', vk: signedKey() }));
    expect(response.status).toBe(200);
    const data = (await response.json()) as { ok: boolean; voted: boolean; voteCount: number };
    expect(data).toMatchObject({ ok: true, voted: true, voteCount: 5 });
  });

  it('valid anonymous toggle-off removes the vote', async () => {
    mockSignedOutServer();
    vi.doMock('@/lib/supabase/admin', () => ({
      createSupabaseAdminClient: () => fakeAdmin({ lookup: { data: { id: 'vote-1' } }, voteCount: 4 }),
    }));
    const { POST } = await import('../route');
    const response = await POST(request({ ideaId: 'x', vk: signedKey() }));
    const data = (await response.json()) as { ok: boolean; voted: boolean; voteCount: number };
    expect(data).toMatchObject({ ok: true, voted: false, voteCount: 4 });
  });
});
