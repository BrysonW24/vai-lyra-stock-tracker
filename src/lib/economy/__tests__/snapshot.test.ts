import { beforeEach, describe, expect, it } from 'vitest';
import { cacheGet, resetCacheForTests } from '@/lib/cache';
import type { FetchImpl } from '../abs';
import { absSeriesUrl } from '../abs';
import { deriveRealWages, getEconomySnapshot } from '../snapshot';
import { ECONOMY_SERIES } from '../series';
import { indicator } from './fixtures';

const noSleep = async () => {};

function sdmxSeries(points: [string, number][]) {
  return {
    data: {
      structures: [{ dimensions: { observation: [{ id: 'TIME_PERIOD', values: points.map(([p]) => ({ id: p })) }] } }],
      dataSets: [{ observations: Object.fromEntries(points.map(([, v], i) => [`${i}`, [v]])) }],
    },
  };
}

/** Answer every request from a table keyed by a substring of the URL; 404 for anything else. */
function router(routes: Record<string, unknown>): FetchImpl {
  return async (url) => {
    const hit = Object.keys(routes).find((k) => url.includes(k));
    if (!hit) return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
    const body = routes[hit];
    return { ok: true, status: 200, json: async () => body, text: async () => String(body) };
  };
}

describe('deriveRealWages', () => {
  const wages = indicator('wages', {
    value: 3.2,
    period: '2026-Q2',
    history: [
      { period: '2026-Q1', value: 3.3 },
      { period: '2026-Q2', value: 3.2 },
    ],
  });
  const cpi = indicator('cpi', {
    value: 4.3,
    period: '2026-09',
    history: [
      { period: '2026-03', value: 4.6 },
      { period: '2026-06', value: 3.8 },
      { period: '2026-09', value: 4.3 },
    ],
  });

  it('subtracts the CPI for the quarter’s final month - not the latest month', () => {
    const rw = deriveRealWages(wages, cpi);
    expect(rw.value).toBe(-0.6); // 3.2 - 3.8 (June), not 3.2 - 4.3 (September)
    expect(rw.period).toBe('2026-Q2');
    expect(rw.previous).toBe(-1.3); // 3.3 - 4.6 (March)
    expect(rw.direction).toBe('up');
    expect(rw.provenance).toBe('live');
  });

  it('is unavailable - NaN, not zero - when either side is missing', () => {
    const rw = deriveRealWages(wages, { ...cpi, provenance: 'unavailable', value: Number.NaN });
    expect(rw.provenance).toBe('unavailable');
    expect(Number.isNaN(rw.value)).toBe(true);
    expect(deriveRealWages(undefined, cpi).provenance).toBe('unavailable');
  });

  it('is unavailable when no CPI month lines up with a wage quarter', () => {
    const rw = deriveRealWages(wages, { ...cpi, history: [{ period: '2026-09', value: 4.3 }] });
    expect(rw.provenance).toBe('unavailable');
  });
});

describe('getEconomySnapshot', () => {
  beforeEach(() => resetCacheForTests());

  it('computes the change over a year from LEVELS, matched by period across a gap', async () => {
    const snap = await getEconomySnapshot({
      useCache: false,
      sleep: noSleep,
      fetchImpl: router({
        'M2.GPM.20.AUS.Q': sdmxSeries([['2026-Q1', 0.3], ['2026-Q2', 0.4]]),
        // 2025-Q4 missing on purpose: an offset-based read would compare the wrong quarters.
        'M1.GPM.20.AUS.Q': sdmxSeries([['2025-Q1', 679519], ['2025-Q2', 684822], ['2025-Q3', 688271], ['2026-Q1', 696539], ['2026-Q2', 699461]]),
      }),
    });
    const gdp = snap.indicators.find((i) => i.id === 'gdp')!;
    expect(gdp.value).toBe(0.4);
    expect(gdp.annual).toBe(2.14);
    expect(gdp.annualSpan).toBe('2025-Q2 to 2026-Q2');
    expect(gdp.provenance).toBe('live');
  });

  it('marks every series it could not fetch unavailable, with NaN - and still returns', async () => {
    const snap = await getEconomySnapshot({ useCache: false, sleep: noSleep, fetchImpl: router({}) });
    // Every registry row plus the derived real-wage figure.
    expect(snap.indicators).toHaveLength(ECONOMY_SERIES.length + 1);
    for (const i of snap.indicators) {
      expect(i.provenance).toBe('unavailable');
      expect(Number.isNaN(i.value)).toBe(true);
    }
  });

  it('caches a series that loaded, and does NOT pin one that failed', async () => {
    const gdpDef = ECONOMY_SERIES.find((d) => d.id === 'gdp')!;
    const popDef = ECONOMY_SERIES.find((d) => d.id === 'population')!;
    if (gdpDef.source.agency !== 'ABS' || popDef.source.agency !== 'ABS') throw new Error('expected ABS');
    await getEconomySnapshot({
      sleep: noSleep,
      fetchImpl: router({ 'M2.GPM.20.AUS.Q': sdmxSeries([['2026-Q2', 0.4]]) }),
    });
    expect(await cacheGet(`economy:au:v1:${absSeriesUrl(gdpDef.source)}`)).toEqual([{ period: '2026-Q2', value: 0.4 }]);
    expect(await cacheGet(`economy:au:v1:${absSeriesUrl(popDef.source)}`)).toBeNull();
  });
});
