/**
 * Shared scales + labels for the Model Lab visualisations. Pure functions, no dependencies - the whole
 * viz layer is hand-drawn SVG/CSS so it stays honest (every pixel maps to a real field) and adds no
 * bundle weight. Colour encodes a 0-100 domain score on a weak->strong ramp; `unavailable` never gets a
 * colour (it is drawn as an explicit empty state), so the eye never reads "grey" as "low" by accident.
 */

/** Short axis/column labels for the 10 EW domains - keyed by the engine's canonical domain key. */
export const SHORT_DOMAIN: Record<string, string> = {
  technical: 'Tech',
  accumulation: 'Accum',
  liquidity: 'Liq',
  theme: 'Theme',
  business_quality: 'Quality',
  capital: 'Capital',
  government: 'Gov',
  adoption: 'Adopt',
  sponsorship: 'Sponsor',
  narrative: 'Narr',
};

export function shortDomain(key: string, fallback: string): string {
  return SHORT_DOMAIN[key] ?? fallback;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Weak->strong colour for a 0-100 score: red (weak) -> amber (mid) -> emerald (strong). Returns an
 * `hsl()` string; pass `alpha` for fills. Intuitive direction: high domain score = green = good.
 */
export function scoreColor(score: number, alpha = 1): string {
  const t = Math.max(0, Math.min(1, score / 100));
  const hue = t < 0.5 ? lerp(2, 46, t / 0.5) : lerp(46, 152, (t - 0.5) / 0.5);
  const sat = lerp(58, 68, t);
  const light = lerp(46, 52, t);
  return alpha >= 1 ? `hsl(${hue} ${sat}% ${light}%)` : `hsl(${hue} ${sat}% ${light}% / ${alpha})`;
}

/** Colour for a risk verdict - the opportunity-map bubble colour. */
export function riskColor(verdict: 'pass' | 'review' | 'block' | string): string {
  if (verdict === 'pass') return 'hsl(152 62% 46%)';
  if (verdict === 'review') return 'hsl(38 92% 55%)';
  return 'hsl(2 74% 56%)'; // block / anything else
}

/** Compact market-cap label, e.g. 1_520_000_000 -> "$1.5B". Null = "n/a". */
export function fmtCap(cap: number | null | undefined): string {
  if (cap == null || !isFinite(cap)) return 'n/a';
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`;
  if (cap >= 1e6) return `$${Math.round(cap / 1e6)}M`;
  return `$${Math.round(cap / 1e3)}K`;
}

/** Bubble radius from a market cap on a gentle log scale, clamped so nothing dominates. */
export function capRadius(cap: number | null | undefined, min = 5, max = 20): number {
  if (cap == null || cap <= 0) return min;
  // log10($100M)=8 .. log10($3T)=12.5 mapped to [min,max]
  const l = Math.log10(cap);
  const t = Math.max(0, Math.min(1, (l - 8) / (12.5 - 8)));
  return lerp(min, max, t);
}
