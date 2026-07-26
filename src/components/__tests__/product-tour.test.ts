import { describe, expect, it } from 'vitest';
import { shouldAutoOpenProductTour } from '@/lib/product-tour';

describe('product tour auto-open', () => {
  it('opens only for a user who has seen neither setup nor the tour', () => {
    expect(shouldAutoOpenProductTour(false, false)).toBe(true);
    expect(shouldAutoOpenProductTour(true, false)).toBe(false);
    expect(shouldAutoOpenProductTour(false, true)).toBe(false);
    expect(shouldAutoOpenProductTour(true, true)).toBe(false);
  });
});
