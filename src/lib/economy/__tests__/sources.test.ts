import { describe, expect, it } from 'vitest';
import { absSeriesUrl, fetchAbsSeries, parseAbsSeries, type FetchImpl } from '../abs';
import { parseRbaSeries, fetchRbaSeries } from '../rba';
import { latestPeriod, periodEndMonth, periodLabel, yearEarlier } from '../period';
import { ECONOMY_SERIES } from '../series';

/** A minimal SDMX-JSON data message. TIME_PERIOD deliberately NOT last, keys out of order. */
function sdmx(periods: string[], values: (number | null)[]) {
  const observations: Record<string, unknown> = {};
  values.forEach((v, i) => {
    observations[`0:${i}:0`] = [v];
  });
  return {
    data: {
      structures: [
        {
          dimensions: {
            observation: [
              { id: 'MEASURE', values: [{ id: 'M2' }] },
              { id: 'TIME_PERIOD', values: periods.map((id) => ({ id })) },
              { id: 'REGION', values: [{ id: 'AUS' }] },
            ],
          },
        },
      ],
      dataSets: [{ observations }],
    },
  };
}

const ok = (body: unknown): Awaited<ReturnType<FetchImpl>> => ({
  ok: true,
  status: 200,
  json: async () => body,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});
const status = (code: number): Awaited<ReturnType<FetchImpl>> => ({
  ok: false,
  status: code,
  json: async () => ({}),
  text: async () => 'NoRecordsFound',
});
const noSleep = async () => {};

describe('ABS SDMX-JSON parsing', () => {
  it('reads TIME_PERIOD wherever it sits in the key, oldest first, skipping unpublished values', () => {
    const payload = sdmx(['2026-Q2', '2025-Q4', '2026-Q1'], [0.4, null, 0.3]);
    expect(parseAbsSeries(payload)).toEqual([
      { period: '2026-Q1', value: 0.3 },
      { period: '2026-Q2', value: 0.4 },
    ]);
  });

  it('turns a non-data answer into no observations, never a value', () => {
    expect(parseAbsSeries('NoRecordsFound')).toEqual([]);
    expect(parseAbsSeries({ data: { dataSets: [] } })).toEqual([]);
    expect(parseAbsSeries(null)).toEqual([]);
  });

  it('ignores observation keys that do not match the dimension count', () => {
    const payload = sdmx(['2026-Q2'], [0.4]);
    (payload.data.dataSets[0].observations as Record<string, unknown>)['0:0'] = [99];
    expect(parseAbsSeries(payload)).toEqual([{ period: '2026-Q2', value: 0.4 }]);
  });

  it('builds the request in the dataflow’s own key order', () => {
    const gdp = ECONOMY_SERIES.find((s) => s.id === 'gdp')!;
    expect(gdp.source.agency).toBe('ABS');
    if (gdp.source.agency !== 'ABS') return;
    expect(absSeriesUrl(gdp.source)).toBe(
      'https://data.api.abs.gov.au/rest/data/ABS,ANA_AGG,1.0.0/M2.GPM.20.AUS.Q?startPeriod=2023-Q1&dimensionAtObservation=AllDimensions',
    );
  });
});

describe('ABS fetching degrades, never throws', () => {
  const spec = { agency: 'ABS' as const, dataflow: 'ANA_AGG', version: '1.0.0', key: 'M2.GPM.20.AUS.Q', startPeriod: '2025-Q1' };

  it('asks for SDMX-JSON (the plain endpoint answers XML)', async () => {
    let accept = '';
    const fetchImpl: FetchImpl = async (_url, init) => {
      accept = init?.headers?.Accept ?? '';
      return ok(sdmx(['2026-Q2'], [0.4]));
    };
    await fetchAbsSeries(spec, { fetchImpl, sleep: noSleep });
    expect(accept).toBe('application/vnd.sdmx.data+json');
  });

  it('treats a 404 ("NoRecordsFound") as absent without retrying', async () => {
    let calls = 0;
    const fetchImpl: FetchImpl = async () => {
      calls++;
      return status(404);
    };
    expect(await fetchAbsSeries(spec, { fetchImpl, sleep: noSleep })).toEqual([]);
    expect(calls).toBe(1);
  });

  it('retries a transient 503 and returns the value', async () => {
    let calls = 0;
    const fetchImpl: FetchImpl = async () => (++calls === 1 ? status(503) : ok(sdmx(['2026-Q2'], [0.4])));
    expect(await fetchAbsSeries(spec, { fetchImpl, sleep: noSleep })).toEqual([{ period: '2026-Q2', value: 0.4 }]);
    expect(calls).toBe(2);
  });

  it('returns [] when the network fails outright', async () => {
    const fetchImpl: FetchImpl = async () => {
      throw new Error('fetch failed');
    };
    expect(await fetchAbsSeries(spec, { fetchImpl, sleep: noSleep })).toEqual([]);
  });
});

