import { describe, it, expect } from 'vitest';
import { ema, wilderRsi, smaAt, minLowAt, pctRatio } from '@/lib/live-signals';

/**
 * 2026-07-27 audit V1: live-signals.ts produces every number the shipped demo/Solo default renders,
 * yet its indicator ports had zero behavioral coverage - a bug in the TS RSI/EMA/SMA math would ship
 * wrong numbers with a green board. These vectors pin the primitives against their mathematical
 * definitions (computed independently of the implementation), so the display path can't drift silently.
 */

describe('ema', () => {
  it('seeds on the first value and applies k = 2/(period+1)', () => {
    // period 2 -> k = 2/3. out[0]=10; out[1]=20*(2/3)+10*(1/3); out[2]=30*(2/3)+out[1]*(1/3).
    const out = ema([10, 20, 30], 2);
    expect(out[0]).toBe(10);
    expect(out[1]).toBeCloseTo(16.6667, 3);
    expect(out[2]).toBeCloseTo(25.5556, 3);
  });

  it('holds flat on a constant series', () => {
    expect(ema([5, 5, 5, 5], 3)).toEqual([5, 5, 5, 5]);
  });
});

describe('wilderRsi', () => {
  it('is NaN until it has `period` changes, then defined', () => {
    const out = wilderRsi([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], 14);
    for (let i = 0; i < 14; i++) expect(Number.isNaN(out[i])).toBe(true);
    expect(Number.isNaN(out[14])).toBe(false);
  });

  it('is 100 for a monotonically rising series (no losses)', () => {
    const rising = Array.from({ length: 20 }, (_, i) => i + 1);
    const out = wilderRsi(rising, 14);
    expect(out[14]).toBe(100);
    expect(out[19]).toBe(100);
  });

  it('is 0 for a monotonically falling series (no gains)', () => {
    const falling = Array.from({ length: 20 }, (_, i) => 20 - i);
    const out = wilderRsi(falling, 14);
    expect(out[14]).toBe(0);
    expect(out[19]).toBe(0);
  });

  it('stays within [0, 100] on a mixed series', () => {
    const mixed = [10, 11, 9, 12, 8, 13, 7, 14, 6, 15, 5, 16, 4, 17, 3, 18, 2, 19];
    for (const v of wilderRsi(mixed, 14)) {
      if (Number.isNaN(v)) continue;
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

describe('smaAt', () => {
  it('averages the trailing window and returns null before it is full', () => {
    expect(smaAt([2, 4, 6, 8], 2, 3)).toBe(7); // (6+8)/2
    expect(smaAt([2, 4, 6, 8], 2, 0)).toBeNull(); // window not yet full
    expect(smaAt([2, 4, 6, 8], 4, 3)).toBe(5); // (2+4+6+8)/4
  });
});

describe('minLowAt', () => {
  it('returns the window minimum and null before the window is full', () => {
    expect(minLowAt([5, 3, 4, 2], 2, 3)).toBe(2);
    expect(minLowAt([5, 3, 4, 2], 3, 3)).toBe(2);
    expect(minLowAt([5, 3], 2, 0)).toBeNull();
  });
});

describe('pctRatio (distance-from-low / vs-SMA percentage)', () => {
  it('is signed percent distance, null on a null or zero base', () => {
    expect(pctRatio(110, 100)).toBe(10);
    expect(pctRatio(90, 100)).toBe(-10);
    expect(pctRatio(5, null)).toBeNull();
    expect(pctRatio(5, 0)).toBeNull();
  });
});
