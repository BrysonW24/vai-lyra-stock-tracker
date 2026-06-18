import { describe, expect, it } from 'vitest';
import { getDemoFinding } from '@/lib/findings/demo-findings';
import {
  buildAllowedMetrics,
  buildDefaultGenUIView,
  collectAllowedNumbers,
  validateGenUIView,
} from '@/lib/findings/genui';

const finding = getDemoFinding('BKSY-20260617')!;

describe('GenUI view model', () => {
  it('builds a deterministic default view that is never empty', () => {
    const v = buildDefaultGenUIView(finding);
    expect(v.source).toBe('default');
    expect(v.blocks.length).toBeGreaterThan(0);
    expect(v.blocks[0].kind).toBe('metric_grid');
  });

  it('only exposes metrics the engine actually computed', () => {
    const keys = buildAllowedMetrics(finding).map((m) => m.key);
    expect(keys).toContain('total');
    expect(keys).toContain('government');
    // A finding without a government score must not surface that key.
    const soun = getDemoFinding('SOUN-20260617')!;
    expect(buildAllowedMetrics(soun).map((m) => m.key)).not.toContain('government');
  });

  it('includes the headline scores in the allow-set of numbers', () => {
    const nums = collectAllowedNumbers(finding);
    expect(nums).toContain(String(finding.scores.total));
    expect(nums).toContain(String(finding.scores.government));
  });

  it('drops metric keys the engine does not own', () => {
    const v = validateGenUIView(
      { title: 'View', blocks: [{ kind: 'metric_grid', metrics: [{ key: 'total' }, { key: 'made_up_key' }] }] },
      finding,
    );
    const grid = v?.blocks.find((b) => b.kind === 'metric_grid');
    expect(grid && grid.kind === 'metric_grid' && grid.metrics.map((m) => m.key)).toEqual(['total']);
  });

  it('drops prose that smuggles a fabricated number but keeps clean prose', () => {
    const v = validateGenUIView(
      {
        title: 'View',
        blocks: [
          { kind: 'bullets', items: ['Revenue jumped 9999% last quarter', 'Government-linked demand is real'] },
          { kind: 'metric_grid', metrics: [{ key: 'total' }] },
        ],
      },
      finding,
    );
    const bullets = v?.blocks.find((b) => b.kind === 'bullets');
    expect(bullets && bullets.kind === 'bullets' && bullets.items).toEqual(['Government-linked demand is real']);
  });

  it('returns null when nothing survives, so the caller falls back to default', () => {
    const v = validateGenUIView({ title: 'x', blocks: [{ kind: 'bullets', items: ['up 9999% today'] }] }, finding);
    expect(v).toBeNull();
  });

  it('marks an accepted AI view as source ai', () => {
    const v = validateGenUIView({ title: 'View', blocks: [{ kind: 'metric_grid', metrics: [{ key: 'total' }] }] }, finding);
    expect(v?.source).toBe('ai');
  });

  it('drops advice prose with no digits (the numeral guard alone misses it)', () => {
    const v = validateGenUIView(
      {
        title: 'View',
        blocks: [
          { kind: 'bullets', items: ['Strong buy, load up before it runs', 'Government-linked demand is real'] },
          { kind: 'metric_grid', metrics: [{ key: 'total' }] },
        ],
      },
      finding,
    );
    const bullets = v?.blocks.find((b) => b.kind === 'bullets');
    expect(bullets && bullets.kind === 'bullets' && bullets.items).toEqual(['Government-linked demand is real']);
  });

  it('drops a note that gives advice', () => {
    const v = validateGenUIView(
      { title: 'View', blocks: [{ kind: 'note', text: 'Accumulate here, guaranteed upside.' }, { kind: 'metric_grid', metrics: [{ key: 'total' }] }] },
      finding,
    );
    expect(v?.blocks.some((b) => b.kind === 'note')).toBe(false);
  });

  it('drops prose with spelled-out numbers that smuggle a figure', () => {
    const v = validateGenUIView(
      {
        title: 'View',
        blocks: [
          { kind: 'bullets', items: ['This name doubles from here to a forty dollar level', 'Exposed to the same bottleneck as peers'] },
          { kind: 'metric_grid', metrics: [{ key: 'total' }] },
        ],
      },
      finding,
    );
    const bullets = v?.blocks.find((b) => b.kind === 'bullets');
    expect(bullets && bullets.kind === 'bullets' && bullets.items).toEqual(['Exposed to the same bottleneck as peers']);
  });

  it('rejects an advice title, falling back through to a safe label', () => {
    const v = validateGenUIView({ title: 'Strong buy now', blocks: [{ kind: 'metric_grid', metrics: [{ key: 'total' }] }] }, finding);
    // The banned title is discarded (cleanLabel returns undefined) and a safe default title is used.
    expect(v?.title.toLowerCase()).not.toContain('buy');
  });
});
