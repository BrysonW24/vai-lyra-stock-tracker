/**
 * Realistic transaction-cost model for a SMALL account.
 *
 * The paper engine's flat "0.05% commission + 0.1% slippage" understates the costs that
 * actually dominate a small-capital retail trader: a fixed per-trade commission floor (which
 * is a large % of a $300 position but trivial on a $30k one), the AUD-to-USD FX spread an
 * Australian user pays twice to hold a US ticker, and the wider slippage a thin small-cap
 * name fills at. This module models all four so the break-even move - the % a price must rise
 * just to cover the round trip - is honest for someone deciding whether $500 can win here.
 *
 * Pure, deterministic, no I/O. Research only - a cost estimate, not advice. Assumptions are
 * explicit and adjustable via CostModel; defaults reflect typical AU retail brokerage.
 */

export interface CostModel {
  /** Commission as % of notional, per side (entry and exit each charged). */
  commissionRatePct: number;
  /** Fixed commission floor per side, in the account's base currency. */
  minCommission: number;
  /** FX spread as % per conversion, charged on both legs when the trade currency differs from base. */
  fxSpreadPct: number;
  /** Reference slippage as % per fill for a deep-liquidity name; scaled up for thin ones. */
  baseSlippagePct: number;
}

/** Typical Australian retail brokerage holding a US-listed name. Adjustable per user. */
export const DEFAULT_COST_MODEL: CostModel = {
  commissionRatePct: 0.1,
  minCommission: 3,
  fxSpreadPct: 0.5,
  baseSlippagePct: 0.1,
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Slippage scales inversely with liquidity: a deep name (liquidity 100) fills near the
 * reference base, a thin small-cap (liquidity near 0) fills up to ~5x wider. `liquidity` is a
 * 0-100 depth score (the world-radar liquidity field). Missing/invalid liquidity is treated
 * as mid-book (60) rather than best-case, so the estimate stays conservative.
 */
export function effectiveSlippagePct(baseSlippagePct: number, liquidity0to100: number | undefined): number {
  const liquidity = Number.isFinite(liquidity0to100 as number) ? clamp(liquidity0to100 as number, 0, 100) : 60;
  const scarcity = (100 - liquidity) / 100; // 0 (deep) .. 1 (illiquid)
  return round4(Math.max(0, baseSlippagePct) * (1 + scarcity * 4));
}

export interface TradeCostInput {
  /** Position notional in base currency (shares * entry price). */
  notional: number;
  /** True when the ticker trades in a currency other than the account base (e.g. AUD account, US ticker). */
  crossCurrency?: boolean;
  /** 0-100 liquidity/depth score for the name. */
  liquidity?: number;
  model?: CostModel;
}

export interface TradeCost {
  notional: number;
  /** Round-trip commission (entry + exit), floored per side. */
  commission: number;
  /** Round-trip FX spread (both conversions), zero when not cross-currency. */
  fx: number;
  /** Round-trip slippage (both fills), liquidity-scaled. */
  slippage: number;
  /** Total friction to open and close the position. */
  roundTripCost: number;
  /** Round-trip cost as % of notional. */
  costPctOfNotional: number;
  /** The % the price must rise just to cover round-trip friction. Same magnitude as costPctOfNotional. */
  breakEvenMovePct: number;
  /** The liquidity-scaled per-fill slippage actually applied, for transparency. */
  effectiveSlippagePct: number;
}

/**
 * Round-trip cost of opening and closing a position. Exit notional is approximated by entry
 * notional (documented), which is conservative for a winner and slightly generous for a loser.
 */
export function computeTradeCost(input: TradeCostInput): TradeCost {
  const model = input.model ?? DEFAULT_COST_MODEL;
  const notional = Math.max(0, Number.isFinite(input.notional) ? input.notional : 0);

  const commissionPerSide = Math.max((notional * model.commissionRatePct) / 100, model.minCommission);
  const commission = round2(commissionPerSide * 2);

  const fxPerSide = input.crossCurrency ? (notional * model.fxSpreadPct) / 100 : 0;
  const fx = round2(fxPerSide * 2);

  const effSlip = effectiveSlippagePct(model.baseSlippagePct, input.liquidity);
  const slippage = round2(((notional * effSlip) / 100) * 2);

  const roundTripCost = round2(commission + fx + slippage);
  const costPctOfNotional = notional > 0 ? round2((roundTripCost / notional) * 100) : 0;

  return {
    notional: round2(notional),
    commission,
    fx,
    slippage,
    roundTripCost,
    costPctOfNotional,
    breakEvenMovePct: costPctOfNotional,
    effectiveSlippagePct: effSlip,
  };
}
