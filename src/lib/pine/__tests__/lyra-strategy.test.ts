import { describe, expect, it } from 'vitest';
import { generateLyraPineStrategy, LYRA_SCORE_MODEL } from '@/lib/pine/lyra-strategy';

describe('LYRA_SCORE_MODEL', () => {
  it('keeps the documented component caps (RSI 25, MACD 30, price 15, trend 15, volume 15 -> 100)', () => {
    const m = LYRA_SCORE_MODEL;
    expect(m.rsi.bandPts + m.rsi.rising1Pts + m.rsi.rising2Pts).toBe(25);
    expect(m.macd.negativePts + m.macd.improving1Pts + m.macd.improving2Pts + m.macd.belowSignalImprovingPts).toBe(30);
    expect(m.price.lowDistancePts + m.price.nearSma50Pts).toBe(15);
    // Trend's two SMA200 terms are mutually exclusive, so the max is aboveSma200 + sma20VsSma50.
    expect(m.trend.aboveSma200Pts + m.trend.sma20VsSma50Pts).toBe(15);
    expect(m.volume.ratioLowPts + m.volume.ratioHighPts + m.volume.risingPts).toBe(15);
  });

  it('matches the engine bands in signal_engine.py / indicators.py', () => {
    const m = LYRA_SCORE_MODEL;
    expect([m.rsi.bandLow, m.rsi.bandHigh]).toEqual([35, 50]);
    expect(m.price.lowLookback).toBe(60);
    expect(m.price.lowDistancePct).toBe(10);
    expect(m.price.nearSma50Mult).toBe(1.03);
    expect(m.trend.nearSma200Mult).toBe(0.95);
    expect(m.trend.sma20VsSma50Mult).toBe(0.95);
    expect(m.volume.ratioLow).toBe(0.8);
    expect(m.volume.ratioHigh).toBe(1.0);
    expect(m.thresholds).toEqual({ strong: 75, watchlist: 60 });
  });
});

describe('generateLyraPineStrategy', () => {
  const src = generateLyraPineStrategy({ symbol: 'AAPL' });

  it('emits a valid Pine v5 strategy header', () => {
    expect(src.startsWith('//@version=5')).toBe(true);
    expect(src).toContain('strategy("Lyra Oversold-Recovery v1 - AAPL"');
    expect(src).toContain('overlay=false');
  });

  it('uses the same indicator definitions as the scanner', () => {
    expect(src).toContain('ta.rsi(close, 14)');
    expect(src).toContain('ta.macd(close, 12, 26, 9)');
    expect(src).toContain('ta.sma(close, 200)');
    expect(src).toContain('ta.lowest(low, 60)');
    expect(src).toContain('volume / ta.sma(volume, 20)');
    // deltas must be level-minus-level (not diff-of-diff)
    expect(src).toContain('rsiD2  = rsi14 - rsi14[2]');
    expect(src).toContain('histD2 = histLine - histLine[2]');
  });

  it('renders every score weight from the model (Pine<->Python parity guard)', () => {
    const m = LYRA_SCORE_MODEL;
    // RSI block
    expect(src).toContain(`rsi14 >= ${m.rsi.bandLow} and rsi14 <= ${m.rsi.bandHigh} ? ${m.rsi.bandPts}`);
    expect(src).toContain(`rsiD1 > 0 ? ${m.rsi.rising1Pts}`);
    expect(src).toContain(`rsiD2 > 0 ? ${m.rsi.rising2Pts}`);
    // MACD block
    expect(src).toContain(`histLine < 0 ? ${m.macd.negativePts}`);
    expect(src).toContain(`histD1 > 0 ? ${m.macd.improving1Pts}`);
    expect(src).toContain(`histD2 > 0 ? ${m.macd.improving2Pts}`);
    expect(src).toContain(`macdLine < signalLine and histD1 > 0 ? ${m.macd.belowSignalImprovingPts}`);
    // Price block
    expect(src).toContain(`dist60 <= ${m.price.lowDistancePct} ? ${m.price.lowDistancePts}`);
    expect(src).toContain(`close <= sma50 * ${m.price.nearSma50Mult} ? ${m.price.nearSma50Pts}`);
    // Trend block
    expect(src).toContain(`close >= sma200 ? ${m.trend.aboveSma200Pts}`);
    expect(src).toContain(`close >= sma200 * ${m.trend.nearSma200Mult} ? ${m.trend.nearSma200Pts}`);
    expect(src).toContain(`sma20 >= sma50 * ${m.trend.sma20VsSma50Mult} ? ${m.trend.sma20VsSma50Pts}`);
    // Volume block
    expect(src).toContain(`volRatio >= ${m.volume.ratioLow} ? ${m.volume.ratioLowPts}`);
    expect(src).toContain(`volRatio >= ${m.volume.ratioHigh} ? ${m.volume.ratioHighPts}`);
    expect(src).toContain(`volume > volume[1] ? ${m.volume.risingPts}`);
    // Total is capped at 100, matching min(sum, 100)
    expect(src).toContain('math.min(rsiScore + macdScore + priceScore + trendScore + volScore, 100)');
  });

  it('defaults the entry/exit thresholds to the engine values', () => {
    expect(src).toContain('input.int(75, "Entry: strong-setup score"');
    expect(src).toContain('input.int(60, "Exit floor: watchlist score"');
    expect(src).toContain('ta.crossover(score, strongTh)');
    expect(src).toContain('score < watchTh');
  });

  it('honours threshold overrides', () => {
    const custom = generateLyraPineStrategy({ symbol: 'TSLA', strongThreshold: 80, watchlistThreshold: 55 });
    expect(custom).toContain('input.int(80, "Entry: strong-setup score"');
    expect(custom).toContain('input.int(55, "Exit floor: watchlist score"');
    expect(custom).toContain('Lyra Oversold-Recovery v1 - TSLA');
  });

  it('carries the research-only disclaimer and the source-of-truth pointer', () => {
    expect(src).toContain('not financial advice');
    expect(src).toContain('signal_engine.py');
  });

  it('contains no em dash (Lyra copy rule)', () => {
    expect(src).not.toContain('—');
  });

  it('sanitises a dirty symbol into the title', () => {
    expect(generateLyraPineStrategy({ symbol: 'aapl"; hack' })).toContain('Lyra Oversold-Recovery v1 - AAPLHACK');
    expect(generateLyraPineStrategy({})).toContain('Lyra Oversold-Recovery v1 - SYMBOL');
  });
});
