/**
 * sweepNotifications - the maintenance drainer. Proves the two previously-terminal
 * states recover: held events release for users with NO new inbound event, and a
 * failed chat delivery is retried exactly once (never looping, never re-retrying).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sweepNotifications } from '../dispatch';
import { baseTables, eventRow, fakeSupabase } from './fake-supabase';

describe('sweepNotifications', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('ok', { status: 200 })),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('releases held events for users with no new inbound event', async () => {
    const tables = baseTables();
    tables.notification_events.push(eventRow('evt-held-1'));
    tables.notification_deliveries.push({
      event_id: 'evt-held-1',
      user_id: 'u1',
      channel: 'held',
      status: 'held',
      idempotency_key: 'evt-held-1:held',
      created_at: new Date().toISOString(),
    });

    const result = await sweepNotifications(fakeSupabase(tables), new Date());

    expect(result.usersSwept).toBe(1);
    expect(result.released).toBe(1);
    const heldRow = tables.notification_deliveries.find((row) => row.channel === 'held');
    expect(heldRow?.status).toBe('released');
    const sent = tables.notification_deliveries.find(
      (row) => row.channel === 'slack' && row.status === 'sent',
    );
    expect(sent).toBeTruthy();
  });

  it('retries a failed chat delivery exactly once', async () => {
    const tables = baseTables();
    tables.notification_events.push(eventRow('evt-fail-1'));
    tables.notification_deliveries.push({
      event_id: 'evt-fail-1',
      user_id: 'u1',
      channel: 'slack',
      status: 'failed',
      idempotency_key: 'evt-fail-1:slack:ch-1',
      created_at: new Date().toISOString(),
    });

    const first = await sweepNotifications(fakeSupabase(tables), new Date());
    expect(first.retried).toBe(1);
    // The sent retry row (per-destination), not the claim marker - both keys end ':retry1'.
    const retryRow = tables.notification_deliveries.find(
      (row) => String(row.idempotency_key ?? '').endsWith(':retry1') && row.status === 'sent',
    );
    expect(retryRow?.status).toBe('sent');

    // Second sweep: the retry already happened (and succeeded) - nothing re-fires.
    const second = await sweepNotifications(fakeSupabase(tables), new Date());
    expect(second.retried).toBe(0);
  });

  it('does not retry when the retry itself failed - one retry is the ceiling', async () => {
    const tables = baseTables();
    tables.notification_events.push(eventRow('evt-fail-2'));
    tables.notification_deliveries.push(
      {
        event_id: 'evt-fail-2',
        user_id: 'u1',
        channel: 'slack',
        status: 'failed',
        idempotency_key: 'evt-fail-2:slack:ch-1',
        created_at: new Date().toISOString(),
      },
      {
        event_id: 'evt-fail-2',
        user_id: 'u1',
        channel: 'slack',
        status: 'failed',
        idempotency_key: 'evt-fail-2:slack:ch-1:retry1',
        created_at: new Date().toISOString(),
      },
    );

    const result = await sweepNotifications(fakeSupabase(tables), new Date());

    expect(result.retried).toBe(0);
  });

  it('leaves a retry parked while the user is inside quiet hours', async () => {
    const tables = baseTables();
    tables.user_alert_preferences = [
      {
        user_id: 'u1',
        quiet_hours_enabled: true,
        quiet_start: '00:00',
        quiet_end: '23:59',
        timezone: 'UTC',
        slack_enabled: true,
        min_signal_score: 40,
      },
    ];
    tables.notification_events.push(eventRow('evt-fail-3'));
    tables.notification_deliveries.push({
      event_id: 'evt-fail-3',
      user_id: 'u1',
      channel: 'slack',
      status: 'failed',
      idempotency_key: 'evt-fail-3:slack:ch-1',
      created_at: new Date().toISOString(),
    });

    const result = await sweepNotifications(fakeSupabase(tables), new Date());

    expect(result.retried).toBe(0);
    expect(
      tables.notification_deliveries.some((row) => String(row.idempotency_key ?? '').endsWith(':retry1')),
    ).toBe(false);
  });
});
