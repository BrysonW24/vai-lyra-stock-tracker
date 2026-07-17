/**
 * Shared client-side types for the Paper Bot surface - the API response shapes the panels
 * render. Extracted from PaperBotView.tsx when the 970-line component was split into panels;
 * these mirror (a subset of) the server types in src/lib/trading/types.ts + paper-bot.ts.
 */

export interface MarketQuote {
  valid: boolean;
  symbol: string;
  name: string | null;
  price: number | null;
  currency: string | null;
  exchange: string | null;
  changePercent: number | null;
  error?: string;
}

export type Action = 'propose' | 'approve' | 'execute';

export interface Verdict {
  readiness?: string;
  reasons?: string[];
  missingEvidence?: string[];
  citations?: string[];
  confidence?: number;
}

export interface Intent {
  id?: string;
  symbol: string;
  side: string;
  quantity: number;
  notionalValue: number;
  status: string;
  aiExplanation?: string;
  reasonCode?: string;
}

export interface Check {
  id: string;
  label: string;
  severity: string;
  passed: boolean;
}

export interface Report {
  passed: boolean;
  requiresApproval: boolean;
  blocking?: Check[];
  warnings?: Check[];
}

export interface Fill {
  symbol: string;
  side: string;
  quantity: number;
  fillPrice: number;
  notional: number;
  simulatedFee: number;
  simulatedSlippage: number;
}

export interface BotRun {
  ok?: boolean;
  reason?: string;
  status?: string;
  verdict?: Verdict;
  intent?: Intent;
  report?: Report;
  fill?: Fill;
  requiresApproval?: boolean;
  /** Server-signed capability carried across propose -> approve -> execute (the approval gate). */
  token?: string;
}

export interface AccountPosition {
  symbol: string;
  quantity: number;
  avgEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealisedPnl: number;
  unrealisedPnlPct: number;
}

export interface Account {
  positions: AccountPosition[];
  totalInvested: number;
  marketValue: number;
  unrealisedPnl: number;
  unrealisedPnlPct: number;
  openPositions: number;
  fillCount: number;
  startingEquity: number;
  equity: number;
  equityCurve: number[];
  realisedPnl: number;
  closedTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  dataSource: 'persisted' | 'demo';
}

export interface Flag {
  id: string;
  kind: string;
  severity: 'action' | 'good' | 'warn' | 'info';
  message: string;
  symbol?: string;
  createdAt: string;
  read: boolean;
}

export interface CliEntry {
  cmd: string;
  ok: boolean;
  lines: string[];
}
