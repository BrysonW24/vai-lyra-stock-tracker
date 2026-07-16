/**
 * Signal Intelligence - the reasoning-over-the-multitude layer.
 *
 * The gap this closes: Lyra had a great deterministic COMPOSITION of curated signals, but nothing
 * that scanned the whole signal universe to decide which data points are the MOST EFFECTIVE right
 * now. This module is that layer. It gathers every independent signal touching each entity
 * (government awards, capital events, big-tech/institutional backing, supply-chain bottleneck
 * exposure, technical momentum, lifecycle shifts), scores each data point deterministically for
 * impact x recency x corroboration, dedupes the noise down to the few points that matter, and -
 * the Bloomberg-grade part - detects CONVERGENCE: when multiple INDEPENDENT signals line up on the
 * same name in a window, that is the highest-conviction "pay attention here" event.
 *
 * Doctrine: every score here is deterministic truth. The AI only ever explains a convergence; it
 * never invents one. Freshness is tracked per source so the UI + AI can tell live from sample.
 * Research only - nothing here is a buy/sell call.
 */
import {
  getThemeCompanies,
  getTheme,
  getNode,
  CAPITAL_EVENTS,
  INVESTORS,
  type ThemeCompany,
} from '@/lib/world-radar';
import { GOV_AWARDS } from '@/lib/gov-awards';
import { SMART_MONEY } from '@/lib/smart-money';
import { backingFor, stageFor, type LifecycleStage } from '@/lib/small-cap-lifecycle';

export type SignalKind =
  | 'gov-award'
  | 'capital-event'
  | 'big-tech-backing'
  | 'institutional'
  | 'bottleneck'
  | 'momentum'
  | 'lifecycle';

export type SignalFreshness = 'live' | 'sample' | 'derived';

export interface SignalDataPoint {
  entity: string;
  kind: SignalKind;
  headline: string;
  detail: string;
  /** ISO date when known (drives recency). */
  date?: string;
  /** 0-100 how material the signal is on its own. */
  impact: number;
  /** 0-100 recency weight (1.0 today, decaying with age; 60 for undated derived signals). */
  recency: number;
  /** Effective score = impact scaled by recency. */
  score: number;
  source: string;
  freshness: SignalFreshness;
}

export interface SignalConvergence {
  entity: string;
  name: string;
  theme: string;
  themeName: string;
  themeEmoji: string;
  stage: LifecycleStage;
  /** The distinct signal kinds converging on this name. More independent kinds = higher conviction. */
  kinds: SignalKind[];
  /** The scored data points behind the convergence, best first. */
  points: SignalDataPoint[];
  /** 0-100 deterministic conviction that this is where attention belongs now. */
  convergenceScore: number;
  /** Deterministic one-line read of why the signals converge. */
  narrative: string;
  /** 'live' if any converging signal is from a live feed, else 'sample'. */
  freshness: SignalFreshness;
  /** Newest signal date across the cluster (drives "this week" framing). */
  latestDate?: string;
}

