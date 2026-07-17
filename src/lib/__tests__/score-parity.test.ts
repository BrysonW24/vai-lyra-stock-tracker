import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { computeLyraScore, type ScoreInputs } from '../score-model';

/**
 * TS half of the cross-language score parity contract. The SAME golden vectors are asserted by
 * the Python engine in tests/test_score_parity.py. Together they guarantee the two independent
 * implementations of Lyra's deterministic score agree - the Pine-only test could never detect
 * Python-side drift, this can, because both languages check the same numbers.
 */

interface Golden {
  cases: Array<{
    name: string;
    inputs: ScoreInputs;
    expected: {
      rsiScore: number;
      macdScore: number;
      priceLocationScore: number;
      trendScore: number;
      volumeScore: number;
      final: number;
    };
  }>;
}

const golden = JSON.parse(
  readFileSync(new URL('../../../contracts/score-golden-vectors.json', import.meta.url), 'utf8'),
) as Golden;

describe('score parity - TS matches the golden vectors (shared with Python)', () => {
  it('has a non-trivial vector set', () => {
    expect(golden.cases.length).toBeGreaterThanOrEqual(5);
  });

  for (const c of golden.cases) {
    it(`case: ${c.name}`, () => {
      const got = computeLyraScore(c.inputs);
      expect(got.rsiScore).toBe(c.expected.rsiScore);
      expect(got.macdScore).toBe(c.expected.macdScore);
      expect(got.priceLocationScore).toBe(c.expected.priceLocationScore);
      expect(got.trendScore).toBe(c.expected.trendScore);
      expect(got.volumeScore).toBe(c.expected.volumeScore);
      expect(got.final).toBe(c.expected.final);
    });
  }
});
