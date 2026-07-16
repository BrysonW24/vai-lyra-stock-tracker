/**
 * Expectancy - the single honest "does this actually make money" number.
 *
 * A win rate on its own is the classic mean-reversion trap: a strategy can win 70% of the
 * time and still lose money if the 30% of losers are large. Expectancy folds win rate,
 * average win, and average loss into one expected-value-per-trade figure and reports the
 * win rate a setup would need just to break even. It also derives a conservative
 * (half-Kelly, hard-capped) sizing fraction so upside is never divorced from downside.
 *
 * Pure functions, deterministic, no I/O. Research only - this describes the math behind a
 * base rate, it is never a recommendation to trade. A "win" must be defined at the source as
 * a finish ABOVE round-trip friction (a breakeven is not a win); this module trusts that
 * definition and does not itself re-classify outcomes.
 */

export interface ExpectancyInput {
  /** 0-100. Share of trades finishing above round-trip friction (a breakeven counts as a loss). */
  winRatePct: number;
  /** Average % gain across winning trades (a positive number). */
  avgWinPct: number;
  /** Average % loss across losing trades, expressed as a POSITIVE magnitude. */
  avgLossPct: number;
}

export interface Expectancy {
  /** Expected value per trade in %: winRate*avgWin - lossRate*avgLoss. */
  expectedValuePct: number;
  /** Reward-to-risk: avgWin / avgLoss. */
  payoffRatio: number;
  /** Win rate needed just to break even: avgLoss / (avgWin + avgLoss). */
  breakEvenWinRatePct: number;
  /** Sign of the edge after accounting for payoff asymmetry. */
  edge: 'positive' | 'breakeven' | 'negative';
  /**
   * Conservative sizing fraction of capital. Half of the Kelly fraction, clamped to [0, 0.25].
   * Zero whenever the edge is not positive. This is a ceiling for discussion, not an instruction.
   */
  halfKellyFraction: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Compute expectancy from a win rate and average win/loss magnitudes.
 * Degrades safely: non-finite or negative inputs are treated as no-edge rather than throwing.
 */
export function computeExpectancy(input: ExpectancyInput): Expectancy {
  const winRate = clamp(Number.isFinite(input.winRatePct) ? input.winRatePct : 0, 0, 100) / 100;
  const lossRate = 1 - winRate;
  const avgWin = Math.max(0, Number.isFinite(input.avgWinPct) ? input.avgWinPct : 0);
  const avgLoss = Math.max(0, Number.isFinite(input.avgLossPct) ? input.avgLossPct : 0);

  const expectedValuePct = round2(winRate * avgWin - lossRate * avgLoss);
  const payoffRatio = avgLoss > 0 ? round2(avgWin / avgLoss) : 0;
  const breakEvenWinRatePct = avgWin + avgLoss > 0 ? round2((avgLoss / (avgWin + avgLoss)) * 100) : 100;

  const edge: Expectancy['edge'] =
    expectedValuePct > 0.001 ? 'positive' : expectedValuePct < -0.001 ? 'negative' : 'breakeven';

  // Kelly: f* = W - (1 - W) / R. Half-Kelly, floored at 0 and capped at 25% of capital.
  let halfKellyFraction = 0;
  if (edge === 'positive' && payoffRatio > 0) {
    const kelly = winRate - lossRate / payoffRatio;
    halfKellyFraction = clamp(round4(kelly / 2), 0, 0.25);
  }

  return { expectedValuePct, payoffRatio, breakEvenWinRatePct, edge, halfKellyFraction };
}

/**
 * A plain-English, research-only reading of an expectancy result. No advice verbs.
 */
export function describeExpectancy(e: Expectancy): string {
  if (e.edge === 'negative') {
    return `Negative expectancy: on these base rates the average outcome is ${e.expectedValuePct}% per trade (it would need a ${e.breakEvenWinRatePct}% win rate just to break even).`;
  }
  if (e.edge === 'breakeven') {
    return `Roughly break-even expectancy (${e.expectedValuePct}% per trade); the payoff ratio is ${e.payoffRatio} to 1.`;
  }
  return `Positive expectancy of ${e.expectedValuePct}% per trade at a ${e.payoffRatio}-to-1 payoff (break-even win rate is ${e.breakEvenWinRatePct}%).`;
}
