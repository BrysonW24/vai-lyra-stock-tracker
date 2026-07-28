import { demoDashboardData } from '@/lib/demo-data';
import { applyLiveSignals } from '@/lib/live-signals';
import { buildSoloMarketDashboard } from '@/lib/local-dashboard';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  ActionState,
  AlertRow,
  DashboardData,
  LifecycleState,
  ScannerRun,
  SignalChange,
  SignalExplanation,
  SignalRow,
  SignalStatus,
  PortfolioHolding,
  TickerSetting,
  WatchlistRow,
} from '@/types/scanner';

type SignalRecord = {
  symbol: string;
  timeframe: string;
  candle_time: string;
  signal_score: number;
  signal_type: string;
  signal_status: SignalStatus;
  previous_signal_score: number | null;
  signal_score_delta: number | null;
  action_state: ActionState | null;
  lifecycle_state: LifecycleState | null;
  explanation: Record<string, unknown> | null;
  rsi_summary: string | null;
  macd_summary: string | null;
  volume_summary: string | null;
  trend_summary: string | null;
  price_summary: string | null;
  raw_payload: Record<string, unknown> | null;
};

type TickerRecord = {
  symbol: string;
  company_name: string | null;
  sector: string | null;
  industry: string | null;
  category: string | null;
  exchange: string | null;
  is_active: boolean | null;
};

type PortfolioPositionRecord = {
  id: string;
  symbol: string;
  quantity: number;
  average_buy_price: number;
  brokerage_fee: number | null;
  purchase_date: string | null;
  notes: string | null;
  is_active: boolean | null;
};

type PortfolioOverlayRecord = {
  position_id: string | null;
  symbol: string;
  candle_time: string;
  current_price: number | null;
  market_value: number | null;
  unrealised_pl: number | null;
  unrealised_pl_pct: number | null;
  portfolio_weight_pct: number | null;
  signal_score: number | null;
  signal_status: SignalStatus | null;
  action_state: ActionState | null;
  risk_state: PortfolioHolding['riskState'] | null;
  explanation: Record<string, unknown> | null;
};

type WatchlistItemRecord = {
  id: string;
  symbol: string;
  target_price: number | null;
  target_signal_score: number | null;
  notes: string | null;
  is_active: boolean | null;
};

type WatchlistOverlayRecord = {
  watchlist_item_id: string | null;
  symbol: string;
  candle_time: string;
  current_price: number | null;
  distance_to_target_price_pct: number | null;
  signal_score: number | null;
  signal_status: SignalStatus | null;
  watchlist_trigger_state: WatchlistRow['triggerState'] | null;
  explanation: Record<string, unknown> | null;
};

type RunRecord = {
  job_name: string;
  timeframe: string;
  started_at: string;
  finished_at: string | null;
  status: ScannerRun['status'];
  tickers_scanned: number | null;
  candles_saved: number | null;
  indicators_saved: number | null;
  signals_created: number | null;
  portfolio_overlays_created: number | null;
  watchlist_overlays_created: number | null;
  alerts_sent: number | null;
};

type AlertRecord = {
  symbol: string;
  channel: string;
  alert_type: string;
  message: string;
  payload: Record<string, unknown> | null;
  sent_status: string;
  sent_at: string | null;
  created_at: string;
};

