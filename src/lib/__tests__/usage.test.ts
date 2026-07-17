import { describe, it, expect } from 'vitest';
import {
  emptyUsage,
  normaliseUsage,
  recordSession,
  recordVisit,
  accrueDwell,
  recordAiRequest,
  summarizeUsage,
} from '@/lib/usage';

const T0 = '2026-07-17T09:00:00.000Z';
const T1 = '2026-07-18T10:00:00.000Z';

describe('usage record', () => {
  it('starts empty and stamps first-seen', () => {
    const r = emptyUsage(T0);
    expect(r.sessions).toBe(0);
    expect(r.totalMs).toBe(0);
    expect(r.firstSeen).toBe(T0);
  });

  it('counts sessions and dedupes active days', () => {
    let r = emptyUsage(T0);
    r = recordSession(r, T0);
    r = recordSession(r, T0); // same day
    r = recordSession(r, T1); // next day
    expect(r.sessions).toBe(3);
    expect(r.activeDays).toEqual(['2026-07-17', '2026-07-18']);
  });

  it('records visits with dwell and rolls up per surface', () => {
    let r = emptyUsage(T0);
    r = recordVisit(r, '/portfolio', 5000, T0, 'Portfolio');
    r = recordVisit(r, '/portfolio', 3000, T0, 'Portfolio');
    r = recordVisit(r, '/plan', 2000, T0, 'Trade Plan');
    expect(r.bySurface['/portfolio'].visits).toBe(2);
    expect(r.bySurface['/portfolio'].ms).toBe(8000);
    expect(r.totalMs).toBe(10000);
  });

  it('caps a single dwell so a left-open tab cannot wreck totals', () => {
    let r = emptyUsage(T0);
    r = recordVisit(r, '/wire', 9 * 60 * 60 * 1000, T0); // 9 hours -> capped to 30 min
    expect(r.bySurface['/wire'].ms).toBe(30 * 60 * 1000);
  });

  it('accrues dwell without counting a visit', () => {
    let r = emptyUsage(T0);
    r = recordVisit(r, '/charts', 1000, T0);
    r = accrueDwell(r, '/charts', 4000, T0);
    expect(r.bySurface['/charts'].visits).toBe(1);
    expect(r.bySurface['/charts'].ms).toBe(5000);
  });

  it('counts AI requests', () => {
    let r = emptyUsage(T0);
    r = recordAiRequest(r, T0);
    r = recordAiRequest(r, T0);
    expect(r.aiRequests).toBe(2);
  });

  it('normalises a junk stored value into a valid record', () => {
    expect(normaliseUsage(null, T0).sessions).toBe(0);
    expect(normaliseUsage({ sessions: 4, bySurface: { '/x': { visits: 1, ms: 10 } } }, T0).sessions).toBe(4);
    expect(normaliseUsage('nonsense', T0).version).toBe(1);
  });
});

describe('summarizeUsage', () => {
  it('ranks surfaces by visits and scores heatmap intensity relative to the top', () => {
    let r = emptyUsage(T0);
    r = recordSession(r, T0);
    r = recordVisit(r, '/portfolio', 60000, T0, 'Portfolio'); // 4 visits
    r = recordVisit(r, '/portfolio', 60000, T0, 'Portfolio');
    r = recordVisit(r, '/portfolio', 60000, T0, 'Portfolio');
    r = recordVisit(r, '/portfolio', 60000, T0, 'Portfolio');
    r = recordVisit(r, '/plan', 30000, T0, 'Trade Plan'); // 2 visits
    r = recordVisit(r, '/plan', 30000, T0, 'Trade Plan');

    const s = summarizeUsage(r);
    expect(s.mostUsed?.surface).toBe('/portfolio');
    expect(s.mostUsed?.intensity).toBe(1);
    expect(s.surfaces[1].surface).toBe('/plan');
    expect(s.surfaces[1].intensity).toBe(0.5); // 2/4
    expect(s.surfacesUsed).toBe(2);
    expect(s.totalMinutes).toBe(5); // 300000ms
  });

  it('computes average session length', () => {
    let r = emptyUsage(T0);
    r = recordSession(r, T0);
    r = recordSession(r, T0);
    r = recordVisit(r, '/x', 600000, T0); // 10 min total over 2 sessions -> 5 min avg
    expect(summarizeUsage(r).avgSessionMinutes).toBe(5);
  });

  it('is safe on an empty record', () => {
    const s = summarizeUsage(emptyUsage(T0));
    expect(s.mostUsed).toBeNull();
    expect(s.surfaces).toEqual([]);
    expect(s.totalHours).toBe(0);
  });
});
