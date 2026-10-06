import { describe, expect, it } from 'vitest';
import { describeMute } from '@/lib/alert-health';
import type { AlertHealth } from '@/lib/setup-status';

/**
 * The notice that says alerts are muted. The real case it was written for: muted at
 * 2026-07-17T16:39:39Z - which is 2:39am on the 18th in Sydney - fourteen seconds after the last
 * alert that ever got through, and unnoticed for eleven weeks.
 */
const muted = (overrides: Partial<AlertHealth> = {}): AlertHealth => ({
  muted: true,
  mutedSince: '2026-07-17T16:39:39Z',
  lastDeliveredAt: '2026-07-17T16:39:25Z',
  heldBack: 3414,
  timezone: 'Australia/Sydney',
  ...overrides,
});

describe('describeMute', () => {
  it('says nothing when alerts are not muted, or could not be read', () => {
    expect(describeMute(undefined)).toBeNull();
    expect(describeMute(muted({ muted: false }))).toBeNull();
  });

  it('states when anything last arrived, in the account own timezone, and how much was held back', () => {
    // 16:39 UTC on the 17th is already the 18th in Sydney - the date the user would say.
    expect(describeMute(muted())).toEqual({
      title: 'Your alerts are muted',
      detail: 'Nothing has reached you since 18 Jul 2026. 3,414 alerts have been held back.',
    });
  });

  it('uses the stored zone, not the machine one', () => {
    expect(describeMute(muted({ timezone: 'America/New_York' }))!.detail).toContain('since 17 Jul 2026');
  });

  it('falls back to the mute date when nothing was ever delivered', () => {
    expect(describeMute(muted({ lastDeliveredAt: null, heldBack: 0 }))!.detail).toBe(
      'Nothing has reached you since they were muted on 18 Jul 2026.',
    );
  });

  it('never invents a date or a count it does not have', () => {
    expect(describeMute(muted({ lastDeliveredAt: null, mutedSince: null, heldBack: 0 }))!.detail).toBe('Nothing is reaching you.');
    expect(describeMute(muted({ lastDeliveredAt: 'garbage', mutedSince: null, heldBack: 1 }))!.detail).toBe(
      'Nothing is reaching you. 1 alert has been held back.',
    );
  });

  it('survives an unrecognised stored timezone', () => {
    expect(describeMute(muted({ timezone: 'Not/AZone' }))!.detail).toContain('since 18 Jul 2026');
  });
});
