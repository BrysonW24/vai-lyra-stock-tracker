/**
 * Paper-bot spine orchestration. Proves a future trading bot can exist SAFELY without building one.
 *
 *   signal -> trade_readiness verdict (AI explains) -> deterministic OrderIntent -> risk gate
 *          -> approval gate -> simulated paper fill -> (audit) .  No broker. No live path.
 *
 * The model only supplies a verdict + an explanation. Deterministic code builds the OrderIntent,
 * the EXISTING risk engine (runPreTradeChecks) gates it, and execution is a pure fee+slippage
 * simulation - re-validated at execution time so a condition change halts it. Paper-only is
 * structural: the risk engine refuses any non-paper mode and no broker adapter is wired.
 */
import { runTradeReadiness, type AiCreds } from '@/lib/ai/run-agent';
import { buildPaperOrderIntent } from './order-intent-builder';
import { runPreTradeChecks } from './risk-engine';
import { DEFAULT_TRADING_SETTINGS } from './types';
import type { OrderIntent, PreTradeContext, PreTradeReport, TradingSettings } from './types';
import { PAPER_FEE_RATE, PAPER_SLIPPAGE_RATE } from '@/lib/paper-trading';
import { getDashboardData } from '@/lib/data';
import { recordPaperFill } from './paper-account-store';
import { recordFlag } from './notifications-store';
import { persistFillIfAuthed } from './paper-account-repo';

export type BotRunStatus =
  | 'research_only'
  | 'blocked_missing_evidence'
  | 'proposed'
  | 'blocked_by_risk'
  | 'paper_executed'
  | 'error';

export interface PaperFill {
  symbol: string;
  side: string;
  quantity: number;
  fillPrice: number;
  notional: number;
  simulatedFee: number;
  simulatedSlippage: number;
  fillTimestamp: string;
  sourceOrderIntentId: string;
}

export interface BotRun {
  status: BotRunStatus;
  verdict?: unknown;
  intent?: OrderIntent;
  report?: PreTradeReport;
  fill?: PaperFill;
  requiresApproval?: boolean;
  error?: string;
}

/** Paper-only settings. tradingMode is approval_required (the risk engine refuses anything live). */
const PAPER_SETTINGS: TradingSettings = {
  ...DEFAULT_TRADING_SETTINGS,
  userId: 'local',
  tradingMode: 'approval_required',
  maxOrderNotional: 25000,
  maxPositionPct: 15,
  maxDailyLoss: 5000,
  requireManualApproval: true,
  allowedStrategies: ['lyra_paper_bot'],
};

