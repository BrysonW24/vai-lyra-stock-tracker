import { describe, it, expect } from 'vitest';
import { buildScoreHistory, type ScoreHistoryInput } from '../score-history';

describe('buildScoreHistory', () => {
  it('should return a 7-point series ending exactly at the input score', () => {
    const input: ScoreHistoryInput = {
      symbol: 'NVDA',
      score: 75,
      rsi: 60,
      macdHistogram: 0.5,
    };

    const history = buildScoreHistory(input);

    // Must be 7 points (6h ago through Now)
    expect(history).toHaveLength(7);

    // The final point (Now) must match the input exactly
    expect(history[6].score).toBe(75);
    expect(history[6].rsi).toBe(60);
    expect(history[6].histogram).toBe(0.5);
  });

  it('should have correct labels from 6h ago to Now', () => {
    const input: ScoreHistoryInput = {
      symbol: 'AMD',
      score: 50,
      rsi: 50,
      macdHistogram: 0,
    };

    const history = buildScoreHistory(input);
    const expectedLabels = ['6h ago', '5h ago', '4h ago', '3h ago', '2h ago', '1h ago', 'Now'];

    expect(history.map((p) => p.label)).toEqual(expectedLabels);
  });

  it('should generate valid series with positive scoreDelta and recovering state', () => {
    const input: ScoreHistoryInput = {
      symbol: 'MSFT',
      score: 70,
      rsi: 65,
      macdHistogram: 1.0,
      scoreDelta: 15, // Strong positive delta
      rsiDelta: 10,
      histDelta: 0.5,
      macdState: 'recovering',
    };

    const history = buildScoreHistory(input);

    // The final point must match the input exactly (this is the contract)
    expect(history[6].score).toBe(70);
    expect(history[6].rsi).toBe(65);
    expect(history[6].histogram).toBe(1.0);

    // All points should be within valid ranges
    history.forEach((point) => {
      expect(point.score).toBeGreaterThanOrEqual(3);
      expect(point.score).toBeLessThanOrEqual(99);
      expect(point.rsi).toBeGreaterThanOrEqual(5);
      expect(point.rsi).toBeLessThanOrEqual(95);
      expect(point.histogram).toBeGreaterThanOrEqual(-5);
      expect(point.histogram).toBeLessThanOrEqual(5);
    });
  });

  it('should generate valid series with negative scoreDelta and weakening state', () => {
    const input: ScoreHistoryInput = {
      symbol: 'TSLA',
      score: 30,
      rsi: 35,
      macdHistogram: -1.2,
      scoreDelta: -12, // Strong negative delta
      rsiDelta: -8,
      histDelta: -0.6,
      macdState: 'weakening',
    };

    const history = buildScoreHistory(input);

    // The final point must match the input exactly
    expect(history[6].score).toBe(30);
    expect(history[6].rsi).toBe(35);
    expect(history[6].histogram).toBe(-1.2);

    // All points should be within valid ranges
    history.forEach((point) => {
      expect(point.score).toBeGreaterThanOrEqual(3);
      expect(point.score).toBeLessThanOrEqual(99);
      expect(point.rsi).toBeGreaterThanOrEqual(5);
      expect(point.rsi).toBeLessThanOrEqual(95);
      expect(point.histogram).toBeGreaterThanOrEqual(-5);
      expect(point.histogram).toBeLessThanOrEqual(5);
    });
  });

  it('should keep all values within valid ranges', () => {
    const input: ScoreHistoryInput = {
      symbol: 'GOOGL',
      score: 65,
      rsi: 58,
      macdHistogram: 0.3,
      scoreDelta: 8,
    };

    const history = buildScoreHistory(input);

    history.forEach((point) => {
      // Scores should be in a reasonable range
      expect(point.score).toBeGreaterThanOrEqual(3);
      expect(point.score).toBeLessThanOrEqual(99);

      // RSI should be in 5-95 range
      expect(point.rsi).toBeGreaterThanOrEqual(5);
      expect(point.rsi).toBeLessThanOrEqual(95);

      // MACD histogram should be in -5 to 5 range
      expect(point.histogram).toBeGreaterThanOrEqual(-5);
      expect(point.histogram).toBeLessThanOrEqual(5);
    });
  });

  it('should produce consistent output for the same symbol', () => {
    const input: ScoreHistoryInput = {
      symbol: 'AAPL',
      score: 55,
      rsi: 55,
      macdHistogram: 0.1,
    };

    const history1 = buildScoreHistory(input);
    const history2 = buildScoreHistory(input);

    // Same symbol should produce identical history (seeded PRNG)
    expect(history1).toEqual(history2);
  });

  it('should produce different output for different symbols', () => {
    const baseInput: Omit<ScoreHistoryInput, 'symbol'> = {
      score: 50,
      rsi: 50,
      macdHistogram: 0,
    };

    const history1 = buildScoreHistory({ ...baseInput, symbol: 'TICKER1' });
    const history2 = buildScoreHistory({ ...baseInput, symbol: 'TICKER2' });

    // Different symbols should produce different histories
    const scores1 = history1.map((p) => p.score);
    const scores2 = history2.map((p) => p.score);

    expect(scores1).not.toEqual(scores2);
  });

  it('should handle flat/neutral state', () => {
    const input: ScoreHistoryInput = {
      symbol: 'NEUTRAL',
      score: 50,
      rsi: 50,
      macdHistogram: 0,
      scoreDelta: 0,
      rsiDelta: 0,
      histDelta: 0,
      macdState: 'neutral',
    };

    const history = buildScoreHistory(input);

    // For neutral state, the swing should be minimal or randomly small
    expect(history).toHaveLength(7);
    expect(history[6].score).toBe(50);

    // Points should be relatively close to each other
    const scores = history.map((p) => p.score);
    const maxDiff = Math.max(...scores) - Math.min(...scores);
    expect(maxDiff).toBeLessThan(20);
  });
});
