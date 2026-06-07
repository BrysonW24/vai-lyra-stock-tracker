export type SignalStatus =
  | 'strong_setup'
  | 'watchlist_setup'
  | 'no_signal'
  | 'weakening'
  | 'invalidated'
  | 'overextended';

export type ScannerRunStatus = 'running' | 'success' | 'failed' | 'skipped';

export type ActionState = 'buy_review' | 'watch' | 'hold' | 'do_not_add' | 'trim_review' | 'sell_review' | 'invalidated';

export type LifecycleState = 'new_signal' | 'continuing' | 'upgraded' | 'downgraded' | 'invalidated' | 'recovered' | 'unchanged';

export interface SignalExplanation {
  triggeredBecause: string[];
  missingConfirmation: string[];
  riskNotes: string[];
  action: ActionState;
}

export interface ScoreBreakdown {
  rsiScore: number;
  macdScore: number;
  priceLocationScore: number;
  trendScore: number;
  volumeScore: number;
}

export interface SignalRow {
  symbol: string;
  companyName: string;
  score: number;
  scoreDelta: number;
  status: SignalStatus;
  actionState: ActionState;
  lifecycleState: LifecycleState;
  signalType: string;
  scoreBreakdown: ScoreBreakdown;
  close: number;
  priceChange1h: number;
  priceChange1d: number;
  rsi: number;
  previousRsi: number;
  rsiDelta: number;
  macdHistogram: number;
  previousMacdHistogram: number;
  histDelta: number;
  macdState: string;
  histogramSlope: number;
  volumeRatio: number;
  distanceFromLow: number;
  priceVsSma20: number;
  priceVsSma50: number;
  priceVsSma200: number;
  lastAlert: string | null;
  lastUpdated: string;
  explanation: SignalExplanation;
  summary: {
    rsi: string;
    macd: string;
    volume: string;
    trend: string;
    price: string;
  };
}

export interface ScannerRun {
  jobName: string;
  timeframe: string;
  status: ScannerRunStatus;
  startedAt: string;
  finishedAt: string;
  tickersScanned: number;
  candlesSaved: number;
  indicatorsSaved: number;
  signalsCreated: number;
  portfolioOverlaysCreated: number;
  watchlistOverlaysCreated: number;
  alertsSent: number;
}

export interface AlertRow {
  symbol: string;
  channel: string;
  alertType: string;
  message: string;
  score: number | null;
  previousScore: number | null;
  payload: Record<string, unknown> | null;
  sentStatus: string;
  sentAt: string | null;
  createdAt: string;
}

export interface TickerSetting {
  symbol: string;
  companyName: string;
  sector: string;
  industry: string;
  category: string;
  exchange: string;
  isActive: boolean;
}

export interface ScorePoint {
  label: string;
  score: number;
  rsi: number;
  histogram: number;
}

export interface PortfolioHolding {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  unrealisedPnl: number;
  unrealisedPnlPercent: number;
  portfolioWeight: number;
  signalScore: number;
  scoreDelta: number;
  signalStatus: SignalStatus;
  actionState: ActionState;
  rsi: number;
  macdState: string;
  riskState: 'low_risk' | 'neutral' | 'watch' | 'elevated_risk' | 'invalidated' | 'overextended' | 'opportunity';
  suggestedAction: string;
  explanation: SignalExplanation;
}

export interface WatchlistRow {
  symbol: string;
  companyName: string;
  category: string;
  targetBuyZone: number;
  currentPrice: number;
  distanceToTarget: number;
  signalScore: number;
  scoreDelta: number;
  signalStatus: SignalStatus;
  triggerState: 'not_ready' | 'approaching' | 'triggered' | 'missed' | 'invalidated';
  targetSignalScore: number;
  rsi: number;
  macdHistogram: number;
  volumeRatio: number;
  alertStatus: string;
  notes: string;
  explanation: SignalExplanation;
}

export interface SignalChange {
  symbol: string;
  change: number;
  label: string;
  status: 'improving' | 'weakening' | 'neutral';
  at: string;
}

export interface DashboardData {
  generatedFrom: 'supabase' | 'demo';
  latestRun: ScannerRun;
  signals: SignalRow[];
  alerts: AlertRow[];
  tickers: TickerSetting[];
  portfolio: PortfolioHolding[];
  watchlist: WatchlistRow[];
  signalChanges: SignalChange[];
  scoreHistory: ScorePoint[];
  thresholds: {
    alert: number;
    watchlist: number;
    signalChange: number;
  };
}
