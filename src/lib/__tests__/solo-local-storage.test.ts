import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addLocalHolding,
  loadLocalHoldings,
  saveLocalHoldings,
} from '@/lib/local-portfolio';
import {
  addLocalWatchItem,
  loadLocalWatchlist,
  saveLocalWatchlist,
} from '@/lib/local-watchlist';
import {
  loadOnboardingSummary,
  saveOnboardingSummary,
} from '@/lib/onboarding-summary';
import { addLocalTradeLog, loadLocalTradeLogs } from '@/lib/local-trades';
import { saveAi } from '@/lib/account';

function storageWindow(
  initial: Record<string, string> = {},
  failWrite?: (key: string) => boolean,
) {
  const store = new Map(Object.entries(initial));
  const dispatchEvent = vi.fn(() => true);
  return {
    store,
    window: {
      localStorage: {
        get length() {
          return store.size;
        },
        key: (index: number) => [...store.keys()][index] ?? null,
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          if (failWrite?.(key)) throw new DOMException('Quota exceeded', 'QuotaExceededError');
          store.set(key, value);
        },
        removeItem: (key: string) => void store.delete(key),
      },
      sessionStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
      dispatchEvent,
    },
    dispatchEvent,
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ valid: true, price: 200 }) })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Solo browser storage integrity', () => {
  it('fails closed on corrupt or invalid local records', () => {
    const { window } = storageWindow({
      'lyra.portfolio.holdings': '[{"symbol":"NVDA","quantity":-2,"averageBuyPrice":200},{"symbol":"<script>","quantity":1,"averageBuyPrice":1}]',
      'lyra.watchlist.items': '{broken json',
      'lyra.onboarding.summary': '{"onboarded":"yes"}',
    });
    vi.stubGlobal('window', window);

    expect(loadLocalHoldings()).toEqual([]);
    expect(loadLocalWatchlist()).toEqual([]);
    expect(loadOnboardingSummary()).toBeNull();
  });

  it('normalises and deduplicates valid holdings and watchlist data', () => {
    const { window } = storageWindow();
    vi.stubGlobal('window', window);

    expect(
      saveLocalHoldings([
        { symbol: ' nvda ', quantity: 0.5, averageBuyPrice: 200 },
        { symbol: 'bad symbol', quantity: 1, averageBuyPrice: 1 },
      ]),
    ).toBe(true);
    expect(loadLocalHoldings()).toEqual([
      { symbol: 'NVDA', quantity: 0.5, averageBuyPrice: 200 },
    ]);

    expect(
      saveLocalWatchlist([
        { symbol: ' nvda ' },
        { symbol: 'NVDA', targetBuyPrice: 190 },
        { symbol: 'aapl', targetBuyPrice: Number.NaN },
      ]),
    ).toBe(true);
    expect(loadLocalWatchlist()).toEqual([{ symbol: 'NVDA' }, { symbol: 'AAPL' }]);
  });

  it('reports rejected writes instead of presenting false success', () => {
    const { window, dispatchEvent } = storageWindow({}, () => true);
    vi.stubGlobal('window', window);

    expect(addLocalHolding({ symbol: 'NVDA', quantity: 1, averageBuyPrice: 200 })).toBe(false);
    expect(addLocalWatchItem({ symbol: 'NVDA' })).toBe(false);
    expect(
      saveOnboardingSummary({
        onboarded: true,
        tradedBefore: 'yes',
        portfolioCount: 1,
        watchlistCount: 1,
      }),
    ).toBe(false);
    expect(
      saveAi({
        mode: 'byo',
        provider: 'anthropic',
        apiKey: 'test-key-never-logged',
        model: 'claude-haiku-4-5',
      }),
    ).toBe(false);
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it('rolls back a trade log if the matching holdings write fails', async () => {
    const { window } = storageWindow({}, (key) => key === 'lyra.portfolio.holdings');
    vi.stubGlobal('window', window);

    const result = await addLocalTradeLog({
      side: 'buy',
      symbol: 'NVDA',
      notional: 1_000,
      source: 'chat',
    });

    expect(result).toBeNull();
    expect(loadLocalTradeLogs()).toEqual([]);
    expect(loadLocalHoldings()).toEqual([]);
  });
});
