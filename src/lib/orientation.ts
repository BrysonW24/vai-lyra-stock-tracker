/**
 * Orientation - a TRUE two-sided read of what is happening to the names you care about: the ones you
 * HOLD and the ones you are interested in (watchlist). It splits the live news flow into
 * OPPORTUNITIES (the good) and RISKS (the bad) so you always see both sides at once, weighted toward
 * the names where you have money on the line.
 *
 * This is the "consider poor news" ask, generalised: not just downside, and not just holdings - a
 * balanced orientation across holdings and interests, good and bad. Deterministic and pure. It
 * surfaces and classifies published items by their existing sentiment; it never writes the news, and
 * it never issues a buy/sell call.
 */
import type { IntelligenceItem, Relevance } from '@/lib/intelligence';

export type OrientationSide = 'opportunity' | 'risk';

export interface OrientationItem {
  id: string;
  symbol: string;
  side: OrientationSide;
  /** You own this name - the news matters most here. */
  held: boolean;
  /** You are watching this name (on your watchlist / interests). */
  watched: boolean;
  headline: string;
  summary: string;
  sourceName: string;
  sourceType: IntelligenceItem['sourceType'];
  relevance: Relevance;
  publishedAt: string;
  /** Deterministic ranking weight (higher = surfaced first). */
  weight: number;
}

export interface Orientation {
  opportunities: OrientationItem[];
  risks: OrientationItem[];
  /** Distinct held names touched by news. */
  heldNamesWithNews: number;
  /** Distinct watched names touched by news. */
  watchedNamesWithNews: number;
}

const RELEVANCE_WEIGHT: Record<Relevance, number> = { high: 3, medium: 2, low: 1 };

const norm = (s: string) => s.toUpperCase();

/**
 * Build the two-sided orientation from the news flow and the user's names. A news item counts only
 * if it touches a held or watched symbol; positive sentiment lands as an opportunity, negative as a
 * risk, neutral is dropped (no signal). Held names weight double - that is where being wrong costs
 * money. Ties break toward more recent items.
 */
export function computeOrientation(input: {
  news: IntelligenceItem[];
  heldSymbols: string[];
  watchedSymbols: string[];
  limitPerSide?: number;
}): Orientation {
  const held = new Set(input.heldSymbols.map(norm));
  const watched = new Set(input.watchedSymbols.map(norm));
  const limit = input.limitPerSide ?? 4;

  const opportunities: OrientationItem[] = [];
  const risks: OrientationItem[] = [];
  const heldHit = new Set<string>();
  const watchedHit = new Set<string>();

  for (const item of input.news ?? []) {
    if (item.sentiment === 'neutral') continue;
    // Pick the most relevant matching ticker: a held name beats a merely-watched one.
    const heldMatch = item.tickers.map(norm).find((t) => held.has(t));
    const watchMatch = item.tickers.map(norm).find((t) => watched.has(t));
    const symbol = heldMatch ?? watchMatch;
    if (!symbol) continue;

    const isHeld = Boolean(heldMatch);
    const isWatched = Boolean(watchMatch);
    if (isHeld) heldHit.add(symbol);
    else if (isWatched) watchedHit.add(symbol);

    const weight = RELEVANCE_WEIGHT[item.relevance] * (isHeld ? 2 : 1);
    const oi: OrientationItem = {
      id: item.id,
      symbol,
      side: item.sentiment === 'positive' ? 'opportunity' : 'risk',
      held: isHeld,
      watched: isWatched && !isHeld,
      headline: item.headline,
      summary: item.summary,
      sourceName: item.sourceName,
      sourceType: item.sourceType,
      relevance: item.relevance,
      publishedAt: item.publishedAt,
      weight,
    };
    (oi.side === 'opportunity' ? opportunities : risks).push(oi);
  }

  const rank = (a: OrientationItem, b: OrientationItem) =>
    b.weight - a.weight || (a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0);

  return {
    opportunities: opportunities.sort(rank).slice(0, limit),
    risks: risks.sort(rank).slice(0, limit),
    heldNamesWithNews: heldHit.size,
    watchedNamesWithNews: watchedHit.size,
  };
}
