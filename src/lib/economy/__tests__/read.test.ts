import { describe, expect, it } from 'vitest';
import { readEconomy, THRESHOLDS } from '../read';
import { ECONOMY_SERIES } from '../series';
import { JUNE_2026, indicator, withChanges, withMissing } from './fixtures';

const q = (read: ReturnType<typeof readEconomy>, id: string) => {
  const found = read.questions.find((x) => x.id === id);
  if (!found) throw new Error(`no question ${id}`);
  return found;
};

/** Every sentence the read can put on screen. */
function allCopy(read: ReturnType<typeof readEconomy>): string[] {
  return [read.headline, ...read.questions.flatMap((x) => [x.question, x.answer, x.cannotTell, x.wouldChange])];
}

describe('the founder case - June quarter 2026, live figures captured 2026-11-18', () => {
  const read = readEconomy(JUNE_2026);

  it('separates growing bigger from getting better off', () => {
    expect(read.headline).toContain('grew 2.1%');
    expect(read.headline).toContain('output per person grew only 0.7%');
    expect(read.headline).toContain('pay bought 0.6% less');
    expect(read.headline).toContain('bigger, not better off per person');
    expect(read.overall).toBe('mixed');
    expect(read.livingStandards).toBe('under-pressure');
  });

  it('says the growth came from more hours, not more productive ones - citing the published hours figure', () => {
    const living = q(read, 'living');
    expect(living.answer).toContain('Output per hour worked fell 0.2%');
    expect(living.answer).toContain('hours worked rose 2.4%');
    expect(living.answer).toContain('not because each hour produced more');
  });

  it('attributes the per-person gap to population, dated with population’s own period', () => {
    const growth = q(read, 'growth');
    expect(growth.answer).toContain('1.4% more people than a year earlier (March quarter 2026)');
    expect(growth.because).toContain('population');
  });

  it('names BOTH drivers when two tie for the biggest lift', () => {
    expect(q(read, 'growth').answer).toContain('household spending and exports (0.2 points each)');
  });

  it('compares public and private demand from all four components, not consumption alone', () => {
    // Government services +0.1 and public investment -0.1 = public demand 0.0. Reading the
    // services row alone would have said government added more than private investment.
    const growth = q(read, 'growth');
    expect(growth.answer).toContain('Private demand added 0.2 points and public demand added nothing');
    expect(growth.answer).not.toContain('Government spending added more than private investment');
  });

  it('dates the real-wage year separately from the latest monthly CPI', () => {
    const living = q(read, 'living');
    // 3.8% is the CPI for June 2026 (wages 3.2 - real wages -0.6), NOT the September 4.3%.
    expect(living.answer).toContain('In the year to the June quarter 2026');
    expect(living.answer).toContain('prices rose 3.8%');
    expect(q(read, 'prices').answer).toContain('Headline inflation is 4.3%');
  });

  it('reads inflation against the RBA band and states the cash rate without forecasting it', () => {
    const prices = q(read, 'prices');
    expect(prices.verdict).toBe('under-pressure');
    expect(prices.answer).toContain('above the RBA\'s 2-3% target band');
    expect(prices.answer).toContain('The cash rate averaged 4.60% in October 2026, up from 4.36%');
    expect(prices.answer).not.toMatch(/will (cut|raise|hike|hold)/i);
  });

  it('judges direction at displayed precision - 4.65 and 4.72 both show as 4.7%', () => {
    expect(q(read, 'jobs').answer).toContain('Unemployment is 4.7% in September 2026, unchanged from August');
  });

  it('reports nothing missing when every series is live', () => {
    expect(read.missing).toEqual([]);
    expect(read.empty).toBe(false);
    // Latest across frequencies is compared by month: October beats "2026-Q2" even though
    // "2026-Q2" > "2026-10" as a raw string.
    expect(read.asOf).toBe('2026-10');
  });
});

