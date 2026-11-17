/**
 * Period helpers. The ABS labels quarters "2026-Q2" and months "2026-09"; the RBA's monthly
 * rows become "2026-10". Comparing those as raw strings is wrong ("2026-Q2" sorts after
 * "2026-09" because 'Q' > '0'), so anything that compares periods across frequencies goes
 * through `periodEndMonth` first.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const QUARTER = /^(\d{4})-Q([1-4])$/;
const MONTH = /^(\d{4})-(\d{2})$/;

/** The last month a period covers, as "yyyy-mm". Unknown shapes pass through unchanged. */
export function periodEndMonth(period: string): string {
  const q = QUARTER.exec(period);
  if (q) return `${q[1]}-${String(Number(q[2]) * 3).padStart(2, '0')}`;
  return period;
}

/** "2026-Q2" -> "June quarter 2026"; "2026-09" -> "September 2026". The ABS's own phrasing. */
export function periodLabel(period: string): string {
  const q = QUARTER.exec(period);
  if (q) return `${MONTHS[Number(q[2]) * 3 - 1]} quarter ${q[1]}`;
  const m = MONTH.exec(period);
  if (m) {
    const month = MONTHS[Number(m[2]) - 1];
    if (month) return `${month} ${m[1]}`;
  }
  return period;
}

/** The same period a year earlier: "2026-Q2" -> "2025-Q2", "2026-09" -> "2025-09". */
export function yearEarlier(period: string): string | null {
  const q = QUARTER.exec(period);
  if (q) return `${Number(q[1]) - 1}-Q${q[2]}`;
  const m = MONTH.exec(period);
  if (m) return `${Number(m[1]) - 1}-${m[2]}`;
  return null;
}

/** The latest of a set of periods of ANY frequency, compared by the month each one ends. */
export function latestPeriod(periods: string[]): string {
  let best = '';
  for (const p of periods) {
    if (!p) continue;
    if (!best || periodEndMonth(p) > periodEndMonth(best)) best = p;
  }
  return best;
}
