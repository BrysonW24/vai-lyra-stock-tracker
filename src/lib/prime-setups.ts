import type { SignalRow } from '@/types/scanner';

export type PrimeTier = 'prime' | 'approaching';

export interface PrimeSetup {
  signal: SignalRow;
  tier: PrimeTier;
  /** How many of the 4 momentum-confirmation conditions are currently met (0-4). */
  confirming: number;
  /** Short plain-English reasons, surfaced under the row. */
  reasons: string[];
}

export interface PrimeSetupResult {
  prime: PrimeSetup[];
  approaching: PrimeSetup[];
}

const PRIME_SCORE = 70;
const APPROACH_SCORE = 55;
const PRIME_FALLBACK_SCORE = 75;

/**
 * The momentum-recovery confirmation checklist - four deterministic booleans read
 * straight off the backend signal. No opinion, no advice. The score-delta condition
 * is counted toward `confirming` but not repeated in `reasons` (the +delta chip shows it).
 */
function evaluate(s: SignalRow): { confirming: number; reasons: string[] } {
  const reasons: string[] = [];
  let confirming = 0;
  // RSI lifting from oversold/neutral with room left to run.
  if (s.rsi <= 60 && s.rsiDelta > 0) {
    confirming += 1;
    reasons.push(`RSI ${Math.round(s.rsi)} rising`);
  }
  // MACD histogram turning up - selling pressure easing.
  if (s.histDelta > 0) {
    confirming += 1;
    reasons.push('MACD turning up');
  }
  // Heavier-than-usual participation confirming the move.
  if (s.volumeRatio >= 1) {
    confirming += 1;
    reasons.push(`Vol ${s.volumeRatio.toFixed(1)}x`);
  }
  // Composite score still climbing.
  if (s.scoreDelta > 0) {
    confirming += 1;
  }
  return { confirming, reasons };
}

/**
 * Deterministic opportunity radar. Buckets the scanned signals into:
 *  - `prime`: a genuine strong setup that momentum also confirms (the "perfect setup").
 *  - `approaching`: not prime yet, but closing in (rising mid-score, a gaining watchlist
 *    setup, or an early oversold recovery turning up).
 * Pure function of the signal rows - research framing only, never a buy/sell call.
 */
export function derivePrimeSetups(signals: SignalRow[]): PrimeSetupResult {
  const scored = signals.map((signal) => {
    const { confirming, reasons } = evaluate(signal);
    return { signal, confirming, reasons };
  });

  // Prime: the engine flagged the structure (strong_setup) AND momentum agrees (>=2 of 4).
  let prime: PrimeSetup[] = scored
    .filter((x) => x.signal.status === 'strong_setup' && x.signal.score >= PRIME_SCORE && x.confirming >= 2)
    .map((x) => ({ ...x, tier: 'prime' as const }));

  // Fallback: when nothing is officially strong, surface the cleanest high-score confirmers
  // so good structure is never hidden. The UI labels this case honestly.
  if (prime.length === 0) {
    prime = scored
      .filter((x) => x.signal.score >= PRIME_FALLBACK_SCORE && x.confirming >= 3)
      .map((x) => ({ ...x, tier: 'prime' as const }));
  }

  const primeSymbols = new Set(prime.map((p) => p.signal.symbol));

  const approaching: PrimeSetup[] = scored
    .filter((x) => !primeSymbols.has(x.signal.symbol))
    .filter((x) => {
      const s = x.signal;
      const risingMid = s.score >= APPROACH_SCORE && s.score < PRIME_FALLBACK_SCORE && s.scoreDelta > 0 && x.confirming >= 2;
      const watchlistGaining = s.status === 'watchlist_setup' && s.scoreDelta > 0;
      const oversoldTurn = s.rsi < 45 && s.rsiDelta > 0 && s.histDelta > 0;
      return risingMid || watchlistGaining || oversoldTurn;
    })
    .map((x) => ({ ...x, tier: 'approaching' as const }));

  prime.sort((a, b) => b.signal.score - a.signal.score);
  approaching.sort((a, b) => b.signal.scoreDelta - a.signal.scoreDelta);

  return { prime: prime.slice(0, 4), approaching: approaching.slice(0, 4) };
}
