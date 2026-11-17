/**
 * The series registry - every Australian economic series the read is built from.
 *
 * One row per indicator, carrying the EXACT agency coordinates: ABS dataflow + version +
 * series key, or the RBA table + series id. Every key in here was verified against the live
 * API on 2026-11-18 (see `__tests__/series.test.ts` for the shape guard). If the ABS retires
 * a dataflow version the fetch degrades to 'unavailable' and the page names the gap - it
 * never silently substitutes a number.
 *
 * ABS Data API: keyless, SDMX-JSON, https://data.api.abs.gov.au. Dimension ORDER matters and
 * differs per dataflow - it is baked into each `key` below in the datastructure's own order.
 *
 * Note on CPI: the primary Australian consumer price series is now the MONTHLY CPI indicator
 * (dataflow CPI 2.0.0, FREQ=M). The headline index is published Original (TSEST=10); the
 * trimmed mean - the underlying read the RBA actually watches - is Seasonally Adjusted
 * (TSEST=20) and 404s under Original. The two are not interchangeable and are kept separate.
 */
import type { EconomyUnit } from './types';

export interface AbsSeriesSpec {
  agency: 'ABS';
  /** Dataflow id, e.g. "ANA_AGG". */
  dataflow: string;
  /** Dataflow version, e.g. "1.0.0". Pinned - an unpinned flow can change shape under us. */
  version: string;
  /** Series key in the datastructure's dimension order, time excluded. */
  key: string;
  /** Earliest period to request. Enough history for a trend word, not a chart. */
  startPeriod: string;
}

export interface RbaSeriesSpec {
  agency: 'RBA';
  /** Statistical table CSV, e.g. "f1.1". */
  table: string;
  /** Column series id, e.g. "FIRMMCRT". */
  seriesId: string;
}

export type EconomySourceSpec = AbsSeriesSpec | RbaSeriesSpec;


export interface EconomySeriesDef {
  id: string;
  label: string;
  unit: EconomyUnit;
  measures: string;
  sourceUrl: string;
  /** The headline series, exactly as published (e.g. the quarterly % change). */
  source: EconomySourceSpec;
  /**
   * Optional LEVEL series (chain volumes or an index) for the change over a year. A single
   * quarter is noisy, and people quote annual figures ("GDP grew 2.1%"), so wherever the ABS
   * publishes levels we compute the through-the-year change from them exactly, rather than
   * compounding rounded quarterly percentages.
   */
  levels?: AbsSeriesSpec;
}

const ANA_RELEASE =
  'https://www.abs.gov.au/statistics/economy/national-accounts/australian-national-accounts-national-income-expenditure-and-product/latest-release';
const CPI_RELEASE =
  'https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/monthly-consumer-price-index-indicator/latest-release';
const LF_RELEASE =
  'https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia/latest-release';
const LF_UNDER_RELEASE =
  'https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia/latest-release';
const WPI_RELEASE =
  'https://www.abs.gov.au/statistics/labour/earnings-and-working-conditions/wage-price-index-australia/latest-release';
const ERP_RELEASE =
  'https://www.abs.gov.au/statistics/people/population/national-state-and-territory-population/latest-release';
const CASH_RATE_RELEASE = 'https://www.rba.gov.au/statistics/cash-rate/';

/** Quarterly national-accounts aggregate, seasonally adjusted, Australia. */
function ana(key: string): AbsSeriesSpec {
  return { agency: 'ABS', dataflow: 'ANA_AGG', version: '1.0.0', key, startPeriod: '2023-Q1' };
}

/** Chain volume LEVELS for the same aggregate (M1), or the index (M5), for annual changes. */
function anaLevels(key: string): AbsSeriesSpec {
  return { agency: 'ABS', dataflow: 'ANA_AGG', version: '1.0.0', key, startPeriod: '2023-Q1' };
}

