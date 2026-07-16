/**
 * Symbol -> theme resolver for the twin, built from the same generated theme data the rest of the
 * app uses. Lets the twin roll a user's per-symbol activity up into theme affinities without any
 * network or per-row DB lookup.
 */
import themeCompanies from '@/lib/generated/theme-companies.json';
import themes from '@/lib/generated/themes.json';

const SLUG_TO_NAME = new Map(
  (themes as Array<{ slug: string; name: string }>).map((t) => [t.slug, t.name]),
);
const SYMBOL_TO_SLUG = new Map(
  (themeCompanies as Array<{ symbol: string; theme: string }>).map((c) => [c.symbol.toUpperCase(), c.theme]),
);

/** Human theme name for a symbol, or null when the symbol is not in a tracked theme. */
export function themeForSymbol(symbol: string | null | undefined): string | null {
  if (!symbol) return null;
  const slug = SYMBOL_TO_SLUG.get(symbol.toUpperCase());
  if (!slug) return null;
  return SLUG_TO_NAME.get(slug) ?? slug;
}

/** Human theme name for a theme slug (e.g. a theme_open capture carries the slug). */
export function themeNameForSlug(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return SLUG_TO_NAME.get(slug) ?? slug;
}
