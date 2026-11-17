/**
 * Indicator fixtures for the economy read. `JUNE_2026` is the live ABS/RBA read captured on
 * 2026-11-18 - the release behind the founder's "2.1% GDP but 0.7% per person" video - so the
 * regression case is the real one, not an invented economy.
 */
import { ECONOMY_SERIES, seriesKeyLabel } from '../series';
import type { EconomyIndicator, EconomyObservation } from '../types';

export function indicator(id: string, over: Partial<EconomyIndicator> = {}): EconomyIndicator {
  const def = ECONOMY_SERIES.find((d) => d.id === id);
  return {
    id,
    label: def?.label ?? id,
    value: Number.NaN,
    previous: Number.NaN,
    unit: def?.unit ?? 'percent',
    period: '',
    provenance: 'live',
    measures: def?.measures ?? '',
    agency: def?.source.agency ?? 'ABS',
    seriesKey: def ? seriesKeyLabel(def) : id,
    sourceUrl: def?.sourceUrl ?? 'https://www.abs.gov.au/',
    history: [],
    annual: Number.NaN,
    annualSpan: '',
    ...over,
  };
}

const monthly = (values: number[], lastYear = 2026, lastMonth = 9): EconomyObservation[] =>
  values.map((value, i) => {
    const offset = values.length - 1 - i;
    const m = lastMonth - offset;
    const y = lastYear + Math.floor((m - 1) / 12);
    const mm = ((((m - 1) % 12) + 12) % 12) + 1;
    return { period: `${y}-${String(mm).padStart(2, '0')}`, value };
  });

export const JUNE_2026: EconomyIndicator[] = [
  indicator('gdp', { value: 0.4, previous: 0.3, period: '2026-Q2', direction: 'up', annual: 2.14, annualSpan: '2025-Q2 to 2026-Q2' }),
  indicator('gdpPerCapita', { value: 0, previous: -0.1, period: '2026-Q2', direction: 'flat', annual: 0.68, annualSpan: '2025-Q2 to 2026-Q2' }),
  indicator('population', { value: 1.43, previous: 1.46, period: '2026-Q1', direction: 'down' }),
  indicator('contribHousehold', { value: 0.2, previous: 0.2, period: '2026-Q2', direction: 'up' }),
  indicator('contribGovernment', { value: 0.1, previous: -0.1, period: '2026-Q2', direction: 'up' }),
  indicator('contribPublicInvestment', { value: -0.1, previous: 0, period: '2026-Q2', direction: 'down' }),
  indicator('contribPrivateInvestment', { value: 0, previous: 0.8, period: '2026-Q2', direction: 'flat' }),
  indicator('contribExports', { value: 0.2, previous: -0.3, period: '2026-Q2', direction: 'up' }),
  indicator('incomePerCapita', { value: -0.4, previous: 0.3, period: '2026-Q2', direction: 'down', annual: 0.05, annualSpan: '2025-Q2 to 2026-Q2' }),
  indicator('productivity', { value: 0, previous: -0.6, period: '2026-Q2', direction: 'flat', annual: -0.2, annualSpan: '2025-Q2 to 2026-Q2' }),
  indicator('hoursWorked', { value: 0.4, previous: 0.9, period: '2026-Q2', direction: 'up', annual: 2.35, annualSpan: '2025-Q2 to 2026-Q2' }),
  indicator('wages', { value: 3.2, previous: 3.2, period: '2026-Q2', direction: 'flat' }),
  indicator('savingRatio', { value: 6.5, previous: 6.4, period: '2026-Q2', direction: 'up' }),
  indicator('cpi', { value: 4.3, previous: 4.0, period: '2026-09', direction: 'up' }),
  indicator('cpiTrimmed', { value: 3.6, previous: 3.5, period: '2026-09', direction: 'up' }),
  indicator('cashRate', { value: 4.6, previous: 4.36, period: '2026-10', direction: 'up', agency: 'RBA' }),
  indicator('unemployment', {
    value: 4.71834873,
    previous: 4.65160785,
    period: '2026-09',
    direction: 'flat',
    history: monthly([4.5, 4.5, 4.6, 4.6, 4.6, 4.7, 4.65160785, 4.71834873]),
  }),
  indicator('underemployment', { value: 6.3258024, previous: 6.2219544, period: '2026-09', direction: 'up' }),
  indicator('participation', { value: 66.76317272, previous: 66.99604671, period: '2026-09', direction: 'down' }),
  indicator('realWages', { value: -0.6, previous: -1.4, period: '2026-Q2', direction: 'up' }),
];

/** Replace some indicators in a set by id - for "what if the data turned" cases. */
export function withChanges(base: EconomyIndicator[], changes: Record<string, Partial<EconomyIndicator>>): EconomyIndicator[] {
  return base.map((i) => (changes[i.id] ? { ...i, ...changes[i.id] } : i));
}

/** Mark indicators unavailable exactly the way the snapshot does: NaN value, no period. */
export function withMissing(base: EconomyIndicator[], ids: string[]): EconomyIndicator[] {
  return base.map((i) =>
    ids.includes(i.id)
      ? { ...i, value: Number.NaN, previous: Number.NaN, period: '', provenance: 'unavailable' as const, annual: Number.NaN, annualSpan: '', direction: undefined, history: [] }
      : i,
  );
}
