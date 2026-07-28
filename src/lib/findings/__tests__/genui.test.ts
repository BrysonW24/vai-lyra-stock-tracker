import { describe, it, expect } from 'vitest';
import {
  validateGenUIView,
  buildAllowedMetrics,
  collectAllowedNumbers,
  buildDefaultGenUIView,
  type GenUIBlock,
} from '../genui';
import { DEMO_FINDINGS } from '../demo-findings';

/**
 * Behavioral pin for the GenUI composition guard - the vertical's safety-critical "AI composes
 * layout, never numbers, never advice" boundary (2026-07-27 audit V11 P2: previously only present
 * as a regex string in policy-invariants). Every hostile shape must be neutralised: unknown metric
 * keys dropped, advice prose stripped, spelled-out magnitudes (incl. plurals) and out-of-set digits
 * rejected, deterministic blocks kept only when the finding has that data, and an all-bad view -> null
 * so the drawer falls back to buildDefaultGenUIView.
 */
const finding = DEMO_FINDINGS[0];

function metricKeysIn(blocks: GenUIBlock[]): string[] {
  const grid = blocks.find((b) => b.kind === 'metric_grid');
  return grid && grid.kind === 'metric_grid' ? grid.metrics.map((m) => m.key) : [];
}

describe('validateGenUIView', () => {
  it('keeps allowed metric keys and drops keys Lyra did not compute', () => {
    const allowedKey = buildAllowedMetrics(finding)[0].key;
    const view = validateGenUIView(
      { blocks: [{ kind: 'metric_grid', metrics: [{ key: allowedKey }, { key: 'made_up_key' }, { key: 'pe_ratio' }] }] },
      finding,
    );
    expect(view).not.toBeNull();
    expect(metricKeysIn(view!.blocks)).toEqual([allowedKey]);
  });

  it('drops a metric_grid whose keys are all disallowed (no metrics survive)', () => {
    const view = validateGenUIView(
      { blocks: [{ kind: 'metric_grid', metrics: [{ key: 'made_up_key' }, { key: 'pe_ratio' }] }] },
      finding,
    );
    expect(view).toBeNull();
  });

  it('strips advice prose from a note block', () => {
    const view = validateGenUIView(
      { blocks: [{ kind: 'note', text: 'Strong buy - load up here before it runs.' }] },
      finding,
    );
    expect(view).toBeNull();
  });

  it('rejects a spelled-out PLURAL magnitude (the V11 plural-bypass fix)', () => {
    const view = validateGenUIView(
      { blocks: [{ kind: 'note', text: 'This could run up hundreds of percent from here.' }] },
      finding,
    );
    expect(view).toBeNull();
  });

  it('rejects an out-of-set fabricated digit in prose', () => {
    const bogus = '4242';
    expect(collectAllowedNumbers(finding)).not.toContain(bogus);
    const view = validateGenUIView(
      { blocks: [{ kind: 'note', text: `The name is up ${bogus}% since the award.` }] },
      finding,
    );
    expect(view).toBeNull();
  });

  it('keeps clean, number-free, advice-free prose', () => {
    const view = validateGenUIView(
      { blocks: [{ kind: 'note', text: 'Government demand is the anchor of this thesis.' }] },
      finding,
    );
    expect(view).not.toBeNull();
    const note = view!.blocks.find((b) => b.kind === 'note');
    expect(note && note.kind === 'note' ? note.text : '').toContain('Government demand');
  });

  it('keeps a timeline block only when the finding has timeline data', () => {
    const withTimeline = { blocks: [{ kind: 'timeline', title: 'How it built' }] };
    if (finding.timeline.length > 0) {
      const view = validateGenUIView(withTimeline, finding);
      expect(view!.blocks.some((b) => b.kind === 'timeline')).toBe(true);
    }
    // A finding with no timeline must never surface a timeline block.
    const stripped = validateGenUIView(withTimeline, { ...finding, timeline: [] });
    expect(stripped).toBeNull();
  });

  it('returns null for an all-bad view so the caller falls back to the default view', () => {
    const view = validateGenUIView(
      {
        title: 'Guaranteed 10x - all in now',
        blocks: [
          { kind: 'metric_grid', metrics: [{ key: 'made_up_key' }] },
          { kind: 'note', text: 'Accumulate aggressively, this doubles from here.' },
        ],
      },
      finding,
    );
    expect(view).toBeNull();
    // The caller's fallback is always a real, non-null deterministic view.
    expect(buildDefaultGenUIView(finding).blocks.length).toBeGreaterThan(0);
  });

  it('returns null for non-object input', () => {
    expect(validateGenUIView(null, finding)).toBeNull();
    expect(validateGenUIView('nope', finding)).toBeNull();
    expect(validateGenUIView({ blocks: [] }, finding)).toBeNull();
  });
});