export interface SignalIntelligence {
  generatedAt: string;
  /** Ranked convergences - the "most effective data points", highest conviction first. */
  convergence: SignalConvergence[];
  /** Flat, ranked feed of the individual data points (for a raw intelligence stream). */
  feed: SignalDataPoint[];
  /** Counts for the header. */
  stats: { entities: number; dataPoints: number; liveDataPoints: number; convergentEntities: number };
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/**
 * Recency weight from an ISO date. Fresh signals dominate; a signal decays to ~0 over ~180 days.
 * `nowMs` is injectable for deterministic tests. Undated signals get a neutral 60.
 */
export function recencyWeight(dateIso: string | undefined, nowMs: number): number {
  if (!dateIso) return 60;
  const t = Date.parse(dateIso);
  if (Number.isNaN(t)) return 60;
  const ageDays = Math.max(0, (nowMs - t) / 86_400_000);
  const HALF_LIFE = 45; // days - a 45-day-old signal is worth half a today one
  return clamp(100 * Math.pow(0.5, ageDays / HALF_LIFE));
}

const GOVERNMENT_ACTORS =
  /\bnasa\b|department of defense|\bdod\b|department of energy|\bdoe\b|\bdarpa\b|space development agency|space force|\bus army\b|\bus navy\b|air force|department of commerce|\bchips\b|\barpa\b|national reconnaissance|\bnro\b|arena|austender|grantconnect|government|ministry|defence/i;
const HYPERSCALER_ACTORS = /meta|microsoft|amazon|google|alphabet|oracle|nvidia|openai|anthropic|apple|tesla|xai|verizon|at&t|coreweave/i;

/** Gather every independent signal data point touching one company. */
function gatherPoints(company: ThemeCompany, momentum: number | undefined, nowMs: number): SignalDataPoint[] {
  const sym = company.symbol.toUpperCase();
  const points: SignalDataPoint[] = [];
  const push = (p: Omit<SignalDataPoint, 'entity' | 'recency' | 'score'>) => {
    const recency = recencyWeight(p.date, nowMs);
    points.push({ ...p, entity: company.symbol, recency, score: clamp((p.impact * recency) / 100) });
  };

  // Government awards naming the ticker (highest-signal for the emerging-market thesis).
  for (const award of GOV_AWARDS) {
    if (award.tickers.map((t) => t.toUpperCase()).includes(sym)) {
      push({ kind: 'gov-award', headline: `${award.agency} ${award.kind}`, detail: award.summary, date: award.date, impact: 90, source: award.source.name, freshness: 'sample' });
    }
  }

  // Capital events with this symbol - classify government vs big-tech by the actor.
  for (const ev of CAPITAL_EVENTS) {
    if (ev.symbol?.toUpperCase() !== sym) continue;
    const gov = GOVERNMENT_ACTORS.test(ev.actor);
    const bigTech = HYPERSCALER_ACTORS.test(ev.actor);
    const amount = ev.amountUsdM ? (ev.amountUsdM >= 1000 ? `$${(ev.amountUsdM / 1000).toFixed(1)}B` : `$${ev.amountUsdM}M`) : '';
    push({
      kind: gov ? 'gov-award' : bigTech ? 'big-tech-backing' : 'capital-event',
      headline: `${ev.actor} ${ev.type}${amount ? ` ${amount}` : ''}`,
      detail: ev.summary,
      date: ev.date,
      impact: gov ? 88 : bigTech ? 82 : 70,
      source: ev.sourceName,
      freshness: 'sample',
    });
  }

  // Smart-money / news-driven backing.
  for (const sm of SMART_MONEY) {
    if (sm.ticker.toUpperCase() !== sym) continue;
    const gov = sm.backer === 'government';
    push({ kind: gov ? 'gov-award' : 'big-tech-backing', headline: `${sm.backerName} backing`, detail: sm.catalyst, date: sm.date, impact: gov ? 84 : 78, source: sm.source, freshness: 'sample' });
  }

  // Institutional 13F conviction.
  for (const investor of INVESTORS) {
    const move = investor.moves.find((m) => m.symbol?.toUpperCase() === sym);
    if (move && (move.action === 'new' || move.action === 'increase')) {
      push({ kind: 'institutional', headline: `${investor.name} ${move.action}`, detail: move.note || `${investor.firm} ${move.action} (${investor.filingType})`, date: investor.filingDate, impact: move.action === 'new' ? 74 : 66, source: investor.filingType, freshness: 'sample' });
    }
  }

  // Supply-chain bottleneck exposure (derived, undated).
  const nodes = company.nodes.map(getNode).filter((n): n is NonNullable<ReturnType<typeof getNode>> => Boolean(n));
  const topNode = nodes.reduce<typeof nodes[number] | undefined>((best, n) => (!best || n.bottleneck > best.bottleneck ? n : best), undefined);
  if (topNode && topNode.bottleneck >= 60) {
    push({ kind: 'bottleneck', headline: `${topNode.name} bottleneck (${topNode.bottleneck})`, detail: topNode.whyItMatters, impact: clamp(topNode.bottleneck * 0.8), source: 'supply-chain map', freshness: 'derived' });
  }

  // Technical momentum turning (derived from the live scanner - genuinely live when covered).
  if (typeof momentum === 'number' && momentum >= 60) {
    push({ kind: 'momentum', headline: `Momentum turning (score ${Math.round(momentum)})`, detail: 'The technical scanner has this name in an early-turn regime.', impact: clamp(momentum), source: 'scanner', freshness: momentum === 50 ? 'sample' : 'live' });
  }

  return points;
}

const KIND_LABEL: Record<SignalKind, string> = {
  'gov-award': 'government backing',
  'capital-event': 'capital commitment',
  'big-tech-backing': 'big-tech backing',
  institutional: 'institutional buying',
  bottleneck: 'bottleneck exposure',
  momentum: 'turning momentum',
  lifecycle: 'lifecycle shift',
};

/** Deterministic narrative for a convergence - names the aligning signal kinds, no invention. */
function narrativeFor(name: string, kinds: SignalKind[]): string {
  const labels = kinds.map((k) => KIND_LABEL[k]);
  const list = labels.length <= 1 ? labels[0] ?? 'a signal' : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
  return `${name}: ${list} converge${kinds.length === 1 ? 's' : ''} on the same name.`;
}

/**
 * Build the full signal-intelligence pass over the entire company universe. `momentumBySymbol`
 * joins the live scanner. Returns the ranked convergences (the most effective data points) plus the
 * flat feed and freshness stats. Deterministic in `nowMs` for tests.
 */
export function buildSignalIntelligence(
  momentumBySymbol: Record<string, number> = {},
  nowMs: number = Date.now(),
): SignalIntelligence {
  const feed: SignalDataPoint[] = [];
  const convergence: SignalConvergence[] = [];
  let liveDataPoints = 0;

  for (const company of getThemeCompanies()) {
    const momentum = momentumBySymbol[company.symbol];
    const points = gatherPoints(company, momentum, nowMs).sort((a, b) => b.score - a.score);
    if (points.length === 0) continue;
    feed.push(...points);
    liveDataPoints += points.filter((p) => p.freshness === 'live').length;

    const kinds = [...new Set(points.map((p) => p.kind))];
    const backing = backingFor(company.symbol);
    const stage = stageFor(company, backing, momentum ?? 50);

    // Convergence conviction: rewards INDEPENDENT breadth (distinct kinds), the strength of the top
    // few points, disclosed backing, and freshness. A single loud signal is not convergence; several
    // independent ones on the same name is.
    const distinctKinds = kinds.length;
    const breadth = clamp((distinctKinds - 1) * 22); // 0 kinds->0, 2->22, 4->66
    const depth = clamp(points.slice(0, 3).reduce((s, p) => s + p.score, 0) / 3);
    const convergenceScore = clamp(breadth * 0.45 + depth * 0.35 + backing.strength * 0.2 * 33);

    const dates = points.map((p) => p.date).filter((d): d is string => Boolean(d)).sort((a, b) => b.localeCompare(a));
    const theme = getTheme(company.theme);
    convergence.push({
      entity: company.symbol,
      name: company.name,
      theme: company.theme,
      themeName: theme?.name ?? company.theme,
      themeEmoji: theme?.emoji ?? '',
      stage,
      kinds,
      points: points.slice(0, 5),
      convergenceScore,
      narrative: narrativeFor(company.name, kinds),
      freshness: points.some((p) => p.freshness === 'live') ? 'live' : 'sample',
      latestDate: dates[0],
    });
  }

  convergence.sort((a, b) => b.convergenceScore - a.convergenceScore || (b.latestDate ?? '').localeCompare(a.latestDate ?? ''));
  feed.sort((a, b) => b.score - a.score);

  return {
    generatedAt: new Date(nowMs).toISOString(),
    convergence,
    feed,
    stats: {
      entities: convergence.length,
      dataPoints: feed.length,
      liveDataPoints,
      convergentEntities: convergence.filter((c) => c.kinds.length >= 2).length,
    },
  };
}

/**
 * The tightest lens: the top cross-signal convergences that a serious operator should look at now.
 * Requires at least `minKinds` independent signal kinds so a single loud signal never floats up as
 * "convergence". This is the "most effective data points" selector.
 */
export function topConvergence(intel: SignalIntelligence, limit = 6, minKinds = 2): SignalConvergence[] {
  return intel.convergence.filter((c) => c.kinds.length >= minKinds).slice(0, limit);
}

export const SIGNAL_KIND_LABEL = KIND_LABEL;
