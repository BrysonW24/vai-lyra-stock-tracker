import { describe, it, expect } from 'vitest';
import { resolveOrder, defaultLayout, DEFAULT_HIDDEN } from '@/lib/command-layout';

/**
 * 2026-07-27 audit V3: the command-shell layout decision seam (resolveOrder / defaultLayout) was
 * unpinned. resolveOrder must be forward-compatible: keep the user's saved order for sections that
 * still exist, DROP sections that no longer exist, and APPEND newly-added sections in their default
 * position - so a shipped new card is never silently lost and a removed one never leaves a hole.
 */
const KNOWN = ['a', 'b', 'c', 'd'];

describe('resolveOrder', () => {
  it('returns the known order untouched when there is no saved state', () => {
    expect(resolveOrder(null, KNOWN)).toEqual(KNOWN);
    expect(resolveOrder(undefined, KNOWN)).toEqual(KNOWN);
    expect(resolveOrder([], KNOWN)).toEqual(KNOWN);
  });

  it('preserves a saved reordering of still-existing sections', () => {
    expect(resolveOrder(['c', 'a', 'b', 'd'], KNOWN)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('drops saved ids that no longer exist', () => {
    expect(resolveOrder(['b', 'ghost', 'a'], KNOWN)).toEqual(['b', 'a', 'c', 'd']);
  });

  it('appends newly-added known sections after the saved order (never loses a new card)', () => {
    // Saved layout only knew a + b; c and d shipped later -> they appear at the end.
    expect(resolveOrder(['b', 'a'], KNOWN)).toEqual(['b', 'a', 'c', 'd']);
  });

  it('never duplicates or omits a known section', () => {
    const out = resolveOrder(['d', 'ghost', 'd', 'a'], KNOWN);
    expect([...out].sort()).toEqual([...KNOWN].sort());
  });
});

describe('defaultLayout', () => {
  it('orders by known and hides only the default-hidden ids that exist', () => {
    const known = ['compact-feed', 'goal', 'strongest', 'portfolio-exposure'];
    const layout = defaultLayout(known);
    expect(layout.order).toEqual(known);
    expect(layout.hidden).toEqual(DEFAULT_HIDDEN.filter((id) => known.includes(id)));
  });

  it('hides nothing when the default-hidden ids are absent', () => {
    expect(defaultLayout(['goal', 'portfolio-exposure']).hidden).toEqual([]);
  });
});
