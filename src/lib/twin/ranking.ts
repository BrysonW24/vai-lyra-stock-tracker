/**
 * Twin-affinity ranking - a STABLE tiebreak layered on top of the deterministic score. Doctrine:
 * the score still gates what qualifies and its order; affinity only reorders names the engine scored
 * EQUALLY. It can never promote a lower-scored name above a higher-scored one, and it never removes a
 * name (the anti-bubble duty - personalisation raises attention, it never hides risk). Pure + tested.
 */
import type { TwinProfile } from '@/lib/twin/model';
import { themeForSymbol } from '@/lib/twin/themes';

export interface AffinityWeights {
  symbols: Map<string, number>;
  themes: Map<string, number>;
}

/** How much a symbol's own affinity outweighs its theme's (a symbol you touch beats a theme you browse). */
const THEME_AFFINITY_WEIGHT = 0.5;

export function affinityWeightsFrom(
  profile: Pick<TwinProfile, 'symbols' | 'themes'> | null | undefined,
): AffinityWeights {
  const symbols = new Map<string, number>();
  const themes = new Map<string, number>();
  for (const s of profile?.symbols ?? []) symbols.set(s.key.toUpperCase(), s.weight);
  for (const t of profile?.themes ?? []) themes.set(t.key, t.weight);
  return { symbols, themes };
}

/** The user's affinity for a symbol: its own weight plus a softer share of its theme's weight. */
export function affinityFor(symbol: string, w: AffinityWeights): number {
  const sym = symbol.toUpperCase();
  const symW = w.symbols.get(sym) ?? 0;
  const theme = themeForSymbol(sym);
  const themeW = theme ? w.themes.get(theme) ?? 0 : 0;
  return symW + THEME_AFFINITY_WEIGHT * themeW;
}

/**
 * Personalise a list by applying affinity as a tiebreak on top of the primary (deterministic) score.
 * Returns a NEW array; the input is untouched. Items with different primary scores keep their order;
 * only equal-primary items are reordered by affinity, then by original position (stable).
 */
export function applyAffinityTiebreak<T>(
  items: readonly T[],
  primary: (t: T) => number,
  affinity: (t: T) => number,
): T[] {
  return items
    .map((item, index) => ({ item, index, p: primary(item), a: affinity(item) }))
    .sort((x, y) => y.p - x.p || y.a - x.a || x.index - y.index)
    .map((x) => x.item);
}
