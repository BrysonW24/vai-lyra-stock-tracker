/**
 * The one call a page makes: the live snapshot, read. Never throws - an unreachable ABS or RBA
 * comes back as an empty or partial read that says so (see EconomyRead.empty / .missing).
 */
import { readEconomy } from './read';
import { getEconomySnapshot } from './snapshot';
import type { EconomyRead } from './types';

export async function getEconomyRead(): Promise<EconomyRead> {
  try {
    const snapshot = await getEconomySnapshot();
    return readEconomy(snapshot.indicators);
  } catch {
    // getEconomySnapshot already degrades per series; this guards the unexpected (a cache
    // backend bug, a parse edge) so the page still renders its honest empty state.
    return readEconomy([]);
  }
}
