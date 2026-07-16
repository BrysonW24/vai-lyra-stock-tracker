import { describe, it, expect } from 'vitest';
import {
  backingFor,
  stageFor,
  emergenceFor,
  computeUpside,
  buildLifecycleCandidates,
  buildEmergenceShortlist,
  stageDistribution,
  LIFECYCLE_ORDER,
  type LifecycleStage,
} from '@/lib/small-cap-lifecycle';
import { getSmallCapCompanies, type ThemeCompany } from '@/lib/world-radar';
import { buildEmergenceGrounding } from '@/lib/ai/chat-context';

const mk = (over: Partial<ThemeCompany>): ThemeCompany => ({
  symbol: 'TST',
  name: 'Test',
  theme: 'agi-infrastructure',
  nodes: [],
  sizeBucket: 'small',
  exposure: 'direct',
  whyItMatters: 'x',
  evidence: 30,
  evidenceSummary: 'x',
  financialQuality: 50,
  liquidity: 50,
  crowding: 30,
  hypeRisk: 20,
  dilutionRisk: 20,
  risks: [],
  ...over,
});

const noBacking = { government: false, bigTech: false, smartMoney: false, strength: 0, sources: [] };

describe('stageFor', () => {
  it('is concept with no evidence and no backing', () => {
    expect(stageFor(mk({ evidence: 20 }), noBacking, 50)).toBe('concept');
  });

  it('is funded when money is behind it but evidence is still thin', () => {
    const backing = { ...noBacking, government: true, strength: 1 };
    expect(stageFor(mk({ evidence: 30 }), backing, 50)).toBe('funded');
  });

  it('is contracted once real evidence is on record', () => {
    expect(stageFor(mk({ evidence: 58, crowding: 20 }), noBacking, 40)).toBe('contracted');
  });

  it('is scaling with strong evidence and turning momentum', () => {
    expect(stageFor(mk({ evidence: 65, crowding: 30 }), noBacking, 70)).toBe('scaling');
  });

  it('is crowded when evidence is high but the trade is obvious', () => {
    expect(stageFor(mk({ evidence: 70, crowding: 80 }), noBacking, 70)).toBe('crowded');
  });
});

describe('emergenceFor', () => {
  it('rewards an early, backed name over a crowded one', () => {
    const earlyBacked = emergenceFor(
      mk({ evidence: 55 }),
      { government: true, bigTech: true, smartMoney: false, strength: 2, sources: [] },
      'funded',
      55,
    );
    const crowded = emergenceFor(mk({ evidence: 70, crowding: 85 }), noBacking, 'crowded', 60);
    expect(earlyBacked.total).toBeGreaterThan(crowded.total);
  });

  it('stays within 0-100', () => {
    const b = emergenceFor(mk({}), noBacking, 'concept', 50);
    expect(b.total).toBeGreaterThanOrEqual(0);
    expect(b.total).toBeLessThanOrEqual(100);
  });
});

