import { describe, it, expect } from 'vitest';
import {
  scoreCompany,
  scoreThemeCompanies,
  bucketSmallCaps,
  getThemes,
  getNodesForTheme,
  getNode,
  getThemeCompanies,
  getSmallCapCompanies,
  type ThemeCompany,
} from '@/lib/world-radar';

/**
 * The World Radar opportunity scorer + discovery buckets feed the Small Caps flagship and the
 * theme dossiers. It was untested; these pin the scoring shape, the risk-penalty behaviour, and the
 * bucketing invariants so the small-caps surface can't silently drift.
 */

const base: ThemeCompany = {
  symbol: 'TEST',
  name: 'Test Co',
  theme: 'agi-infrastructure',
  nodes: getNodesForTheme('agi-infrastructure')[0] ? [getNodesForTheme('agi-infrastructure')[0].id] : [],
  sizeBucket: 'small',
  exposure: 'direct',
  whyItMatters: 'x',
  evidence: 70,
  evidenceSummary: 'x',
  financialQuality: 70,
  liquidity: 60,
  crowding: 30,
  hypeRisk: 20,
  dilutionRisk: 10,
  risks: [],
};

describe('scoreCompany', () => {
  it('returns a bounded 0-100 total with a research-only action', () => {
    const s = scoreCompany(base, 60);
    expect(s.total).toBeGreaterThanOrEqual(0);
    expect(s.total).toBeLessThanOrEqual(100);
    expect(['Research', 'Watch', 'Monitor', 'Review risk']).toContain(s.action);
  });

  it('flags high hype/dilution as avoid + review risk', () => {
    const risky = scoreCompany({ ...base, hypeRisk: 85 }, 50);
    expect(risky.state).toBe('Avoid - hype/dilution risk');
    expect(risky.action).toBe('Review risk');
  });

  it('penalises crowding/hype/dilution (higher risk -> lower total)', () => {
    const clean = scoreCompany({ ...base, crowding: 10, hypeRisk: 10, dilutionRisk: 10 }, 60);
    const crowded = scoreCompany({ ...base, crowding: 90, hypeRisk: 60, dilutionRisk: 60 }, 60);
    expect(crowded.total).toBeLessThan(clean.total);
  });

  it('rewards direct exposure over second-order', () => {
    const direct = scoreCompany({ ...base, exposure: 'direct' }, 60);
    const secondOrder = scoreCompany({ ...base, exposure: 'second-order' }, 60);
    expect(direct.themeFit).toBeGreaterThan(secondOrder.themeFit);
  });

  it('treats a missing momentum as neutral 50', () => {
    const s = scoreCompany(base, undefined);
    expect(s.momentum).toBe(50);
  });
});

describe('scoreThemeCompanies + bucketSmallCaps', () => {
  it('ranks companies best-first', () => {
    const scored = scoreThemeCompanies('agi-infrastructure', {});
    for (let i = 1; i < scored.length; i++) {
      expect(scored[i - 1].score.total).toBeGreaterThanOrEqual(scored[i].score.total);
    }
  });

  it('buckets every company exactly once (no dup, no drop)', () => {
    const scored = scoreThemeCompanies(undefined, {});
    const buckets = bucketSmallCaps(scored);
    const placed = buckets.flatMap((b) => b.items.map((c) => c.symbol));
    expect(placed.length).toBe(scored.length);
    expect(new Set(placed).size).toBe(placed.length); // no company in two buckets
  });
});

describe('data integrity', () => {
  it('every small-cap company references a real theme', () => {
    const themeSlugs = new Set(getThemes().map((t) => t.slug));
    for (const c of getSmallCapCompanies()) {
      expect(themeSlugs.has(c.theme)).toBe(true);
    }
  });

  it('every company node id resolves to a real supply-chain node (cross-theme links allowed)', () => {
    // A company may touch nodes in OTHER themes (NVDA sits in agi-infrastructure but is also a
    // semiconductor designer) - that cross-theme web is the value-chain linkage, not a bug. So the
    // invariant is that every node id resolves GLOBALLY, not that it lives in the company's theme.
    for (const c of getThemeCompanies()) {
      for (const nodeId of c.nodes) {
        expect(getNode(nodeId), `${c.symbol} -> ${nodeId}`).toBeDefined();
      }
    }
  });
});
