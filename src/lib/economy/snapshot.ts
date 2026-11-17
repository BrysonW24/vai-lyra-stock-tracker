/**
 * The live Australian economic snapshot: every registry series fetched, cached and shaped
 * into indicators, plus the two figures that only exist by combining published ones -
 * the change over a year (from levels) and real wages (wage growth minus inflation over the
 * SAME period).
 *
 * Caching follows the repo rule (src/lib/cache.ts): only a VALID result is stored. A series
 * that failed is not cached, so a transient ABS outage costs one slow render, not six hours
 * of a page claiming the figure is missing. ABS releases are quarterly/monthly; 6 hours of
 * staleness is invisible in practice, and every figure on the page carries its own period,
 * so a cached value can be older but never wrong.
 */
import { cacheGet, cacheSet } from '@/lib/cache';
import { absSeriesUrl, fetchAbsSeries, type FetchImpl } from './abs';
import { yearEarlier, periodEndMonth } from './period';
import { fetchRbaSeries, rbaTableUrl } from './rba';
import { ECONOMY_SERIES, seriesKeyLabel, type EconomySeriesDef, type EconomySourceSpec } from './series';
import type { EconomyDirection, EconomyIndicator, EconomyObservation } from './types';

export const ECONOMY_CACHE_TTL_SECONDS = 6 * 60 * 60;

/** Bump when the indicator shape or a series key changes, so old cache entries are ignored. */
const CACHE_VERSION = 'v1';

export interface EconomySnapshotOptions {
  fetchImpl?: FetchImpl;
  sleep?: (ms: number) => Promise<void>;
  /** Default true. Tests turn it off so each case fetches what it injected. */
  useCache?: boolean;
}

function sourceUrlFor(spec: EconomySourceSpec): string {
  return spec.agency === 'ABS' ? absSeriesUrl(spec) : rbaTableUrl(spec);
}

