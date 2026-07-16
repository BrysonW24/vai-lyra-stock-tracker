import { describe, expect, it } from 'vitest';
import { compareIpoDates, effectiveIpoStatus, withEffectiveStatus, type IpoCompany } from '../ipos';

const NOW = new Date('2026-07-16T12:00:00Z');

const stub = (over: Partial<IpoCompany>): Pick<IpoCompany, 'status' | 'ipoDate'> => ({
  status: 'upcoming',
  ipoDate: '2026-08-01',
  ...over,
});

describe('effectiveIpoStatus', () => {
  it('keeps a genuinely future upcoming IPO upcoming', () => {
    expect(effectiveIpoStatus(stub({ ipoDate: '2026-08-01' }), NOW)).toBe('upcoming');
  });

  it('flips a past-dated "upcoming" to recent - stale seeds cannot promise the past', () => {
    expect(effectiveIpoStatus(stub({ ipoDate: '2026-06-10' }), NOW)).toBe('recent');
  });

  it('treats an IPO dated today as still upcoming', () => {
    expect(effectiveIpoStatus(stub({ ipoDate: '2026-07-16' }), NOW)).toBe('upcoming');
  });

  it('passes stored priced/recent through untouched', () => {
    expect(effectiveIpoStatus(stub({ status: 'priced', ipoDate: '2026-06-10' }), NOW)).toBe('priced');
    expect(effectiveIpoStatus(stub({ status: 'recent', ipoDate: '2026-01-05' }), NOW)).toBe('recent');
  });
});

describe('withEffectiveStatus', () => {
  it('rewrites only the rows whose status changed', () => {
    const rows = [
      stub({ ipoDate: '2026-06-01' }), // past upcoming -> recent
      stub({ ipoDate: '2026-09-01' }), // future upcoming -> unchanged reference
    ] as IpoCompany[];
    const out = withEffectiveStatus(rows, NOW);
    expect(out[0].status).toBe('recent');
    expect(out[1]).toBe(rows[1]);
  });
});

describe('compareIpoDates', () => {
  const d = (ipoDate: string) => ({ ipoDate });

  it('puts future IPOs before past ones', () => {
    expect(compareIpoDates(d('2026-08-01'), d('2026-06-01'), NOW)).toBeLessThan(0);
    expect(compareIpoDates(d('2026-06-01'), d('2026-08-01'), NOW)).toBeGreaterThan(0);
  });

  it('sorts future IPOs soonest-first (the one you can still act on tops the list)', () => {
    expect(compareIpoDates(d('2026-07-30'), d('2026-12-05'), NOW)).toBeLessThan(0);
  });

  it('sorts past IPOs newest-first', () => {
    expect(compareIpoDates(d('2026-07-01'), d('2026-02-01'), NOW)).toBeLessThan(0);
  });

  it('full sort: soonest future, later future, recent past, older past', () => {
    const rows = [d('2026-02-01'), d('2026-12-05'), d('2026-07-01'), d('2026-07-30')];
    const sorted = [...rows].sort((a, b) => compareIpoDates(a, b, NOW)).map((r) => r.ipoDate);
    expect(sorted).toEqual(['2026-07-30', '2026-12-05', '2026-07-01', '2026-02-01']);
  });
});
