/**
 * The book a free model may be shown. A no-account reader's holdings live in their browser; the
 * brief card builds its lines from them. Tapping "plain English" hands the brief to somebody
 * else's computer, so without their say-so only the market lines go.
 */
import { describe, expect, it } from 'vitest';
import type { DashboardData } from '@/types/scanner';
import { buildDailyBrief } from '@/lib/daily-brief';
import { demoDashboardData } from '@/lib/demo-data';
import { demoMarketContext } from '@/lib/market-context';
import { briefForFreeModel } from '../share-book';

const market = { ...demoMarketContext, source: 'sample' as const };
const full = buildDailyBrief(demoDashboardData, market);
const marketOnly = buildDailyBrief({ ...demoDashboardData, portfolio: [], watchlist: [] } as DashboardData, market);

describe('briefForFreeModel', () => {
  it('has a book in the full brief to keep out, and none in the market brief', () => {
    // The sample dashboard carries holdings and a watchlist, so this test would notice if the
    // brief stopped mentioning them (and the check below stopped meaning anything).
    expect(full.headline).toContain('your book');
    expect(full.lines.some((line) => line.label === 'Your book' || line.label === 'Risk watch' || line.label === 'Watchlist')).toBe(true);

    expect(marketOnly.headline).not.toContain('your book');
    expect(marketOnly.lines.map((line) => line.label)).toEqual(['Market', 'Lead setup', 'Reminder']);
    const held = new Set(demoDashboardData.portfolio.map((holding) => holding.symbol));
    const lead = marketOnly.lines.find((line) => line.label === 'Lead setup');
    for (const line of marketOnly.lines) {
      if (line === lead) continue; // the lead setup comes from the scan, whoever holds it
      for (const symbol of held) expect(line.text).not.toContain(symbol);
    }
  });

  it('sends a no-account reader only the market brief until they include their book', () => {
    expect(briefForFreeModel(full, marketOnly, { soloMode: true, shareBook: false })).toBe(marketOnly);
    expect(briefForFreeModel(full, marketOnly, { soloMode: true, shareBook: true })).toBe(full);
  });

  it('sends an account holder the brief as shown: their book is covered by the privacy policy', () => {
    expect(briefForFreeModel(full, marketOnly, { soloMode: false, shareBook: false })).toBe(full);
  });
});
