/**
 * Authorization contract of /api/notifications/dispatch with LIVE clients mocked in - the
 * half the no-mock sibling (route.test.ts) cannot reach: who may dispatch to whom, and that
 * a refused caller produces NO side effect. Sweep-refusal and type-whitelist cases live in
 * route.test.ts; these pin the cross-user boundary.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/notifications/dispatch', () => ({
  dispatchNotificationEvent: vi.fn(async () => ({ ok: true, deliveredChannels: ['slack'], suppressedChannels: [], errors: [] })),
  sweepNotifications: vi.fn(async () => ({ usersSwept: 0, released: 0, retried: 0, errors: [] })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  })),
  createSupabaseServiceClient: vi.fn(() => ({ service: true })),
}));

import { POST } from '../route';
import { dispatchNotificationEvent, sweepNotifications } from '@/lib/notifications/dispatch';

const SECRET = 'dispatch-secret-for-tests';

function req(body: Record<string, unknown>, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/notifications/dispatch', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const VALID = { userId: 'u1', type: 'signal_alert', title: 'NVDA', body: 'reset band' };

describe('POST /api/notifications/dispatch authorization boundary', () => {
  beforeEach(() => {
    process.env.NOTIFICATION_DISPATCH_SECRET = SECRET;
    vi.clearAllMocks();
  });

  it('a session user CANNOT dispatch to another user - 403, no side effect', async () => {
    const res = await POST(req({ ...VALID, userId: 'someone-else' }));
    expect(res.status).toBe(403);
    expect(dispatchNotificationEvent).not.toHaveBeenCalled();
  });

  it('a session user can dispatch to themself', async () => {
    const res = await POST(req(VALID));
    expect(res.status).toBe(200);
    expect(dispatchNotificationEvent).toHaveBeenCalledTimes(1);
  });

  it('the service secret allows cross-user dispatch (the worker path)', async () => {
    const res = await POST(req({ ...VALID, userId: 'any-user' }, { authorization: `Bearer ${SECRET}` }));
    expect(res.status).toBe(200);
    expect(dispatchNotificationEvent).toHaveBeenCalledTimes(1);
  });

  it('a wrong secret does NOT unlock cross-user dispatch - falls to the session boundary', async () => {
    const res = await POST(req({ ...VALID, userId: 'any-user' }, { 'x-notification-secret': 'wrong' }));
    expect(res.status).toBe(403);
    expect(dispatchNotificationEvent).not.toHaveBeenCalled();
  });

  it('sweep with the correct secret runs against the service client', async () => {
    const res = await POST(req({ sweep: true }, { 'x-notification-secret': SECRET }));
    expect(res.status).toBe(200);
    expect(sweepNotifications).toHaveBeenCalledTimes(1);
  });
});
