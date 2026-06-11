/**
 * Signal events engine - deterministic detection of MAJOR technical events that
 * drive trade timing, pinned as static SIGNALS for 24 hours and then tracked as a
 * "story": momentum since the event, framed as the human behaviour it represents
 * (sellers exhausting, buyers stepping back in - and the inverse).
 *
 * Detectors are pure functions over explicit numeric inputs so they are exactly
 * unit-testable (see __tests__/signal-events.test.ts - accuracy + smoke tests).
 * The adapter derives events from live SignalRow fields; the 24h pin store is
 * browser-local (demo-safe) and worker-side persistence can replace it later.
 * Research software - events time research, they are never buy/sell instructions.
 */
import type { SignalRow } from '@/types/scanner';

/* -------------------------------------------------------------- thresholds */

export const RSI_OVERSOLD = 30;
export const RSI_OVERBOUGHT = 70;
/** How long a detected event stays pinned as a static SIGNAL. */
export const PIN_HOURS = 24;

export type SignalEventType =
  | 'macd_bull_cross'
  | 'macd_bear_cross'
  | 'rsi_oversold'
  | 'rsi_overbought'
  | 'oversold_recovery'
  | 'overbought_rollover'
  | 'bb_lower_break'
  | 'bb_upper_break';

export interface SignalEventMeta {
  /** Chip text, e.g. "MACD CROSS". */
  chip: string;
  /** Bullish-read events render green, bearish red, caution amber. */
  tone: 'pos' | 'neg' | 'warn';
  /** The human behaviour this event represents. */
  behaviour: string;
}

export const EVENT_META: Record<SignalEventType, SignalEventMeta> = {
  macd_bull_cross: {
    chip: 'MACD CROSS ↑',
    tone: 'pos',
    behaviour: 'Selling pressure has flipped - shorter-term momentum just crossed above the longer trend.',
  },
  macd_bear_cross: {
    chip: 'MACD CROSS ↓',
    tone: 'neg',
    behaviour: 'Buying pressure has flipped - momentum just crossed below the longer trend.',
  },
  rsi_oversold: {
    chip: 'OVERSOLD',
    tone: 'warn',
    behaviour: 'Heavily sold. Watch for sellers exhausting - this is where capitulation bottoms form.',
  },
  rsi_overbought: {
    chip: 'OVERBOUGHT',
    tone: 'warn',
    behaviour: 'Run hot. Late buyers are chasing - risk of air-pocket pullbacks rises here.',
  },
  oversold_recovery: {
    chip: 'STRONG REVIEW',
    tone: 'pos',
    behaviour: 'Sellers have stopped pressing and buyers are stepping back in at a level they consider fair - RSI just reclaimed 30.',
  },
  overbought_rollover: {
    chip: 'ROLLOVER',
    tone: 'neg',
    behaviour: 'Buyers have stopped chasing - RSI just lost 70 from above; momentum is cooling from the top.',
  },
  bb_lower_break: {
    chip: 'BB BREAK ↓',
    tone: 'warn',
    behaviour: 'Close broke the lower Bollinger band - a statistically stretched sell-off; mean-reversion zone.',
  },
  bb_upper_break: {
    chip: 'BB BREAK ↑',
    tone: 'warn',
    behaviour: 'Close broke the upper Bollinger band - a statistically stretched rally; extension zone.',
  },
};

/* --------------------------------------------------------- pure detectors */

/** MACD histogram sign change. prev <= 0 -> > 0 is a bullish cross; inverse bearish. */
export function detectMacdCross(prevHist: number, currHist: number): 'bull' | 'bear' | null {
  if (!Number.isFinite(prevHist) || !Number.isFinite(currHist)) return null;
  if (prevHist <= 0 && currHist > 0) return 'bull';
  if (prevHist >= 0 && currHist < 0) return 'bear';
  return null;
}

/** RSI zone events, including the behavioural exits (recovery / rollover). */
export function detectRsiEvent(prevRsi: number, currRsi: number): SignalEventType | null {
  if (!Number.isFinite(prevRsi) || !Number.isFinite(currRsi)) return null;
  if (prevRsi >= RSI_OVERSOLD && currRsi < RSI_OVERSOLD) return 'rsi_oversold';
  if (prevRsi < RSI_OVERSOLD && currRsi >= RSI_OVERSOLD) return 'oversold_recovery';
  if (prevRsi <= RSI_OVERBOUGHT && currRsi > RSI_OVERBOUGHT) return 'rsi_overbought';
  if (prevRsi > RSI_OVERBOUGHT && currRsi <= RSI_OVERBOUGHT) return 'overbought_rollover';
  return null;
}

/** Bollinger break: close beyond a band. Bands must be real (upper > lower). */
export function detectBollingerBreak(close: number, upperBand: number, lowerBand: number): SignalEventType | null {
  if (!Number.isFinite(close) || !Number.isFinite(upperBand) || !Number.isFinite(lowerBand)) return null;
  if (upperBand <= lowerBand) return null;
  if (close > upperBand) return 'bb_upper_break';
  if (close < lowerBand) return 'bb_lower_break';
  return null;
}

