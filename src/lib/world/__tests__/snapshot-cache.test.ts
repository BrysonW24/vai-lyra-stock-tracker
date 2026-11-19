import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The shared store, faked: values by key, and Upstash's SET NX for the refill lock. `lockedElsewhere`
 * is another server instance holding the lock; `configured` is whether a shared store exists at all.
 */
const store = vi.hoisted(() => ({
  values: new Map<string, string>(),
  locks: new Set<string>(),
  configured: false,
  lockedElsewhere: false,
}));

vi.mock('@/lib/cache', () => ({
  cacheGet: async (key: string): Promise<unknown> => {
    const raw = store.values.get(key);
    return raw === undefined ? null : JSON.parse(raw);
  },
  cacheSet: async (key: string, value: unknown): Promise<void> => {
    store.values.set(key, JSON.stringify(value));
  },
  sharedStoreConfigured: () => store.configured,
  upstashCommand: async (cmd: Array<string | number>): Promise<unknown> => {
    if (cmd[0] !== 'SET' || !cmd.includes('NX')) return null;
    const key = String(cmd[1]);
    if (store.lockedElsewhere || store.locks.has(key)) return null;
    store.locks.add(key);
    return 'OK';
  },
}));

import { getWorldSnapshot, readWorldSnapshot, resetWorldSnapshotForTests } from '../fetch';
import { WORLD_INSTRUMENTS } from '../instruments';

// Absolute instants only - the repo rule. The snapshot's own clock is what decides freshness.
const NOW = Date.parse('2026-11-18T03:00:00Z');
const MINUTE = 60_000;

const CHART = {
  chart: {
    result: [
      {
        timestamp: Array.from({ length: 30 }, (_, i) => Date.parse('2026-10-01T21:00:00Z') / 1000 + i * 86_400),
        meta: { exchangeTimezoneName: 'America/New_York' },
        indicators: { quote: [{ close: Array.from({ length: 30 }, (_, i) => 100 + i) }] },
      },
    ],
  },
};

/** A fake Yahoo: answers the symbols `answers` allows, after `delayMs`, and counts every request. */
function yahoo(answers: (symbol: string) => boolean, delayMs = 0) {
  const calls: string[] = [];
  const impl = (async (input: RequestInfo | URL) => {
    const symbol = decodeURIComponent(String(input).split('/chart/')[1]!.split('?')[0]!);
    calls.push(symbol);
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    return answers(symbol) ? new Response(JSON.stringify(CHART), { status: 200 }) : new Response('unavailable', { status: 503 });
  }) as typeof fetch;
  return { impl, calls };
}

const firstTwenty = (symbol: string) => WORLD_INSTRUMENTS.findIndex((instrument) => instrument.symbol === symbol) < 20;

beforeEach(() => {
  store.values.clear();
  store.locks.clear();
  store.configured = false;
  store.lockedElsewhere = false;
  resetWorldSnapshotForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the shared world snapshot', () => {
  it('keeps a board read while the source was failing for a minute, so the source is not asked on every view', async () => {
    const source = yahoo(firstTwenty); // 20 of 39: under the three-quarters that make a complete board
    const first = await getWorldSnapshot(NOW, source.impl);
    expect(first.moves).toHaveLength(20);
    expect(source.calls).toHaveLength(WORLD_INSTRUMENTS.length);

    await getWorldSnapshot(NOW + 30_000, source.impl);
    expect(source.calls).toHaveLength(WORLD_INSTRUMENTS.length);

    await getWorldSnapshot(NOW + MINUTE + 1_000, source.impl);
    expect(source.calls).toHaveLength(2 * WORLD_INSTRUMENTS.length);
  });

  it('keeps a complete board for ten minutes', async () => {
    const source = yahoo(() => true);
    await getWorldSnapshot(NOW, source.impl);
    await getWorldSnapshot(NOW + 9 * MINUTE, source.impl);
    expect(source.calls).toHaveLength(WORLD_INSTRUMENTS.length);
    await getWorldSnapshot(NOW + 11 * MINUTE, source.impl);
    expect(source.calls).toHaveLength(2 * WORLD_INSTRUMENTS.length);
  });

  it('reads the board once for requests that arrive together on one server', async () => {
    const source = yahoo(() => true, 5);
    const [a, b, c] = await Promise.all([getWorldSnapshot(NOW, source.impl), getWorldSnapshot(NOW, source.impl), getWorldSnapshot(NOW, source.impl)]);
    expect(source.calls).toHaveLength(WORLD_INSTRUMENTS.length);
    expect(b.asOf).toBe(a.asOf);
    expect(c.moves).toHaveLength(WORLD_INSTRUMENTS.length);
  });

  it("waits for another server's read instead of reading the board again", async () => {
    store.configured = true;
    const source = yahoo(() => true, 40);
    // Server A finds nothing, takes the refill lock and starts reading.
    const a = getWorldSnapshot(NOW, source.impl);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(store.locks.size).toBe(1);
    // Server B - its own process, the same shared store - arrives while A is still reading.
    resetWorldSnapshotForTests();
    const b = getWorldSnapshot(NOW, source.impl);
    const [fromA, fromB] = await Promise.all([a, b]);
    expect(source.calls).toHaveLength(WORLD_INSTRUMENTS.length);
    expect(fromB.asOf).toBe(fromA.asOf);
    expect(fromB.moves).toHaveLength(WORLD_INSTRUMENTS.length);
  });

  it('serves the last copy when another server holds the lock and its read never lands', async () => {
    const source = yahoo(() => true);
    const last = await getWorldSnapshot(NOW, source.impl);
    expect(source.calls).toHaveLength(WORLD_INSTRUMENTS.length);

    store.configured = true;
    store.lockedElsewhere = true;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const later = getWorldSnapshot(NOW + 11 * MINUTE, source.impl);
    await vi.advanceTimersByTimeAsync(15_000);
    expect((await later).asOf).toBe(last.asOf);
    expect(source.calls).toHaveLength(WORLD_INSTRUMENTS.length);
  });
});

describe('reading the board', () => {
  it('stops at its deadline when the source stalls, naming what it could not read', async () => {
    // Answers nothing; gives up only when the request is aborted - the way a stalled connection behaves.
    const stalled = (async (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as typeof fetch;
    const outcome = await Promise.race([
      readWorldSnapshot(NOW, stalled, 150),
      new Promise<'still waiting'>((resolve) => setTimeout(() => resolve('still waiting'), 5_000)),
    ]);
    expect(outcome).not.toBe('still waiting');
    if (outcome === 'still waiting') return;
    expect(outcome.moves).toHaveLength(0);
    expect(outcome.missing).toHaveLength(WORLD_INSTRUMENTS.length);
  });
});