/** Quarterly contribution-to-growth row from the expenditure account. */
function anaExp(key: string): AbsSeriesSpec {
  return { agency: 'ABS', dataflow: 'ANA_EXP', version: '1.0.0', key, startPeriod: '2024-Q1' };
}

/**
 * The registry. Order within a question is the order the read weighs them.
 */
export const ECONOMY_SERIES: EconomySeriesDef[] = [
  // --- Growth and what is driving it ------------------------------------------------
  {
    id: 'gdp',
    label: 'Total output (GDP)',
    unit: 'percentChange',
    measures: 'Everything the country produced, change on the previous quarter, inflation-adjusted.',
    sourceUrl: ANA_RELEASE,
    source: ana('M2.GPM.20.AUS.Q'),
    levels: anaLevels('M1.GPM.20.AUS.Q'),
  },
  {
    id: 'gdpPerCapita',
    label: 'Output per person',
    unit: 'percentChange',
    measures: 'The same output divided by the population - the share that grew for each of us.',
    sourceUrl: ANA_RELEASE,
    source: ana('M2.GPM_PCA.20.AUS.Q'),
    levels: anaLevels('M1.GPM_PCA.20.AUS.Q'),
  },
  {
    id: 'population',
    label: 'Population growth',
    unit: 'percent',
    measures: 'How much the population grew over a year - more people to share the output between.',
    sourceUrl: ERP_RELEASE,
    source: { agency: 'ABS', dataflow: 'ERP_Q', version: '1.0.0', key: '3.3.TOT.AUS.Q', startPeriod: '2024-Q1' },
  },
  {
    id: 'contribHousehold',
    label: 'From household spending',
    unit: 'points',
    measures: 'Households buying goods and services - usually the largest part of the economy.',
    sourceUrl: ANA_RELEASE,
    source: anaExp('TCH.FCE.PHS.20.AUS.Q'),
  },
  {
    id: 'contribGovernment',
    label: 'From government services',
    unit: 'points',
    measures: 'Government spending on running things - health, education, defence, administration.',
    sourceUrl: ANA_RELEASE,
    source: anaExp('TCH.FCE.GGS.20.AUS.Q'),
  },
  {
    id: 'contribPublicInvestment',
    label: 'From public investment',
    unit: 'points',
    measures:
      'Public spending on building things - roads, rail, hospitals - by governments and public corporations. Government services plus this is total public demand.',
    sourceUrl: ANA_RELEASE,
    source: anaExp('TCH.GFC.GSS.20.AUS.Q'),
  },
  {
    id: 'contribPrivateInvestment',
    label: 'From private investment',
    unit: 'points',
    measures: 'Businesses and households building and buying equipment, homes and software. Household spending plus this is total private demand.',
    sourceUrl: ANA_RELEASE,
    source: anaExp('TCH.GFC.PSS.20.AUS.Q'),
  },
  {
    id: 'contribExports',
    label: 'From exports',
    unit: 'points',
    measures: 'How much came from selling to the rest of the world.',
    sourceUrl: ANA_RELEASE,
    source: anaExp('TCH.XGS.SSS.20.AUS.Q'),
  },

  // --- Whether people are getting better off ----------------------------------------
  {
    id: 'incomePerCapita',
    label: 'Real income per person',
    unit: 'percentChange',
    measures:
      'Real net national disposable income per person - the closest single read on what the country can actually afford, after inflation.',
    sourceUrl: ANA_RELEASE,
    source: ana('M2.NNDI_PCA.20.AUS.Q'),
    levels: anaLevels('M1.NNDI_PCA.20.AUS.Q'),
  },
  {
    id: 'productivity',
    label: 'Output per hour worked',
    unit: 'percentChange',
    measures:
      'How much is produced per hour of work. This, not total output, is what "more productive" means.',
    sourceUrl: ANA_RELEASE,
    source: ana('M6.GPM_PHW.20.AUS.Q'),
    levels: anaLevels('M5.GPM_PHW.20.AUS.Q'),
  },
  {
    id: 'hoursWorked',
    label: 'Hours worked',
    unit: 'percentChange',
    measures: 'Total hours worked across the economy. Output can grow just because more hours are worked.',
    sourceUrl: ANA_RELEASE,
    source: ana('M6.GPM_HRW.20.AUS.Q'),
    levels: anaLevels('M5.GPM_HRW.20.AUS.Q'),
  },
  {
    id: 'wages',
    label: 'Wage growth',
    unit: 'percent',
    measures: 'Hourly pay rates across the economy, change over a year, before inflation.',
    sourceUrl: WPI_RELEASE,
    source: { agency: 'ABS', dataflow: 'WPI', version: '1.2.0', key: '3.THRPEB.7.TOT.10.AUS.Q', startPeriod: '2023-Q1' },
  },
  {
    id: 'savingRatio',
    label: 'Household saving ratio',
    unit: 'percent',
    measures: 'The share of household income not spent - a buffer when it rises, a squeeze when it falls.',
    sourceUrl: ANA_RELEASE,
    source: ana('M7.HSR.20.AUS.Q'),
  },

  // --- Inflation, jobs and rates -----------------------------------------------------
  {
    id: 'cpi',
    label: 'Inflation (headline)',
    unit: 'percent',
    measures: 'How much prices rose over the past year. Falling inflation still means prices are rising, just slower.',
    sourceUrl: CPI_RELEASE,
    source: { agency: 'ABS', dataflow: 'CPI', version: '2.0.0', key: '3.10001.10.50.M', startPeriod: '2025-01' },
  },
  {
    id: 'cpiTrimmed',
    label: 'Inflation (underlying)',
    unit: 'percent',
    measures: 'The trimmed mean - inflation with the wildest movers stripped out. The read the RBA watches.',
    sourceUrl: CPI_RELEASE,
    source: { agency: 'ABS', dataflow: 'CPI', version: '2.0.0', key: '3.999902.20.50.M', startPeriod: '2025-01' },
  },
  {
    id: 'cashRate',
    label: 'Cash rate',
    unit: 'percent',
    measures: "The RBA's policy rate, monthly average - what sets the cost of borrowing.",
    sourceUrl: CASH_RATE_RELEASE,
    source: { agency: 'RBA', table: 'f1.1', seriesId: 'FIRMMCRT' },
  },
  {
    id: 'unemployment',
    label: 'Unemployment',
    unit: 'percent',
    measures: 'The share of people who want work, are available, and cannot find any.',
    sourceUrl: LF_RELEASE,
    source: { agency: 'ABS', dataflow: 'LF', version: '1.0.0', key: 'M13.3.1599.20.AUS.M', startPeriod: '2025-01' },
  },
  {
    id: 'underemployment',
    label: 'Underemployment',
    unit: 'percent',
    measures: 'People who have a job but want more hours. Low unemployment can hide a high number here.',
    sourceUrl: LF_UNDER_RELEASE,
    source: { agency: 'ABS', dataflow: 'LF_UNDER', version: '1.0.1', key: 'M23.3.1599.20.AUS.M', startPeriod: '2025-01' },
  },
  {
    id: 'participation',
    label: 'Participation rate',
    unit: 'percent',
    measures: 'The share of adults working or looking for work - how many of us are in the labour market at all.',
    sourceUrl: LF_RELEASE,
    source: { agency: 'ABS', dataflow: 'LF', version: '1.0.0', key: 'M12.3.1599.20.AUS.M', startPeriod: '2025-01' },
  },
];

/** Look a definition up by id. Returns undefined for an unknown id - callers must handle it. */
export function economySeriesById(id: string): EconomySeriesDef | undefined {
  return ECONOMY_SERIES.find((s) => s.id === id);
}

/** Human label for an agency series key, for the "where this came from" line. */
export function seriesKeyLabel(def: EconomySeriesDef): string {
  return def.source.agency === 'ABS'
    ? `ABS ${def.source.dataflow} ${def.source.key}`
    : `RBA ${def.source.table} ${def.source.seriesId}`;
}
