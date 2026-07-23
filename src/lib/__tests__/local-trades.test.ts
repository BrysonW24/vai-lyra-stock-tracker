/**
 * Pins the Solo/demo trade-log contract (local-trades.ts). This store is the fix for a
 * real data-loss bug: on a deployment without Supabase, /api/trades answers {demo:true}
 * and chat-logged trades silently vanished while the UI said "sign in to save" on a
 * build with no accounts to sign into. The pins that matter:
 *
 *  - no fabricated fills: a trade with no notional or no live quote is REFUSED, never
 *    logged with a $0 price;
 *  - holdings parity: a logged buy moves the local holdings book exactly like the
 *    server's log_buy_trade RPC moves the DB one, and undo reverses it exactly;
 *  - the server's undo rule holds locally too: reverse-chronological per symbol.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addLocalTradeLog, loadLocalTradeLogs, undoLocalTradeLog } from '@/lib/local-trades';
import { loadLocalHoldings } from '@/lib/local-portfolio';

function makeWindowWithStorage() {
  const store = new Map<string, string>();
  return {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    dispatchEvent: () => true,
  };
}

/** Stub the quote lookup the store prices fills from. */
function stubQuote(price: number | null) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      json: async () => (price === null ? { valid: false, price: null } : { valid: true, price }),
    })),
  );
}

beforeEach(() => {
  vi.stubGlobal('window', makeWindowWithStorage());
  vi.useFakeTimers({ now: new Date('2026-07-20T00:00:00Z') });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('addLocalTradeLog', () => {
  it('refuses a zero-notional trade and logs nothing', async () => {
    stubQuote(100);
    expect(await addLocalTradeLog({ side: 'buy', symbol: 'NVDA', notional: 0 })).toBeNull();
    expect(loadLocalTradeLogs()).toHaveLength(0);
  });

  it('refuses when no live quote exists - never logs a made-up fill', async () => {
    stubQuote(null);
    expect(await addLocalTradeLog({ side: 'buy', symbol: 'NVDA', notional: 5000 })).toBeNull();
    expect(loadLocalTradeLogs()).toHaveLength(0);
  });

  it('logs a buy priced off the quote and creates the matching local holding', async () => {
    stubQuote(200);
    const log = await addLocalTradeLog({ side: 'buy', symbol: 'NVDA', notional: 5000, source: 'chat' });
    expect(log).not.toBeNull();
    expect(log!.quantity_delta).toBeCloseTo(25); // 5000 / 200
    expect(log!.cash_delta).toBe(-5000);
    expect(log!.status).toBe('applied');

    const holding = loadLocalHoldings().find((h) => h.symbol === 'NVDA');
    expect(holding?.quantity).toBeCloseTo(25);
    expect(holding?.averageBuyPrice).toBeCloseTo(200);
  });

  it('a second buy at a higher price moves the average exactly', async () => {
    stubQuote(200);
    await addLocalTradeLog({ side: 'buy', symbol: 'NVDA', notional: 5000 });
    vi.advanceTimersByTime(1000);
    stubQuote(400);
    await addLocalTradeLog({ side: 'buy', symbol: 'NVDA', notional: 5000 });

    const holding = loadLocalHoldings().find((h) => h.symbol === 'NVDA');
    expect(holding?.quantity).toBeCloseTo(37.5); // 25 + 12.5
    expect(holding?.averageBuyPrice).toBeCloseTo(10000 / 37.5); // 266.67
  });
});

describe('undoLocalTradeLog', () => {
  it('enforces reverse-chronological undo per symbol, like the server RPC', async () => {
    stubQuote(200);
    const first = await addLocalTradeLog({ side: 'buy', symbol: 'NVDA', notional: 5000 });
    vi.advanceTimersByTime(1000);
    const second = await addLocalTradeLog({ side: 'buy', symbol: 'NVDA', notional: 5000 });

    const blocked = undoLocalTradeLog(first!.id);
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toMatch(/reverse order/);

    expect(undoLocalTradeLog(second!.id).ok).toBe(true);
    expect(undoLocalTradeLog(first!.id).ok).toBe(true);
  });

  it('reverses the holdings book exactly - undoing the only buy removes the holding', async () => {
    stubQuote(200);
    const log = await addLocalTradeLog({ side: 'buy', symbol: 'NVDA', notional: 5000 });
    expect(loadLocalHoldings()).toHaveLength(1);

    expect(undoLocalTradeLog(log!.id).ok).toBe(true);
    expect(loadLocalHoldings()).toHaveLength(0);
    expect(loadLocalTradeLogs()[0]?.status).toBe('undone');
  });

  it('restores the prior average when undoing the second of two buys', async () => {
    stubQuote(200);
    await addLocalTradeLog({ side: 'buy', symbol: 'NVDA', notional: 5000 });
    vi.advanceTimersByTime(1000);
    stubQuote(400);
    const second = await addLocalTradeLog({ side: 'buy', symbol: 'NVDA', notional: 5000 });

    expect(undoLocalTradeLog(second!.id).ok).toBe(true);
    const holding = loadLocalHoldings().find((h) => h.symbol === 'NVDA');
    expect(holding?.quantity).toBeCloseTo(25);
    expect(holding?.averageBuyPrice).toBeCloseTo(200);
  });

  it('refuses an id that is not on this device, and refuses a double undo', async () => {
    stubQuote(200);
    const log = await addLocalTradeLog({ side: 'buy', symbol: 'NVDA', notional: 5000 });
    expect(undoLocalTradeLog('local-nope').ok).toBe(false);
    expect(undoLocalTradeLog(log!.id).ok).toBe(true);
    expect(undoLocalTradeLog(log!.id)).toEqual({ ok: false, error: 'Already undone.' });
  });
});
