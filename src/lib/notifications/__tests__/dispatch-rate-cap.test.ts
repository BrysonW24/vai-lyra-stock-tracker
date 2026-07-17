/**
 * The alert rate governor + server-enforced Quiet mode - both born from a live founder report:
 * six pushes in five minutes, and switching to Quiet changed nothing because the mode never
 * left localStorage. These pin the fixes end to end through the real dispatch path. RED on the
 * pre-052 code (no cap: the 7th alert sends; no quiet rule: watchlist noise delivers).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchNotificationEvent, releaseHeldEvents } from '../dispatch';
import { baseTables, eventRow, fakeSupabase, type Row } from './fake-supabase';

function sentDelivery(eventId: string, minutesAgo: number): Row {
  return {
    event_id: eventId,
    user_id: 'u1',
    channel: 'slack',
    status: 'sent',
    idempotency_key: `${eventId}:slack:ch-1`,
    created_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  };
}

function alert(symbol: string, overrides: Record<string, unknown> = {}) {
  return {
    userId: 'u1',
    type: 'watchlist_price_move' as const,
    title: `${symbol} moved`,
    body: `${symbol} moved 5%`,
    symbol,
    relevanceScore: 90,
    ...overrides,
  };
}

describe('per-user alert rate cap (max_alerts_per_hour)', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchSpy = vi.fn(async () => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function tablesWithCap(cap: number, sentThisHour: number): Record<string, Row[]> {
    const tables = baseTables();
    tables.user_alert_preferences = [
      { user_id: 'u1', quiet_hours_enabled: false, slack_enabled: true, min_signal_score: 40, max_alerts_per_hour: cap },
    ];
    for (let i = 0; i < sentThisHour; i++) {
      tables.notification_events.push(eventRow(`evt-sent-${i}`));
      tables.notification_deliveries.push(sentDelivery(`evt-sent-${i}`, 5 + i));
    }
    return tables;
  }

  it('the alert OVER the cap parks as held instead of buzzing the phone', async () => {
    const tables = tablesWithCap(6, 6); // six already sent inside the hour - the founder's burst
    const result = await dispatchNotificationEvent(fakeSupabase(tables), alert('NVDA'));

    expect(result.routeReason).toBe('rate cap');
    expect(result.deliveredChannels).toEqual(['held']);
    expect(fetchSpy).not.toHaveBeenCalled(); // nothing reached the webhook
    const heldRow = tables.notification_deliveries.find((row) => row.channel === 'held');
    expect(heldRow?.status).toBe('held');
  });

  it('under the cap the alert delivers normally', async () => {
    const tables = tablesWithCap(6, 3);
    const result = await dispatchNotificationEvent(fakeSupabase(tables), alert('NVDA'));
    expect(result.deliveredChannels).toContain('slack');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('a safety-critical approval BYPASSES the cap - even mid-flood', async () => {
    const tables = tablesWithCap(6, 10);
    const result = await dispatchNotificationEvent(
      fakeSupabase(tables),
      alert('NVDA', { type: 'paper_approval_required', relevanceScore: 100 }),
    );
    expect(result.deliveredChannels).toContain('slack');
  });

  it('release drains held alerts only up to the remaining budget - never a second flood', async () => {
    const tables = tablesWithCap(6, 5); // budget of 1 remains
    for (const id of ['evt-held-a', 'evt-held-b', 'evt-held-c']) {
      tables.notification_events.push(eventRow(id));
      tables.notification_deliveries.push({
        event_id: id,
        user_id: 'u1',
        channel: 'held',
        status: 'held',
        idempotency_key: `${id}:held`,
        created_at: new Date().toISOString(),
      });
    }

    const released = await releaseHeldEvents(fakeSupabase(tables), 'u1', new Date());

    expect(released).toBe(1); // one slot in the window -> one release; the rest wait
    expect(tables.notification_deliveries.filter((row) => row.channel === 'held' && row.status === 'held')).toHaveLength(2);
  });
});

describe('Quiet mode is enforced server-side', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchSpy = vi.fn(async () => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function quietTables(): Record<string, Row[]> {
    const tables = baseTables();
    tables.user_alert_preferences = [
      { user_id: 'u1', quiet_hours_enabled: false, slack_enabled: true, min_signal_score: 40, alert_mode: 'quiet' },
    ];
    return tables;
  }

  it('watchlist noise is dropped in quiet mode - the founder flipped Quiet and it now means it', async () => {
    const result = await dispatchNotificationEvent(fakeSupabase(quietTables()), alert('NVDA'));
    expect(result.routeReason).toBe('quiet mode');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('a strong setup still gets through in quiet mode', async () => {
    const result = await dispatchNotificationEvent(
      fakeSupabase(quietTables()),
      alert('NVDA', { type: 'signal_alert', relevanceScore: 90 }),
    );
    expect(result.deliveredChannels).toContain('slack');
  });

  it('a WEAK signal does not - quiet keeps the strong-setups-only promise', async () => {
    const result = await dispatchNotificationEvent(
      fakeSupabase(quietTables()),
      alert('NVDA', { type: 'signal_alert', relevanceScore: 60 }),
    );
    expect(result.routeReason).toBe('quiet mode');
  });

  it('portfolio risk still gets through in quiet mode', async () => {
    const result = await dispatchNotificationEvent(
      fakeSupabase(quietTables()),
      alert('NVDA', { type: 'portfolio_risk', relevanceScore: 90 }),
    );
    expect(result.deliveredChannels).toContain('slack');
  });

  it('alert_mode muted folds into the global mute', async () => {
    const tables = quietTables();
    tables.user_alert_preferences = [
      { user_id: 'u1', quiet_hours_enabled: false, slack_enabled: true, min_signal_score: 40, alert_mode: 'muted' },
    ];
    const result = await dispatchNotificationEvent(fakeSupabase(tables), alert('NVDA'));
    expect(result.routeReason).toBe('muted all');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
