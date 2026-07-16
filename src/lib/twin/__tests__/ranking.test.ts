import { describe, it, expect } from 'vitest';
import { applyAffinityTiebreak, affinityWeightsFrom, affinityFor } from '@/lib/twin/ranking';

interface Row {
  symbol: string;
  score: number;
}

describe('twin · affinity tiebreak (anti-bubble invariants)', () => {
  const rows: Row[] = [
    { symbol: 'AAA', score: 80 },
    { symbol: 'BBB', score: 80 },
    { symbol: 'CCC', score: 90 },
    { symbol: 'DDD', score: 70 },
  ];
  // User is into BBB heavily; AAA a little.
  const affinity = (r: Row) => ({ AAA: 1, BBB: 5 }[r.symbol] ?? 0);
  const out = applyAffinityTiebreak(rows, (r) => r.score, affinity);

  it('never promotes a lower score above a higher score (the score still gates)', () => {
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1].score).toBeGreaterThanOrEqual(out[i].score);
    }
    expect(out[0].symbol).toBe('CCC'); // 90 stays on top regardless of affinity
    expect(out[out.length - 1].symbol).toBe('DDD'); // 70 stays last
  });

  it('reorders only the equal-score names by affinity', () => {
    // Among the two 80s, BBB (higher affinity) leads AAA.
    const eighties = out.filter((r) => r.score === 80).map((r) => r.symbol);
    expect(eighties).toEqual(['BBB', 'AAA']);
  });

  it('never drops or duplicates a name (anti-bubble: nothing hidden)', () => {
    expect(out.map((r) => r.symbol).sort()).toEqual(['AAA', 'BBB', 'CCC', 'DDD']);
    expect(out.length).toBe(rows.length);
  });

  it('is a no-op ordering when affinity is uniform (stable)', () => {
    const flat = applyAffinityTiebreak(rows, (r) => r.score, () => 0);
    expect(flat.map((r) => r.symbol)).toEqual(['CCC', 'AAA', 'BBB', 'DDD']);
  });

  it('does not mutate the input array', () => {
    expect(rows.map((r) => r.symbol)).toEqual(['AAA', 'BBB', 'CCC', 'DDD']);
  });
});

describe('twin · affinity weights', () => {
  it('reads symbol weight and adds a softer theme share', () => {
    const w = affinityWeightsFrom({
      symbols: [{ key: 'RKLB', weight: 2, count: 1, sharePct: 0 }],
      themes: [{ key: 'Space & Defence', weight: 4, count: 1, sharePct: 0 }],
    });
    // RKLB's own weight (2) is present; a symbol not in the map is 0.
    expect(affinityFor('RKLB', w)).toBeGreaterThanOrEqual(2);
    expect(affinityFor('ZZZZ', w)).toBe(0);
  });
});
