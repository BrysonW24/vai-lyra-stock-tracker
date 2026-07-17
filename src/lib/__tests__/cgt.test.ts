/**
 * CGT holding-period status - the badge math must mirror workers/stock_scanner/cgt_radar.py
 * (365-day threshold, 30-day approach window) or the portfolio UI and the notification
 * would disagree about the same date.
 */
import { describe, expect, it } from 'vitest';
import { CGT_APPROACH_WINDOW_DAYS, CGT_HOLDING_DAYS, cgtBadgeClass, cgtStatusFor } from '../cgt';

describe('cgtStatusFor', () => {
  it('is eligible at and past 365 days', () => {
    expect(cgtStatusFor('2025-07-17', '2026-07-17')?.state).toBe('eligible');
    expect(cgtStatusFor('2024-01-05', '2026-07-17')?.state).toBe('eligible');
    expect(cgtStatusFor('2025-07-17', '2026-07-17')?.label).toBe('12mo+ held');
  });

  it('approaches inside the 30-day window with a countdown label', () => {
    const status = cgtStatusFor('2025-08-11', '2026-07-17');
    expect(status?.state).toBe('approaching');
    expect(status?.daysToAnniversary).toBe(25);
    expect(status?.label).toBe('CGT date in 25d');
  });

  it('is building outside the window', () => {
    const status = cgtStatusFor('2026-04-01', '2026-07-17');
    expect(status?.state).toBe('building');
    expect(status?.label).toMatch(/^held \d+d$/);
  });

  it('boundary: exactly 30 days out is approaching, 31 is building', () => {
    // held = 365-30 = 335 days -> purchased 335 days before today.
    expect(cgtStatusFor('2025-08-16', '2026-07-17')?.state).toBe('approaching');
    expect(cgtStatusFor('2025-08-17', '2026-07-17')?.state).toBe('building');
  });

  it('returns null for missing, malformed, or future purchase dates - never guessed', () => {
    expect(cgtStatusFor(null, '2026-07-17')).toBeNull();
    expect(cgtStatusFor(undefined, '2026-07-17')).toBeNull();
    expect(cgtStatusFor('not-a-date', '2026-07-17')).toBeNull();
    expect(cgtStatusFor('2026-08-01', '2026-07-17')).toBeNull();
    expect(cgtStatusFor('2025-07-17', '')).toBeNull(); // pre-hydration empty clock
  });

  it('constants mirror the Python radar', () => {
    expect(CGT_HOLDING_DAYS).toBe(365);
    expect(CGT_APPROACH_WINDOW_DAYS).toBe(30);
  });

  it('badge classes cover every state', () => {
    for (const state of ['eligible', 'approaching', 'building'] as const) {
      expect(cgtBadgeClass(state)).toMatch(/border-/);
    }
  });
});
