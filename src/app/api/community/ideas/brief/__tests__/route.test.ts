/**
 * Contract of /api/community/ideas/brief - the AI-grounded scout-card read. The card
 * NEVER depends on AI: every failure path must return ok:false (never a 500), so the
 * client keeps the deterministic template description.
 */
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { POST } from '../route';

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/community/ideas/brief', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/community/ideas/brief', () => {
  it('rejects a body without an ideaId (400)', async () => {
    const response = await POST(request({ ai: { mode: 'off', provider: 'openai', apiKey: '' } }));
    expect(response.status).toBe(400);
    const data = (await response.json()) as { ok: boolean };
    expect(data.ok).toBe(false);
  });

  it('returns ok:false (not an error status) with no Supabase - the template stands', async () => {
    const response = await POST(
      request({ ideaId: 'some-id', ai: { mode: 'hosted', provider: 'openai', apiKey: '' } }),
    );
    expect(response.status).toBe(200);
    const data = (await response.json()) as { ok: boolean; reason?: string };
    expect(data.ok).toBe(false);
    expect(data.reason).toBe('demo');
  });
});