/** Fetch one source spec through the cache, storing only a non-empty result. */
async function loadSeries(spec: EconomySourceSpec, options: EconomySnapshotOptions): Promise<EconomyObservation[]> {
  const useCache = options.useCache ?? true;
  const cacheKey = `economy:au:${CACHE_VERSION}:${sourceUrlFor(spec)}${spec.agency === 'RBA' ? `#${spec.seriesId}` : ''}`;
  if (useCache) {
    const hit = await cacheGet<EconomyObservation[]>(cacheKey);
    if (hit && hit.length > 0) return hit;
  }
  const fetchOpts = { fetchImpl: options.fetchImpl, sleep: options.sleep };
  const observations =
    spec.agency === 'ABS' ? await fetchAbsSeries(spec, fetchOpts) : await fetchRbaSeries(spec, fetchOpts);
  if (useCache && observations.length > 0) await cacheSet(cacheKey, observations, ECONOMY_CACHE_TTL_SECONDS);
  return observations;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Direction of the latest move, judged on the 1-decimal figure a reader sees - so the arrow
 * can never point "up" between two values that both display as 4.7%.
 * - A CHANGE series (q/q %, contribution points): the sign of the value itself.
 * - A LEVEL series (a rate like unemployment, a yearly % like CPI): against the previous value.
 */
function directionOf(def: EconomySeriesDef, value: number, previous: number): EconomyDirection | undefined {
  if (!Number.isFinite(value)) return undefined;
  if (def.unit === 'percentChange' || def.unit === 'points') {
    const v = round1(value);
    return v > 0 ? 'up' : v < 0 ? 'down' : 'flat';
  }
  if (!Number.isFinite(previous)) return undefined;
  const diff = round1(value) - round1(previous);
  return Math.abs(diff) < 0.05 ? 'flat' : diff > 0 ? 'up' : 'down';
}

/** Change over a year from a level series, matched by PERIOD (never by array offset - a gap
 *  in the series would silently compare the wrong quarters). */
function annualFromLevels(levels: EconomyObservation[]): { annual: number; span: string } {
  const latest = levels[levels.length - 1];
  if (!latest) return { annual: Number.NaN, span: '' };
  const earlierPeriod = yearEarlier(latest.period);
  const earlier = earlierPeriod ? levels.find((o) => o.period === earlierPeriod) : undefined;
  if (!earlier || earlier.value === 0) return { annual: Number.NaN, span: '' };
  return {
    annual: Math.round((latest.value / earlier.value - 1) * 10000) / 100,
    span: `${earlier.period} to ${latest.period}`,
  };
}

function buildIndicator(def: EconomySeriesDef, series: EconomyObservation[], levels: EconomyObservation[]): EconomyIndicator {
  const latest = series[series.length - 1];
  const prior = series[series.length - 2];
  const value = latest?.value ?? Number.NaN;
  const previous = prior?.value ?? Number.NaN;
  const { annual, span } = def.levels ? annualFromLevels(levels) : { annual: Number.NaN, span: '' };
  return {
    id: def.id,
    label: def.label,
    value,
    previous,
    unit: def.unit,
    period: latest?.period ?? '',
    direction: directionOf(def, value, previous),
    provenance: latest ? 'live' : 'unavailable',
    measures: def.measures,
    agency: def.source.agency,
    seriesKey: seriesKeyLabel(def),
    sourceUrl: def.sourceUrl,
    history: series.slice(-8),
    annual,
    annualSpan: span,
  };
}

/**
 * Real wage growth: wage growth over a year minus headline inflation over the SAME year.
 * The WPI is quarterly and the CPI monthly, so we take the CPI reading for the quarter's final
 * month - mixing the June-quarter WPI with September CPI would be comparing different years.
 * A simple difference, the standard approximation; labelled as exactly that.
 */
export function deriveRealWages(wages: EconomyIndicator | undefined, cpi: EconomyIndicator | undefined): EconomyIndicator {
  const base: EconomyIndicator = {
    id: 'realWages',
    label: 'Real wage growth',
    value: Number.NaN,
    previous: Number.NaN,
    unit: 'percent',
    period: '',
    provenance: 'unavailable',
    measures: 'Wage growth minus inflation over the same year. Below zero, pay is buying less than it did.',
    agency: 'ABS',
    seriesKey: 'ABS WPI 3.THRPEB.7.TOT.10.AUS.Q minus ABS CPI 3.10001.10.50.M, same period',
    sourceUrl: wages?.sourceUrl ?? '',
    history: [],
    annual: Number.NaN,
    annualSpan: '',
  };
  if (!wages || !cpi || wages.provenance !== 'live' || cpi.provenance !== 'live') return base;

  const cpiAt = (period: string) => cpi.history.find((o) => o.period === periodEndMonth(period))?.value;
  const points: EconomyObservation[] = [];
  for (const w of wages.history) {
    const c = cpiAt(w.period);
    if (c !== undefined) points.push({ period: w.period, value: Math.round((w.value - c) * 10) / 10 });
  }
  const latest = points[points.length - 1];
  if (!latest) return base;
  const prior = points[points.length - 2];
  const previous = prior?.value ?? Number.NaN;
  const diff = Number.isFinite(previous) ? round1(latest.value) - round1(previous) : Number.NaN;
  return {
    ...base,
    value: latest.value,
    previous,
    period: latest.period,
    direction: Number.isFinite(diff) ? (Math.abs(diff) < 0.05 ? 'flat' : diff > 0 ? 'up' : 'down') : undefined,
    provenance: 'live',
    history: points,
  };
}

export interface EconomySnapshot {
  indicators: EconomyIndicator[];
  /** When this snapshot was assembled (ISO). Not the data's period - that is per indicator. */
  assembledAt: string;
}

/** Fetch every series in parallel and shape the snapshot. Never throws. */
export async function getEconomySnapshot(options: EconomySnapshotOptions = {}): Promise<EconomySnapshot> {
  const loaded = await Promise.all(
    ECONOMY_SERIES.map(async (def) => {
      const [series, levels] = await Promise.all([
        loadSeries(def.source, options),
        def.levels ? loadSeries(def.levels, options) : Promise.resolve([] as EconomyObservation[]),
      ]);
      return { indicator: buildIndicator(def, series, levels), series };
    }),
  );
  const indicators = loaded.map((l) => l.indicator);

  // An indicator keeps 8 points of history for display, but the real-wage join needs the CPI
  // months that line up with every WPI quarter - so it reads CPI's full fetched run.
  const cpi = loaded.find((l) => l.indicator.id === 'cpi');
  const wages = indicators.find((i) => i.id === 'wages');
  const realWages = deriveRealWages(wages, cpi ? { ...cpi.indicator, history: cpi.series } : undefined);

  return { indicators: [...indicators, realWages], assembledAt: new Date().toISOString() };
}
