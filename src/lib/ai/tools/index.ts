/**
 * Read-only AI tools - the real implementations behind the agent registry's tool grants. These let
 * an agent FETCH deterministic evidence instead of narrating a single fixed snapshot. Every tool is
 * read-only and side-effect-free; nothing here can place an order or mutate state (the forbidden
 * tools have no implementation at all, by design). Executed only through the fail-closed gate in
 * ./runtime so an agent can never call a tool it was not granted.
 */
import { THEMES, THEME_COMPANIES, SUPPLY_CHAIN_NODES } from '@/lib/world-radar';
import iposData from '@/lib/generated/ipos.json';
import { FINANCE_FACTS } from '@/lib/finance-facts';
import { EDUCATION_MODULES, getModuleCorpusText, getModuleHref } from '@/lib/education';
import { getDashboardData } from '@/lib/data';
import { buildSignalIntelligence, topConvergence, SIGNAL_KIND_LABEL } from '@/lib/signal-intelligence';

/** Matches the agent registry's evidenceItemSchema: { id, text }. */
export interface EvidenceItem {
  id: string;
  text: string;
}

interface IpoRow {
  symbol: string;
  companyName: string;
  ipoDate: string;
  offerPrice: number;
  currentPrice: number;
  returnSinceIpoPct: number;
}

/** The searchable evidence corpus, built once from the compiled content layer. */
const CORPUS: EvidenceItem[] = (() => {
  const items: EvidenceItem[] = [];
  for (const t of THEMES) {
    items.push({ id: `theme:${t.slug}`, text: `${t.name} theme (${t.maturity}, momentum ${Math.round(t.momentum)}/100): ${t.thesis} Bottlenecks: ${t.bottlenecks.join(', ')}. Falsifier: ${t.falsifier}` });
  }
  for (const c of THEME_COMPANIES) {
    items.push({ id: `company:${c.symbol}`, text: `${c.name} (${c.symbol}) - ${c.theme} theme, ${c.exposure} exposure: ${c.whyItMatters}` });
  }
  for (const n of SUPPLY_CHAIN_NODES) {
    items.push({ id: `node:${n.id}`, text: `${n.name} (${n.theme} supply chain, bottleneck ${n.bottleneck}/100, scarcity ${n.scarcity}/100): ${n.whyItMatters}` });
  }
  for (const i of iposData as IpoRow[]) {
    items.push({ id: `ipo:${i.symbol}`, text: `${i.companyName} (${i.symbol}) IPO ${i.ipoDate} at $${i.offerPrice}, now $${i.currentPrice} (${i.returnSinceIpoPct >= 0 ? '+' : ''}${i.returnSinceIpoPct}% since IPO)` });
  }
  for (const f of FINANCE_FACTS) {
    items.push({ id: `fact:${f.id}`, text: `${f.term}: ${f.body}` });
  }
  // Deep, console-grounded education modules. Each carries definition + why-it-matters +
  // how-the-console-uses-it plus an academy link, so the AI can teach HOW a metric drives
  // the deterministic score and point the user back into the academy (cite the `edu:<id>`).
  for (const m of EDUCATION_MODULES) {
    items.push({ id: `edu:${m.id}`, text: `${getModuleCorpusText(m)} Learn more: ${getModuleHref(m.id)}` });
  }
  return items;
})();

/** Keyword search over the content layer. Deterministic, no embeddings. Symbol/id hits are boosted. */
export function searchEvidence(query: string, limit = 6): EvidenceItem[] {
  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  if (terms.length === 0) return [];
  const scored = CORPUS.map((item) => {
    const text = item.text.toLowerCase();
    const id = item.id.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (text.includes(term)) score += 1;
      if (id.endsWith(`:${term}`)) score += 3; // exact symbol/slug match
    }
    return { item, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.item);
}

/** Deterministic signal snapshot for a symbol (or the top signals when no symbol given). */
export async function readSignals(symbol?: string) {
  const data = await getDashboardData();
  const signals = symbol
    ? data.signals.filter((s) => s.symbol === symbol.toUpperCase())
    : [...data.signals].sort((a, b) => b.score - a.score).slice(0, 10);
  return signals.map((s) => ({
    symbol: s.symbol,
    score: s.score,
    scoreDelta: s.scoreDelta,
    rsi: Math.round(s.rsi),
    macdState: s.macdState,
    volumeRatio: Number(s.volumeRatio.toFixed(2)),
    status: s.status,
  }));
}

/**
 * Cross-signal convergence - the "reasoning over the multitude of signals" layer surfaced as a
 * read-only tool. Returns the names where the MOST independent signal kinds converge (government
 * awards, big-tech backing, smart money, supply-chain bottleneck, momentum, IPO), ranked by
 * deterministic conviction. This is how an agent finds "the most effective data points" instead of
 * narrating one fixed snapshot. Every field is engine-computed; the AI never invents a number.
 *
 * `minKinds` (default 2) enforces the convergence discipline: a single signal is never a thesis.
 * Each returned name carries its freshness (`live` when any converging signal is from a live feed,
 * else `sample`) so the agent can disclose staleness rather than present sample data as current.
 */
export async function readConvergence(limit = 6, minKinds = 2) {
  const data = await getDashboardData();
  const momentumBySymbol = Object.fromEntries(data.signals.map((s) => [s.symbol, s.score]));
  const intel = buildSignalIntelligence(momentumBySymbol);
  const top = topConvergence(intel, limit, minKinds);
  return {
    generatedAt: intel.generatedAt,
    stats: intel.stats,
    convergence: top.map((c) => ({
      symbol: c.entity,
      name: c.name,
      theme: c.themeName,
      stage: c.stage,
      convergenceScore: c.convergenceScore,
      freshness: c.freshness,
      latestDate: c.latestDate,
      kinds: c.kinds.map((k) => SIGNAL_KIND_LABEL[k]),
      narrative: c.narrative,
      // The scored data points behind the convergence, best first - the evidence the agent cites.
      points: c.points.slice(0, 5).map((p) => ({
        kind: SIGNAL_KIND_LABEL[p.kind],
        headline: p.headline,
        detail: p.detail,
        date: p.date,
        impact: p.impact,
        score: p.score,
        source: p.source,
        freshness: p.freshness,
      })),
    })),
  };
}

/** The user's own holdings (read-only). */
export async function readPortfolioOwn() {
  const data = await getDashboardData();
  return data.portfolio.map((h) => ({
    symbol: h.symbol,
    marketValue: h.marketValue,
    unrealisedPnlPercent: h.unrealisedPnlPercent,
    portfolioWeight: Math.round(h.portfolioWeight),
  }));
}

/** Theme context (or one theme by slug). */
export function readThemes(slug?: string) {
  return (slug ? THEMES.filter((t) => t.slug === slug) : THEMES).map((t) => ({
    slug: t.slug,
    name: t.name,
    thesis: t.thesis,
    maturity: t.maturity,
    momentum: Math.round(t.momentum),
    bottlenecks: t.bottlenecks,
    falsifier: t.falsifier,
  }));
}
