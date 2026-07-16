/**
 * Small-Cap Lifecycle + Backing engine - the flagship "find them early, backed, and traceable"
 * layer on top of World Radar.
 *
 * The thesis (founder's): the way to catch an emerging-market winner early is to find a small/micro
 * cap that is (a) still early in its theme's maturity arc, (b) already backed by GOVERNMENT money
 * and/or BIG-TECH capital, and (c) sitting on a real supply-chain bottleneck with evidence on
 * record - not just narrative. This module composes the existing deterministic data (theme-companies,
 * capital-events, gov-awards, smart-money, 13F investors, the momentum scanner) into:
 *
 *   1. a LIFECYCLE STAGE per company (concept -> funded -> contracted -> scaling -> crowded),
 *   2. a BACKING profile (government / big-tech / smart-money, with the named backers), and
 *   3. an EMERGENCE score that ranks "early AND backed AND real" ahead of "obvious and crowded".
 *
 * Every number here is deterministic. AI never sets a stage or a score - it can only explain one.
 * Research only: nothing here is a buy/sell call.
 */
import {
  getSmallCapCompanies,
  getTheme,
  getNode,
  scoreCompany,
  CAPITAL_EVENTS,
  INVESTORS,
  type ThemeCompany,
  type CapitalEvent,
} from '@/lib/world-radar';
import { GOV_AWARDS } from '@/lib/gov-awards';
import { SMART_MONEY } from '@/lib/smart-money';

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** The emergence arc, earliest first. A name should move left-to-right as its thesis proves out. */
export type LifecycleStage = 'concept' | 'funded' | 'contracted' | 'scaling' | 'crowded';

export const LIFECYCLE_ORDER: LifecycleStage[] = ['concept', 'funded', 'contracted', 'scaling', 'crowded'];

export const LIFECYCLE_LABEL: Record<LifecycleStage, string> = {
  concept: 'Concept',
  funded: 'Funded',
  contracted: 'Contracted',
  scaling: 'Scaling',
  crowded: 'Crowded',
};

export const LIFECYCLE_BLURB: Record<LifecycleStage, string> = {
  concept: 'Early narrative, little hard evidence yet, no disclosed backing. Highest risk, highest optionality.',
  funded: 'Backed by government or big-tech capital, but revenue evidence is still thin. The bet is on execution.',
  contracted: 'Real contracts, awards or capacity on record. The thesis has left the slide deck.',
  scaling: 'Evidence plus a turning technical - the market is starting to re-rate it.',
  crowded: 'High evidence but the trade is obvious and crowded. Less edge left to capture.',
};

export type BackerKind = 'government' | 'big-tech' | 'smart-money';

export interface BackingSource {
  kind: BackerKind;
  /** Who is backing it (agency, hyperscaler, or fund). */
  name: string;
  /** The plain-English catalyst / what the money is for. */
  detail: string;
  /** ISO date when known. */
  date?: string;
}

export interface BackingProfile {
  government: boolean;
  bigTech: boolean;
  smartMoney: boolean;
  /** Count of distinct backing kinds present (0-3). */
  strength: number;
  sources: BackingSource[];
}

export interface EmergenceBreakdown {
  /** How early in the arc (earlier = higher). */
  earliness: number;
  /** Backing strength contribution. */
  backing: number;
  /** Evidence on record. */
  evidence: number;
  /** Supply-chain bottleneck exposure. */
  bottleneck: number;
  /** Momentum turning (from the scanner). */
  momentum: number;
  /** Combined hype/dilution/crowding drag (already subtracted). */
  riskPenalty: number;
  total: number;
}

export interface LifecycleCandidate {
  symbol: string;
  name: string;
  theme: string;
  themeName: string;
  themeEmoji: string;
  sizeBucket: ThemeCompany['sizeBucket'];
  stage: LifecycleStage;
  backing: BackingProfile;
  emergence: EmergenceBreakdown;
  /** The deterministic World Radar opportunity total, for cross-reference. */
  opportunityTotal: number;
  whyItMatters: string;
  evidenceSummary: string;
  /** One-line, deterministic "why it's on the shortlist now". */
  whyNow: string;
  risks: string[];
}

const HYPERSCALER_ACTORS = /meta|microsoft|amazon|google|alphabet|oracle|nvidia|openai|anthropic|apple|tesla|xai|verizon|at&t|at & t/i;
const GOVERNMENT_ACTORS =
  /\bnasa\b|department of defense|\bdod\b|department of energy|\bdoe\b|\bdarpa\b|space development agency|space force|\bus army\b|\bus navy\b|air force|department of commerce|\bchips\b|\barpa\b|national reconnaissance|\bnro\b|arena|austender|grantconnect|government|ministry|defence/i;

