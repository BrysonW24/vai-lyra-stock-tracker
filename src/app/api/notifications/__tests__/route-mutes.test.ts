/**
 * PATCH /api/notifications - the mute half of the preferences contract. The client's mute
 * controls (AccountMenu "Muted" mode, timed snoozes) PATCH muteAll/mutedUntil/mutedSymbols/
 * mutedThemes; this proves those fields actually land in user_alert_preferences columns with
 * normalisation applied. RED on the pre-051 handler, which silently ignored every mute key -
 * the exact defect that made the visible mute controls theatre.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const upserts: Array<Record<string, unknown>> = [];

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: (table: string) => ({
      upsert: (payload: Record<string, unknown>) => {
        if (table === 'user_alert_preferences') upserts.push(payload);
        return Promise.resolve({ error: null });
      },
    }),
  })),
  createSupabaseServiceClient: vi.fn(() => null),
}));

import { PATCH } from '../route';

function patchReq(preferences: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/notifications', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ preferences }),
  });
}

describe('PATCH /api/notifications mute contract', () => {
  beforeEach(() => {
    upserts.length = 0;
  });

  it('persists muteAll + a valid mutedUntil into the real columns', async () => {
    const res = await PATCH(patchReq({ muteAll: true, mutedUntil: '2026-07-18T05:00:00.000Z' }));
    expect(res.status).toBe(200);
    expect(upserts).toHaveLength(1);
    expect(upserts[0].mute_all).toBe(true);
    expect(upserts[0].muted_until).toBe('2026-07-18T05:00:00.000Z');
  });

  it('normalises muted symbols - trimmed, uppercased, deduped, empties dropped', async () => {
    await PATCH(patchReq({ mutedSymbols: [' nvda ', 'NVDA', '', 'tsla', 42, 'x'.repeat(30)] }));
    expect(upserts[0].muted_symbols).toEqual(['NVDA', 'TSLA']);
  });

  it('stores muted themes lowercase (the router matches case-insensitively)', async () => {
    await PATCH(patchReq({ mutedThemes: ['Quantum', 'FUSION'] }));
    expect(upserts[0].muted_themes).toEqual(['quantum', 'fusion']);
  });

  it('an unparseable mutedUntil stores null - a bad value must fail OPEN, never mute forever', async () => {
    await PATCH(patchReq({ mutedUntil: 'not-a-date' }));
    expect(upserts[0].muted_until).toBeNull();
  });

  it('clearing the snooze (mutedUntil null) persists null', async () => {
    await PATCH(patchReq({ muteAll: false, mutedUntil: null }));
    expect(upserts[0].mute_all).toBe(false);
    expect(upserts[0].muted_until).toBeNull();
  });
});
