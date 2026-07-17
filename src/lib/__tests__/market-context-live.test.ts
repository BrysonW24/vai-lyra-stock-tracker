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

import { getMarketContextLive, getMacroContextLive } from '../market-context-live';

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
