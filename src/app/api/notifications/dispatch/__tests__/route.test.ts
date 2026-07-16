/**
 * Security contract of /api/notifications/dispatch - the first route-handler test in the
 * repo. The audit's finding: 28 routes, zero tests, meaning the dispatch secret or type
 * whitelist could be deleted with every gate staying green. This pins the contract:
 * sweep is service-only, the type whitelist rejects unknown types, validation rejects
 * incomplete bodies - all BEFORE any Supabase access.
 */
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it } from 'vitest';
import { POST } from '../route';

function request(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/notifications/dispatch', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/notifications/dispatch', () => {
  afterEach(() => {
    delete process.env.NOTIFICATION_DISPATCH_SECRET;
  });

  it('rejects a sweep without the dispatch secret (401)', async () => {
    process.env.NOTIFICATION_DISPATCH_SECRET = 'right-secret';
    const response = await POST(request({ sweep: true }));
    expect(response.status).toBe(401);
  });

  it('rejects a sweep with the WRONG secret (401), even at equal length', async () => {
    process.env.NOTIFICATION_DISPATCH_SECRET = 'right-secret';
    const response = await POST(request({ sweep: true }, { 'x-notification-secret': 'wrong-secret' }));
    expect(response.status).toBe(401);
  });

  it('rejects a sweep when NO secret is configured - fail closed, not fail open', async () => {
    const response = await POST(request({ sweep: true }));
    expect(response.status).toBe(401);
  });

  it('rejects an unknown notification type (400)', async () => {
    const response = await POST(
      request({ userId: 'u1', type: 'made_up_type', title: 'x', body: 'y' }),
    );
    expect(response.status).toBe(400);
    const parsed = (await response.json()) as { error?: string };
    expect(parsed.error).toMatch(/type is invalid/i);
  });

  it('rejects an incomplete body (400) before touching any backend', async () => {
    const response = await POST(request({ userId: 'u1', type: 'signal_alert', title: '  ' }));
    expect(response.status).toBe(400);
  });

  it('accepts signal_followup as a valid type (the coaching follow-up loop)', async () => {
    // No secret + no Supabase env in tests: a VALID body must get past validation and
    // return the demo shape (200, ok:false, demo:true) - not a 400.
    const response = await POST(
      request({ userId: 'u1', type: 'signal_followup', title: 'NVDA follow-up', body: '+8.2% in 5 days' }),
    );
    expect(response.status).toBe(200);
    const parsed = (await response.json()) as { demo?: boolean; ok?: boolean };
    expect(parsed.demo).toBe(true);
  });
});
