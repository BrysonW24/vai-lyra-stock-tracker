import { describe, it, expect } from 'vitest';
import { scanFreshness, STALE_AFTER_HOURS } from '../scan-freshness';

/**
 * 2026-07-27 audit V3: the shell "Live / Stale" badge freshness read was untested. The invariant a
 * dead cron must not defeat: anything older than STALE_AFTER_HOURS reads stale, so a silent scan
 * failure stops wearing a confident green badge. Clock is injected - no machine-time dependency.
 */
const NOW = 1_700_000_000_000; // fixed epoch ms
const hoursAgoIso = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

describe('scanFreshness', () => {
  it('reads fresh just under the stale window', () => {
    const r = scanFreshness(hoursAgoIso(1), NOW);
    expect(r.stale).toBe(false);
    expect(r.hoursAgo).toBeCloseTo(1, 5);
  });

  it('reads stale past the window', () => {
    const r = scanFreshness(hoursAgoIso(3), NOW);
    expect(r.stale).toBe(true);
    expect(r.hoursAgo).toBeCloseTo(3, 5);
  });

  it('is not stale exactly at the boundary, stale just beyond it', () => {
    expect(scanFreshness(hoursAgoIso(STALE_AFTER_HOURS), NOW).stale).toBe(false);
    expect(scanFreshness(hoursAgoIso(STALE_AFTER_HOURS + 0.01), NOW).stale).toBe(true);
  });

  it('treats an unparseable timestamp as stale (never a false-fresh green)', () => {
    const r = scanFreshness('not-a-date', NOW);
    expect(r.stale).toBe(true);
    expect(r.hoursAgo).toBe(0);
  });
});
