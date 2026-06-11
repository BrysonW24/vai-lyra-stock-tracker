import { describe, expect, it } from 'vitest';
import {
  buildEventStories,
  computeBollinger,
  deriveSignalEvents,
  detectBollingerBreak,
  detectMacdCross,
  detectRsiEvent,
  mergePinnedEvents,
  PIN_HOURS,
  type SignalEvent,
} from '../signal-events';
import type { SignalRow } from '@/types/scanner';

const NOW = new Date('2026-06-11T10:00:00.000Z');

function row(overrides: Partial<SignalRow>): SignalRow {
  return {
    symbol: 'TEST',
    companyName: 'Test Corp',
    close: 100,
    rsi: 50,
    rsiDelta: 0,
    macdHistogram: 0.5,
    histDelta: 0.1,
    score: 60,
    scoreDelta: 0,
    priceChange1d: 0,
    volumeRatio: 1,
    ...overrides,
  } as unknown as SignalRow;
}

describe('detectMacdCross - accuracy', () => {
  it('detects a bullish cross when the histogram crosses up through zero', () => {
    expect(detectMacdCross(-0.4, 0.2)).toBe('bull');
    expect(detectMacdCross(0, 0.01)).toBe('bull'); // from exactly zero counts
  });

  it('detects a bearish cross when the histogram crosses down through zero', () => {
    expect(detectMacdCross(0.3, -0.1)).toBe('bear');
    expect(detectMacdCross(0, -0.01)).toBe('bear');
  });

  it('does NOT fire when momentum improves or fades without crossing', () => {
    expect(detectMacdCross(-1.9, -0.4)).toBeNull(); // improving but still negative
    expect(detectMacdCross(1.2, 0.3)).toBeNull(); // fading but still positive
    expect(detectMacdCross(0.5, 0.5)).toBeNull();
  });

  it('fails closed on bad inputs', () => {
    expect(detectMacdCross(NaN, 1)).toBeNull();
    expect(detectMacdCross(1, Infinity)).toBeNull();
  });
});

describe('detectRsiEvent - accuracy', () => {
  it('fires oversold only when CROSSING below 30, not while sitting below', () => {
    expect(detectRsiEvent(32, 28)).toBe('rsi_oversold');
    expect(detectRsiEvent(28, 25)).toBeNull(); // already oversold - no re-fire
  });

  it('fires the recovery (sellers exhausted, buyers stepping in) when reclaiming 30', () => {
    expect(detectRsiEvent(27, 33)).toBe('oversold_recovery');
    expect(detectRsiEvent(29.9, 30)).toBe('oversold_recovery'); // 30 is reclaimed
  });

  it('fires overbought and the inverse rollover symmetrically', () => {
    expect(detectRsiEvent(68, 73)).toBe('rsi_overbought');
    expect(detectRsiEvent(74, 66)).toBe('overbought_rollover');
    expect(detectRsiEvent(75, 72)).toBeNull(); // still above 70 - no event
  });

  it('does not fire in the neutral band', () => {
    expect(detectRsiEvent(45, 55)).toBeNull();
  });
});

describe('detectBollingerBreak + computeBollinger - accuracy', () => {
  it('flags closes beyond the bands and not inside them', () => {
    expect(detectBollingerBreak(105, 104, 96)).toBe('bb_upper_break');
    expect(detectBollingerBreak(95, 104, 96)).toBe('bb_lower_break');
    expect(detectBollingerBreak(100, 104, 96)).toBeNull();
  });

  it('refuses degenerate bands', () => {
    expect(detectBollingerBreak(100, 96, 104)).toBeNull(); // inverted
    expect(detectBollingerBreak(100, 100, 100)).toBeNull(); // collapsed
  });

  it('computes bands from a series: flat series collapses to the mean, vol widens them', () => {
    const flat = computeBollinger(Array(20).fill(50));
    expect(flat).not.toBeNull();
    expect(flat!.mid).toBe(50);
    expect(flat!.upper).toBe(50);
    const vol = computeBollinger([...Array(10).fill(48), ...Array(10).fill(52)]);
    expect(vol!.mid).toBe(50);
    expect(vol!.upper).toBeGreaterThan(51);
    expect(vol!.lower).toBeLessThan(49);
    expect(computeBollinger([1, 2, 3])).toBeNull(); // insufficient data
  });
});

