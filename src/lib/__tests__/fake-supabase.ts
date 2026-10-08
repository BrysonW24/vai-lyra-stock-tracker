/**
 * A tiny recording Supabase client for store tests: every builder chain is logged as one Call and
 * answered by the handler the test supplies. Thenable, so `await client.from(t).update(x).eq(...)`
 * resolves like the real builder does.
 */
export interface Call {
  table: string;
  op: 'select' | 'insert' | 'update' | 'upsert';
  payload?: unknown;
  options?: unknown;
  columns?: string;
  filters: Array<[string, string, unknown]>;
}

export interface Answer {
  data?: unknown;
  error?: { code?: string; message?: string } | null;
}

export function fakeSupabase(answer: (call: Call) => Answer) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const call: Call = { table, op: 'select', filters: [] };
    const resolve = async () => {
      calls.push(call);
      const result = answer(call);
      return { data: result.data ?? null, error: result.error ?? null };
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = {
      select: (columns?: string) => {
        call.columns = columns;
        return builder;
      },
      insert: (payload: unknown) => {
        call.op = 'insert';
        call.payload = payload;
        return builder;
      },
      update: (payload: unknown) => {
        call.op = 'update';
        call.payload = payload;
        return builder;
      },
      upsert: (payload: unknown, options?: unknown) => {
        call.op = 'upsert';
        call.payload = payload;
        call.options = options;
        return builder;
      },
      eq: (column: string, value: unknown) => {
        call.filters.push(['eq', column, value]);
        return builder;
      },
      neq: (column: string, value: unknown) => {
        call.filters.push(['neq', column, value]);
        return builder;
      },
      is: (column: string, value: unknown) => {
        call.filters.push(['is', column, value]);
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      maybeSingle: () => resolve(),
      single: () => resolve(),
      then: (onFulfilled: (value: Answer) => unknown, onRejected?: (reason: unknown) => unknown) => resolve().then(onFulfilled, onRejected),
    };
    return builder;
  };
  return { client: { from }, calls };
}