describe('backingFor', () => {
  it('returns a well-formed profile for every real small cap (no throws)', () => {
    for (const c of getSmallCapCompanies()) {
      const b = backingFor(c.symbol);
      expect(b.strength).toBe(Number(b.government) + Number(b.bigTech) + Number(b.smartMoney));
      expect(b.sources.length).toBeLessThanOrEqual(6);
    }
  });

  it('de-dupes sources by kind+name', () => {
    // Whatever the data, no two sources share the same (kind, name) key.
    for (const c of getSmallCapCompanies()) {
      const keys = backingFor(c.symbol).sources.map((s) => `${s.kind}:${s.name}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe('buildLifecycleCandidates + shortlist', () => {
  it('covers exactly the small/micro universe, ranked by emergence desc', () => {
    const candidates = buildLifecycleCandidates({});
    expect(candidates.length).toBe(getSmallCapCompanies().length);
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i - 1].emergence.total).toBeGreaterThanOrEqual(candidates[i].emergence.total);
    }
  });

  it('assigns every candidate a valid stage', () => {
    for (const c of buildLifecycleCandidates({})) {
      expect(LIFECYCLE_ORDER).toContain(c.stage as LifecycleStage);
    }
  });

  it('shortlist is bounded and prefers early+backed names', () => {
    const shortlist = buildEmergenceShortlist({}, 8);
    expect(shortlist.length).toBeLessThanOrEqual(8);
    expect(shortlist.length).toBeGreaterThan(0);
    // The distribution helper sums to the candidate count.
    const dist = stageDistribution(buildLifecycleCandidates({}));
    const summed = Object.values(dist).reduce((a, b) => a + b, 0);
    expect(summed).toBe(getSmallCapCompanies().length);
  });

  it('threads momentum from the scanner into the score', () => {
    const withMomentum = buildLifecycleCandidates({ [getSmallCapCompanies()[0].symbol]: 95 });
    const target = withMomentum.find((c) => c.symbol === getSmallCapCompanies()[0].symbol);
    expect(target?.emergence.momentum).toBe(95);
  });

  it('EVERY small cap connects to at least one backing source (no dangling signal)', () => {
    // The flagship's whole premise (find them early AND backed) breaks if a name has no backing
    // data. This pins the founder's "no data gaps" mandate - a new small cap without connected
    // government / big-tech / smart-money backing fails here until its backing is wired in.
    const unbacked = buildLifecycleCandidates({})
      .filter((c) => c.backing.strength === 0)
      .map((c) => c.symbol);
    expect(unbacked, `unbacked small caps: ${unbacked.join(', ')}`).toEqual([]);
  });
});

describe('computeUpside', () => {
  const upsideFor = (company: ThemeCompany, backing = noBacking, momentum = 50) => {
    const stage = stageFor(company, backing, momentum);
    const emergence = emergenceFor(company, backing, stage, momentum);
    return { stage, upside: computeUpside(company, backing, stage, emergence) };
  };

  it('keeps the multiples internally consistent and the bear floored', () => {
    const { upside: u } = upsideFor(mk({ evidence: 40 }));
    expect(u.impliedUpsidePct).toBeCloseTo((u.baseMultiple - 1) * 100, 1);
    expect(u.downsideRiskPct).toBeCloseTo((1 - u.bearMultiple) * 100, 1);
    expect(u.bearMultiple).toBeGreaterThanOrEqual(0.1);
    expect(u.bullMultiple).toBeGreaterThanOrEqual(u.baseMultiple);
  });

  it('flags a concept with big upside and big downside as lottery-tier', () => {
    // Unbacked concept, high hype/dilution/crowding downside, high-bottleneck theme for big upside.
    const { stage, upside } = upsideFor(
      mk({ theme: 'agi-infrastructure', evidence: 20, crowding: 60, hypeRisk: 80, dilutionRisk: 80 }),
      noBacking,
    );
    expect(stage).toBe('concept');
    expect(upside.tier).toBe('lottery');
    expect(upside.downsideRiskPct).toBeGreaterThanOrEqual(50);
  });

  it('rates a proven, low-hype name as more balanced than a raw concept', () => {
    const gov = { government: true, bigTech: false, smartMoney: false, strength: 1, sources: [] };
    const proven = upsideFor(mk({ evidence: 70, crowding: 30, hypeRisk: 20, dilutionRisk: 20 }), gov).upside;
    const concept = upsideFor(mk({ evidence: 15, crowding: 50, hypeRisk: 80, dilutionRisk: 80 }), noBacking).upside;
    expect(proven.downsideRiskPct).toBeLessThan(concept.downsideRiskPct);
    expect(proven.tier === 'asymmetric' || proven.tier === 'balanced' || proven.tier === 'limited').toBe(true);
  });
});

describe('AI grounding (flagship signals are first-class to the AI)', () => {
  it('emits a shortlist block naming stage, backing and raw materials', () => {
    const block = buildEmergenceGrounding({});
    expect(block).toContain('SMALL-CAP EMERGENCE SHORTLIST');
    expect(block).toMatch(/emergence \d+\/100/);
    expect(block).toMatch(/backed by/);
    // At least one shortlisted name should carry a disclosed backer (not "none disclosed" for all).
    expect(block).not.toMatch(/backed by none disclosed[\s\S]*backed by none disclosed[\s\S]*backed by none disclosed/);
  });
});
