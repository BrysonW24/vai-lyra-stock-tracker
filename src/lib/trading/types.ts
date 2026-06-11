/**
 * Future trading layer - TYPES ONLY, no live execution exists in this codebase.
 *
 * Core principle: LLMs never generate orders. An OrderIntent is produced by
 * deterministic strategy logic, passes the deterministic pre-trade risk engine,
 * requires explicit human approval where configured, and (today) can at most be
 * paper-executed. Live broker execution is intentionally NOT implemented - see
 * docs/architecture/future-trading-bot.md for the gates that must pass first.
 */

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
export type TimeInForce = 'day' | 'gtc' | 'ioc';

export type TradingMode = 'disabled' | 'paper_only' | 'approval_required' | 'live_limited' | 'live_full';

export type OrderIntentStatus =
  | 'drafted'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'blocked'
  | 'expired'
  | 'paper_executed'
  | 'live_executed';

export interface OrderIntent {
  id: string;
  userId: string;
  strategyId: string;
  strategyVersion: string;
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  notionalValue: number;
  limitPrice?: number;
  stopPrice?: number;
  timeInForce: TimeInForce;
  /** Deterministic reason code from the strategy, e.g. "momentum_recovery_entry". */
  reasonCode: string;
  /** Frozen snapshots so the decision is auditable forever. */
  signalSnapshot: Record<string, unknown>;
  riskSnapshot: Record<string, unknown>;
  evidenceSnapshot: string[];
  /** AI may EXPLAIN an intent after the fact - it never creates or mutates one. */
  aiExplanation?: string;
  status: OrderIntentStatus;
  /** Deterministic duplicate-prevention key. */
  idempotencyKey: string;
  createdAt: string;
}

export interface TradingSettings {
  userId: string;
  tradingMode: TradingMode;
  maxOrderNotional: number;
  maxPositionPct: number;
  maxDailyLoss: number;
  maxTotalDrawdownPct: number;
  requireManualApproval: boolean;
  allowedStrategies: string[];
  blockedSymbols: string[];
  blockedThemes: string[];
}

export const DEFAULT_TRADING_SETTINGS: Omit<TradingSettings, 'userId'> = {
  tradingMode: 'disabled',
  maxOrderNotional: 0,
  maxPositionPct: 5,
  maxDailyLoss: 0,
  maxTotalDrawdownPct: 10,
  requireManualApproval: true,
  allowedStrategies: [],
  blockedSymbols: [],
  blockedThemes: [],
};

export type KillSwitchId =
  | 'global'
  | 'user'
  | 'strategy'
  | 'broker'
  | 'symbol'
  | 'theme'
  | 'daily_loss'
  | 'error_rate'
  | 'slippage'
  | 'data_staleness'
  | 'ai_system';

export interface KillSwitchState {
  id: KillSwitchId;
  active: boolean;
  /** Why it tripped - mandatory when active. */
  reason?: string;
  activatedAt?: string;
}

/** Everything the pre-trade engine needs to evaluate an intent - all deterministic inputs. */
export interface PreTradeContext {
  settings: TradingSettings;
  killSwitches: KillSwitchState[];
  marketOpen: boolean;
  symbolTradable: boolean;
  /** Seconds since last quote for the symbol. */
  quoteAgeSeconds: number;
  maxQuoteAgeSeconds: number;
  portfolioValue: number;
  currentPositionValue: number;
  realisedDailyPnl: number;
  portfolioDrawdownPct: number;
  /** Average daily dollar volume for the symbol. */
  avgDailyDollarVolume: number;
  minDollarVolume: number;
  spreadPct: number;
  maxSpreadPct: number;
  earningsBlackout: boolean;
  newsRiskBlackout: boolean;
  /** Idempotency keys of open/recent intents, for duplicate detection. */
  openIntentKeys: string[];
  brokerConnected: boolean;
  symbolTheme?: string;
}

export interface PreTradeCheck {
  id: string;
  label: string;
  passed: boolean;
  /** Blocking failures stop the intent; warnings surface but do not. */
  severity: 'blocking' | 'warning';
  detail: string;
}

export interface PreTradeReport {
  intentId: string;
  passed: boolean;
  requiresApproval: boolean;
  checks: PreTradeCheck[];
  blocking: PreTradeCheck[];
  warnings: PreTradeCheck[];
  evaluatedAt: string;
}
