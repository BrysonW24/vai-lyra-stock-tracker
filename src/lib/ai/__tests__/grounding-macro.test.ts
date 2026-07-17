/**
 * The MACRO grounding block (v0.57.0). The chat UI suggests macro questions
 * ("what regime are we in?") that the model previously could not answer from grounded
 * fact - the word "macro" appeared only in a comment. These pin the contract:
 * live snapshots ground the answer, sample snapshots are LABELED so the model must
 * disclose them, and no market argument means no macro claim at all.
 */
import { describe, expect, it } from 'vitest';
import { buildGrounding } from '../chat-context';
import { demoDashboardData } from '@/lib/demo-data';
import { demoMarketContext, type MarketContextSnapshot } from '@/lib/market-context';

const NOW = new Date('2026-07-18T00:30:00Z');

function liveMarket(): MarketContextSnapshot {
  return {
    ...demoMarketContext,
    source: 'live',
    regime: 'risk_off',
    vixPrice: 26.4,
    vixChangePct: 8.1,
    fearGreedIndex: 24,
    fearGreedLabel: 'Extreme Fear',
  };
}

describe('buildGrounding - MACRO block', () => {
  it('grounds live macro facts with the live tag', () => {
    const text = buildGrounding(demoDashboardData, NOW, liveMarket());
    expect(text).toContain('MACRO (live hourly snapshot):');
    expect(text).toContain('regime risk off');
    expect(text).toContain('VIX 26.4');
    expect(text).toContain('Fear&Greed 24 (Extreme Fear)');
  });

  it('labels sample snapshots so the model must disclose them', () => {
    const text = buildGrounding(demoDashboardData, NOW, { ...demoMarketContext, source: 'sample' });
    expect(text).toContain('MACRO (SAMPLE values');
    expect(text).toContain('say these are sample numbers');
    expect(text).not.toContain('MACRO (live hourly snapshot)');
  });

  it('omits the macro block entirely when no market snapshot is passed', () => {
    const text = buildGrounding(demoDashboardData, NOW);
    expect(text).not.toContain('MACRO (');
  });

  it('drops null fields instead of rendering them', () => {
    const market = { ...liveMarket(), yield10y: null, sp500ChangePct: null };
    const text = buildGrounding(demoDashboardData, NOW, market);
    expect(text).not.toContain('10Y');
    expect(text).not.toContain('null');
  });
});