describe('RBA table parsing', () => {
  const csv = [
    '﻿F1.1 INTEREST RATES AND YIELDS - MONEY MARKET',
    'Title,Cash Rate Target,Interbank Overnight Cash Rate',
    'Publication date,02-Nov-2026,02-Nov-2026',
    'Series ID,FIRMMCRI,FIRMMCRT',
    '30/09/2026,4.35,4.36',
    '31/10/2026,,4.60',
    '31/08/2026,4.34,4.35',
    '',
  ].join('\n');

  it('finds the column by series id, not position, and sorts by month', () => {
    expect(parseRbaSeries(csv, 'FIRMMCRT')).toEqual([
      { period: '2026-08', value: 4.35 },
      { period: '2026-09', value: 4.36 },
      { period: '2026-10', value: 4.6 },
    ]);
  });

  it('skips blank cells rather than reading them as zero', () => {
    expect(parseRbaSeries(csv, 'FIRMMCRI').map((o) => o.period)).toEqual(['2026-08', '2026-09']);
  });

  it('returns nothing - not a neighbouring column - when the id is absent', () => {
    expect(parseRbaSeries(csv, 'NOT_A_SERIES')).toEqual([]);
    expect(parseRbaSeries('Title,a\n30/09/2026,1', 'FIRMMCRT')).toEqual([]);
  });

  it('degrades to [] on a failed fetch', async () => {
    const fetchImpl: FetchImpl = async () => status(500);
    expect(await fetchRbaSeries({ agency: 'RBA', table: 'f1.1', seriesId: 'FIRMMCRT' }, { fetchImpl, sleep: noSleep })).toEqual([]);
  });
});

describe('periods across frequencies', () => {
  it('compares a quarter by the month it ends, not as a raw string', () => {
    expect('2026-Q2' > '2026-10').toBe(true); // the trap
    expect(periodEndMonth('2026-Q2')).toBe('2026-06');
    expect(latestPeriod(['2026-Q2', '2026-10', '2026-09'])).toBe('2026-10');
  });

  it('labels periods the way the ABS phrases them', () => {
    expect(periodLabel('2026-Q2')).toBe('June quarter 2026');
    expect(periodLabel('2026-09')).toBe('September 2026');
    expect(periodLabel('weird')).toBe('weird');
  });

  it('finds the same period a year earlier', () => {
    expect(yearEarlier('2026-Q2')).toBe('2025-Q2');
    expect(yearEarlier('2026-01')).toBe('2025-01');
    expect(yearEarlier('nope')).toBeNull();
  });
});

describe('series registry shape', () => {
  /** Dimension counts (time excluded) from each datastructure, verified live 2026-11-18. */
  const KEY_PARTS: Record<string, number> = { ANA_AGG: 5, ANA_EXP: 6, CPI: 5, LF: 6, LF_UNDER: 6, WPI: 7, ERP_Q: 5 };

  it('gives every ABS key the right number of parts for its dataflow - a mis-ordered key 404s', () => {
    for (const def of ECONOMY_SERIES) {
      for (const spec of [def.source, def.levels].filter(Boolean)) {
        if (!spec || spec.agency !== 'ABS') continue;
        expect(KEY_PARTS[spec.dataflow], `${def.id}: unknown dataflow ${spec.dataflow}`).toBeDefined();
        expect(spec.key.split('.'), `${def.id} ${spec.key}`).toHaveLength(KEY_PARTS[spec.dataflow]!);
      }
    }
  });

  it('has unique ids and links only to the agencies themselves', () => {
    const ids = ECONOMY_SERIES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of ECONOMY_SERIES) expect(s.sourceUrl).toMatch(/^https:\/\/www\.(abs|rba)\.gov\.au\//);
  });

  it('pins every dataflow version', () => {
    for (const s of ECONOMY_SERIES) if (s.source.agency === 'ABS') expect(s.source.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
