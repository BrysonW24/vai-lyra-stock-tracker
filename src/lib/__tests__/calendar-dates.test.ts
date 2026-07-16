import { describe, expect, it } from 'vitest';
import type { SignalRow } from '@/types/scanner';
import {
  DEMO_ANCHOR_ISO,
  anchorCalendarEvents,
  daysUntil,
  getDemoCalendarEvents,
  eventRiskForTicker,
  type CalendarEvent,
} from '../calendar';

const TODAY = new Date('2026-07-16T12:00:00Z');

const ev = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'test-event',
  date: '2026-07-20',
  type: 'earnings',
  ticker: 'NVDA',
  title: 'Test event',
  importance: 'high',
  ...over,
});

const signal = (symbol: string, status: string) => ({ symbol, status }) as unknown as SignalRow;

describe('daysUntil', () => {
  it('counts from the injected today, not a hardcoded anchor', () => {
    expect(daysUntil('2026-07-16', TODAY)).toBe(0);
    expect(daysUntil('2026-07-17', TODAY)).toBe(1);
    expect(daysUntil('2026-07-10', TODAY)).toBe(-6);
  });

  it('defaults to the real clock - the frozen 2026-06-03 today is gone', () => {
    // Whatever "now" is when this runs, today must be 0 days away.
    expect(daysUntil(new Date().toISOString().slice(0, 10))).toBe(0);
  });
});

describe('anchorCalendarEvents', () => {
  it('shifts every event so the anchor lands on today, preserving gaps', () => {
    const events = [ev({ date: '2026-06-04' }), ev({ id: 'b', date: '2026-06-11' })];
    const shifted = anchorCalendarEvents(events, '2026-06-03', '2026-07-16');
    expect(shifted[0].date).toBe('2026-07-17');
    expect(shifted[1].date).toBe('2026-07-24');
    // 7-day gap preserved
    expect(daysUntil(shifted[1].date, new Date(shifted[0].date + 'T00:00:00Z'))).toBe(7);
  });

  it('is a no-op when today IS the anchor', () => {
    const events = [ev({})];
    expect(anchorCalendarEvents(events, '2026-06-03', '2026-06-03')).toBe(events);
  });

  it('shifts backwards too', () => {
    const shifted = anchorCalendarEvents([ev({ date: '2026-06-10' })], '2026-06-03', '2026-06-01');
    expect(shifted[0].date).toBe('2026-06-08');
  });
});

describe('getDemoCalendarEvents (re-anchored per call, never per process)', () => {
  it('always has upcoming events - the sample calendar can never age out', () => {
    const now = new Date();
    const upcoming = getDemoCalendarEvents(now).filter((e) => daysUntil(e.date, now) >= 0);
    expect(upcoming.length).toBeGreaterThan(10);
  });

  it('stays inside a ~month window from the injected now', () => {
    const now = new Date();
    for (const e of getDemoCalendarEvents(now)) {
      const days = daysUntil(e.date, now);
      expect(days).toBeGreaterThanOrEqual(0);
      expect(days).toBeLessThanOrEqual(40);
    }
  });

  it('re-anchors per call - a long-lived process asking weeks later still gets a fresh window', () => {
    // This is the property a module-level const CANNOT have: the anchor follows the
    // caller's clock, so a server up for a month serves the same fresh window as a
    // cold start.
    const early = new Date('2026-07-16T12:00:00Z');
    const late = new Date('2026-08-20T12:00:00Z');
    const earlyDays = getDemoCalendarEvents(early).map((e) => daysUntil(e.date, early));
    const lateDays = getDemoCalendarEvents(late).map((e) => daysUntil(e.date, late));
    expect(lateDays).toEqual(earlyDays);
  });

  it('exposes the authoring anchor for the shift math', () => {
    expect(DEMO_ANCHOR_ISO).toBe('2026-06-03');
  });
});

describe('eventRiskForTicker with injected events + clock', () => {
  const events = [
    ev({ id: 'nvda-high', ticker: 'NVDA', date: '2026-07-20', importance: 'high' }),
    ev({ id: 'amd-med', ticker: 'AMD', date: '2026-07-19', importance: 'medium' }),
    ev({ id: 'msft-far', ticker: 'MSFT', date: '2026-08-30', importance: 'high' }),
  ];

  it('elevated: active setup + high-importance event within 7 days', () => {
    expect(eventRiskForTicker('NVDA', [signal('NVDA', 'strong_setup')], events, TODAY)).toBe('elevated');
  });

  it('moderate: active setup + only a medium event within 7 days', () => {
    expect(eventRiskForTicker('AMD', [signal('AMD', 'watchlist_setup')], events, TODAY)).toBe('moderate');
  });

  it('low: event too far out, or no active setup', () => {
    expect(eventRiskForTicker('MSFT', [signal('MSFT', 'strong_setup')], events, TODAY)).toBe('low');
    expect(eventRiskForTicker('NVDA', [signal('NVDA', 'inactive')], events, TODAY)).toBe('low');
    expect(eventRiskForTicker('NVDA', [], events, TODAY)).toBe('low');
  });
});
