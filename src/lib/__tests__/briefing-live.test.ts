import { describe, expect, it } from 'vitest';
import { briefingDayLabel, briefingFromRow, itemFromPayload } from '../briefing';

const item = (overrides: Record<string, unknown> = {}) => ({
  headline: 'Constellation (Nasdaq: CEG)',
  category: 'infrastructure',
  listed: true,
  exchange: 'Nasdaq',
  ticker: 'ceg',
  what_happened: 'Google signed a 20-year agreement for 890 MW.',
  why_it_matters: 'A concrete AI-power development.',
  risks: 'Construction and approvals.',
  not_disclosed: 'Contract pricing.',
  sources: [{ label: 'Constellation', url: 'https://www.constellationenergy.com/newsroom/x' }, { label: 'bad', url: 'javascript:alert(1)' }],
  lyra_symbols: ['CEG', 'CEG', 'nope!'],
  catch_up: false,
  ...overrides,
});

describe('briefing-live - the worker rows become the page, nothing invented', () => {
  it('maps a stored item and drops what is not a web address', () => {
    const parsed = itemFromPayload(item());
    expect(parsed).toEqual({
      headline: 'Constellation (Nasdaq: CEG)',
      category: 'infrastructure',
      listed: true,
      exchange: 'Nasdaq',
      ticker: 'CEG',
      whatHappened: 'Google signed a 20-year agreement for 890 MW.',
      whyItMatters: 'A concrete AI-power development.',
      risks: 'Construction and approvals.',
      notDisclosed: 'Contract pricing.',
      sources: [{ label: 'Constellation', url: 'https://www.constellationenergy.com/newsroom/x' }],
      lyraSymbols: ['CEG'],
      catchUp: false,
    });
  });

  it('refuses an item missing what a reader must see', () => {
    expect(itemFromPayload(item({ risks: '' }))).toBeNull();
    expect(itemFromPayload(item({ category: 'gossip' }))).toBeNull();
    expect(itemFromPayload(item({ sources: [{ label: 'x', url: 'ftp://nope' }] }))).toBeNull();
    expect(itemFromPayload('text')).toBeNull();
  });

  it('builds a briefing from a run row and skips rows with no delivered briefing', () => {
    const row = {
      started_at: '2026-10-07T09:20:00Z',
      finished_at: '2026-10-07T09:24:00Z',
      payload: { date: '2026-10-07', items: [item(), 'junk'], ipo_note: 'None tonight.', model: 'claude-opus-5-5', effort: 'high', searches: 14, fetches: 6, cost_usd: 1.04, removed: 1 },
    };
    const briefing = briefingFromRow(row);
    expect(briefing?.date).toBe('2026-10-07');
    expect(briefing?.generatedAt).toBe('2026-10-07T09:24:00Z');
    expect(briefing?.items).toHaveLength(1);
    expect(briefing).toMatchObject({ ipoNote: 'None tonight.', model: 'claude-opus-5-5', effort: 'high', searches: 14, pagesOpened: 6, costUsd: 1.04, removed: 1 });

    expect(briefingFromRow({ payload: { date: null, date_attempted: '2026-10-07', items: [item()] } })).toBeNull();
    expect(briefingFromRow({ payload: { date: '2026-10-07', items: [] } })).toBeNull();
    expect(briefingFromRow({ payload: null })).toBeNull();
  });

  it('labels the day without shifting it through a timezone', () => {
    expect(briefingDayLabel('2026-10-07')).toBe('Wed 7 Oct');
    expect(briefingDayLabel('junk')).toBe('junk');
  });
});
