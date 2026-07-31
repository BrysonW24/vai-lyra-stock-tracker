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

  it('roadmap covers phases 0-6 with exactly one "next" gate', () => {
    expect(ROADMAP.map((p) => p.phase)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(ROADMAP.filter((p) => p.status === 'next')).toHaveLength(1);
    expect(ROADMAP.find((p) => p.status === 'next')!.phase).toBe(1);
  });
});
