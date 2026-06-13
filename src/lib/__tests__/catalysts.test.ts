import { describe, expect, it } from 'vitest';
import { CATALYSTS, daysUntil, deriveCatalystRadar, scoreCatalyst, type Catalyst } from '@/lib/catalysts';

const REF = new Date('2026-06-13T12:00:00');

function make(overrides: Partial<Catalyst>): Catalyst {
  return {
    id: 'test',
    title: 'Test catalyst',
    category: 'ipo',
    date: '2026-06-20',
    dateConfidence: 'confirmed',
    tickers: [],
    exposure: [],
    impact: 3,
    attention: 3,
    why: 'why',
    setup: 'setup',
    ...overrides,
  };
}

describe('daysUntil', () => {
  it('counts whole days to a future date and is negative for the past', () => {
    expect(daysUntil('2026-06-20', REF)).toBe(7);
    expect(daysUntil('2026-06-13', REF)).toBe(0);
    expect(daysUntil('2026-06-11', REF)).toBe(-2);
  });
});

describe('scoreCatalyst', () => {
  it('scores a soon, high-impact, high-attention IPO as hot and in the act window', () => {
    const s = scoreCatalyst(make({ date: '2026-06-18', impact: 5, attention: 5 }), REF);
    expect(s.heat).toBeGreaterThanOrEqual(80);
    expect(s.tier).toBe('now');
  });

  it('ranks a sooner moment above a later one, all else equal', () => {
    const soon = scoreCatalyst(make({ date: '2026-06-15' }), REF);
    const later = scoreCatalyst(make({ date: '2026-07-10' }), REF);
    expect(soon.timing).toBeGreaterThan(later.timing);
    expect(soon.heat).toBeGreaterThan(later.heat);
  });

  it('discounts impact for rumored dates vs confirmed', () => {
    const confirmed = scoreCatalyst(make({ dateConfidence: 'confirmed', impact: 5 }), REF);
    const rumored = scoreCatalyst(make({ dateConfidence: 'rumored', impact: 5 }), REF);
    expect(rumored.impactScore).toBeLessThan(confirmed.impactScore);
  });

  it('pushes a distant, quiet moment to the horizon tier', () => {
    const s = scoreCatalyst(make({ date: '2026-08-01', impact: 2, attention: 2 }), REF);
    expect(s.tier).toBe('horizon');
  });
});

describe('deriveCatalystRadar', () => {
  it('drops moments that have gone cold (passed more than ~8 days)', () => {
    const stale = make({ id: 'stale', date: '2026-06-01' }); // 12 days ago
    const ids = deriveCatalystRadar(REF, [stale, make({ id: 'fresh' })]).map((c) => c.id);
    expect(ids).not.toContain('stale');
    expect(ids).toContain('fresh');
  });

  it('returns the curated catalysts ranked by heat (descending)', () => {
    const radar = deriveCatalystRadar(REF);
    expect(radar.length).toBeGreaterThan(0);
    const heats = radar.map((c) => c.heat);
    expect([...heats]).toEqual([...heats].sort((a, b) => b - a));
  });

  it('keeps every curated catalyst well-formed', () => {
    for (const c of CATALYSTS) {
      expect(c.impact).toBeGreaterThanOrEqual(1);
      expect(c.impact).toBeLessThanOrEqual(5);
      expect(c.attention).toBeGreaterThanOrEqual(1);
      expect(c.attention).toBeLessThanOrEqual(5);
      expect(c.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
