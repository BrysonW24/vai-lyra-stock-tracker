/**
 * The figures-only answer: what chat says when no model can answer. Pins that it is built from
 * scanner rows alone, names the tickers the question asked about (else the reader's own book, else
 * the day's brief, else the top of the scan), and never prints sample data as today's.
 */
import { describe, expect, it } from 'vitest';
import type { DashboardData, SignalRow } from '@/types/scanner';
import type { DailyBrief } from '@/lib/daily-brief';
import { FIGURES_ONLY_CLOSE, FIGURES_ONLY_LEAD, figuresOnlyAnswer } from '../figures-answer';

const signal = (symbol: string, score: number, extra: Partial<SignalRow> = {}): SignalRow =>
  ({ symbol, score, scoreDelta: 6, status: 'strong_setup', priceChange1d: -4.4, rsi: 41.2, volumeRatio: 1.34, ...extra }) as SignalRow;

const DATA = {
  signals: [signal('NVDA', 82), signal('AMD', 48, { status: 'weakening', scoreDelta: -37, priceChange1d: -17.3 }), signal('CRWD', 91, { status: 'strong_setup' }), signal('MSFT', 60, { status: 'watchlist_setup' })],
  portfolio: [],
  watchlist: [],
} as unknown as DashboardData;

const BRIEF: DailyBrief = {
  headline: 'Risk-off: 60 of 61 names fell.',
  regimeLabel: 'Risk-off',
  regimeTone: 'neg',
  lines: [
    { label: 'Breadth', text: '1 up, 60 down', tone: 'neg' },
    { label: 'Setups', text: '0 strong, 7 on watch', tone: 'warn' },
  ],
};

describe('figuresOnlyAnswer', () => {
  it('prints the engine figures for the tickers the question named', () => {
    const answer = figuresOnlyAnswer('How are NVDA and AMD looking after that fall?', DATA, BRIEF);
    expect(answer.split('\n')).toEqual([
      FIGURES_ONLY_LEAD,
      '- NVDA: score 82 (+6), strong setup, -4.4% on the day, RSI 41, volume 1.3x',
      '- AMD: score 48 (-37), weakening, -17.3% on the day, RSI 41, volume 1.3x',
      FIGURES_ONLY_CLOSE,
    ]);
  });

  it("falls back to the reader's own book when the question names no ticker", () => {
    const answer = figuresOnlyAnswer('how is my book doing?', DATA, BRIEF, ['crwd', 'QQQ', 'MSFT']);
    expect(answer).toContain('- CRWD: score 91');
    expect(answer).toContain('- MSFT: score 60 (+6), watchlist setup');
    expect(answer).not.toContain('QQQ'); // held, but not on the scan: nothing is invented for it
    expect(answer).not.toContain('NVDA');
  });

  it("uses the day's brief when there is no ticker and no book", () => {
    const lines = figuresOnlyAnswer('what happened today?', DATA, BRIEF).split('\n');
    expect(lines.slice(1, 4)).toEqual(['Risk-off: 60 of 61 names fell.', '- Breadth: 1 up, 60 down', '- Setups: 0 strong, 7 on watch']);
  });

  it('shows the top of the scan, not sample data, when the brief is not live', () => {
    const answer = figuresOnlyAnswer('what happened today?', DATA, null);
    expect(answer).toContain('The highest scores on the scan right now:');
    expect(answer.indexOf('CRWD')).toBeLessThan(answer.indexOf('NVDA'));
    expect(answer).not.toContain('Risk-off');
    expect(figuresOnlyAnswer('anything?', { ...DATA, signals: [] } as DashboardData, null)).toContain('Nothing on the dashboard matches');
  });

  it('caps the list and uses no em dash', () => {
    const many = { ...DATA, signals: ['NVDA', 'AMD', 'CRWD', 'MSFT', 'ORCL', 'ADBE'].map((symbol, index) => signal(symbol, 90 - index)) } as DashboardData;
    const answer = figuresOnlyAnswer('NVDA AMD CRWD MSFT ORCL ADBE', many, null);
    expect(answer.split('\n').filter((line) => line.startsWith('- ')).length).toBe(4);
    expect(answer).not.toMatch(/[—–]/);
  });
});
