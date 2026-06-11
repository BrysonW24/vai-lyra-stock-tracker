/**
 * Paper trading - demo-safe simulated trading surface.
 *
 * Everything here is SIMULATED. There is no broker, no order routing, and no
 * live execution anywhere in this build. Fills are modelled with realistic
 * friction (0.05% commission per fill + 0.1% slippage per fill) so the paper
 * P/L is honest about cost drag instead of flattering the strategy.
 *
 * All functions are pure and deterministic. The demo dataset is derived from
 * the same demo signal universe the rest of the dashboard uses (NVDA, AMD,
 * CRM, PLTR, CRWD, DDOG, NET, AVGO, SNOW).
 */

export type PaperTradeSide = 'long' | 'short';
export type PaperTradeStatus = 'open' | 'closed';

export type PaperExitReason =
  | 'target_hit'
  | 'stop_hit'
  | 'trailing_stop'
  | 'signal_invalidated'
  | 'time_stop'
  | 'manual_close';

export type MistakeTag =
  | 'chased_entry'
  | 'oversized'
  | 'moved_stop'
  | 'ignored_regime'
  | 'early_exit'
  | 'late_exit'
  | 'revenge_trade'
  | 'no_mistake';

/** Commission per fill, as a fraction of notional (0.05%). */
export const PAPER_FEE_RATE = 0.0005;
/** Slippage per fill, as a fraction of the reference price (0.1%). */
export const PAPER_SLIPPAGE_RATE = 0.001;

export interface PaperAccount {
  id: string;
  name: string;
  startingEquity: number;
  /** Cash remaining after open-trade entry notionals, realised P/L and fees. */
  cash: number;
  feeRatePct: number;
  slippageRatePct: number;
  createdAt: string;
}

/** Frozen view of the signal at entry time so the decision is auditable forever. */
export interface PaperThesisSnapshot {
  signalScore: number;
  signalStatus: string;
  rsi: number;
  macdState: string;
  volumeRatio: number;
  note: string;
}

export interface PaperTrade {
  id: string;
  accountId: string;
  strategyId: string;
  symbol: string;
  companyName: string;
  side: PaperTradeSide;
  status: PaperTradeStatus;
  quantity: number;
  /** Simulated fill price - slippage is already baked into this number. */
  entryPrice: number;
  entryAt: string;
  stopPrice: number;
  targetPrice: number;
  /** Latest mark for open trades. */
  currentPrice?: number;
  /** Simulated exit fill (slippage baked in) - closed trades only. */
  exitPrice?: number;
  exitAt?: string;
  exitReason?: PaperExitReason;
  /** Total commissions paid across fills (entry only while open). */
  fees: number;
  /** Dollar drag lost to slippage vs reference prices (tracked for transparency). */
  slippage: number;
  /** Net realised P/L after fees, with slippage embedded in fills - closed only. */
  realisedPnl?: number;
  /** Deterministic strategy reason code, e.g. "momentum_breakout_entry". */
  reasonCode: string;
  thesisSnapshot: PaperThesisSnapshot;
  journalEntryId?: string;
}

export interface PaperJournalEntry {
  id: string;
  tradeId: string;
  symbol: string;
  createdAt: string;
  mistakeTags: MistakeTag[];
  lesson: string;
  note: string;
}

