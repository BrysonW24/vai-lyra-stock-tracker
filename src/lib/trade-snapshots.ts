/**
 * Trade Day Snapshot Types and Demo Data
 *
 * Mirrors the Python TradeDaySnapshot dataclass.
 * SINGLE-OPERATOR mode: no user_id, no auth.
 *
 * Types capture entry-day technical context + forward performance.
 * Demo snapshots: best-trade (NVDA winner) + worst-trade (SNOW overextended).
 */

/**
 * Complete snapshot of a trade entry and subsequent performance.
 */
export interface TradeDaySnapshot {
  id?: string;
  symbol: string;
  purchase_date: string; // ISO 8601 date
  entry_price: number;
  // Entry-day technical indicators
  rsi_on_entry?: number;
  macd_state_on_entry?: string; // "bullish" | "bearish" | "weakening" | "strengthening"
  macd_histogram_on_entry?: number;
  volume_ratio_on_entry?: number;
  price_vs_sma_20_on_entry?: number;
  price_vs_sma_50_on_entry?: number;
  price_vs_sma_200_on_entry?: number;
  distance_from_20_period_low_on_entry?: number;
  signal_score_on_entry?: number;
  market_regime_on_entry?: string; // "strong_setup" | "weak_setup" | etc.
  // Forward performance
  return_5d?: number;
  return_20d?: number;
  return_60d?: number;
  return_120d?: number;
  max_drawdown_after_entry?: number;
  max_upside_after_entry?: number;
  // Deterministic learning observations
  learning_summary?: string[];
  created_at?: string; // ISO 8601 timestamp
  updated_at?: string; // ISO 8601 timestamp
}

/**
 * Best-trade demo snapshot: NVDA momentum continuation winner.
 * Entry: 2024-05-12 at $820
 * - RSI in recovery band (52), MACD bullish, volume elevated (1.4x)
 * - Price slightly above SMA50 (+2.5%), well above SMA200 (+9.3%)
 * - Signal score: 78 (strong)
 * Forward: +42.8% return over 60 days, max upside +51.2%, minor drawdown -4.2%
 */
const DEMO_BEST_TRADE: TradeDaySnapshot = {
  id: "demo-best-nvda",
  symbol: "NVDA",
  purchase_date: "2024-05-12",
  entry_price: 820.0,
  rsi_on_entry: 52.0,
  macd_state_on_entry: "bullish",
  macd_histogram_on_entry: 0.72,
  volume_ratio_on_entry: 1.4,
  price_vs_sma_20_on_entry: 3.15,
  price_vs_sma_50_on_entry: 2.5,
  price_vs_sma_200_on_entry: 9.33,
  distance_from_20_period_low_on_entry: 12.2,
  signal_score_on_entry: 78.0,
  market_regime_on_entry: "strong_setup",
  return_5d: 5.8,
  return_20d: 18.4,
  return_60d: 42.8,
  return_120d: 58.2,
  max_drawdown_after_entry: -4.2,
  max_upside_after_entry: 51.2,
  learning_summary: [
    "Entry was a momentum continuation trade supported by price above moving averages.",
    "Entry quality was strong with high signal score and volume confirmation.",
    "Volume on entry day was significantly elevated, supporting the move.",
    "MACD was bullish at entry, confirming upside momentum.",
    "RSI was in the reset band (35-50), indicating recovery potential.",
    "Trade worked well over 60 days with strong positive returns.",
  ],
  created_at: "2024-05-12T10:00:00Z",
};

/**
 * Worst-trade demo snapshot: SNOW overextended entry.
 * Entry: 2024-03-04 at $150
 * - RSI overbought (71), MACD bearish, volume declining (0.65x)
 * - Price extended above SMA50 (+15.4%), approaching all-time high
 * - Signal score: 35 (weak)
 * Forward: -18.4% return over 60 days, max upside only +3.1%, significant drawdown -22.5%
 */
const DEMO_WORST_TRADE: TradeDaySnapshot = {
  id: "demo-worst-snow",
  symbol: "SNOW",
  purchase_date: "2024-03-04",
  entry_price: 150.0,
  rsi_on_entry: 71.0,
  macd_state_on_entry: "bearish",
  macd_histogram_on_entry: -0.42,
  volume_ratio_on_entry: 0.65,
  price_vs_sma_20_on_entry: 11.11,
  price_vs_sma_50_on_entry: 15.38,
  price_vs_sma_200_on_entry: 20.0,
  distance_from_20_period_low_on_entry: 35.5,
  signal_score_on_entry: 35.0,
  market_regime_on_entry: "weak_setup",
  return_5d: -4.2,
  return_20d: -12.8,
  return_60d: -18.4,
  return_120d: -15.2,
  max_drawdown_after_entry: -22.5,
  max_upside_after_entry: 3.1,
  learning_summary: [
    "Entry occurred when price was extended and momentum was deteriorating.",
    "Entry quality was weak with low signal score or limited volume support.",
    "Volume on entry day was below average, limiting conviction.",
    "Stock was extended above the 50-period SMA at entry.",
    "MACD was bearish at entry, conflicting with the bullish setup.",
    "Trade faced significant headwinds over 60 days.",
    "Trade experienced a substantial peak-to-trough drawdown after entry.",
  ],
  created_at: "2024-03-04T10:00:00Z",
};

