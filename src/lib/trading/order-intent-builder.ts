/**
 * Deterministic OrderIntent construction - the hard boundary between AI and execution.
 *
 * The AI (trade_readiness) may have produced a verdict and an explanation string, but NOTHING here
 * is decided by the model: side, quantity, order type, price, reason code and idempotency all come
 * from deterministic inputs. The aiExplanation is attached to the intent for the audit record; it
 * decides nothing. Reuses the existing OrderIntent type + risk-engine idempotency so the same intent
 * flows through the existing risk engine unchanged.
 */
import { buildIdempotencyKey } from './risk-engine';
import type { OrderIntent, OrderSide } from './types';

export const BOT_STRATEGY_ID = 'lyra_paper_bot';
export const BOT_STRATEGY_VERSION = 'v1';

export interface BuildPaperIntentInput {
  userId: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  /** Fresh reference price (deterministic, from the scan / quote) - NOT supplied by the model. */
  referencePrice: number;
  signalSnapshot: Record<string, unknown>;
  riskSnapshot?: Record<string, unknown>;
  evidenceRefs: string[];
  /** Optional model explanation, attached for the record only - it influences nothing above. */
  aiExplanation?: string;
  now?: Date;
}

/** Build a complete, immutable paper OrderIntent. Status starts 'drafted' (risk gate decides next). */
export function buildPaperOrderIntent(input: BuildPaperIntentInput): OrderIntent {
  const now = input.now ?? new Date();
  const symbol = input.symbol.toUpperCase();
  const quantity = Math.max(0, Math.floor(input.quantity));
  const isoDay = now.toISOString().slice(0, 10);
  return {
    id: `intent_${symbol}_${now.getTime()}`,
    userId: input.userId,
    strategyId: BOT_STRATEGY_ID,
    strategyVersion: BOT_STRATEGY_VERSION,
    symbol,
    side: input.side,
    orderType: 'market',
    quantity,
    notionalValue: Number((quantity * input.referencePrice).toFixed(2)),
    timeInForce: 'day',
    reasonCode: 'paper_bot_entry',
    signalSnapshot: input.signalSnapshot,
    riskSnapshot: input.riskSnapshot ?? {},
    evidenceSnapshot: input.evidenceRefs,
    aiExplanation: input.aiExplanation,
    status: 'drafted',
    idempotencyKey: buildIdempotencyKey(BOT_STRATEGY_ID, symbol, input.side, isoDay),
    createdAt: now.toISOString(),
  };
}
