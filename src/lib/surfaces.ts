/**
 * Surface identity - maps a pathname to a stable "surface" key + human label, so usage rolls up per
 * destination (all /tickers/NVDA, /tickers/AMD ... count as one "Ticker detail" surface). Pure.
 */

export const SURFACE_LABELS: Record<string, string> = {
  '/': 'Command',
  '/portfolio': 'Portfolio',
  '/watchlist': 'Watchlist',
  '/plan': 'Trade Plan',
  '/trades': 'Trade Log',
  '/twin': 'Your Twin',
  '/radar': 'Signal Radar',
  '/small-caps': 'Small Caps',
  '/themes': 'World Radar',
  '/smart-money': 'Smart Money',
  '/investors': 'Investor Radar',
  '/ipos': 'IPO Radar',
  '/calendar': 'Calendar',
  '/wire': 'Live Wire',
  '/findings': 'Findings',
  '/intelligence': 'Intelligence',
  '/filings': 'Filings',
  '/fundamentals': 'Fundamentals',
  '/supply-chain': 'Supply Chain',
  '/comparison': 'Comparison Lab',
  '/charts': 'Charts',
  '/graph': 'Investigation Graph',
  '/awards': 'Gov Awards',
  '/flows': 'Capital Flows',
  '/commodities': 'Commodities',
  '/paper-bot': 'Paper Bot',
  '/trading': 'Live Bot',
  '/simulation': 'Simulation Lab',
  '/strategy-lab': 'Strategy Lab',
  '/track-record': 'Track Record',
  '/calculators': 'Calculators',
  '/education': 'Education',
  '/settings': 'Strategy Rules',
  '/saved': 'Saved',
  '/whats-new': "What's New",
  '/tickers': 'Ticker detail',
  '/usage': 'Your Activity',
  '/onboarding': 'Onboarding',
  '/welcome': 'Welcome',
  '/account': 'Account',
};

/** Collapse a pathname to its top-level surface key: '/' or '/<first-segment>'. */
export function normalizeSurface(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  const seg = pathname.split('/').filter(Boolean)[0];
  return seg ? `/${seg}` : '/';
}

const prettify = (seg: string) =>
  seg
    .replace(/^\//, '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') || 'Command';

/** Human label for a surface key, falling back to a prettified segment. */
export function surfaceLabelFor(pathnameOrKey: string): string {
  const key = normalizeSurface(pathnameOrKey);
  return SURFACE_LABELS[key] ?? prettify(key);
}
