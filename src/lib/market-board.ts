/**
 * Market board - the macro "world" data for the Charts hub: top commodities, top global
 * exchanges (incl. ASX), and key rates. Illustrative values + short series in the same
 * spirit as the rest of the demo data (see COMMODITIES_NOTES_SAMPLE / market-context); the
 * flag below stays true until live prices wire in. Research context, never advice.
 */
export interface BoardItem {
  key: string;
  label: string;
  /** Pre-formatted display value. */
  value: string;
  changePct: number;
  /** Short sparkline series, oldest -> newest. */
  series: number[];
  /** Small context tag (region / unit / theme). */
  meta: string;
}

export interface RateItem {
  key: string;
  label: string;
  value: string;
  change: string;
  direction: 'up' | 'down' | 'flat';
  implication: string;
  source: string;
  sourceUrl: string;
}

export const MARKET_BOARD_SAMPLE = true;

export const COMMODITIES_BOARD: BoardItem[] = [
  { key: 'gold', label: 'Gold', value: '$2,364', changePct: 0.32, series: [2310, 2325, 2318, 2340, 2351, 2348, 2360, 2364], meta: 'oz · haven' },
  { key: 'oil', label: 'Crude oil', value: '$82.15', changePct: -1.45, series: [85.1, 84.6, 84.0, 83.2, 83.5, 82.9, 82.6, 82.15], meta: 'WTI · bbl' },
  { key: 'copper', label: 'Copper', value: '$4.62', changePct: 0.88, series: [4.48, 4.51, 4.5, 4.55, 4.57, 4.56, 4.6, 4.62], meta: 'lb · buildout' },
  { key: 'silver', label: 'Silver', value: '$30.85', changePct: 1.12, series: [29.8, 30.1, 30.0, 30.3, 30.5, 30.4, 30.7, 30.85], meta: 'oz · solar' },
  { key: 'uranium', label: 'Uranium', value: '$91.50', changePct: 0.55, series: [88, 89, 88.5, 90, 90.5, 90.2, 91, 91.5], meta: 'lb · nuclear' },
];

export const EXCHANGES_BOARD: BoardItem[] = [
  { key: 'sp500', label: 'S&P 500', value: '5,482', changePct: 0.45, series: [5421, 5438, 5430, 5455, 5462, 5458, 5476, 5482], meta: 'US' },
  { key: 'nasdaq', label: 'Nasdaq', value: '17,836', changePct: 0.82, series: [17610, 17680, 17655, 17720, 17760, 17745, 17810, 17836], meta: 'US tech' },
  { key: 'asx200', label: 'ASX 200', value: '7,912', changePct: 0.21, series: [7880, 7895, 7888, 7902, 7908, 7901, 7910, 7912], meta: 'Australia' },
  { key: 'ftse', label: 'FTSE 100', value: '8,245', changePct: -0.18, series: [8268, 8260, 8255, 8248, 8252, 8246, 8250, 8245], meta: 'UK' },
  { key: 'nikkei', label: 'Nikkei 225', value: '38,420', changePct: 0.64, series: [38110, 38200, 38160, 38280, 38340, 38310, 38390, 38420], meta: 'Japan' },
];

export const RATES_BOARD: RateItem[] = [
  { key: 'rba', label: 'RBA cash rate', value: '3.85%', change: '-0.25', direction: 'down', implication: 'Cuts ease financial conditions - a tailwind for risk assets.', source: 'RBA', sourceUrl: 'https://www.rba.gov.au/statistics/cash-rate/' },
  { key: 'us10y', label: 'US 10Y yield', value: '3.98%', change: '+0.08', direction: 'up', implication: 'Higher long yields pressure high-multiple, long-duration tech.', source: 'US Treasury', sourceUrl: 'https://home.treasury.gov/' },
  { key: 'fed', label: 'US Fed funds', value: '4.50%', change: '0.00', direction: 'flat', implication: 'On hold - the market reads every word of the dot plot.', source: 'Federal Reserve', sourceUrl: 'https://www.federalreserve.gov/' },
];
