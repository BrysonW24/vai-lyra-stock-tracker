import { describe, expect, it } from 'vitest';
import { dropStaleSignals, loadTickersWithLatestSignal } from '@/lib/data';

/**
 * The dashboard's signal read. It used to be `order by candle_time desc limit 80`, which silently
 * dropped 19 of 99 scanned tickers on every render (and scanned a 69 MB table to do it). These
 * tests pin the two things that replaced it: nothing falls off a limit, and the request is the
 * per-ticker, index-backed shape.
 */

type Op = [string, unknown[]];
interface Call { table: string; ops: Op[] }

/** A recording stand-in for the Supabase query builder: every chained call is logged, and awaiting
 *  it resolves to whatever `respond` returns for that call. */
function recordingClient(respond: (call: Call) => { data?: unknown; error?: unknown }) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const builder: Record<string, unknown> = {};
      const proxy: unknown = new Proxy(builder, {
        get(_target, prop: string) {
          if (prop === 'then') {
            return (resolve: (value: unknown) => void) => resolve({ data: null, error: null, ...respond(call) });
          }
          return (...args: unknown[]) => {
            call.ops.push([prop, args]);
            return proxy;
          };
        },
      });
      return proxy;
    },
  };
  return { client: client as never, calls };
}

const signal = (symbol: string, candle_time: string, timeframe = '1h') => ({
  symbol, timeframe, candle_time, signal_score: 50, signal_type: 'momentum_recovery_v1', signal_status: 'neutral',
  previous_signal_score: null, signal_score_delta: null, action_state: null, lifecycle_state: null, explanation: null,
  rsi_summary: null, macd_summary: null, volume_summary: null, trend_summary: null, price_summary: null, raw_payload: null,
});
const ticker = (symbol: string, signals: unknown[], scan_timeframe: string | null = '1h') => ({
  symbol, company_name: symbol, sector: null, industry: null, category: null, exchange: 'NASDAQ', is_active: true,
  scan_timeframe, stock_signals: signals,
});

const NEWEST = '2026-10-02T19:30:00+00:00';

describe('loadTickersWithLatestSignal', () => {
  it('returns a signal for every scanned ticker - a universe larger than any old limit loses none', async () => {
    const universe = Array.from({ length: 140 }, (_, i) => ticker(`T${String(i).padStart(3, '0')}`, [signal(`T${String(i).padStart(3, '0')}`, NEWEST)]));
    const { client } = recordingClient(() => ({ data: universe }));

    const result = await loadTickersWithLatestSignal(client);

    expect(result.failed).toBe(false);
    expect(result.tickers).toHaveLength(140);
    expect(new Set(result.signals.map((s) => s.symbol)).size).toBe(140);
  });

  it('asks for exactly one newest signal per ticker, on the scan timeframe (the index-backed shape)', async () => {
    const { client, calls } = recordingClient(() => ({ data: [ticker('NVDA', [signal('NVDA', NEWEST)])] }));

    await loadTickersWithLatestSignal(client);

    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe('stock_tickers');
    const ops = calls[0].ops;
    // The embedded filter is what lets Postgres walk (symbol, timeframe, candle_time desc) and stop at one row.
    expect(ops).toContainEqual(['eq', ['stock_signals.timeframe', '1h']]);
    expect(ops).toContainEqual(['order', ['candle_time', { referencedTable: 'stock_signals', ascending: false }]]);
    expect(ops).toContainEqual(['limit', [1, { referencedTable: 'stock_signals' }]]);
    // And it never falls back to selecting whole rows it does not map.
    const select = ops.find(([name]) => name === 'select')![1][0] as string;
    expect(select).toContain('stock_signals(');
    expect(select).not.toContain('*');
  });

  it('does not rank a delisted ticker months-old signal beside live ones', async () => {
    const { client } = recordingClient(() => ({
      data: [
        ticker('NVDA', [signal('NVDA', NEWEST)]),
        ticker('PSTG', [signal('PSTG', '2026-04-16T19:30:00+00:00')]), // still flagged active, last scored in April
        ticker('ANSS', []), // never scored
      ],
    }));

    const result = await loadTickersWithLatestSignal(client);

    expect(result.signals.map((s) => s.symbol)).toEqual(['NVDA']);
    expect(result.tickers.map((t) => t.symbol)).toEqual(['NVDA', 'PSTG', 'ANSS']); // tickers themselves are all kept
  });

  it('keeps a ticker that missed the latest scan but was scored a bar earlier', async () => {
    const { client } = recordingClient(() => ({
      data: [ticker('NVDA', [signal('NVDA', NEWEST)]), ticker('AMD', [signal('AMD', '2026-10-02T18:30:00+00:00')])],
    }));

    const result = await loadTickersWithLatestSignal(client);

    expect(result.signals.map((s) => s.symbol).sort()).toEqual(['AMD', 'NVDA']);
  });

  it('reads tickers scanned on another timeframe with their own one-probe request', async () => {
    const { client, calls } = recordingClient((call) =>
      call.ops.some(([name, args]) => name === 'eq' && args[1] === '1d')
        ? { data: [ticker('BHP', [signal('BHP', NEWEST, '1d')], '1d')] }
        : { data: [ticker('NVDA', [signal('NVDA', NEWEST)]), ticker('BHP', [], '1d')] },
    );

    const result = await loadTickersWithLatestSignal(client);

    expect(calls).toHaveLength(2);
    expect(calls[1].ops).toContainEqual(['in', ['symbol', ['BHP']]]);
    expect(result.signals.map((s) => s.symbol).sort()).toEqual(['BHP', 'NVDA']);
  });

  it('falls back to a universe-sized read when the embed is unavailable, never a fixed 80', async () => {
    const tickers = Array.from({ length: 150 }, (_, i) => ticker(`T${i}`, []));
    const { client, calls } = recordingClient((call) => {
      const select = (call.ops.find(([name]) => name === 'select')?.[1][0] ?? '') as string;
      if (call.table === 'stock_tickers' && select.includes('stock_signals(')) return { error: { code: 'PGRST200' } };
      if (call.table === 'stock_tickers') return { data: tickers };
      return { data: [signal('T1', NEWEST)] };
    });

    const result = await loadTickersWithLatestSignal(client);

    expect(result.failed).toBe(false);
    const legacy = calls.find((c) => c.table === 'stock_signals')!;
    const limit = legacy.ops.find(([name]) => name === 'limit')![1][0] as number;
    expect(limit).toBeGreaterThanOrEqual(300); // at least two full scan batches of a 150-name universe
  });

  it('reports failure when even the fallback cannot read, so the caller can say so', async () => {
    const { client } = recordingClient(() => ({ error: { message: 'restricted' } }));
    expect((await loadTickersWithLatestSignal(client)).failed).toBe(true);
  });
});

describe('dropStaleSignals', () => {
  it('measures staleness against the freshest signal, not the wall clock (a paused scanner drops nothing)', () => {
    const rows = [signal('A', '2026-01-05T19:30:00Z'), signal('B', '2026-01-02T19:30:00Z')];
    expect(dropStaleSignals(rows).map((r) => r.symbol)).toEqual(['A', 'B']);
  });

  it('returns newest first and tolerates an empty or unparseable set', () => {
    expect(dropStaleSignals([])).toEqual([]);
    expect(dropStaleSignals([signal('A', 'not a date')])).toEqual([]);
    const rows = [signal('OLD', '2026-10-01T19:30:00Z'), signal('NEW', '2026-10-02T19:30:00Z')];
    expect(dropStaleSignals(rows).map((r) => r.symbol)).toEqual(['NEW', 'OLD']);
  });
});