/**
 * Get all demo snapshots.
 * Used for initial dashboard seeding when no real data exists.
 */
export function getDemoSnapshots(): TradeDaySnapshot[] {
  return [DEMO_BEST_TRADE, DEMO_WORST_TRADE];
}

/**
 * Get the best-trade demo snapshot.
 */
export function bestTrade(): TradeDaySnapshot {
  return DEMO_BEST_TRADE;
}

/**
 * Get the worst-trade demo snapshot.
 */
export function worstTrade(): TradeDaySnapshot {
  return DEMO_WORST_TRADE;
}

/**
 * Format a snapshot for display.
 * Rounds numeric values and handles null/undefined gracefully.
 */
export function formatSnapshot(snapshot: TradeDaySnapshot): TradeDaySnapshot {
  return {
    ...snapshot,
    entry_price: Math.round(snapshot.entry_price * 100) / 100,
    rsi_on_entry: snapshot.rsi_on_entry ? Math.round(snapshot.rsi_on_entry * 10) / 10 : undefined,
    macd_histogram_on_entry: snapshot.macd_histogram_on_entry
      ? Math.round(snapshot.macd_histogram_on_entry * 100) / 100
      : undefined,
    volume_ratio_on_entry: snapshot.volume_ratio_on_entry
      ? Math.round(snapshot.volume_ratio_on_entry * 100) / 100
      : undefined,
    price_vs_sma_20_on_entry: snapshot.price_vs_sma_20_on_entry
      ? Math.round(snapshot.price_vs_sma_20_on_entry * 10) / 10
      : undefined,
    price_vs_sma_50_on_entry: snapshot.price_vs_sma_50_on_entry
      ? Math.round(snapshot.price_vs_sma_50_on_entry * 10) / 10
      : undefined,
    price_vs_sma_200_on_entry: snapshot.price_vs_sma_200_on_entry
      ? Math.round(snapshot.price_vs_sma_200_on_entry * 10) / 10
      : undefined,
    distance_from_20_period_low_on_entry: snapshot.distance_from_20_period_low_on_entry
      ? Math.round(snapshot.distance_from_20_period_low_on_entry * 10) / 10
      : undefined,
    signal_score_on_entry: snapshot.signal_score_on_entry
      ? Math.round(snapshot.signal_score_on_entry * 10) / 10
      : undefined,
    return_5d: snapshot.return_5d ? Math.round(snapshot.return_5d * 10) / 10 : undefined,
    return_20d: snapshot.return_20d ? Math.round(snapshot.return_20d * 10) / 10 : undefined,
    return_60d: snapshot.return_60d ? Math.round(snapshot.return_60d * 10) / 10 : undefined,
    return_120d: snapshot.return_120d ? Math.round(snapshot.return_120d * 10) / 10 : undefined,
    max_drawdown_after_entry: snapshot.max_drawdown_after_entry
      ? Math.round(snapshot.max_drawdown_after_entry * 10) / 10
      : undefined,
    max_upside_after_entry: snapshot.max_upside_after_entry
      ? Math.round(snapshot.max_upside_after_entry * 10) / 10
      : undefined,
  };
}

/**
 * Check if snapshot has all entry-day indicators populated.
 */
export function isFullyEnriched(snapshot: TradeDaySnapshot): boolean {
  return (
    snapshot.rsi_on_entry !== null &&
    snapshot.macd_state_on_entry !== null &&
    snapshot.macd_histogram_on_entry !== null &&
    snapshot.volume_ratio_on_entry !== null &&
    snapshot.price_vs_sma_20_on_entry !== null &&
    snapshot.price_vs_sma_50_on_entry !== null &&
    snapshot.price_vs_sma_200_on_entry !== null &&
    snapshot.signal_score_on_entry !== null
  );
}

/**
 * Check if snapshot has forward performance data populated.
 */
export function hasForwardData(snapshot: TradeDaySnapshot): boolean {
  return (
    snapshot.return_5d !== null &&
    snapshot.return_20d !== null &&
    snapshot.return_60d !== null &&
    snapshot.max_drawdown_after_entry !== null &&
    snapshot.max_upside_after_entry !== null
  );
}
