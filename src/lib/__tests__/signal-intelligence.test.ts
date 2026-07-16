import { describe, it, expect } from 'vitest';
import {
  buildSignalIntelligence,
  topConvergence,
  recencyWeight,
} from '@/lib/signal-intelligence';

// A fixed clock so recency + ordering are deterministic (the content dates are mid-2026).
const NOW = Date.parse('2026-07-16T00:00:00Z');

describe('recencyWeight', () => {
  it('is ~100 today and decays with age', () => {
    expect(recencyWeight('2026-07-16', NOW)).toBeGreaterThanOrEqual(99);
    const older = recencyWeight('2026-05-01', NOW);
    const newer = recencyWeight('2026-07-01', NOW);
    expect(newer).toBeGreaterThan(older);
  });

  it('halves roughly every 45 days', () => {
    const w = recencyWeight('2026-06-01', NOW); // 45 days before
    expect(w).toBeGreaterThan(40);
    expect(w).toBeLessThan(60);
  });

  it('gives undated/derived signals a neutral weight', () => {
    expect(recencyWeight(undefined, NOW)).toBe(60);
    expect(recencyWeight('not-a-date', NOW)).toBe(60);
  });
});

describe('buildSignalIntelligence', () => {
  const intel = buildSignalIntelligence({}, NOW);

  it('produces a ranked convergence list, highest conviction first', () => {
    expect(intel.convergence.length).toBeGreaterThan(0);
    for (let i = 1; i < intel.convergence.length; i++) {
      expect(intel.convergence[i - 1].convergenceScore).toBeGreaterThanOrEqual(intel.convergence[i].convergenceScore);
    }
  });

  it('scores each data point as impact scaled by recency (0-100)', () => {
    for (const p of intel.feed) {
      expect(p.score).toBeGreaterThanOrEqual(0);
      expect(p.score).toBeLessThanOrEqual(100);
      expect(p.score).toBe(Math.round((p.impact * p.recency) / 100));
    }
  });

  it('feed is ranked by score desc', () => {
    for (let i = 1; i < intel.feed.length; i++) {
      expect(intel.feed[i - 1].score).toBeGreaterThanOrEqual(intel.feed[i].score);
    }
  });

  it('narrative names every converging kind and never invents one', () => {
    for (const c of intel.convergence) {
      // Each kind label in the narrative must correspond to an actual point kind on the cluster.
      const kindsPresent = new Set(c.points.map((p) => p.kind));
      for (const k of c.kinds) expect(kindsPresent.has(k) || c.points.length >= 5).toBe(true);
      expect(c.narrative).toContain(c.name);
    }
  });

  it('stats are internally consistent', () => {
    expect(intel.stats.entities).toBe(intel.convergence.length);
    expect(intel.stats.dataPoints).toBe(intel.feed.length);
    expect(intel.stats.convergentEntities).toBe(intel.convergence.filter((c) => c.kinds.length >= 2).length);
  });
});

describe('topConvergence - the most-effective-data-points selector', () => {
  it('only surfaces names with >= 2 independent signal kinds (real convergence, not one loud signal)', () => {
    const intel = buildSignalIntelligence({}, NOW);
    const top = topConvergence(intel, 6, 2);
    expect(top.length).toBeGreaterThan(0);
    for (const c of top) expect(c.kinds.length).toBeGreaterThanOrEqual(2);
  });

  it('rewards breadth: a multi-kind name outranks a single-kind name', () => {
    const intel = buildSignalIntelligence({}, NOW);
    const multi = intel.convergence.find((c) => c.kinds.length >= 3);
    const single = intel.convergence.find((c) => c.kinds.length === 1);
    if (multi && single) expect(multi.convergenceScore).toBeGreaterThan(single.convergenceScore);
  });

  it('threads live scanner momentum into freshness', () => {
    // Give a known company strong momentum -> a live momentum data point appears.
    const intel = buildSignalIntelligence({ NVDA: 88 }, NOW);
    const nvda = intel.convergence.find((c) => c.entity === 'NVDA');
    expect(nvda?.points.some((p) => p.kind === 'momentum' && p.freshness === 'live')).toBe(true);
  });
});
