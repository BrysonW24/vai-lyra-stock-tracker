/**
 * Engagement capture contract: malformed nids are rejected before any backend access,
 * and with no Supabase configured the beacon's post degrades to a clean demo no-op -
 * telemetry must never error a page.
 */
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { POST } from '../route';

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/notifications/engaged', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/notifications/engaged', () => {
  it('rejects a non-uuid nid (400) before touching any backend', async () => {
    const response = await POST(request({ nid: 'not-a-uuid', ch: 'telegram' }));
    expect(response.status).toBe(400);
  });

  it('no-ops cleanly in demo (no service client) for a well-formed nid', async () => {
    const response = await POST(request({ nid: '123e4567-e89b-42d3-a456-426614174000', ch: 'push' }));
    expect(response.status).toBe(200);
    const data = (await response.json()) as { ok: boolean; demo?: boolean };
    expect(data.ok).toBe(true);
    expect(data.demo).toBe(true);
  });
});
