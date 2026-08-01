import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { MODEL_GROUPS, ROADMAP, STAGE_LABEL } from '../registry';
import { SURFACE_LABELS } from '../../surfaces';

/**
 * The /models registry is the app's public claim about what its models are and how far they have
 * shipped - so the data itself is pinned: complete fields, honest stages, resolvable surfaces, and
 * zero advice language. A future edit that adds a model with a dead link or a trading instruction
 * fails here, not in production.
 */

const ALL_ENTRIES = MODEL_GROUPS.flatMap((g) => g.entries);

describe('models registry integrity', () => {
  it('has unique keys and complete fields on every entry', () => {
    const keys = ALL_ENTRIES.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const e of ALL_ENTRIES) {
      expect(e.name.length).toBeGreaterThan(0);
      expect(e.family.length).toBeGreaterThan(0);
      expect(e.answers.length).toBeGreaterThan(10);
      expect(e.provenance.length).toBeGreaterThan(10);
      expect(e.code.length).toBeGreaterThan(0);
      expect(STAGE_LABEL[e.stage]).toBeTruthy();
    }
  });

  it('registers all six Emerging Winner Engine models', () => {
    const keys = new Set(ALL_ENTRIES.map((e) => e.key));
    for (let n = 1; n <= 6; n++) {
      const match = [...keys].some((k) => k.startsWith(`ew-m${n}-`));
      expect(match, `missing Emerging Winner model M${n}`).toBe(true);
    }
  });

  it('only links to surfaces that exist as registered routes with real pages', () => {
    for (const e of ALL_ENTRIES) {
      if (!e.surface) continue;
      expect(SURFACE_LABELS[e.surface.href], `${e.key} links unregistered ${e.surface.href}`).toBeTruthy();
      const page = join(process.cwd(), 'src', 'app', e.surface.href.slice(1), 'page.tsx');
      expect(existsSync(page), `${e.key} links ${e.surface.href} but ${page} does not exist`).toBe(true);
    }
  });

  it('contains no advice language anywhere in the registry', () => {
    const text = JSON.stringify(MODEL_GROUPS) + JSON.stringify(ROADMAP);
    expect(text).not.toMatch(/\bbuy\b/i);
    expect(text).not.toMatch(/price target/i);
    expect(text).not.toMatch(/guaranteed/i);
  });

  it('designed families are honestly marked with no surface', () => {
    const families = MODEL_GROUPS.find((g) => g.key === 'event-families');
    expect(families).toBeTruthy();
    for (const e of families!.entries) {
      expect(e.stage).toBe('designed');
      expect(e.surface).toBeUndefined();
      expect(e.provenance).toMatch(/spec only/i);
    }
  });

  it('states the Model 2 champion truth with the survivor-biased caveat, never overclaiming', () => {
    const m2 = ALL_ENTRIES.find((e) => e.key === 'ew-m2-classifier')!;
    expect(m2.provenance).toMatch(/emerging-winner-classifier-real-v1/);
    expect(m2.provenance).toMatch(/real historical outcomes/);
    expect(m2.provenance).toMatch(/survivor-biased/);
    expect(m2.provenance).toMatch(/shadow-live, research only/);
    expect(m2.stage).toBe('shadow-live');
  });

  it('roadmap covers phases 0-6, keeps Phase 1 partial (never done) and exactly one "next" gate', () => {
    expect(ROADMAP.map((p) => p.phase)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    // Phase 1 is partially delivered: survivor-biased corpus exists, delisted-inclusive corpus is the gate.
    const phase1 = ROADMAP.find((p) => p.phase === 1)!;
    expect(phase1.status).toBe('ongoing');
    expect(phase1.note).toMatch(/survivor-biased/i);
    expect(phase1.note).toMatch(/delisted-inclusive/i);
    // Phase 2 is done on the v1 corpus only, and says so.
    const phase2 = ROADMAP.find((p) => p.phase === 2)!;
    expect(phase2.status).toBe('done');
    expect(phase2.note).toMatch(/v1 corpus/i);
    // Exactly one "next" gate: live calibration on matured ledger outcomes (the feedback loop).
    expect(ROADMAP.filter((p) => p.status === 'next')).toHaveLength(1);
    expect(ROADMAP.find((p) => p.status === 'next')!.phase).toBe(6);
  });
});
