/**
 * Market context types and demo snapshot.
 * Live wiring reads from Supabase; demo ensures rendering works with zero backend.
 */

export type MarketRegime = 'risk_on' | 'neutral' | 'risk_off';

export interface MarketContextSnapshot {
  capturedAt: string; // ISO timestamp
  sp500Price: number | null;
  sp500ChangePct: number | null;
  nasdaqPrice: number | null;
  nasdaqChangePct: number | null;
  dowPrice: number | null;
  dowChangePct: number | null;
  vixPrice: number | null;
  vixChangePct: number | null;
  yield10y: number | null;
  yield10yChangePct: number | null;
  goldPrice: number | null;
  goldChangePct: number | null;
  oilPrice: number | null;
  oilChangePct: number | null;
  btcPrice: number | null;
  btcChangePct: number | null;
  fearGreedIndex: number | null;
  fearGreedLabel: string | null;
  regime: MarketRegime;
  /** 'live' = latest hourly worker snapshot; 'sample' = the bundled demo values.
   * Surfaces MUST badge sample data - frozen numbers presenting as live is a lie. */
  source: 'live' | 'sample';
}

/**
 * Demo snapshot - realistic values as of early June 2026.
 * Regime set to 'neutral' (mixed signals: VIX moderate, F&G mid-range, indices mixed).
 */
export const demoMarketContext: MarketContextSnapshot = {
  capturedAt: new Date().toISOString(),
  sp500Price: 5482.12,
  sp500ChangePct: 0.45,
  nasdaqPrice: 17835.64,
  nasdaqChangePct: 0.82,
  dowPrice: 43891.45,
  dowChangePct: -0.12,
  vixPrice: 17.34,
  vixChangePct: 2.15,
  yield10y: 3.98,
  yield10yChangePct: 0.08,
  goldPrice: 2364.50,
  goldChangePct: 0.32,
  oilPrice: 82.15,
  oilChangePct: -1.45,
  btcPrice: 71480.00,
  btcChangePct: 3.25,
  fearGreedIndex: 52,
  fearGreedLabel: 'neutral',
  regime: 'neutral',
  source: 'sample',
};

/**
 * Demo market context. The LIVE read is getMarketContextLive() in
 * market-context-live.ts (server-only - it touches Supabase); this module stays
 * importable from client components and holds only types + the sample.
 */
export async function getMarketContext(): Promise<MarketContextSnapshot> {
  return demoMarketContext;
}
