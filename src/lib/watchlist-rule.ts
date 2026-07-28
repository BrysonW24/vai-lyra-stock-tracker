/**
 * Watch-rule persistence helpers (server-side).
 *
 * A watch rule with target_signal_score = 0 reads 'triggered' on EVERY hourly scan (signal_score >= 0
 * is always true - see workers/stock_scanner/watchlist_engine.py), so a user who typed only a ticker +
 * note got a false green 'buy-zone hit' they never configured. Treat an omitted / blank / 0 score as
 * "no explicit threshold" and fall back to a sane floor so a bare rule fires only on a genuine strong
 * setup. An explicit value in 1-100 is always honoured. (2026-07-27 audit V4 P1 fix.)
 *
 * Kept out of the route module because Next.js route files may not export non-handler symbols.
 */
export const DEFAULT_TARGET_SIGNAL_SCORE = 60;

export function resolveTargetSignalScore(raw: unknown): { value: number } | { error: string } {
  const hasExplicit = raw !== undefined && raw !== null && String(raw).trim() !== '';
  const explicit = hasExplicit ? parseFloat(String(raw)) : NaN;
  if (hasExplicit && (isNaN(explicit) || explicit < 0 || explicit > 100)) {
    return { error: 'targetSignalScore must be between 0 and 100' };
  }
  // 0 or blank -> the floor (a bare rule must not auto-trigger); an explicit 1-100 wins.
  return { value: hasExplicit && explicit > 0 ? explicit : DEFAULT_TARGET_SIGNAL_SCORE };
}
