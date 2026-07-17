/**
 * Double-send races in the drainer paths - and the claims that close them.
 *
 * The event-level dedupe was always race-safe (unique index + 23505 handler), but the two
 * drainers were check-then-act: releaseHeldEvents ran from BOTH the top of every dispatch and
 * the sweep, each reading status='held' before either marked, so overlapping runners sent the
 * same held alert twice; the sweep retry likewise read history before writing, so overlapping
 * sweeps both fired the retry. (The chat adapters' in-memory dedupe cannot save either case: it
 * records a key only AFTER the send resolves, and separate serverless instances share nothing.)
 *
 * The concurrency tests run two runners via Promise.all against one fake DB - deterministically
 * interleaving at the await points exactly like the prod overlap - and go RED on the unclaimed
 * code (two webhook posts). With the claims, exactly one send survives.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { releaseHeldEvents, sweepNotifications } from '../dispatch';
import { baseTables, eventRow, fakeSupabase, type Row } from './fake-supabase';

function heldDelivery(eventId: string, overrides: Row = {}): Row {
  return {
    event_id: eventId,
    user_id: 'u1',
    channel: 'held',
    status: 'held',
    idempotency_key: `${eventId}:held`,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('drainer double-send races are closed by claims', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchSpy = vi.fn(async () => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('two concurrent held releases send exactly ONE message (dispatch tick + sweep overlap)', async () => {
    const tables = baseTables();
    tables.notification_events.push(eventRow('evt-race-1'));
    tables.notification_deliveries.push(heldDelivery('evt-race-1'));
    const supabase = fakeSupabase(tables);
    const now = new Date();

    await Promise.all([releaseHeldEvents(supabase, 'u1', now), releaseHeldEvents(supabase, 'u1', now)]);

    expect(fetchSpy).toHaveBeenCalledTimes(1); // one webhook post, not two
    const heldRow = tables.notification_deliveries.find((row) => row.channel === 'held');
    expect(heldRow?.status).toBe('released');
  });

  it('two concurrent sweeps retry a failed delivery exactly ONCE', async () => {
    const tablesA = baseTables();
    tablesA.notification_events.push(eventRow('evt-race-2'));
    tablesA.notification_deliveries.push({
      event_id: 'evt-race-2',
      user_id: 'u1',
      channel: 'slack',
      status: 'failed',
      idempotency_key: 'evt-race-2:slack:ch-1',
      created_at: new Date().toISOString(),
    });
    const supabase = fakeSupabase(tablesA);
    const now = new Date();

    const [first, second] = await Promise.all([
      sweepNotifications(supabase, now),
      sweepNotifications(supabase, now),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1); // the loser's claim insert failed 23505 and it never sent
    expect(first.retried + second.retried).toBe(1);
  });

  it('a claim stranded by a crashed runner is reclaimed by the sweep after the stale window', async () => {
    const now = new Date('2026-07-18T03:00:00Z');
    const tables = baseTables();
    tables.notification_events.push(eventRow('evt-stale-1'));
    tables.notification_deliveries.push(
      // Claimed 20 minutes ago by a runner that died before delivering - silent loss without recovery.
      heldDelivery('evt-stale-1', { status: 'releasing', attempted_at: '2026-07-18T02:40:00Z' }),
    );

    const result = await sweepNotifications(fakeSupabase(tables), now);

    expect(result.released).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // late delivery beats silent loss
    const heldRow = tables.notification_deliveries.find((row) => row.channel === 'held');
    expect(heldRow?.status).toBe('released');
  });

  it('a FRESH claim is not stolen - the owning runner keeps exclusive delivery', async () => {
    const now = new Date('2026-07-18T03:00:00Z');
    const tables = baseTables();
    tables.notification_events.push(eventRow('evt-fresh-1'));
    tables.notification_deliveries.push(
      heldDelivery('evt-fresh-1', { status: 'releasing', attempted_at: '2026-07-18T02:59:00Z' }),
    );

    const result = await sweepNotifications(fakeSupabase(tables), now);

    expect(result.released).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled(); // another live runner owns it - no double delivery
  });
});