export interface ReadinessGate {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface StrategyReadiness {
  strategyId: string;
  strategyLabel: string;
  sampleSize: number;
  winRate: number | null;
  expectancy: number | null;
  profitFactor: number | null;
  ready: boolean;
  verdict: 'not_ready_for_automation';
  gates: ReadinessGate[];
  missingGates: string[];
}

export interface PaperAccountSummary {
  accountId: string;
  startingEquity: number;
  equity: number;
  realisedPnl: number;
  unrealisedPnl: number;
  totalPnl: number;
  totalPnlPct: number;
  feesPaid: number;
  slippagePaid: number;
  openTrades: number;
  closedTrades: number;
  wins: number;
  losses: number;
  winRate: number | null;
}

const STRATEGY_LABELS: Record<string, string> = {
  momentum_breakout_v1: 'Momentum breakout',
  oversold_recovery_v1: 'Oversold recovery',
  trend_pullback_v1: 'Trend pullback',
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function direction(side: PaperTradeSide): 1 | -1 {
  return side === 'long' ? 1 : -1;
}

interface OpenTradeSpec {
  id: string;
  strategyId: string;
  symbol: string;
  companyName: string;
  side: PaperTradeSide;
  quantity: number;
  referenceEntry: number;
  currentPrice: number;
  stopPrice: number;
  targetPrice: number;
  entryAt: string;
  reasonCode: string;
  thesisSnapshot: PaperThesisSnapshot;
}

interface ClosedTradeSpec extends Omit<OpenTradeSpec, 'currentPrice'> {
  referenceExit: number;
  exitAt: string;
  exitReason: PaperExitReason;
  journalEntryId?: string;
}

const ACCOUNT_ID = 'paper-acct-demo-1';

/** Build an open trade with the entry fill slipped against the trader. */
function buildOpenTrade(spec: OpenTradeSpec): PaperTrade {
  const dir = direction(spec.side);
  const entryPrice = round2(spec.referenceEntry * (1 + dir * PAPER_SLIPPAGE_RATE));
  const fees = round2(entryPrice * spec.quantity * PAPER_FEE_RATE);
  const slippage = round2(spec.referenceEntry * spec.quantity * PAPER_SLIPPAGE_RATE);

  return {
    id: spec.id,
    accountId: ACCOUNT_ID,
    strategyId: spec.strategyId,
    symbol: spec.symbol,
    companyName: spec.companyName,
    side: spec.side,
    status: 'open',
    quantity: spec.quantity,
    entryPrice,
    entryAt: spec.entryAt,
    stopPrice: spec.stopPrice,
    targetPrice: spec.targetPrice,
    currentPrice: spec.currentPrice,
    fees,
    slippage,
    reasonCode: spec.reasonCode,
    thesisSnapshot: spec.thesisSnapshot,
  };
}

/** Build a closed trade with both fills slipped and commission on both sides. */
function buildClosedTrade(spec: ClosedTradeSpec): PaperTrade {
  const dir = direction(spec.side);
  const entryPrice = round2(spec.referenceEntry * (1 + dir * PAPER_SLIPPAGE_RATE));
  const exitPrice = round2(spec.referenceExit * (1 - dir * PAPER_SLIPPAGE_RATE));
  const fees = round2((entryPrice + exitPrice) * spec.quantity * PAPER_FEE_RATE);
  const slippage = round2((spec.referenceEntry + spec.referenceExit) * spec.quantity * PAPER_SLIPPAGE_RATE);
  const realisedPnl = round2(dir * (exitPrice - entryPrice) * spec.quantity - fees);

  return {
    id: spec.id,
    accountId: ACCOUNT_ID,
    strategyId: spec.strategyId,
    symbol: spec.symbol,
    companyName: spec.companyName,
    side: spec.side,
    status: 'closed',
    quantity: spec.quantity,
    entryPrice,
    entryAt: spec.entryAt,
    stopPrice: spec.stopPrice,
    targetPrice: spec.targetPrice,
    exitPrice,
    exitAt: spec.exitAt,
    exitReason: spec.exitReason,
    fees,
    slippage,
    realisedPnl,
    reasonCode: spec.reasonCode,
    thesisSnapshot: spec.thesisSnapshot,
    journalEntryId: spec.journalEntryId,
  };
}

export const DEMO_PAPER_TRADES: PaperTrade[] = [
  // ---- Open trades (3) ----
  buildOpenTrade({
    id: 'pt-open-nvda-1',
    strategyId: 'momentum_breakout_v1',
    symbol: 'NVDA',
    companyName: 'Nvidia',
    side: 'long',
    quantity: 70,
    referenceEntry: 128.4,
    currentPrice: 134.85,
    stopPrice: 119.5,
    targetPrice: 148.0,
    entryAt: '2026-06-02T14:35:00Z',
    reasonCode: 'momentum_breakout_entry',
    thesisSnapshot: {
      signalScore: 86,
      signalStatus: 'strong_setup',
      rsi: 63.2,
      macdState: 'bullish_cross',
      volumeRatio: 2.4,
      note: 'Hourly breakout above 20-day range high on 2.4x volume; AI infra theme leading.',
    },
  }),
  buildOpenTrade({
    id: 'pt-open-amd-1',
    strategyId: 'oversold_recovery_v1',
    symbol: 'AMD',
    companyName: 'Advanced Micro Devices',
    side: 'long',
    quantity: 55,
    referenceEntry: 162.8,
    currentPrice: 158.9,
    stopPrice: 149.8,
    targetPrice: 184.0,
    entryAt: '2026-06-05T15:05:00Z',
    reasonCode: 'oversold_recovery_entry',
    thesisSnapshot: {
      signalScore: 71,
      signalStatus: 'watchlist_setup',
      rsi: 31.8,
      macdState: 'histogram_turning',
      volumeRatio: 1.6,
      note: 'RSI washout into the 50-day with histogram turning; semis still in uptrend regime.',
    },
  }),
  buildOpenTrade({
    id: 'pt-open-crwd-1',
    strategyId: 'trend_pullback_v1',
    symbol: 'CRWD',
    companyName: 'CrowdStrike',
    side: 'long',
    quantity: 28,
    referenceEntry: 312.5,
    currentPrice: 318.2,
    stopPrice: 289.0,
    targetPrice: 352.0,
    entryAt: '2026-06-08T18:40:00Z',
    reasonCode: 'trend_pullback_entry',
    thesisSnapshot: {
      signalScore: 78,
      signalStatus: 'strong_setup',
      rsi: 48.5,
      macdState: 'above_signal',
      volumeRatio: 1.2,
      note: 'First pullback to the rising 21-EMA after a fresh high; cybersecurity breadth intact.',
    },
  }),

  // ---- Closed trades (6) ----
  buildClosedTrade({
    id: 'pt-closed-crm-1',
    strategyId: 'trend_pullback_v1',
    symbol: 'CRM',
    companyName: 'Salesforce',
    side: 'long',
    quantity: 40,
    referenceEntry: 245.0,
    referenceExit: 262.5,
    stopPrice: 232.0,
    targetPrice: 262.0,
    entryAt: '2026-04-21T14:50:00Z',
    exitAt: '2026-05-06T16:10:00Z',
    exitReason: 'target_hit',
    reasonCode: 'trend_pullback_entry',
    journalEntryId: 'pj-crm-1',
    thesisSnapshot: {
      signalScore: 81,
      signalStatus: 'strong_setup',
      rsi: 52.1,
      macdState: 'bullish_cross',
      volumeRatio: 1.5,
      note: 'Pullback to prior breakout shelf with MACD re-cross; enterprise software regime positive.',
    },
  }),
  buildClosedTrade({
    id: 'pt-closed-pltr-1',
    strategyId: 'momentum_breakout_v1',
    symbol: 'PLTR',
    companyName: 'Palantir Technologies',
    side: 'long',
    quantity: 100,
    referenceEntry: 92.0,
    referenceExit: 86.5,
    stopPrice: 86.6,
    targetPrice: 106.0,
    entryAt: '2026-04-28T17:25:00Z',
    exitAt: '2026-05-01T14:45:00Z',
    exitReason: 'stop_hit',
    reasonCode: 'momentum_breakout_entry',
    journalEntryId: 'pj-pltr-1',
    thesisSnapshot: {
      signalScore: 74,
      signalStatus: 'strong_setup',
      rsi: 71.4,
      macdState: 'extended',
      volumeRatio: 3.1,
      note: 'Breakout chased two bars late with RSI already above 70; extension risk flagged at entry.',
    },
  }),
  buildClosedTrade({
    id: 'pt-closed-ddog-1',
    strategyId: 'oversold_recovery_v1',
    symbol: 'DDOG',
    companyName: 'Datadog',
    side: 'long',
    quantity: 80,
    referenceEntry: 118.0,
    referenceExit: 127.4,
    stopPrice: 110.5,
    targetPrice: 127.0,
    entryAt: '2026-05-04T15:15:00Z',
    exitAt: '2026-05-18T19:30:00Z',
    exitReason: 'target_hit',
    reasonCode: 'oversold_recovery_entry',
    thesisSnapshot: {
      signalScore: 69,
      signalStatus: 'watchlist_setup',
      rsi: 29.6,
      macdState: 'histogram_turning',
      volumeRatio: 1.8,
      note: 'Capitulation flush into long-term support; observability peers already recovering.',
    },
  }),
  buildClosedTrade({
    id: 'pt-closed-net-1',
    strategyId: 'momentum_breakout_v1',
    symbol: 'NET',
    companyName: 'Cloudflare',
    side: 'long',
    quantity: 90,
    referenceEntry: 96.5,
    referenceExit: 92.3,
    stopPrice: 90.2,
    targetPrice: 112.0,
    entryAt: '2026-05-11T14:40:00Z',
    exitAt: '2026-05-13T17:55:00Z',
    exitReason: 'signal_invalidated',
    reasonCode: 'momentum_breakout_entry',
    journalEntryId: 'pj-net-1',
    thesisSnapshot: {
      signalScore: 72,
      signalStatus: 'strong_setup',
      rsi: 58.9,
      macdState: 'above_signal',
      volumeRatio: 1.9,
      note: 'Range breakout while the broader cloud-data cohort was rolling over; cohort divergence ignored.',
    },
  }),
  buildClosedTrade({
    id: 'pt-closed-avgo-1',
    strategyId: 'trend_pullback_v1',
    symbol: 'AVGO',
    companyName: 'Broadcom',
    side: 'long',
    quantity: 55,
    referenceEntry: 168.0,
    referenceExit: 181.4,
    stopPrice: 158.5,
    targetPrice: 192.0,
    entryAt: '2026-05-15T13:55:00Z',
    exitAt: '2026-06-01T15:20:00Z',
    exitReason: 'trailing_stop',
    reasonCode: 'trend_pullback_entry',
    thesisSnapshot: {
      signalScore: 84,
      signalStatus: 'strong_setup',
      rsi: 55.3,
      macdState: 'bullish_cross',
      volumeRatio: 1.4,
      note: 'Orderly 3-week pullback in a leading AI-infrastructure name; trailing stop managed the exit.',
    },
  }),
  buildClosedTrade({
    id: 'pt-closed-snow-1',
    strategyId: 'oversold_recovery_v1',
    symbol: 'SNOW',
    companyName: 'Snowflake',
    side: 'long',
    quantity: 60,
    referenceEntry: 142.0,
    referenceExit: 149.1,
    stopPrice: 132.9,
    targetPrice: 164.0,
    entryAt: '2026-05-19T16:05:00Z',
    exitAt: '2026-06-04T19:45:00Z',
    exitReason: 'time_stop',
    reasonCode: 'oversold_recovery_entry',
    journalEntryId: 'pj-snow-1',
    thesisSnapshot: {
      signalScore: 66,
      signalStatus: 'watchlist_setup',
      rsi: 33.4,
      macdState: 'histogram_turning',
      volumeRatio: 1.3,
      note: 'Recovery bounce stalled below the 50-day; 12-session time stop closed the position.',
    },
  }),
];

export const DEMO_PAPER_JOURNAL: PaperJournalEntry[] = [
  {
    id: 'pj-pltr-1',
    tradeId: 'pt-closed-pltr-1',
    symbol: 'PLTR',
    createdAt: '2026-05-01T20:10:00Z',
    mistakeTags: ['chased_entry', 'oversized'],
    lesson: 'Do not take breakout entries when RSI is already above 70 - wait for the first consolidation or skip.',
    note: 'Entered two bars after the trigger at a worse price and sized at full risk anyway. The stop was correct; the entry and size were not.',
  },
  {
    id: 'pj-net-1',
    tradeId: 'pt-closed-net-1',
    symbol: 'NET',
    createdAt: '2026-05-13T21:35:00Z',
    mistakeTags: ['ignored_regime'],
    lesson: 'Check cohort breadth before single-name breakouts - a breakout against a rolling-over cohort is a low-quality setup.',
    note: 'The cloud-data cohort score had been falling for three sessions. The single-name signal was valid but the regime filter should have vetoed it.',
  },
  {
    id: 'pj-snow-1',
    tradeId: 'pt-closed-snow-1',
    symbol: 'SNOW',
    createdAt: '2026-06-04T22:00:00Z',
    mistakeTags: ['no_mistake'],
    lesson: 'Time stops work - a small win taken on schedule beats holding a stalling thesis hoping for the target.',
    note: 'Thesis partially played out, momentum never confirmed. Exited on the 12-session clock per plan. Process win even though the target was missed.',
  },
  {
    id: 'pj-crm-1',
    tradeId: 'pt-closed-crm-1',
    symbol: 'CRM',
    createdAt: '2026-05-06T20:25:00Z',
    mistakeTags: ['early_exit'],
    lesson: 'Consider scaling out instead of closing the full position at target when the trend regime is still strong.',
    note: 'Target hit in 11 sessions and the name kept running afterwards. A two-tranche exit would have captured more of the move at the same risk.',
  },
];

/** Mark-to-market P/L for an open trade, net of the entry commission already paid. */
export function computeOpenTradePnl(trade: PaperTrade): { pnl: number; pnlPct: number } {
  if (trade.status !== 'open' || trade.currentPrice === undefined) {
    return { pnl: 0, pnlPct: 0 };
  }

  const dir = direction(trade.side);
  const pnl = round2(dir * (trade.currentPrice - trade.entryPrice) * trade.quantity - trade.fees);
  const basis = trade.entryPrice * trade.quantity;
  const pnlPct = basis > 0 ? round2((pnl / basis) * 100) : 0;
  return { pnl, pnlPct };
}

function buildDemoAccount(trades: PaperTrade[]): PaperAccount {
  const startingEquity = 100000;
  const realised = trades
    .filter((t) => t.status === 'closed')
    .reduce((sum, t) => sum + (t.realisedPnl ?? 0), 0);
  const openCost = trades
    .filter((t) => t.status === 'open')
    .reduce((sum, t) => sum + t.entryPrice * t.quantity + t.fees, 0);

  return {
    id: ACCOUNT_ID,
    name: 'Demo paper account',
    startingEquity,
    cash: round2(startingEquity + realised - openCost),
    feeRatePct: PAPER_FEE_RATE * 100,
    slippageRatePct: PAPER_SLIPPAGE_RATE * 100,
    createdAt: '2026-04-20T00:00:00Z',
  };
}

export const DEMO_PAPER_ACCOUNT: PaperAccount = buildDemoAccount(DEMO_PAPER_TRADES);

/** Aggregate account statistics. Pure - no I/O, no mutation. */
export function computeAccountSummary(account: PaperAccount, trades: PaperTrade[]): PaperAccountSummary {
  const accountTrades = trades.filter((t) => t.accountId === account.id);
  const open = accountTrades.filter((t) => t.status === 'open');
  const closed = accountTrades.filter((t) => t.status === 'closed');

  const realisedPnl = round2(closed.reduce((sum, t) => sum + (t.realisedPnl ?? 0), 0));
  const unrealisedPnl = round2(open.reduce((sum, t) => sum + computeOpenTradePnl(t).pnl, 0));
  const totalPnl = round2(realisedPnl + unrealisedPnl);
  const feesPaid = round2(accountTrades.reduce((sum, t) => sum + t.fees, 0));
  const slippagePaid = round2(accountTrades.reduce((sum, t) => sum + t.slippage, 0));
  const wins = closed.filter((t) => (t.realisedPnl ?? 0) > 0).length;
  const losses = closed.filter((t) => (t.realisedPnl ?? 0) <= 0).length;

  return {
    accountId: account.id,
    startingEquity: account.startingEquity,
    equity: round2(account.startingEquity + totalPnl),
    realisedPnl,
    unrealisedPnl,
    totalPnl,
    totalPnlPct: account.startingEquity > 0 ? round2((totalPnl / account.startingEquity) * 100) : 0,
    feesPaid,
    slippagePaid,
    openTrades: open.length,
    closedTrades: closed.length,
    wins,
    losses,
    winRate: closed.length > 0 ? round2((wins / closed.length) * 100) : null,
  };
}

/**
 * Honest per-strategy automation-readiness assessment. Pure and deterministic.
 *
 * Every strategy in this build returns NOT READY FOR AUTOMATION. The gates are
 * intentionally strict: a handful of paper trades proves nothing. Automation is
 * only discussable once every gate passes - and even then the deterministic
 * risk engine and human approval still sit in front of any execution path.
 */
export function computeStrategyReadiness(trades: PaperTrade[]): StrategyReadiness[] {
  const MIN_SAMPLE = 30;
  const strategyIds = Array.from(new Set(trades.map((t) => t.strategyId))).sort();

  return strategyIds.map((strategyId) => {
    const all = trades.filter((t) => t.strategyId === strategyId);
    const closed = all.filter((t) => t.status === 'closed');
    const sampleSize = closed.length;

    const wins = closed.filter((t) => (t.realisedPnl ?? 0) > 0);
    const losses = closed.filter((t) => (t.realisedPnl ?? 0) <= 0);
    const grossWin = wins.reduce((sum, t) => sum + (t.realisedPnl ?? 0), 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (t.realisedPnl ?? 0), 0));

    const winRate = sampleSize > 0 ? round2((wins.length / sampleSize) * 100) : null;
    const expectancy = sampleSize > 0
      ? round2(closed.reduce((sum, t) => sum + (t.realisedPnl ?? 0), 0) / sampleSize)
      : null;
    const profitFactor = grossLoss > 0 ? round2(grossWin / grossLoss) : null;

    const gates: ReadinessGate[] = [
      {
        id: 'sample_size',
        label: 'Sample size n >= 30 closed trades',
        passed: sampleSize >= MIN_SAMPLE,
        detail: sampleSize >= MIN_SAMPLE
          ? `${sampleSize} closed trades recorded.`
          : `Only ${sampleSize} closed trade${sampleSize === 1 ? '' : 's'} - statistically meaningless below ${MIN_SAMPLE}.`,
      },
      {
        id: 'out_of_sample',
        label: 'Out-of-sample evaluation period',
        passed: false,
        detail: 'No out-of-sample period exists yet - all results are in-sample paper fills.',
      },
      {
        id: 'drawdown_tested',
        label: 'Drawdown tested through a full regime cycle',
        passed: false,
        detail: 'Max drawdown is untested - the strategy has not traded through a downtrend regime.',
      },
      {
        id: 'expectancy_confidence',
        label: 'Positive expectancy with statistical confidence',
        passed: false,
        detail: expectancy !== null
          ? `Point-estimate expectancy ${expectancy >= 0 ? '+' : ''}$${expectancy.toFixed(2)}/trade, but n=${sampleSize} gives no confidence interval worth acting on.`
          : 'No closed trades - expectancy unknown.',
      },
      {
        id: 'cost_model',
        label: 'Fees + slippage modelled in results',
        passed: true,
        detail: `All paper fills include ${(PAPER_FEE_RATE * 100).toFixed(2)}% commission and ${(PAPER_SLIPPAGE_RATE * 100).toFixed(1)}% slippage per fill.`,
      },
    ];

    const missingGates = gates.filter((g) => !g.passed).map((g) => g.label);

    return {
      strategyId,
      strategyLabel: STRATEGY_LABELS[strategyId] ?? strategyId,
      sampleSize,
      winRate,
      expectancy,
      profitFactor,
      ready: missingGates.length === 0,
      verdict: 'not_ready_for_automation',
      gates,
      missingGates,
    };
  });
}