describe('the read follows the data - no stored opinion survives a change', () => {
  it('turns to "improving" when wages outrun prices, income rises and productivity grows', () => {
    const better = withChanges(JUNE_2026, {
      gdp: { annual: 3.0 },
      gdpPerCapita: { annual: 1.5 },
      incomePerCapita: { annual: 1.2 },
      realWages: { value: 1.1 },
      productivity: { annual: 1.4 },
    });
    const read = readEconomy(better);
    expect(read.overall).toBe('improving');
    expect(read.livingStandards).toBe('improving');
    expect(read.headline).toContain('people are sharing in it');
    expect(read.headline).not.toContain('not better off');
    expect(q(read, 'living').answer).toContain('pay bought 1.1% more');
    expect(q(read, 'living').answer).toContain('lifts living standards over time');
  });

  it('calls growth under pressure when output per person falls, whatever total output did', () => {
    const read = readEconomy(withChanges(JUNE_2026, { gdpPerCapita: { annual: -0.3 } }));
    expect(q(read, 'growth').verdict).toBe('under-pressure');
    expect(q(read, 'growth').answer).toContain('output per person fell 0.3%');
    expect(read.headline).toContain('output per person fell 0.3%');
  });

  it('flags a jobs warning when unemployment climbs half a point off its recent low', () => {
    const climbing = withChanges(JUNE_2026, {
      unemployment: {
        value: 4.9,
        previous: 4.8,
        direction: 'up',
        history: [4.1, 4.1, 4.2, 4.3, 4.5, 4.7, 4.8, 4.9].map((value, i) => ({ period: `2026-0${i + 2}`, value })),
      },
    });
    const jobs = q(readEconomy(climbing), 'jobs');
    expect(jobs.verdict).toBe('under-pressure');
    expect(jobs.answer).toContain('climbed');
  });

  it('reads inflation inside the band and easing as improving', () => {
    const calm = withChanges(JUNE_2026, { cpiTrimmed: { value: 2.6, previous: 2.8, direction: 'down' } });
    const prices = q(readEconomy(calm), 'prices');
    expect(prices.verdict).toBe('improving');
    expect(prices.answer).toContain('inside the RBA\'s 2-3% target band and easing');
  });

  it('names the low-unemployment, not-enough-hours pattern only when both halves are true', () => {
    const tightButShort = withChanges(JUNE_2026, {
      unemployment: { value: 4.1, previous: 4.1, direction: 'flat', history: [4.1, 4.1, 4.1].map((value, i) => ({ period: `2026-0${i + 7}`, value })) },
      underemployment: { value: 6.8 },
    });
    expect(q(readEconomy(tightButShort), 'jobs').answer).toContain('plenty of jobs, not enough work in them');
    expect(q(readEconomy(JUNE_2026), 'jobs').answer).not.toContain('plenty of jobs');
  });
});

describe('missing data is said out loud and never filled in', () => {
  it('makes no call on growth when the national accounts did not load - and quotes no figure', () => {
    const read = readEconomy(withMissing(JUNE_2026, ['gdp', 'gdpPerCapita']));
    const growth = q(read, 'growth');
    expect(growth.verdict).toBe('unknown');
    expect(growth.answer).not.toMatch(/\d/);
    expect(read.headline).toContain('not making a call');
    expect(read.missing).toEqual(expect.arrayContaining(['Total output (GDP)', 'Output per person']));
  });

  it('will not read living standards from a single number', () => {
    const read = readEconomy(withMissing(JUNE_2026, ['incomePerCapita', 'realWages']));
    expect(q(read, 'living').verdict).toBe('unknown');
  });

  it('marks the whole read empty when nothing at all loaded', () => {
    const read = readEconomy(withMissing(JUNE_2026, JUNE_2026.map((i) => i.id)));
    expect(read.empty).toBe(true);
    expect(read.questions.every((x) => x.verdict === 'unknown')).toBe(true);
    expect(read.missing).toHaveLength(JUNE_2026.length);
  });

  it('does not claim "more hours" unless hours worked actually loaded', () => {
    const read = readEconomy(withMissing(JUNE_2026, ['hoursWorked']));
    expect(q(read, 'living').answer).not.toContain('more hours were worked');
    expect(q(read, 'living').answer).toContain('Output per hour worked fell 0.2%');
  });
});

describe('copy rules', () => {
  const reads = [
    readEconomy(JUNE_2026),
    readEconomy(withMissing(JUNE_2026, ['gdp', 'gdpPerCapita', 'realWages'])),
    readEconomy(withChanges(JUNE_2026, { realWages: { value: 1.1 }, productivity: { annual: 1.4 } })),
  ];

  it('never gives advice - research context only', () => {
    for (const read of reads) {
      for (const line of allCopy(read)) {
        expect(line).not.toMatch(/\b(buy|sell|you should|we recommend|time to|opportunity)\b/i);
      }
    }
  });

  it('uses plain hyphens, never an em or en dash', () => {
    for (const read of reads) for (const line of allCopy(read)) expect(line).not.toMatch(/[–—]/);
  });

  it('states every limit - no question ships without what it cannot tell you', () => {
    for (const x of readEconomy(JUNE_2026).questions) expect(x.cannotTell.length).toBeGreaterThan(40);
  });

  it('only cites indicators that exist', () => {
    const known = new Set([...ECONOMY_SERIES.map((s) => s.id), 'realWages']);
    for (const x of readEconomy(JUNE_2026).questions) for (const id of x.because) expect(known.has(id)).toBe(true);
  });

  it('documents every threshold it judges by', () => {
    expect(THRESHOLDS.targetLow).toBe(2);
    expect(THRESHOLDS.targetHigh).toBe(3);
    expect(Object.values(THRESHOLDS).every((v) => Number.isFinite(v))).toBe(true);
  });

  it('builds an indicator helper consistent with the registry', () => {
    expect(indicator('gdp').label).toBe('Total output (GDP)');
  });
});
