/**
 * sweepNotifications - the maintenance drainer. Proves the two previously-terminal
 * states recover: held events release for users with NO new inbound event, and a
 * failed chat delivery is retried exactly once (never looping, never re-retrying).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sweepNotifications } from '../dispatch';

type Row = Record<string, unknown>;

/** Minimal thenable query builder over in-memory tables - just the chains dispatch uses. */
class FakeQuery {
  private filters: Array<(row: Row) => boolean> = [];
  private patch: Row | null = null;
  private inserted: Row | null = null;
  private max: number | null = null;

  constructor(private readonly rows: Row[]) {}

  select(_columns?: string) {
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }
  gte(column: string, value: string) {
    this.filters.push((row) => String(row[column] ?? '') >= value);
    return this;
  }
  order() {
    return this;
  }
  limit(count: number) {
    this.max = count;
    return this;
  }
  update(patch: Row) {
    this.patch = patch;
    return this;
  }
  insert(row: Row) {
    this.inserted = row;
    return this;
  }
  private matches(): Row[] {
    const filtered = this.rows.filter((row) => this.filters.every((filter) => filter(row)));
    return this.max === null ? filtered : filtered.slice(0, this.max);
  }
  private run(): { data: Row[] | null; error: null } {
    if (this.inserted) {
      this.rows.push({ created_at: new Date().toISOString(), ...this.inserted });
      return { data: null, error: null };
    }
    if (this.patch) {
      for (const row of this.matches()) Object.assign(row, this.patch);
      return { data: null, error: null };
    }
    return { data: this.matches(), error: null };
  }
  maybeSingle(): Promise<{ data: Row | null; error: null }> {
    return Promise.resolve({ data: this.matches()[0] ?? null, error: null });
  }
  then<T>(resolve: (value: { data: Row[] | null; error: null }) => T): Promise<T> {
    return Promise.resolve(resolve(this.run()));
  }
}

function fakeSupabase(tables: Record<string, Row[]>) {
  return {
    from: (table: string) => new FakeQuery(tables[table] ?? (tables[table] = [])),
  };
}

const WEBHOOK = 'https://hooks.slack.com/services/T111/B222/secretsecretsecret';

function baseTables(): Record<string, Row[]> {
  return {
    user_alert_preferences: [
      { user_id: 'u1', quiet_hours_enabled: false, slack_enabled: true, min_signal_score: 40 },
    ],
    notification_channels: [
      { id: 'ch-1', user_id: 'u1', channel_type: 'slack', destination: WEBHOOK, is_active: true, is_verified: true },
    ],
    profiles: [],
    push_subscriptions: [],
    notification_events: [],
    notification_deliveries: [],
  };
}

function eventRow(id: string): Row {
  return {
    id,
    type: 'signal_alert',
    severity: 'medium',
    user_id: 'u1',
    title: 'NVDA signal',
    body: 'NVDA entered the reset band.',
    trigger_reason: 'score crossed 80',
    evidence_refs: [],
    relevance_score: 90,
    dedupe_key: `signal_alert:nvda:${id}`,
    idempotency_key: `${id}:event`,
    url: '/tickers/NVDA',
    created_at: new Date().toISOString(),
  };
}

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
    const retryRow = tables.notification_deliveries.find((row) =>
      String(row.idempotency_key ?? '').endsWith(':retry1'),
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