/**
 * Build the backing profile for a symbol from every independent evidence source, so no backing
 * signal is left dangling:
 *   - government: a gov award naming the ticker, a smart-money row with a government backer, OR a
 *                 capital event whose ACTOR is a government body (NASA, DoD, DoE, SDA, Army, ...)
 *   - big-tech:   a smart-money big-tech/big-ai backer, or a capital event whose actor is a
 *                 hyperscaler / strategic big-tech (incl. telecom anchors like Verizon/AT&T)
 *   - smart-money: a tracked 13F investor holding the name (a new/increase/hold counts as conviction)
 * Capital events with a government actor connect here as GOVERNMENT backing - the single most
 * important "early + backed" signal the flagship exists to surface.
 */
export function backingFor(symbol: string, events: CapitalEvent[] = CAPITAL_EVENTS): BackingProfile {
  const sym = symbol.toUpperCase();
  const sources: BackingSource[] = [];

  for (const award of GOV_AWARDS) {
    if (award.tickers.map((t) => t.toUpperCase()).includes(sym)) {
      sources.push({ kind: 'government', name: `${award.agency}`, detail: award.summary, date: award.date });
    }
  }

  for (const sm of SMART_MONEY) {
    if (sm.ticker.toUpperCase() !== sym) continue;
    if (sm.backer === 'government') {
      sources.push({ kind: 'government', name: sm.backerName, detail: sm.catalyst, date: sm.date });
    } else {
      // 'big-tech' | 'big-ai'
      sources.push({ kind: 'big-tech', name: sm.backerName, detail: sm.catalyst, date: sm.date });
    }
  }

  for (const ev of events) {
    if (ev.symbol?.toUpperCase() !== sym) continue;
    if (GOVERNMENT_ACTORS.test(ev.actor)) {
      sources.push({ kind: 'government', name: ev.actor, detail: ev.summary, date: ev.date });
    } else if (HYPERSCALER_ACTORS.test(ev.actor)) {
      sources.push({ kind: 'big-tech', name: ev.actor, detail: ev.summary, date: ev.date });
    }
  }

  for (const investor of INVESTORS) {
    const move = investor.moves.find((m) => m.symbol?.toUpperCase() === sym);
    if (move && (move.action === 'new' || move.action === 'increase' || move.action === 'hold')) {
      sources.push({
        kind: 'smart-money',
        name: investor.name,
        detail: move.note || `${investor.firm} ${move.action} (${investor.filingType})`,
        date: investor.filingDate,
      });
    }
  }

  const government = sources.some((s) => s.kind === 'government');
  const bigTech = sources.some((s) => s.kind === 'big-tech');
  const smartMoney = sources.some((s) => s.kind === 'smart-money');

  return {
    government,
    bigTech,
    smartMoney,
    strength: Number(government) + Number(bigTech) + Number(smartMoney),
    // De-dupe by (kind,name) so one backer named twice is one source; cap the list.
    sources: dedupeSources(sources).slice(0, 6),
  };
}