describe('deriveSignalEvents - smoke test through the adapter', () => {
  it('derives cross + rsi events from real row shapes, idempotent ids per day', () => {
    const signals = [
      row({ symbol: 'BULL', macdHistogram: 0.2, histDelta: 0.5 }), // prev -0.3 -> bull cross
      row({ symbol: 'SOLD', rsi: 28, rsiDelta: -4, macdHistogram: -1, histDelta: -0.1 }), // crossed below 30
      row({ symbol: 'RECV', rsi: 33, rsiDelta: 6, macdHistogram: -0.5, histDelta: 0.2 }), // reclaimed 30
      row({ symbol: 'NONE', rsi: 50, rsiDelta: 1, macdHistogram: 1, histDelta: 0.1 }), // nothing
    ] as SignalRow[];
    const events = deriveSignalEvents(signals, NOW);
    const types = events.map((e) => `${e.symbol}:${e.type}`);
    expect(types).toContain('BULL:macd_bull_cross');
    expect(types).toContain('SOLD:rsi_oversold');
    expect(types).toContain('RECV:oversold_recovery');
    expect(types.filter((t) => t.startsWith('NONE'))).toHaveLength(0);
    expect(events[0].id).toBe(`${events[0].symbol}:${events[0].type}:2026-06-11`);
    expect(new Date(events[0].pinnedUntil).getTime() - NOW.getTime()).toBe(PIN_HOURS * 3_600_000);
  });
});

describe('24h pin lifecycle', () => {
  const pinned: SignalEvent = {
    id: 'NVDA:macd_bull_cross:2026-06-10',
    symbol: 'NVDA',
    companyName: 'NVIDIA',
    type: 'macd_bull_cross',
    detectedAt: '2026-06-10T12:00:00.000Z',
    pinnedUntil: '2026-06-11T12:00:00.000Z',
    closeAtDetection: 100,
    scoreAtDetection: 70,
    rsiAtDetection: 45,
    histAtDetection: 0.1,
  };

  it('keeps events pinned for the full 24h, existing pins win over re-detections', () => {
    const fresh = deriveSignalEvents([row({ symbol: 'NVDA', macdHistogram: 0.2, histDelta: 0.5 })] as SignalRow[], NOW);
    const merged = mergePinnedEvents([pinned], fresh, NOW); // 10:00 - pin still alive
    expect(merged.filter((e) => e.symbol === 'NVDA')).toHaveLength(2); // different day-id = different event
    const sameDay = mergePinnedEvents([pinned], [{ ...pinned }], NOW);
    expect(sameDay).toHaveLength(1); // identical id deduped, original kept
  });

  it('expires pins after pinnedUntil passes', () => {
    const after = new Date('2026-06-11T12:00:01.000Z');
    expect(mergePinnedEvents([pinned], [], after)).toHaveLength(0);
  });

  it('tracks the story: momentum since detection + confirmation read', () => {
    const current = [row({ symbol: 'NVDA', close: 104, macdHistogram: 0.4, histDelta: 0.1 })] as SignalRow[];
    const currentWithScore = current.map((s) => ({ ...s, score: 78 }));
    const [story] = buildEventStories([pinned], currentWithScore as SignalRow[], NOW);
    expect(story.priceMovePct).toBeCloseTo(4, 5);
    expect(story.scoreMove).toBe(8);
    expect(story.confirming).toBe(true); // bullish event + positive move
    expect(story.ageHours).toBeCloseTo(22, 1);
    expect(story.hoursRemaining).toBeCloseTo(2, 1);
    const [bearStory] = buildEventStories(
      [{ ...pinned, type: 'macd_bear_cross' }],
      currentWithScore as SignalRow[],
      NOW,
    );
    expect(bearStory.confirming).toBe(false); // bearish event but price rose - story disagrees
  });
});