/** Bollinger bands from a close series (SMA n +/- k sigma) - for when candles exist. */
export function computeBollinger(closes: number[], period = 20, k = 2): { upper: number; lower: number; mid: number } | null {
  if (closes.length < period) return null;
  const window = closes.slice(-period);
  const mid = window.reduce((s, c) => s + c, 0) / period;
  const variance = window.reduce((s, c) => s + (c - mid) ** 2, 0) / period;
  const sigma = Math.sqrt(variance);
  return { upper: mid + k * sigma, lower: mid - k * sigma, mid };
}

/* ------------------------------------------------------------------ events */

export interface SignalEvent {
  /** Stable id: symbol + type + detection day, so re-derivation is idempotent. */
  id: string;
  symbol: string;
  companyName: string;
  type: SignalEventType;
  detectedAt: string;
  pinnedUntil: string;
  /** Frozen at detection - the story baseline. */
  closeAtDetection: number;
  scoreAtDetection: number;
  rsiAtDetection: number;
  histAtDetection: number;
}

export interface SignalEventStory extends SignalEvent {
  meta: SignalEventMeta;
  /** Hours since detection (>= 0). */
  ageHours: number;
  hoursRemaining: number;
  /** Momentum since the event - the "story" of the stock after the trigger. */
  priceMovePct: number;
  scoreMove: number;
  /** Is the move since detection confirming the event's read? */
  confirming: boolean;
}

/** Detect fresh events from the current scan rows (prev values via deltas). */
export function deriveSignalEvents(signals: SignalRow[], now: Date): SignalEvent[] {
  const events: SignalEvent[] = [];
  const day = now.toISOString().slice(0, 10);
  const pinnedUntil = new Date(now.getTime() + PIN_HOURS * 3_600_000).toISOString();

  for (const s of signals) {
    const found: SignalEventType[] = [];

    const cross = detectMacdCross(s.macdHistogram - s.histDelta, s.macdHistogram);
    if (cross === 'bull') found.push('macd_bull_cross');
    if (cross === 'bear') found.push('macd_bear_cross');

    const rsiEvent = detectRsiEvent(s.rsi - s.rsiDelta, s.rsi);
    if (rsiEvent) found.push(rsiEvent);

    // Bollinger needs band data the scan rows do not carry yet (worker-side next);
    // detectBollingerBreak/computeBollinger are wired + tested for when it lands.

    for (const type of found) {
      events.push({
        id: `${s.symbol}:${type}:${day}`,
        symbol: s.symbol,
        companyName: s.companyName,
        type,
        detectedAt: now.toISOString(),
        pinnedUntil,
        closeAtDetection: s.close,
        scoreAtDetection: s.score,
        rsiAtDetection: s.rsi,
        histAtDetection: s.macdHistogram,
      });
    }
  }
  return events;
}

/** Merge fresh detections into pinned ones: existing pins win (the 24h is static). */
export function mergePinnedEvents(pinned: SignalEvent[], fresh: SignalEvent[], now: Date): SignalEvent[] {
  const alive = pinned.filter((e) => new Date(e.pinnedUntil).getTime() > now.getTime());
  const known = new Set(alive.map((e) => e.id));
  return [...alive, ...fresh.filter((e) => !known.has(e.id))];
}

const BULLISH: SignalEventType[] = ['macd_bull_cross', 'oversold_recovery'];
const BEARISH: SignalEventType[] = ['macd_bear_cross', 'overbought_rollover'];

/** Track each pinned event as a story: what the stock has done since the trigger. */
export function buildEventStories(events: SignalEvent[], signals: SignalRow[], now: Date): SignalEventStory[] {
  const bySymbol = new Map(signals.map((s) => [s.symbol, s]));
  return events
    .map((event) => {
      const current = bySymbol.get(event.symbol);
      const priceMovePct =
        current && event.closeAtDetection > 0 ? ((current.close - event.closeAtDetection) / event.closeAtDetection) * 100 : 0;
      const scoreMove = current ? current.score - event.scoreAtDetection : 0;
      const ageMs = Math.max(0, now.getTime() - new Date(event.detectedAt).getTime());
      const remainingMs = Math.max(0, new Date(event.pinnedUntil).getTime() - now.getTime());
      const confirming = BULLISH.includes(event.type)
        ? priceMovePct >= 0
        : BEARISH.includes(event.type)
          ? priceMovePct <= 0
          : Math.abs(priceMovePct) < 3; // zone events "confirm" while the stretch is not violently resolving
      return {
        ...event,
        meta: EVENT_META[event.type],
        ageHours: ageMs / 3_600_000,
        hoursRemaining: remainingMs / 3_600_000,
        priceMovePct,
        scoreMove,
        confirming,
      };
    })
    .sort((a, b) => a.ageHours - b.ageHours);
}

/* ----------------------------------------------------- browser pin storage */

const STORE_KEY = 'lyra.signalEvents.v1';

export function loadPinnedEvents(): SignalEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as SignalEvent[]) : [];
  } catch {
    return [];
  }
}

export function savePinnedEvents(events: SignalEvent[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(events));
  } catch {
    /* storage unavailable - ignore */
  }
}
