/**
 * Local macro / economic context - the "country of residence" backdrop that sits
 * below the global market-context strip on the Command page.
 *
 * This is deliberately NOT correlated to the Nasdaq names the scanner tracks - it's
 * the *local* market backdrop (rates, inflation, jobs, migration) that helps the user
 * understand their own economy. Default country is Australia (RBA + ABS).
 *
 * Demo data only for now. A real build would wire RBA statistical tables + the ABS
 * data API and switch on a user "country of residence" setting.
 */

export type MacroStance = 'easing' | 'hold' | 'tightening';
export type DeltaDirection = 'up' | 'down' | 'flat';

export interface MacroIndicator {
  /** Short label, e.g. "Cash rate". */
  label: string;
  /** Display value, pre-formatted, e.g. "3.85%". */
  value: string;
  /** Optional change note, e.g. "-0.25" or "hold". */
  change?: string;
  /** Direction of the change, for a muted arrow (macro deltas are not coloured
   *  good/bad because up/down means different things per series). */
  direction?: DeltaDirection;
  /** Source attribution shown on hover, e.g. "RBA" / "ABS". */
  source?: string;
  /** Link to the primary source release - tapping the indicator opens it. */
  sourceUrl?: string;
  /** Plain-English "so what" - why this number matters for markets right now. */
  implication?: string;
}

export interface MacroSnapshot {
  country: string;
  countryCode: string;
  /** RBA (or local central bank) policy stance. */
  stance: MacroStance;
  stanceLabel: string;
  asOf: string;
  indicators: MacroIndicator[];
  /** Link to the monthly RBA chart pack (the founder reads this each month). */
  chartPackUrl: string;
  chartPackLabel: string;
  isDemo: boolean;
}

const AUSTRALIA_DEMO: MacroSnapshot = {
  country: 'Australia',
  countryCode: 'AU',
  stance: 'easing',
  stanceLabel: 'RBA easing',
  asOf: '2026-06-06',
  indicators: [
    { label: 'Cash rate', value: '3.85%', change: '-0.25', direction: 'down', source: 'RBA', sourceUrl: 'https://www.rba.gov.au/statistics/cash-rate/', implication: 'rate cuts ease financial conditions - a tailwind for risk assets' },
    { label: 'CPI (YoY)', value: '2.8%', change: '-0.3', direction: 'down', source: 'ABS', sourceUrl: 'https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release', implication: 'inside the RBA 2-3% band - gives room to keep easing' },
    { label: 'Unemployment', value: '4.3%', change: '+0.1', direction: 'up', source: 'ABS', sourceUrl: 'https://www.abs.gov.au/statistics/labour/employment-and-unemployment/labour-force-australia/latest-release', implication: 'labour softening - dovish, supports more cuts' },
    { label: 'GDP (YoY)', value: '1.8%', change: '+0.2', direction: 'up', source: 'ABS', sourceUrl: 'https://www.abs.gov.au/statistics/economy/national-accounts/australian-national-accounts-national-income-expenditure-and-product/latest-release', implication: 'soft but positive growth - no recession signal' },
    { label: 'Wages (WPI)', value: '3.5%', change: '-0.1', direction: 'down', source: 'ABS', sourceUrl: 'https://www.abs.gov.au/statistics/labour/earnings-and-working-conditions/wage-price-index-australia/latest-release', implication: 'wage pressure easing - keeps inflation contained' },
    { label: 'AUD/USD', value: '0.668', change: '+0.34%', direction: 'up', source: 'RBA', sourceUrl: 'https://www.rba.gov.au/statistics/frequency/exchange-rates.html', implication: 'a softer AUD flatters offshore-earning exporters' },
    { label: 'ASX 200', value: '8,120.5', change: '+0.41%', direction: 'up', source: 'ASX', sourceUrl: 'https://finance.yahoo.com/quote/%5EAXJO/', implication: 'local market firm - risk appetite holding up' },
  ],
  chartPackUrl: 'https://www.rba.gov.au/chart-pack/',
  chartPackLabel: 'RBA chart pack',
  isDemo: true,
};

/**
 * Returns the macro snapshot for the user's country of residence. Only Australia is
 * populated today; other countries fall back to the AU demo until ABS/RBA-equivalent
 * sources are wired per country.
 */
export async function getMacroContext(countryCode = 'AU'): Promise<MacroSnapshot> {
  // Placeholder for a future per-country source switch.
  void countryCode;
  return AUSTRALIA_DEMO;
}