function numberFromPayload(payload: Record<string, unknown> | null, key: string, fallback = 0): number {
  const value = payload?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function nullableNumberFromPayload(payload: Record<string, unknown> | null, key: string): number | null {
  const value = payload?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function textOrFallback(value: string | null, fallback: string): string {
  return value && value.trim().length > 0 ? value : fallback;
}

function arrayFromPayload(payload: Record<string, unknown> | null, key: string): string[] {
  const value = payload?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function explanationFromPayload(payload: Record<string, unknown> | null, action: ActionState): SignalExplanation {
  return {
    action,
    triggeredBecause: arrayFromPayload(payload, 'triggered_because'),
    missingConfirmation: arrayFromPayload(payload, 'missing_confirmation'),
    riskNotes: arrayFromPayload(payload, 'risk_notes'),
  };
}

function latestSignals(records: SignalRecord[], tickers: TickerSetting[]): SignalRow[] {
  const companies = new Map(tickers.map((ticker) => [ticker.symbol, ticker.companyName]));
  const seen = new Set<string>();
  const rows: SignalRow[] = [];

  for (const record of records) {
    if (seen.has(record.symbol)) {
      continue;
    }

    seen.add(record.symbol);

    rows.push({
      symbol: record.symbol,
      companyName: companies.get(record.symbol) ?? record.symbol,
      score: Math.round(record.signal_score),
      scoreDelta: record.signal_score_delta ?? numberFromPayload(record.raw_payload, 'score_delta'),
      status: record.signal_status,
      actionState: record.action_state ?? 'hold',
      lifecycleState: record.lifecycle_state ?? 'unchanged',
      signalType: record.signal_type,
      scoreBreakdown: {
        rsiScore: numberFromPayload(record.raw_payload, 'rsi_score'),
        macdScore: numberFromPayload(record.raw_payload, 'macd_score'),
        priceLocationScore: numberFromPayload(record.raw_payload, 'price_location_score'),
        trendScore: numberFromPayload(record.raw_payload, 'trend_score'),
        volumeScore: numberFromPayload(record.raw_payload, 'volume_score'),
      },
      close: numberFromPayload(record.raw_payload, 'close'),
      priceChange1h: numberFromPayload(record.raw_payload, 'price_change_1h'),
      priceChange1d: numberFromPayload(record.raw_payload, 'price_change_1d'),
      rsi: numberFromPayload(record.raw_payload, 'rsi_14'),
      previousRsi: numberFromPayload(record.raw_payload, 'previous_rsi_14'),
      rsiDelta: numberFromPayload(record.raw_payload, 'rsi_delta'),
      macdHistogram: numberFromPayload(record.raw_payload, 'macd_histogram'),
      previousMacdHistogram: numberFromPayload(record.raw_payload, 'previous_macd_histogram'),
      histDelta: numberFromPayload(record.raw_payload, 'hist_delta', numberFromPayload(record.raw_payload, 'macd_histogram_slope')),
      macdState: textOrFallback(record.raw_payload?.macd_state as string | null, 'Tracked'),
      histogramSlope: numberFromPayload(record.raw_payload, 'macd_histogram_slope'),
      volumeRatio: numberFromPayload(record.raw_payload, 'volume_ratio'),
      distanceFromLow: numberFromPayload(record.raw_payload, 'distance_from_60_period_low'),
      priceVsSma20: numberFromPayload(record.raw_payload, 'price_vs_sma_20'),
      priceVsSma50: numberFromPayload(record.raw_payload, 'price_vs_sma_50'),
      priceVsSma200: numberFromPayload(record.raw_payload, 'price_vs_sma_200'),
      lastAlert: null,
      lastUpdated: record.candle_time,
      explanation: explanationFromPayload(record.explanation, record.action_state ?? 'hold'),
      summary: {
        rsi: textOrFallback(record.rsi_summary, 'RSI evidence has not been summarized yet.'),
        macd: textOrFallback(record.macd_summary, 'MACD evidence has not been summarized yet.'),
        volume: textOrFallback(record.volume_summary, 'Volume evidence has not been summarized yet.'),
        trend: textOrFallback(record.trend_summary, 'Trend evidence has not been summarized yet.'),
        price: textOrFallback(record.price_summary, 'Price location evidence has not been summarized yet.'),
      },
    });
  }

  return rows.sort((a, b) => b.score - a.score);
}

function mapTickers(records: TickerRecord[]): TickerSetting[] {
  return records.map((record) => ({
    symbol: record.symbol,
    companyName: record.company_name ?? record.symbol,
    sector: record.sector ?? 'Unknown',
    industry: record.industry ?? 'Unknown',
    category: record.category ?? 'unknown',
    exchange: record.exchange ?? 'Unknown',
    isActive: record.is_active ?? true,
  }));
}

function mapRun(record: RunRecord | null): ScannerRun {
  if (!record) {
    return demoDashboardData.latestRun;
  }

  return {
    jobName: record.job_name,
    timeframe: record.timeframe,
    status: record.status,
    startedAt: record.started_at,
    finishedAt: record.finished_at ?? record.started_at,
    tickersScanned: record.tickers_scanned ?? 0,
    candlesSaved: record.candles_saved ?? 0,
    indicatorsSaved: record.indicators_saved ?? 0,
    signalsCreated: record.signals_created ?? 0,
    portfolioOverlaysCreated: record.portfolio_overlays_created ?? 0,
    watchlistOverlaysCreated: record.watchlist_overlays_created ?? 0,
    alertsSent: record.alerts_sent ?? 0,
  };
}

function mapAlerts(records: AlertRecord[]): AlertRow[] {
  return records.map((record) => ({
    symbol: record.symbol,
    channel: record.channel,
    alertType: record.alert_type,
    message: record.message,
    score: nullableNumberFromPayload(record.payload, 'score'),
    previousScore: nullableNumberFromPayload(record.payload, 'previous_score'),
    payload: record.payload,
    sentStatus: record.sent_status,
    sentAt: record.sent_at,
    createdAt: record.created_at,
  }));
}

const ACTION_SUGGESTION: Record<string, string> = {
  buy_review: 'Add review',
  do_not_add: 'Hold / avoid adding',
  hold: 'Hold',
  trim: 'Consider trimming',
  exit_review: 'Exit review',
  watch: 'Watch',
};

const TRIGGER_ALERT_STATUS: Record<string, string> = {
  triggered: 'Triggered',
  approaching: 'Near trigger',
  building: 'Building',
  not_ready: 'Dormant',
};

/** Keep only the newest record per symbol (records arrive newest-first). */
function latestPerSymbol<T extends { symbol: string }>(records: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const record of records) {
    if (!map.has(record.symbol)) map.set(record.symbol, record);
  }
  return map;
}

function mapPortfolio(
  positions: PortfolioPositionRecord[],
  overlays: PortfolioOverlayRecord[],
  signalsBySymbol: Map<string, SignalRow>,
): PortfolioHolding[] {
  const overlayBySymbol = latestPerSymbol(overlays);

  const mapped = positions
    .filter((position) => position.is_active !== false)
    .map((position) => {
      const overlay = overlayBySymbol.get(position.symbol) ?? null;
      const signal = signalsBySymbol.get(position.symbol);
      const action = (overlay?.action_state ?? 'hold') as ActionState;

      const currentPrice = overlay?.current_price ?? signal?.close ?? position.average_buy_price;
      const cost = position.average_buy_price * position.quantity;
      const marketValue = overlay?.market_value ?? currentPrice * position.quantity;
      const unrealisedPnl = overlay?.unrealised_pl ?? marketValue - cost;
      const unrealisedPnlPercent = overlay?.unrealised_pl_pct ?? (cost > 0 ? (unrealisedPnl / cost) * 100 : 0);

      return {
        id: position.id,
        symbol: position.symbol,
        quantity: position.quantity,
        averagePrice: position.average_buy_price,
        currentPrice,
        marketValue,
        unrealisedPnl,
        unrealisedPnlPercent,
        portfolioWeight: overlay?.portfolio_weight_pct ?? 0,
        signalScore: Math.round(overlay?.signal_score ?? signal?.score ?? 0),
        scoreDelta: signal?.scoreDelta ?? 0,
        signalStatus: (overlay?.signal_status ?? signal?.status ?? 'no_signal') as SignalStatus,
        actionState: action,
        rsi: signal?.rsi ?? 0,
        macdState: signal?.macdState ?? 'Tracked',
        riskState: (overlay?.risk_state ?? 'neutral') as PortfolioHolding['riskState'],
        suggestedAction: ACTION_SUGGESTION[action] ?? action.replaceAll('_', ' '),
        explanation: explanationFromPayload(overlay?.explanation ?? null, action),
        purchaseDate: position.purchase_date,
        notes: position.notes,
        brokerageFee: position.brokerage_fee,
      };
    });

  const totalMarketValue = mapped.reduce((sum, h) => sum + h.marketValue, 0);

  // If overlay didn't provide a weight, calculate it from the total market value
  return mapped.map((h) => ({
    ...h,
    portfolioWeight: h.portfolioWeight > 0 ? h.portfolioWeight : (totalMarketValue > 0 ? (h.marketValue / totalMarketValue) * 100 : 0),
  }));
}

function mapWatchlist(
  items: WatchlistItemRecord[],
  overlays: WatchlistOverlayRecord[],
  tickers: TickerSetting[],
  signalsBySymbol: Map<string, SignalRow>,
): WatchlistRow[] {
  const overlayBySymbol = latestPerSymbol(overlays);
  const tickerBySymbol = new Map(tickers.map((ticker) => [ticker.symbol, ticker]));

  return items
    .filter((item) => item.is_active !== false)
    .map((item) => {
      const overlay = overlayBySymbol.get(item.symbol) ?? null;
      const signal = signalsBySymbol.get(item.symbol);
      const ticker = tickerBySymbol.get(item.symbol);
      const triggerState = (overlay?.watchlist_trigger_state ?? 'not_ready') as WatchlistRow['triggerState'];

      return {
        symbol: item.symbol,
        companyName: ticker?.companyName ?? signal?.companyName ?? item.symbol,
        category: ticker?.category ?? ticker?.sector ?? 'Tracked',
        targetBuyZone: item.target_price ?? null,
        currentPrice: overlay?.current_price ?? signal?.close ?? 0,
        distanceToTarget: overlay?.distance_to_target_price_pct ?? 0,
        signalScore: Math.round(overlay?.signal_score ?? signal?.score ?? 0),
        scoreDelta: signal?.scoreDelta ?? 0,
        signalStatus: (overlay?.signal_status ?? signal?.status ?? 'watchlist_setup') as SignalStatus,
        triggerState,
        targetSignalScore: item.target_signal_score ?? 0,
        rsi: signal?.rsi ?? 0,
        macdHistogram: signal?.macdHistogram ?? 0,
        volumeRatio: signal?.volumeRatio ?? 0,
        alertStatus: TRIGGER_ALERT_STATUS[triggerState] ?? 'Dormant',
        notes: item.notes ?? '',
        explanation: explanationFromPayload(overlay?.explanation ?? null, 'watch'),
      };
    });
}

/** Derive recent signal-change rows from the live signal set (largest moves first). */
function deriveSignalChanges(signals: SignalRow[]): SignalChange[] {
  return signals
    .filter((signal) => Math.abs(signal.scoreDelta) >= 1)
    .sort((a, b) => Math.abs(b.scoreDelta) - Math.abs(a.scoreDelta))
    .slice(0, 6)
    .map((signal) => ({
      symbol: signal.symbol,
      change: Math.round(signal.scoreDelta),
      label:
        signal.scoreDelta > 0
          ? `score rising - now ${signal.status.replaceAll('_', ' ')}`
          : `score easing - ${signal.status.replaceAll('_', ' ')}`,
      status: signal.scoreDelta > 0 ? 'improving' : signal.scoreDelta < 0 ? 'weakening' : 'neutral',
      at: signal.lastUpdated,
    }));
}

export async function getDashboardData(): Promise<DashboardData> {
  // Cookie-aware server client: RLS scopes private rows to the signed-in user. When
  // Supabase isn't configured we stay in demo mode.
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    // Solo mode still uses the public market snapshot, but it must never inherit the
    // sample user's private-looking portfolio, watchlist, alert history, or overlay
    // counts. Client surfaces layer this device's real local data over these signals.
    const signals = await applyLiveSignals(demoDashboardData.signals);
    return buildSoloMarketDashboard(demoDashboardData, signals);
  }

  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? null;

    const [tickersResult, signalsResult, runsResult, alertsResult] = await Promise.all([
      // Bounded like the sibling queries - the universe is a few hundred names at most, and an
      // unbounded select grows with every ticker added and runs on each dashboard render.
      supabase.from('stock_tickers').select('*').order('symbol', { ascending: true }).limit(500),
      supabase.from('stock_signals').select('*').order('candle_time', { ascending: false }).limit(80),
      supabase.from('stock_scanner_runs').select('*').order('started_at', { ascending: false }).limit(1),
      supabase.from('stock_alerts').select('*').order('created_at', { ascending: false }).limit(20),
    ]);

    if (tickersResult.error || signalsResult.error || runsResult.error || alertsResult.error) {
      return demoDashboardData;
    }

    const tickers = mapTickers((tickersResult.data ?? []) as TickerRecord[]);
    const signals = latestSignals((signalsResult.data ?? []) as SignalRecord[], tickers);
    const latestRun = mapRun(((runsResult.data ?? []) as RunRecord[])[0] ?? null);
    const alerts = mapAlerts((alertsResult.data ?? []) as AlertRecord[]);

    // Recompute the signal brain from live prices ONCE, up front, and thread the SAME array into
    // everything downstream (the signal table, the changes board, and the portfolio/watchlist
    // overlays). Deriving any of them from the raw DB signals instead would let boards disagree
    // with the table on the same symbol's score/delta.
    const liveSignals = await applyLiveSignals(signals.length > 0 ? signals : demoDashboardData.signals);
    const signalsBySymbol = new Map(liveSignals.map((signal) => [signal.symbol, signal]));

    // Portfolio + watchlist live in separate tables. Fetch them in their own guarded
    // block so a missing/empty overlay table never breaks the core dashboard - each
    // field independently falls back to demo data if not signed in, but allows empty
    // arrays if the user is signed in.
    let portfolio = userId ? ([] as PortfolioHolding[]) : demoDashboardData.portfolio;
    let watchlist = userId ? ([] as WatchlistRow[]) : demoDashboardData.watchlist;
    let signalChanges = liveSignals.length > 0 ? deriveSignalChanges(liveSignals) : demoDashboardData.signalChanges;

    try {
      // RLS already scopes private rows to the signed-in user; the explicit user_id
      // filter is belt-and-braces and also correct if RLS is ever disabled.
      const [positionsResult, portfolioOverlayResult, watchlistItemsResult, watchlistOverlayResult] = await Promise.all([
        userId
          ? supabase.from('portfolio_positions').select('*').eq('is_active', true).eq('user_id', userId)
          : supabase.from('portfolio_positions').select('*').eq('is_active', true),
        supabase.from('portfolio_signal_overlay').select('*').order('candle_time', { ascending: false }).limit(200),
        userId
          ? supabase.from('watchlist_items').select('*').eq('is_active', true).eq('user_id', userId)
          : supabase.from('watchlist_items').select('*').eq('is_active', true),
        supabase.from('watchlist_signal_overlay').select('*').order('candle_time', { ascending: false }).limit(200),
      ]);

      if (!positionsResult.error) {
        const mapped = mapPortfolio(
          (positionsResult.data ?? []) as PortfolioPositionRecord[],
          (portfolioOverlayResult.data ?? []) as PortfolioOverlayRecord[],
          signalsBySymbol,
        );
        if (userId || mapped.length > 0) portfolio = mapped;
      }

      if (!watchlistItemsResult.error) {
        const mapped = mapWatchlist(
          (watchlistItemsResult.data ?? []) as WatchlistItemRecord[],
          (watchlistOverlayResult.data ?? []) as WatchlistOverlayRecord[],
          tickers,
          signalsBySymbol,
        );
        if (userId || mapped.length > 0) watchlist = mapped;
      }
    } catch {
      /* keep per-field demo fallback for portfolio/watchlist */
    }

    if (signalChanges.length === 0) signalChanges = demoDashboardData.signalChanges;

    return {
      generatedFrom: 'supabase',
      latestRun,
      signals: liveSignals,
      alerts,
      tickers: tickers.length > 0 ? tickers : demoDashboardData.tickers,
      portfolio,
      watchlist,
      signalChanges,
      scoreHistory: demoDashboardData.scoreHistory,
      thresholds: demoDashboardData.thresholds,
    };
  } catch {
    return demoDashboardData;
  }
}
