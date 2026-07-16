/**
 * Read-only AI tools - the real implementations behind the agent registry's tool grants. These let
 * an agent FETCH deterministic evidence instead of narrating a single fixed snapshot. Every tool is
 * read-only and side-effect-free; nothing here can place an order or mutate state (the forbidden
 * tools have no implementation at all, by design). Executed only through the fail-closed gate in
 * ./runtime so an agent can never call a tool it was not granted.
 */
import { THEMES, THEME_COMPANIES, SUPPLY_CHAIN_NODES, getThemeCompanies } from '@/lib/world-radar';
import iposData from '@/lib/generated/ipos.json';
import { FINANCE_FACTS } from '@/lib/finance-facts';
import { EDUCATION_MODULES, getModuleCorpusText, getModuleHref } from '@/lib/education';
import { getDashboardData } from '@/lib/data';
import { buildSignalIntelligence, topConvergence, SIGNAL_KIND_LABEL } from '@/lib/signal-intelligence';
import { loadTwinReflection } from '@/lib/twin/repo';
import { getUserConstraints } from '@/lib/ai/user-context';
import { getOutcomeDistribution, expectancyFromOutcome } from '@/lib/outcomes';
import { backingFor, stageFor } from '@/lib/small-cap-lifecycle';
import { buildTradePlan, renderTradePlanText } from '@/lib/edge/trade-plan';

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

/**
 * The requesting user's own trading twin - a deterministic, research-only model of their interests,
 * habits, and revealed risk posture (from their watchlist + paper trades). RLS-scoped to the caller;
 * returns a not-enough-data marker when the twin is too thin or the user is not signed in. This is
 * EVIDENCE the agent may cite to meet the user where they are ("you usually lean into gov-award
 * names") - never a control, never advice. The reflection text is already neutral and guardrailed.
 */
export async function readTradingTwin() {
  const reflection = await loadTwinReflection();
  if (!reflection || !reflection.hasEnoughData) {
    return { hasEnoughData: false, note: 'The user does not have enough trading history yet for a twin profile.' };
  }
  return {
    hasEnoughData: true,
    observations: reflection.observations,
    statedRisk: reflection.reconciliation.statedRisk,
    revealedRisk: reflection.reconciliation.revealedRisk,
    riskGap: reflection.reconciliation.gap,
    topThemes: reflection.topThemes,
    trustedSignalKinds: reflection.topSignalKinds.map((k) => k.label),
    stageLean: reflection.stageLean,
    disclaimer: 'Research about the user, from their own behaviour. Cite to personalise framing; never turn into advice.',
  };
}

/**
 * A deterministic, cost-aware trade PLAN for a symbol, sized against the signed-in user's OWN
 * capital and stop. This is the decision-moment version of the standalone calculator: it floors to
 * whole shares, tells a small account when an entry price is out of reach, nets expectancy against
 * realistic round-trip friction (fixed commission + FX + liquidity-scaled slippage), and raises
 * neutral risk flags. RLS-scoped to the caller for the capital read; returns a no-context marker
 * when the user has not set their available cash. Research only - it computes sizing and cost math,
 * it is never a recommendation to place the trade. The agent must present the flags, not launder
 * them into a "go" signal.
 */
export async function readTradePlan(args: {
  symbol: string;
  entryPrice?: number;
  stopPrice?: number;
  targetPrice?: number;
  riskPercentPerTrade?: number;
}) {
  const symbol = String(args.symbol ?? '').toUpperCase().trim();
  if (!symbol) return { hasPlan: false, note: 'A symbol is required to build a trade plan.' };

  const constraints = await getUserConstraints();
  const accountSize = typeof constraints?.cashAvailable === 'number' && constraints.cashAvailable > 0 ? constraints.cashAvailable : null;
  if (accountSize === null) {
    return { hasPlan: false, note: 'The user has not set their available cash, so a sized plan cannot be built. Ask them to set it in settings.' };
  }

  const data = await getDashboardData();
  const sig = data.signals.find((s) => s.symbol === symbol);
  const entryPrice = typeof args.entryPrice === 'number' && args.entryPrice > 0 ? args.entryPrice : sig?.close;
  if (!entryPrice || entryPrice <= 0) {
    return { hasPlan: false, note: `No price is available for ${symbol}. Supply an entryPrice to build a plan.` };
  }

  // Enrich from the covered small-cap universe when the name is present.
  const company = getThemeCompanies().find((c) => c.symbol.toUpperCase() === symbol);
  const liquidity = company?.liquidity;
  const lifecycleStage = company ? stageFor(company, backingFor(company.symbol), sig?.score ?? 50) : undefined;

  const dist = sig ? getOutcomeDistribution('momentum_recovery_v1', String(sig.status)) : null;
  const outcome = expectancyFromOutcome(dist);
  const baseCurrency = constraints?.baseCurrency ?? 'USD';

  const plan = buildTradePlan({
    symbol,
    entryPrice,
    stopPrice: args.stopPrice,
    targetPrice: args.targetPrice,
    accountSize,
    riskPercentPerTrade: typeof args.riskPercentPerTrade === 'number' ? args.riskPercentPerTrade : 1,
    maxPositionPct: typeof constraints?.maxPositionSizePct === 'number' ? constraints.maxPositionSizePct : 20,
    crossCurrency: baseCurrency.toUpperCase() !== 'USD',
    liquidity,
    lifecycleStage,
    outcome,
    provenance: dist?.provenance,
  });

  return {
    hasPlan: true,
    plan,
    text: renderTradePlanText(plan),
    disclaimer:
      "Deterministic sizing and cost math from the user's own capital and stop. Research only - present the flags honestly; never turn this into a recommendation to place the trade.",
  };
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
