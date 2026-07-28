/**
 * Scan-freshness read for the shell "Live / Stale" market-status badge.
 *
 * Hourly cadence; treat anything older than ~2x cadence as stale so a dead cron stops wearing a
 * confident green "Live" badge. Returns hours-since-scan so the label can say exactly how old the
 * data is. Pure and clock-injectable (pass `now` in tests) - it is UTC epoch math, so it is
 * timezone-agnostic by construction. Extracted from AppShell for behavioral coverage (2026-07-27
 * audit V3: shell freshness was untested).
 */
export const STALE_AFTER_HOURS = 2;

export function scanFreshness(finishedAt: string, now: number = Date.now()): { stale: boolean; hoursAgo: number } {
  const finished = new Date(finishedAt).getTime();
  if (!Number.isFinite(finished)) return { stale: true, hoursAgo: 0 };
  const hoursAgo = (now - finished) / 3_600_000;
  return { stale: hoursAgo > STALE_AFTER_HOURS, hoursAgo };
}
