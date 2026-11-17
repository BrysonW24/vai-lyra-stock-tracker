/**
 * The first reader of market_context_snapshots. Pins the three honesty contracts:
 * live rows map field-for-field and are marked 'live'; every gap (no client, error,
 * empty table, malformed payload) degrades to the demo snapshot marked 'sample';
 * and the macro overlay only claims 'live' for series the snapshot actually carries.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state: { row: unknown; error: unknown; client: boolean } = { row: null, error: null, client: true };

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () =>
    state.client
      ? {
          from: () => ({
            select: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: state.row, error: state.error }),
                }),
              }),
            }),
          }),
        }
      : null,
}));

// The economy overlay reads the live ABS/RBA snapshot. Mocked so the suite never touches the
// network: by default it returns nothing (every existing case is unaffected), and individual
// cases hand it the real June-quarter 2026 read, or a promise that never settles.
const econ: { indicators: EconomyIndicator[]; hang: boolean } = { indicators: [], hang: false };
vi.mock('@/lib/economy/snapshot', () => ({
  getEconomySnapshot: () =>
    econ.hang ? new Promise(() => {}) : Promise.resolve({ indicators: econ.indicators, assembledAt: '2026-11-18T00:00:00Z' }),
}));

import type { EconomyIndicator } from '@/lib/economy/types';
import { JUNE_2026 } from '@/lib/economy/__tests__/fixtures';
import { getMarketContextLive, getMacroContextLive, macroRowsFromEconomy } from '../market-context-live';

function liveRow(payload: Record<string, unknown>) {
  return { captured_at: '2026-07-17T13:00:00Z', regime: 'risk_off', payload };
}

describe('getMarketContextLive', () => {
  beforeEach(() => {
    state.row = null;
    state.error = null;
    state.client = true;
  });

  it('maps a live snapshot and marks it live', async () => {
    state.row = liveRow({
      sp500_price: 6100.5,
      sp500_change_pct: -1.2,
      vix_price: 26.4,
      fear_greed_index: 24,
      fear_greed_label: 'Extreme Fear',
      audusd_price: 0.6584,
    });
    const snapshot = await getMarketContextLive();
    expect(snapshot.source).toBe('live');
    expect(snapshot.sp500Price).toBe(6100.5);
    expect(snapshot.vixPrice).toBe(26.4);
    expect(snapshot.regime).toBe('risk_off');
    expect(snapshot.fearGreedLabel).toBe('Extreme Fear');
    // Absent fields become null, never invented.
    expect(snapshot.goldPrice).toBeNull();
  });

  it('degrades to the sample on no client / error / empty table', async () => {
    state.client = false;
    expect((await getMarketContextLive()).source).toBe('sample');

    state.client = true;
    state.error = { message: 'boom' };
    expect((await getMarketContextLive()).source).toBe('sample');

    state.error = null;
    state.row = null;
    expect((await getMarketContextLive()).source).toBe('sample');
  });

  it('rejects an unknown regime string to neutral instead of trusting it', async () => {
    state.row = { captured_at: '2026-07-17T13:00:00Z', regime: 'moon', payload: { vix_price: 12 } };
    expect((await getMarketContextLive()).regime).toBe('neutral');
  });
});

describe('getMacroContextLive', () => {
  beforeEach(() => {
    state.row = null;
    state.error = null;
    state.client = true;
    econ.indicators = [];
    econ.hang = false;
  });

  it('overlays AUD/USD and ASX 200 from the snapshot and reports the overlay', async () => {
    state.row = liveRow({ audusd_price: 0.6584, audusd_change_pct: -0.42, axjo_price: 8231.4, axjo_change_pct: 0.3 });
    const macro = await getMacroContextLive();
    expect(macro.liveOverlay).toEqual(['AUD/USD', 'ASX 200']);
    const aud = macro.indicators.find((i) => i.label === 'AUD/USD');
    expect(aud?.value).toBe('0.6584');
    expect(aud?.change).toBe('-0.42%');
    expect(macro.asOf).toBe('2026-07-17');
  });

  it('claims nothing live when the snapshot lacks the series', async () => {
    state.row = liveRow({ sp500_price: 6100 });
    const macro = await getMacroContextLive();
    expect(macro.liveOverlay).toBeUndefined();
    expect(macro.isDemo).toBe(true);
  });

  it('returns the seeded base untouched on any gap', async () => {
    state.client = false;
    const macro = await getMacroContextLive();
    expect(macro.isDemo).toBe(true);
    expect(macro.liveOverlay).toBeUndefined();
  });
});

describe('getMacroContextLive - live ABS/RBA rows', () => {
  beforeEach(() => {
    state.row = null;
    state.error = null;
    state.client = true;
    econ.indicators = JUNE_2026;
    econ.hang = false;
  });

  it('replaces the seeded structural rows with the live figures - and their seeded opinions', async () => {
    const macro = await getMacroContextLive();
    const row = (label: string) => macro.indicators.find((i) => i.label === label);
    expect(row('Cash rate')?.value).toBe('4.60%');
    expect(row('Cash rate')?.change).toBe('+0.24');
    expect(row('CPI (YoY)')?.value).toBe('4.3%');
    expect(row('CPI (YoY)')?.implication).toBe('underlying 3.6% - above the RBA 2-3% band');
    expect(row('GDP (YoY)')?.value).toBe('2.1%');
    expect(row('GDP (YoY)')?.implication).toBe('0.7% per person over the same year');
    expect(row('Wages (WPI)')?.implication).toBe('pay behind prices by 0.6% over the year');
    expect(row('Unemployment')?.implication).toBe('6.3% of workers want more hours');
    // The seed called this "a tailwind for risk assets" and "room to keep easing" - opinions
    // that were false against the real figures. None may survive the overlay.
    for (const i of macro.indicators.slice(0, 5)) expect(i.implication ?? '').not.toMatch(/easing|tailwind|dovish|room to/i);
  });

  it('shows no change text for a figure that did not move - never "- 0.0 -"', async () => {
    const macro = await getMacroContextLive();
    expect(macro.indicators.find((i) => i.label === 'Unemployment')?.change).toBeUndefined();
    expect(macro.indicators.find((i) => i.label === 'Wages (WPI)')?.change).toBeUndefined();
  });

  it('derives the stance from the live cash rate instead of the seeded "RBA easing"', async () => {
    const macro = await getMacroContextLive();
    expect(macro.stance).toBe('tightening');
    expect(macro.stanceLabel).toBe('Cash rate rising');
  });

  it('overlays the economy rows even with no Supabase - the ABS does not need it', async () => {
    state.client = false;
    const macro = await getMacroContextLive();
    expect(macro.liveOverlay).toEqual(['Cash rate', 'CPI (YoY)', 'Unemployment', 'GDP (YoY)', 'Wages (WPI)']);
    expect(macro.isDemo).toBe(true); // AUD/USD and the ASX 200 are still seeded
  });

  it('drops the sample badge only when every row is live', async () => {
    state.row = liveRow({ audusd_price: 0.6584, audusd_change_pct: -0.42, axjo_price: 8231.4, axjo_change_pct: 0.3 });
    const macro = await getMacroContextLive();
    expect(macro.liveOverlay).toHaveLength(macro.indicators.length);
    expect(macro.isDemo).toBe(false);
  });

  it('never lets a hung statistics API stall the page - it draws the badged seed rows instead', async () => {
    econ.hang = true;
    const started = Date.now();
    const macro = await getMacroContextLive('AU', { economyBudgetMs: 30 });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(macro.isDemo).toBe(true);
    expect(macro.liveOverlay).toBeUndefined();
  });

  it('builds no row for a figure that did not load', () => {
    const { rows, stance } = macroRowsFromEconomy(JUNE_2026.filter((i) => i.id !== 'cashRate'));
    expect(rows['Cash rate']).toBeUndefined();
    expect(stance).toBeUndefined();
    expect(rows['CPI (YoY)']).toBeDefined();
  });
});
