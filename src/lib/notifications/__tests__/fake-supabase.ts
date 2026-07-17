/**
 * Shared in-memory Supabase fake for the notification dispatch tests. Just the query chains
 * dispatch.ts uses - thenable builders over plain row arrays, one FakeQuery per .from() call.
 *
 * Two deliberate pieces of realism:
 *  - update(...).select() returns the UPDATED rows (PostgREST semantics) - the release path's
 *    atomic claim depends on seeing which rows it actually claimed.
 *  - insert() fails with Postgres error 23505 when the row's idempotency_key already exists in
 *    the table, mirroring prod's uq_notification_deliveries_idem unique index - the retry
 *    claim's exactly-once property depends on the second insert failing.
 */

export type Row = Record<string, unknown>;

let rowSeq = 0;

export class FakeQuery {
  private filters: Array<(row: Row) => boolean> = [];
  private patch: Row | null = null;
  private inserted: Row | null = null;
  private max: number | null = null;
  private selectAfterWrite = false;

  constructor(private readonly rows: Row[]) {}

  select(_columns?: string) {
    if (this.patch || this.inserted) this.selectAfterWrite = true;
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
  lt(column: string, value: string) {
    this.filters.push((row) => String(row[column] ?? '') < value);
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
  insert(row: Row | Row[]) {
    this.inserted = Array.isArray(row) ? row[0] : row;
    return this;
  }
  private matches(): Row[] {
    const filtered = this.rows.filter((row) => this.filters.every((filter) => filter(row)));
    return this.max === null ? filtered : filtered.slice(0, this.max);
  }
  private run(): { data: Row[] | null; error: { code?: string; message: string } | null } {
    if (this.inserted) {
      // Simulate the unique index on idempotency_key: a second insert with the same
      // non-null key fails 23505, exactly like prod after migration 051.
      const key = this.inserted.idempotency_key;
      if (key != null && this.rows.some((row) => row.idempotency_key === key)) {
        return {
          data: null,
          error: { code: '23505', message: 'duplicate key value violates unique constraint "uq_notification_deliveries_idem"' },
        };
      }
      rowSeq += 1;
      const stored = { id: `row-${rowSeq}`, created_at: new Date().toISOString(), ...this.inserted };
      this.rows.push(stored);
      return { data: this.selectAfterWrite ? [stored] : null, error: null };
    }
    if (this.patch) {
      // Capture matches BEFORE assigning - the patch may un-match the filter (that is the
      // whole point of the status='held' -> 'releasing' claim) and PostgREST returns the rows
      // the UPDATE affected, post-update.
      const hit = this.matches();
      for (const row of hit) Object.assign(row, this.patch);
      return { data: this.selectAfterWrite ? hit : null, error: null };
    }
    return { data: this.matches(), error: null };
  }
  maybeSingle(): Promise<{ data: Row | null; error: null }> {
    return Promise.resolve({ data: this.matches()[0] ?? null, error: null });
  }
  single(): Promise<{ data: Row | null; error: { code?: string; message: string } | null }> {
    const result = this.run();
    const row = result.data?.[0] ?? null;
    return Promise.resolve({ data: row, error: result.error ?? (row ? null : { message: 'no rows' }) });
  }
  then<T>(resolve: (value: { data: Row[] | null; error: { code?: string; message: string } | null }) => T): Promise<T> {
    return Promise.resolve(resolve(this.run()));
  }
}

export function fakeSupabase(tables: Record<string, Row[]>) {
  return {
    from: (table: string) => new FakeQuery(tables[table] ?? (tables[table] = [])),
  };
}

export const SLACK_WEBHOOK = 'https://hooks.slack.com/services/T111/B222/secretsecretsecret';

/** One user, one verified Slack channel, quiet hours off - the minimal deliverable setup. */
export function baseTables(): Record<string, Row[]> {
  return {
    user_alert_preferences: [
      { user_id: 'u1', quiet_hours_enabled: false, slack_enabled: true, min_signal_score: 40 },
    ],
    notification_channels: [
      { id: 'ch-1', user_id: 'u1', channel_type: 'slack', destination: SLACK_WEBHOOK, is_active: true, is_verified: true },
    ],
    profiles: [],
    push_subscriptions: [],
    notification_events: [],
    notification_deliveries: [],
  };
}

export function eventRow(id: string, overrides: Row = {}): Row {
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
    ...overrides,
  };
}
