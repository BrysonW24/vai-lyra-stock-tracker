/**
 * Chart pack - RBA/FRED-style macro indicators for the Charts hub's Economy and Markets
 * tabs, plus extra commodity series. Curated illustrative values + short series (flagged)
 * until live FRED / RBA / market feeds wire in. Macro deltas are shown directionally and
 * neutrally - meaning lives in each indicator's note, so we never colour "rising
 * unemployment" green. Research context, never advice.
 */
import type { BoardItem } from '@/lib/market-board';

export type Region = 'US' | 'AU' | 'Global';

export interface MacroIndicator {
  key: string;
  label: string;
  value: string;
  delta: string;
  direction: 'up' | 'down' | 'flat';
  series: number[];
  region: Region;
  note: string;
}

export const CHART_PACK_SAMPLE = true;

export const ECONOMY: MacroIndicator[] = [
  { key: 'us-gdp', label: 'US GDP growth', value: '2.4%', delta: '+0.1', direction: 'up', series: [2.1, 2.0, 2.2, 2.3, 2.2, 2.3, 2.4, 2.4], region: 'US', note: 'Output growth - the primary gauge of economic health.' },
  { key: 'us-cpi', label: 'US CPI', value: '3.1%', delta: '-0.2', direction: 'down', series: [3.7, 3.5, 3.4, 3.3, 3.2, 3.3, 3.2, 3.1], region: 'US', note: 'Headline inflation - cooling toward target eases rate pressure.' },
  { key: 'us-corecpi', label: 'US core CPI', value: '3.4%', delta: '-0.1', direction: 'down', series: [3.9, 3.8, 3.7, 3.6, 3.5, 3.5, 3.4, 3.4], region: 'US', note: 'Ex food + energy - the stickier read the Fed watches.' },
  { key: 'us-unemp', label: 'US unemployment', value: '4.1%', delta: '+0.1', direction: 'up', series: [3.8, 3.9, 3.9, 4.0, 4.0, 4.0, 4.1, 4.1], region: 'US', note: 'Labour slack - rising slowly off cycle lows.' },
  { key: 'us-pmi', label: 'US mfg PMI', value: '49.2', delta: '+0.6', direction: 'up', series: [47.1, 47.8, 48.0, 48.5, 48.6, 48.8, 49.0, 49.2], region: 'US', note: 'Below 50 = contraction; manufacturing soft but improving.' },
  { key: 'us-housing', label: 'US housing starts', value: '1.35M', delta: '+0.03', direction: 'up', series: [1.28, 1.3, 1.29, 1.31, 1.33, 1.32, 1.34, 1.35], region: 'US', note: 'Construction pulse - feeds materials + consumer wealth.' },
  { key: 'au-cpi', label: 'AU CPI', value: '2.8%', delta: '-0.3', direction: 'down', series: [3.6, 3.4, 3.3, 3.1, 3.0, 3.0, 2.9, 2.8], region: 'AU', note: 'Back inside the RBA 2-3% band - supports the easing path.' },
  { key: 'au-unemp', label: 'AU unemployment', value: '4.0%', delta: '+0.1', direction: 'up', series: [3.7, 3.8, 3.8, 3.9, 3.9, 4.0, 4.0, 4.0], region: 'AU', note: 'AU labour market loosening gently.' },
];

export const MARKETS: MacroIndicator[] = [
  { key: 'yc-10y2y', label: '10Y-2Y spread', value: '+12 bps', delta: '+8', direction: 'up', series: [-18, -12, -6, -2, 2, 6, 9, 12], region: 'US', note: 'Yield-curve slope - un-inverting after a long inversion. Watch closely.' },
  { key: 'us-10y', label: 'US 10Y yield', value: '3.98%', delta: '+0.08', direction: 'up', series: [3.82, 3.86, 3.84, 3.9, 3.92, 3.95, 3.96, 3.98], region: 'US', note: 'Long rate - higher pressures long-duration tech.' },
  { key: 'us-2y', label: 'US 2Y yield', value: '3.86%', delta: '0.00', direction: 'flat', series: [3.95, 3.92, 3.9, 3.88, 3.87, 3.86, 3.86, 3.86], region: 'US', note: 'Policy-sensitive - drifting with rate-cut odds.' },
  { key: 'ig-spread', label: 'IG credit spread', value: '92 bps', delta: '-3', direction: 'down', series: [102, 99, 98, 96, 95, 94, 93, 92], region: 'US', note: 'Investment-grade risk premium - tight means calm credit.' },
  { key: 'hy-spread', label: 'HY credit spread', value: '315 bps', delta: '+6', direction: 'up', series: [298, 302, 305, 308, 310, 312, 313, 315], region: 'US', note: 'High-yield premium - widening can lead equity wobbles.' },
  { key: 'vix', label: 'VIX', value: '17.3', delta: '+2.1%', direction: 'up', series: [15.8, 16.2, 16.0, 16.8, 17.0, 16.9, 17.1, 17.3], region: 'Global', note: "Equity 'fear gauge' - low-to-moderate; calm tape." },
  { key: 'move', label: 'MOVE (bond vol)', value: '98', delta: '-1.4%', direction: 'down', series: [104, 103, 102, 101, 100, 99, 99, 98], region: 'Global', note: 'Rate volatility - easing as the path firms up.' },
  { key: 'stress', label: 'Fin. stress index', value: '-0.4', delta: '+0.1', direction: 'up', series: [-0.7, -0.6, -0.6, -0.5, -0.5, -0.4, -0.4, -0.4], region: 'US', note: 'Composite stress - below zero = below-average stress.' },
];

/** Extra commodities beyond the World board, to round out the Commodities tab. */
export const COMMODITIES_EXTRA: BoardItem[] = [
  { key: 'natgas', label: 'Nat gas', value: '$3.12', changePct: -2.1, series: [3.28, 3.24, 3.2, 3.18, 3.15, 3.16, 3.14, 3.12], meta: 'MMBtu · power' },
  { key: 'lithium', label: 'Lithium', value: '$13,850', changePct: -0.8, series: [14200, 14100, 14050, 13980, 13920, 13900, 13880, 13850], meta: 't · batteries' },
  { key: 'nickel', label: 'Nickel', value: '$17,420', changePct: 0.6, series: [17150, 17220, 17190, 17280, 17330, 17310, 17390, 17420], meta: 't · batteries' },
  { key: 'ironore', label: 'Iron ore', value: '$98.40', changePct: -1.1, series: [101.2, 100.5, 100.0, 99.4, 99.0, 98.8, 98.6, 98.4], meta: 't · AU export' },
];
