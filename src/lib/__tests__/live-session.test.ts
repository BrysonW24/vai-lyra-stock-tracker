/**
 * buildLiveSession - one name's last COMPLETED session, from the same price history as the screen.
 * Pins the one thing that matters most: while the market is open, Yahoo's newest daily bar is
 * today's moving bar, and a read of "the session" must never be written from it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildLiveSession, newYorkDay } from '@/lib/live-signals';

const OPEN_UTC_SECONDS = (13 * 60 + 30) * 60; // 09:30 New York in summer

/** A year of daily bars, each stamped at its New York open, ending on `lastDay` (a weekday, YYYY-MM-DD). */
function yahooChart(lastDay: string, options: { periodDay?: string; closes?: (i: number) => number } = {}) {
  const end = Date.parse(`${lastDay}T00:00:00Z`) / 1000 + OPEN_UTC_SECONDS;
  const timestamp: number[] = [];
  for (let i = 259; i >= 0; i--) timestamp.push(end - i * 86_400);
  const closes = timestamp.map((_, i) => (options.closes ? options.closes(i) : 100 + 10 * Math.sin(i / 9) + i * 0.05));
  const periodStart = options.periodDay ? Date.parse(`${options.periodDay}T00:00:00Z`) / 1000 + OPEN_UTC_SECONDS : null;
  return {
    chart: {
      result: [
        {
          timestamp,
          meta: periodStart ? { currentTradingPeriod: { regular: { start: periodStart, end: periodStart + 6.5 * 3600 } } } : {},
          indicators: { quote: [{ close: closes, high: closes.map((c) => c + 1), low: closes.map((c) => c - 1), volume: closes.map(() => 1_000_000) }] },
        },
      ],
    },
  };
}

function stubYahoo(payload: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => payload })));
}

describe('buildLiveSession', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the newest bar once its session has closed, and places it on its New York day', async () => {
    stubYahoo(yahooChart('2026-11-05', { periodDay: '2026-11-05' }));
    // 21:30 UTC on 5 Nov: the 16:00 New York close plus 30 minutes.
    const live = await buildLiveSession('NVDA', Date.parse('2026-11-05T21:30:00Z'));
    expect(live).not.toBeNull();
    expect(newYorkDay(Date.parse(live!.session.time) / 1000)).toBe('2026-11-05');
    expect(newYorkDay(Date.parse(live!.prior.time) / 1000)).toBe('2026-11-04');
    expect(live!.session.close).toBeGreaterThan(0);
    expect(['strong_setup', 'watchlist_setup', 'weakening', 'invalidated', 'no_signal']).toContain(live!.session.status);
  });

  it('steps back to the bar before while the newest bar is still trading', async () => {
    stubYahoo(yahooChart('2026-11-05', { periodDay: '2026-11-05' }));
    // 15:00 UTC on 5 Nov: an hour and a half into the session.
    const live = await buildLiveSession('NVDA', Date.parse('2026-11-05T15:00:00Z'));
    expect(newYorkDay(Date.parse(live!.session.time) / 1000)).toBe('2026-11-04');
    expect(newYorkDay(Date.parse(live!.prior.time) / 1000)).toBe('2026-11-03');
  });

  it('does not trust a bar until a few minutes after its close', async () => {
    stubYahoo(yahooChart('2026-11-05', { periodDay: '2026-11-05' }));
    const atTheBell = await buildLiveSession('NVDA', Date.parse('2026-11-05T20:02:00Z'));
    expect(newYorkDay(Date.parse(atTheBell!.session.time) / 1000)).toBe('2026-11-04');
    const settled = await buildLiveSession('NVDA', Date.parse('2026-11-05T20:12:00Z'));
    expect(newYorkDay(Date.parse(settled!.session.time) / 1000)).toBe('2026-11-05');
  });

  it("falls back to a full session's length when Yahoo gives no trading period", async () => {
    stubYahoo(yahooChart('2026-11-05'));
    // Stamped at the open; the bar is trusted 6.5 hours plus settling later - 20:10 UTC - not before.
    expect(newYorkDay(Date.parse((await buildLiveSession('NVDA', Date.parse('2026-11-05T19:00:00Z')))!.session.time) / 1000)).toBe('2026-11-04');
    expect(newYorkDay(Date.parse((await buildLiveSession('NVDA', Date.parse('2026-11-06T09:05:00Z')))!.session.time) / 1000)).toBe('2026-11-05');
  });

  it('gives the morning job the previous day: the current period is the session about to open', async () => {
    // 09:05 UTC on Friday 6 Nov: Yahoo calls Friday's session current; the newest bar is Thursday's.
    stubYahoo(yahooChart('2026-11-05', { periodDay: '2026-11-06' }));
    const live = await buildLiveSession('NVDA', Date.parse('2026-11-06T09:05:00Z'));
    expect(newYorkDay(Date.parse(live!.session.time) / 1000)).toBe('2026-11-05');
  });

  it('returns null without prices, without timestamps, or with too short a history', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));
    expect(await buildLiveSession('NVDA')).toBeNull();
    const noStamps = yahooChart('2026-11-05');
    noStamps.chart.result[0].timestamp = [];
    stubYahoo(noStamps);
    expect(await buildLiveSession('NVDA', Date.parse('2026-11-06T09:05:00Z'))).toBeNull();
  });

  it('scores the session and the one before it like the screen does', async () => {
    stubYahoo(yahooChart('2026-11-05', { periodDay: '2026-11-05' }));
    const live = await buildLiveSession('NVDA', Date.parse('2026-11-05T21:30:00Z'));
    expect(live!.session.score).toBeGreaterThanOrEqual(0);
    expect(live!.session.score).toBeLessThanOrEqual(100);
    expect(live!.prior.score).toBeGreaterThanOrEqual(0);
    expect(typeof live!.session.volumeRatio).toBe('number');
  });
});

describe('newYorkDay', () => {
  it('turns an instant into the New York calendar day it falls on', () => {
    expect(newYorkDay(Date.parse('2026-11-05T20:00:00Z') / 1000)).toBe('2026-11-05'); // 15:00 New York
    expect(newYorkDay(Date.parse('2026-11-06T02:30:00Z') / 1000)).toBe('2026-11-05'); // 21:30 New York
    expect(newYorkDay(Date.parse('2026-11-06T05:30:00Z') / 1000)).toBe('2026-11-06'); // 00:30 New York
  });
});
