/**
 * The facts a written update starts from. Pins the shape the worker's `build_facts` reads, the
 * one-session rule (the day most names are on; a lagging name is left out), the coverage floor, and
 * that the same facts always hash the same.
 */
import { describe, expect, it } from 'vitest';
import type { LiveSession } from '@/lib/live-signals';
import { assembleFacts, hashRows, listedNames, rowFor, sessionOf, MIN_COVERAGE } from '../facts';

const bar = (time: string, close: number, score: number, status: LiveSession['session']['status'], volumeRatio: number | null = 1.2) => ({ time, close, score, status, volumeRatio });

function live(symbol: string, day = '2026-11-05', priorDay = '2026-11-04'): LiveSession {
  return {
    symbol,
    session: bar(`${day}T20:00:00.000Z`, 123.456789, 61.2345, 'watchlist_setup'),
    prior: bar(`${priorDay}T20:00:00.000Z`, 120.5, 55.5, 'no_signal', null),
  };
}

describe('rowFor', () => {
  it("writes exactly the columns the worker's build_facts reads, newest first", () => {
    expect(rowFor(live('nvda'), 'ai_infrastructure')).toEqual({
      symbol: 'NVDA',
      category: 'ai_infrastructure',
      stock_signals: [
        { candle_time: '2026-11-05T20:00:00.000Z', signal_score: 61.23, signal_status: 'watchlist_setup', volume_ratio: 1.2 },
        { candle_time: '2026-11-04T20:00:00.000Z', signal_score: 55.5, signal_status: 'no_signal', volume_ratio: null },
      ],
      stock_candles: [
        { candle_time: '2026-11-05T20:00:00.000Z', close: 123.4568 },
        { candle_time: '2026-11-04T20:00:00.000Z', close: 120.5 },
      ],
    });
  });
});

describe('assembleFacts', () => {
  const names = (count: number) => Array.from({ length: count }, (_, i) => ({ symbol: `T${i}`, category: 'software' }));

  it('keeps the names on the session most names are on, sorted, and hashes them', () => {
    const computed = names(10).map((name, i) => ({ name, live: i === 3 ? live(name.symbol, '2026-11-04', '2026-11-03') : live(name.symbol) }));
    const result = assembleFacts(computed, '2026-11-06T09:05:00.000Z');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.facts.session).toBe('2026-11-05');
    expect(result.facts.listed).toBe(10);
    expect(result.facts.rows.map((row) => row.symbol)).toEqual(['T0', 'T1', 'T2', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9']); // T3 lagged a day: left out
    expect(result.facts.hash).toBe(hashRows(result.facts.rows));
    expect(result.facts.hash).toMatch(/^[0-9a-f]{64}$/);
    // The same facts hash the same whatever order they were computed in.
    const shuffled = assembleFacts([...computed].reverse(), '2026-11-06T09:05:00.000Z');
    expect(shuffled.ok && shuffled.facts.hash).toBe(result.facts.hash);
  });

  it('refuses a session too few names are on', () => {
    const computed = names(10).map((name, i) => ({ name, live: i < 5 ? live(name.symbol) : null }));
    expect(assembleFacts(computed, '2026-11-06T09:05:00.000Z')).toEqual({ ok: false, reason: 'thin', covered: 5, listed: 10 });
    expect(MIN_COVERAGE).toBe(0.6);
  });

  it('refuses when nothing could be computed', () => {
    expect(assembleFacts(names(3).map((name) => ({ name, live: null })), 'now')).toEqual({ ok: false, reason: 'no_prices', covered: 0, listed: 3 });
  });

  it('places a bar on its New York day', () => {
    expect(sessionOf(live('A', '2026-11-05'))).toBe('2026-11-05');
    // 02:30 UTC is still the 5th in New York.
    expect(sessionOf({ ...live('A'), session: bar('2026-11-06T02:30:00.000Z', 1, 1, 'no_signal') })).toBe('2026-11-05');
  });
});

describe('listedNames', () => {
  it('is the scan list the no-account screen shows, with each name in its group', () => {
    const names = listedNames();
    expect(names.length).toBeGreaterThanOrEqual(60);
    expect(names.find((name) => name.symbol === 'NVDA')).toEqual({ symbol: 'NVDA', category: 'ai_infrastructure' });
    expect(new Set(names.map((name) => name.symbol)).size).toBe(names.length);
  });
});