function buildPaperContext(settings: TradingSettings, portfolioValue: number): PreTradeContext {
  return {
    settings,
    killSwitches: [],
    marketOpen: true,
    symbolTradable: true,
    quoteAgeSeconds: 5,
    maxQuoteAgeSeconds: 120,
    portfolioValue,
    currentPositionValue: 0,
    realisedDailyPnl: 0,
    portfolioDrawdownPct: 0,
    avgDailyDollarVolume: 5e8,
    minDollarVolume: 1e6,
    spreadPct: 0.03,
    maxSpreadPct: 0.5,
    earningsBlackout: false,
    newsRiskBlackout: false,
    openIntentKeys: [],
    // The paper simulator IS the execution venue, so the "broker" is connected for paper mode.
    // No live broker adapter exists; the risk engine's no_live_execution check still hard-blocks live.
    brokerConnected: true,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Pure deterministic paper fill: market fill at reference + slippage, plus commission. No broker. */
export function simulatePaperFill(intent: OrderIntent, referencePrice: number): PaperFill {
  const dir = intent.side === 'buy' ? 1 : -1;
  const fillPrice = round2(referencePrice * (1 + dir * PAPER_SLIPPAGE_RATE));
  const notional = round2(fillPrice * intent.quantity);
  return {
    symbol: intent.symbol,
    side: intent.side,
    quantity: intent.quantity,
    fillPrice,
    notional,
    simulatedFee: round2(notional * PAPER_FEE_RATE),
    simulatedSlippage: round2(referencePrice * intent.quantity * PAPER_SLIPPAGE_RATE),
    fillTimestamp: new Date().toISOString(),
    sourceOrderIntentId: intent.id,
  };
}

export function requiresApproval(intent: OrderIntent, settings: TradingSettings = PAPER_SETTINGS): boolean {
  if (settings.requireManualApproval) return true;
  return intent.notionalValue > settings.maxOrderNotional * 0.5;
}

/**
 * PROPOSE: AI verdict -> deterministic intent -> risk gate -> report. Nothing executes here.
 * Returns research_only / blocked_missing_evidence when the agent declines, blocked_by_risk when the
 * risk engine blocks, or proposed (with requiresApproval) when it is a valid paper candidate.
 */
export async function proposeBotRun(params: { symbol: string; quantity: number; creds: AiCreds }): Promise<BotRun> {
  const data = await getDashboardData();
  const signal = data.signals.find((s) => s.symbol === params.symbol.toUpperCase());
  if (!signal) return { status: 'error', error: 'unknown_symbol' };

  const referencePrice = signal.close;
  const signalSnapshot = { symbol: signal.symbol, score: signal.score, rsi: Math.round(signal.rsi), macdState: signal.macdState, status: signal.status, close: signal.close };

  const verdictRun = await runTradeReadiness({ symbol: params.symbol, signalSnapshot, creds: params.creds });
  if (!verdictRun.ok) return { status: 'error', error: verdictRun.error };
  const verdict = verdictRun.result as { readiness?: string; reasons?: string[]; citations?: string[] };
  if (verdict.readiness !== 'paper_trade_eligible') {
    return { status: verdict.readiness === 'blocked_missing_evidence' ? 'blocked_missing_evidence' : 'research_only', verdict };
  }

  // Deterministic intent - AI is NOT in this path. Entry candidate = buy.
  const intent = buildPaperOrderIntent({
    userId: 'local',
    symbol: params.symbol,
    side: 'buy',
    quantity: params.quantity,
    referencePrice,
    signalSnapshot,
    evidenceRefs: verdictRun.evidenceIds,
    aiExplanation: (verdict.reasons ?? []).join(' '),
  });

  const portfolioValue = data.portfolio.reduce((sum, h) => sum + h.marketValue, 0) || 100000;
  const report = runPreTradeChecks(intent, buildPaperContext(PAPER_SETTINGS, portfolioValue));
  if (!report.passed) {
    recordFlag({ kind: 'risk_blocked', symbol: params.symbol.toUpperCase(), message: `${params.symbol.toUpperCase()} blocked by the risk gate - not paper-eligible` });
    return { status: 'blocked_by_risk', verdict, intent: { ...intent, status: 'blocked' }, report };
  }
  recordFlag({ kind: 'approval_pending', symbol: params.symbol.toUpperCase(), message: `${params.symbol.toUpperCase()} is paper-eligible - ${params.quantity} share order awaiting your approval` });
  return {
    status: 'proposed',
    verdict,
    intent: { ...intent, status: report.requiresApproval ? 'pending_approval' : 'approved' },
    report,
    requiresApproval: report.requiresApproval,
  };
}

/**
 * EXECUTE: re-run the risk gate at execution time (a passed proposal can be blocked if conditions
 * changed), then simulate the paper fill. Only an already-approved intent should reach here.
 */
export async function executeBotRun(intent: OrderIntent): Promise<BotRun> {
  const data = await getDashboardData();
  const signal = data.signals.find((s) => s.symbol === intent.symbol);
  const referencePrice = signal?.close ?? intent.notionalValue / Math.max(1, intent.quantity);
  const portfolioValue = data.portfolio.reduce((sum, h) => sum + h.marketValue, 0) || 100000;

  const report = runPreTradeChecks(intent, buildPaperContext(PAPER_SETTINGS, portfolioValue));
  if (!report.passed) return { status: 'blocked_by_risk', intent: { ...intent, status: 'blocked' }, report };

  const fill = simulatePaperFill(intent, referencePrice);
  // The fill now LIVES in the paper account so it can be viewed + analysed (positions, P/L, track record).
  recordPaperFill({ symbol: fill.symbol, side: fill.side, quantity: fill.quantity, fillPrice: fill.fillPrice, simulatedFee: fill.simulatedFee });
  recordFlag({ kind: 'fill', symbol: fill.symbol, message: `Paper filled ${fill.side.toUpperCase()} ${fill.quantity} ${fill.symbol} @ $${fill.fillPrice} (notional $${fill.notional.toLocaleString()})` });
  // Durable, per-user persistence for authenticated users (RLS-scoped); a no-op in demo mode.
  await persistFillIfAuthed(fill, intent);
  return { status: 'paper_executed', intent: { ...intent, status: 'paper_executed' }, report, fill };
}
