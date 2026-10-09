import { describe, expect, it } from 'vitest';
import { briefingDayLabel, briefingFromRow, briefingSections, itemFromPayload } from '../briefing';

const item = (overrides: Record<string, unknown> = {}) => ({
  headline: 'Constellation (Nasdaq: CEG)',
  theme: 'nuclear-uranium',
  desk: 'news',
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
      theme: 'nuclear-uranium',
      desk: 'news',
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

  it('refuses an item missing what a reader must see - but a label is never a reason to lose one', () => {
    expect(itemFromPayload(item({ risks: '' }))).toBeNull();
    expect(itemFromPayload(item({ theme: 'gossip', desk: 'rumour' }))).toMatchObject({ theme: 'other', desk: 'news' });
    expect(itemFromPayload(item({ theme: undefined, desk: undefined, category: 'infrastructure' }))).toMatchObject({ theme: 'other', desk: 'news' }); // a row from before v0.136.0
    expect(itemFromPayload(item({ sources: [{ label: 'x', url: 'ftp://nope' }] }))).toBeNull();
    expect(itemFromPayload('text')).toBeNull();
  });

  it('builds a briefing from a run row and skips rows with no delivered briefing', () => {
    const row = {
      started_at: '2026-10-07T09:20:00Z',
      finished_at: '2026-10-07T09:24:00Z',
      payload: {
        date: '2026-10-07',
        items: [item(), 'junk'],
        desk_notes: { ipo: 'None tonight.', venture: '', government: 'Quiet on contracts.', small_cap: 7 },
        model: 'claude-opus-5-5',
        effort: 'high',
        searches: 14,
        fetches: 6,
        cost_usd: 1.04,
        removed: 1,
      },
    };
    const briefing = briefingFromRow(row);
    expect(briefing?.date).toBe('2026-10-07');
    expect(briefing?.generatedAt).toBe('2026-10-07T09:24:00Z');
    expect(briefing?.items).toHaveLength(1);
    expect(briefing).toMatchObject({
      deskNotes: { ipo: 'None tonight.', venture: '', government: 'Quiet on contracts.', small_cap: '' },
      model: 'claude-opus-5-5',
      effort: 'high',
      searches: 14,
      pagesOpened: 6,
      costUsd: 1.04,
      removed: 1,
    });
    expect(briefingFromRow({ payload: { date: '2026-10-07', items: [item()], ipo_note: 'Old style.' } })?.deskNotes.ipo).toBe('Old style.');

    expect(briefingFromRow({ payload: { date: null, date_attempted: '2026-10-07', items: [item()] } })).toBeNull();
    expect(briefingFromRow({ payload: { date: '2026-10-07', items: [] } })).toBeNull();
    expect(briefingFromRow({ payload: null })).toBeNull();
  });

  it('groups the page like the messages: themes with items in the spine order, then every desk', () => {
    const briefing = briefingFromRow({
      payload: {
        date: '2026-10-07',
        items: [
          item({ headline: 'Rocket Lab (Nasdaq: RKLB)', theme: 'space-economy', ticker: 'RKLB' }),
          item({ headline: 'OpenAI', theme: 'agi-infrastructure', listed: false, ticker: '' }),
          item({ headline: 'Cerebras files its S-1', theme: 'semiconductors', desk: 'ipo', listed: false, ticker: '' }),
          item(),
        ],
        desk_notes: { government: 'Quiet on contracts.' },
      },
    });
    expect(briefing).not.toBeNull();
    const sections = briefingSections(briefing!);
    expect(sections.map((section) => `${section.kind}:${section.id}:${section.items.map((i) => i.headline).join('+')}:${section.note}`)).toEqual([
      'theme:agi-infrastructure:OpenAI:',
      'theme:nuclear-uranium:Constellation (Nasdaq: CEG):',
      'theme:space-economy:Rocket Lab (Nasdaq: RKLB):',
      'desk:ipo:Cerebras files its S-1:',
      'desk:venture::Nothing new found tonight.',
      'desk:government::Quiet on contracts.',
      'desk:small_cap::Nothing new found tonight.',
    ]);
  });

  it('labels the day without shifting it through a timezone', () => {
    expect(briefingDayLabel('2026-10-07')).toBe('Wed 7 Oct');
    expect(briefingDayLabel('junk')).toBe('junk');
  });
});