function dedupeSources(sources: BackingSource[]): BackingSource[] {
  const seen = new Set<string>();
  const out: BackingSource[] = [];
  for (const s of sources) {
    const key = `${s.kind}:${s.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/**
 * Deterministic lifecycle stage. The order of checks is the arc read backwards: a name only earns a
 * later stage if the earlier gates are cleared. `momentum` is the scanner's 0-100 score (neutral 50
 * when uncovered), `isBeneficiary` means it appears as a capital-event beneficiary.
 */
export function stageFor(company: ThemeCompany, backing: BackingProfile, momentum: number): LifecycleStage {
  const evidence = company.evidence;
  const crowding = company.crowding;

  // Crowded: the thesis is proven but the trade is obvious - evidence high AND crowding high.
  if (evidence >= 60 && crowding >= 70) return 'crowded';
  // Scaling: strong evidence and the technical is turning up.
  if (evidence >= 60 && momentum >= 60) return 'scaling';
  // Contracted: real evidence on record (contracts/awards/capacity), regardless of price yet.
  if (evidence >= 55) return 'contracted';
  // Funded: not much revenue evidence yet, but real money (gov or big-tech) is behind it.
  if (backing.government || backing.bigTech) return 'funded';
  // Otherwise it is still a concept.
  return 'concept';
}

const STAGE_EARLINESS: Record<LifecycleStage, number> = {
  concept: 90,
  funded: 80,
  contracted: 60,
  scaling: 40,
  crowded: 15,
};

/**
 * Emergence score - the NARROW-SCOPE ranking that powers the shortlist. Unlike the generic
 * opportunity score, this deliberately rewards EARLY + BACKED + REAL and punishes crowding hard, so
 * the names that float up are the ones the founder actually wants: early movers with government /
 * big-tech money on a genuine bottleneck, not the obvious mega-cap trade.
 */
export function emergenceFor(
  company: ThemeCompany,
  backing: BackingProfile,
  stage: LifecycleStage,
  momentum: number,
): EmergenceBreakdown {
  const theme = getTheme(company.theme);
  const nodes = company.nodes.map(getNode).filter((n): n is NonNullable<ReturnType<typeof getNode>> => Boolean(n));
  const bottleneck = clamp(nodes.length ? Math.max(...nodes.map((n) => n.bottleneck)) : 30);

  const earliness = STAGE_EARLINESS[stage];
  // Backing: each kind is worth up to ~33, weighted by the theme's own policy support for the gov leg.
  const backingScore = clamp(
    (backing.government ? 30 + (theme?.policySupport ?? 50) * 0.1 : 0) +
      (backing.bigTech ? 34 : 0) +
      (backing.smartMoney ? 26 : 0),
  );
  const evidence = clamp(company.evidence);
  const mom = clamp(momentum);
  const riskPenalty = clamp((company.crowding + company.hypeRisk + company.dilutionRisk) / 3) * 0.3;

  const total = clamp(
    earliness * 0.18 +
      backingScore * 0.28 +
      evidence * 0.2 +
      bottleneck * 0.16 +
      mom * 0.08 +
      (theme?.smallCapOpportunity ?? 50) * 0.1 -
      riskPenalty,
  );

  return {
    earliness,
    backing: backingScore,
    evidence,
    bottleneck,
    momentum: mom,
    riskPenalty: Math.round(riskPenalty),
    total,
  };
}

/** Deterministic one-liner explaining why a name is on the shortlist right now. */
function whyNowFor(company: ThemeCompany, backing: BackingProfile, stage: LifecycleStage): string {
  const parts: string[] = [];
  const backers: string[] = [];
  if (backing.government) backers.push('government');
  if (backing.bigTech) backers.push('big-tech');
  if (backing.smartMoney) backers.push('a tracked fund');
  if (backers.length) parts.push(`backed by ${joinList(backers)}`);
  if (stage === 'concept' || stage === 'funded') parts.push('still early in its theme arc');
  if (company.evidence >= 55) parts.push('with real evidence on record');
  const theme = getTheme(company.theme);
  const nodes = company.nodes.map(getNode).filter(Boolean);
  const topBottleneck = nodes.reduce((best, n) => (n && (!best || n.bottleneck > best.bottleneck) ? n : best), nodes[0]);
  if (topBottleneck && topBottleneck.bottleneck >= 60) parts.push(`sits on the ${topBottleneck.name.toLowerCase()} bottleneck`);
  const lead = parts.length ? parts.join(', ') : 'early exposure to the theme';
  return `${company.name} - ${lead}${theme ? ` in ${theme.name}` : ''}.`;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Build the full lifecycle candidate set: every small/micro cap, staged, backing-profiled and
 * emergence-scored, ranked by emergence (highest first). `momentumBySymbol` joins the scanner.
 */
export function buildLifecycleCandidates(momentumBySymbol: Record<string, number> = {}): LifecycleCandidate[] {
  return getSmallCapCompanies()
    .map((company) => {
      const momentum = momentumBySymbol[company.symbol] ?? 50;
      const backing = backingFor(company.symbol);
      const stage = stageFor(company, backing, momentum);
      const emergence = emergenceFor(company, backing, stage, momentum);
      const opportunity = scoreCompany(company, momentumBySymbol[company.symbol]);
      const theme = getTheme(company.theme);
      return {
        symbol: company.symbol,
        name: company.name,
        theme: company.theme,
        themeName: theme?.name ?? company.theme,
        themeEmoji: theme?.emoji ?? '',
        sizeBucket: company.sizeBucket,
        stage,
        backing,
        emergence,
        opportunityTotal: opportunity.total,
        whyItMatters: company.whyItMatters,
        evidenceSummary: company.evidenceSummary,
        whyNow: whyNowFor(company, backing, stage),
        risks: company.risks,
      };
    })
    .sort((a, b) => b.emergence.total - a.emergence.total);
}

/**
 * The narrow curated shortlist - the "select, watch, invest" list. Defaults to names that are
 * EARLY (concept/funded/contracted) AND have at least one real backer, ranked by emergence. This is
 * the deliberately-tight scope the founder asked for: not a screener dump, a watchlist.
 */
export function buildEmergenceShortlist(
  momentumBySymbol: Record<string, number> = {},
  limit = 8,
): LifecycleCandidate[] {
  const all = buildLifecycleCandidates(momentumBySymbol);
  const early: LifecycleStage[] = ['concept', 'funded', 'contracted', 'scaling'];
  const shortlist = all.filter((c) => early.includes(c.stage) && c.backing.strength >= 1);
  // If backing data is too sparse to fill the list, fall back to the top emergence names so the
  // surface is never empty - but prefer the backed+early set.
  const pool = shortlist.length >= 3 ? shortlist : all;
  return pool.slice(0, limit);
}

/** Count of candidates in each lifecycle stage - powers the arc header. */
export function stageDistribution(candidates: LifecycleCandidate[]): Record<LifecycleStage, number> {
  const dist: Record<LifecycleStage, number> = { concept: 0, funded: 0, contracted: 0, scaling: 0, crowded: 0 };
  for (const c of candidates) dist[c.stage] += 1;
  return dist;
}
