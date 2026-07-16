/**
 * Chat grounding + tone. Consolidates the deterministic state from across the app (the same
 * facts the surfaces show - holdings, watchlist, signals, prime setups, catalysts, macro)
 * into a compact CONTEXT block for the copilot, and derives a response tone from the user's
 * onboarding profile. The model phrases; it never invents a number or gives advice.
 */
import type { DashboardData } from '@/types/scanner';
import { derivePrimeSetups } from '@/lib/prime-setups';
import { deriveCatalystRadar } from '@/lib/catalysts';
import { formatCurrency, formatSignedNumber, formatSignedPercent } from '@/lib/format';
import { THEME_COMPANIES, getTheme, getNodesForTheme } from '@/lib/world-radar';
import { buildEmergenceShortlist, LIFECYCLE_LABEL } from '@/lib/small-cap-lifecycle';
import { companyChainPosition } from '@/lib/value-chain';
import { buildSignalIntelligence, topConvergence } from '@/lib/signal-intelligence';
import iposData from '@/lib/generated/ipos.json';

/** Minimal IPO reference shape read off the compiled content layer. */
interface IpoRef {
  symbol: string;
  ipoDate: string;
  offerPrice: number;
  currentPrice: number;
  returnSinceIpoPct: number;
}
const IPO_REFS = iposData as IpoRef[];

/**
 * Editorial thematic context for the user's OWN symbols - a static join over the already-compiled
 * content layer (themes -> supply-chain bottleneck -> falsifier, plus IPO reference). This is the
 * deterministic-first grounding upgrade: no model call, the curated thesis/bottleneck/IPO data we
 * already build on every compile is simply joined onto the holdings/watchlist the AI is discussing.
 */
function buildThematicContext(symbols: string[]): string {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const raw of symbols) {
    const symbol = raw.toUpperCase();
    if (seen.has(symbol)) continue;
    seen.add(symbol);

    const company = THEME_COMPANIES.find((c) => c.symbol === symbol);
    const ipo = IPO_REFS.find((i) => i.symbol === symbol);
    if (!company && !ipo) continue;

    const parts: string[] = [];
    if (company) {
      const theme = getTheme(company.theme);
      if (theme) {
        parts.push(`theme "${theme.name}" (${theme.maturity}, momentum ${Math.round(theme.momentum)}/100): ${theme.thesis}`);
        const topNode = getNodesForTheme(company.theme)
          .slice()
          .sort((a, b) => b.bottleneck - a.bottleneck)[0];
        if (topNode && topNode.bottleneck >= 55) {
          parts.push(`Key bottleneck - ${topNode.name} (${topNode.bottleneck}/100): ${topNode.whyItMatters}`);
        }
        if (theme.falsifier) parts.push(`Falsifier: ${theme.falsifier}`);
        parts.push(`exposure: ${company.exposure}.`);
      }
    }
    if (ipo) {
      const sign = ipo.returnSinceIpoPct >= 0 ? '+' : '';
      parts.push(`IPO ${ipo.ipoDate} at $${ipo.offerPrice}, now $${ipo.currentPrice} (${sign}${ipo.returnSinceIpoPct}% since IPO).`);
    }
    if (parts.length) lines.push(`- ${symbol}: ${parts.join(' ')}`);
  }
  return lines.length ? `THEMATIC CONTEXT (editorial, for your symbols):\n${lines.join('\n')}` : '';
}

/**
 * Small-cap EMERGENCE grounding - makes the flagship's lifecycle + backing + value-chain signals
 * first-class to the AI, so it can answer "which small caps are early and backed?", "who funds X?",
 * or "trace X back to raw materials" from the same deterministic engine the /small-caps page renders.
 * Compact by design: the shortlist plus each name's stage, backing kinds, and upstream raw materials.
 */
export function buildEmergenceGrounding(momentumBySymbol: Record<string, number> = {}): string {
  const shortlist = buildEmergenceShortlist(momentumBySymbol, 8);
  if (shortlist.length === 0) return '';
  const lines: string[] = ['SMALL-CAP EMERGENCE SHORTLIST (early + backed, deterministic - research only, never advice):'];
  for (const c of shortlist) {
    const backers: string[] = [];
    if (c.backing.government) backers.push('government');
    if (c.backing.bigTech) backers.push('big-tech');
    if (c.backing.smartMoney) backers.push('smart-money');
    const pos = companyChainPosition(c.symbol);
    const materials = pos?.rawMaterials.slice(0, 4).map((r) => r.name).join(', ');
    lines.push(
      `- ${c.symbol} (${c.name}): ${LIFECYCLE_LABEL[c.stage]} stage in ${c.themeName}, emergence ${c.emergence.total}/100, ` +
        `backed by ${backers.length ? backers.join(' + ') : 'none disclosed'}${materials ? `; upstream raw materials: ${materials}` : ''}.`,
    );
  }
  return lines.join('\n');
}

/**
 * Cross-signal CONVERGENCE grounding - the intelligence layer's "where attention belongs now" read.
 * Surfaces the names where multiple INDEPENDENT signals (government backing, capital, institutional
 * buying, bottleneck exposure, momentum) line up. This is the deterministic "most effective data
 * points" selection made first-class to the AI so chat/brief can answer "what's converging and why".
 */
export function buildConvergenceGrounding(momentumBySymbol: Record<string, number> = {}, nowMs: number = Date.now()): string {
  const intel = buildSignalIntelligence(momentumBySymbol, nowMs);
  const top = topConvergence(intel, 6, 2);
  if (top.length === 0) return '';
  const lines: string[] = [
    `SIGNAL CONVERGENCE (deterministic cross-signal intelligence - ${intel.stats.dataPoints} data points across ${intel.stats.entities} names, ${intel.stats.liveDataPoints} live; research only):`,
  ];
  for (const c of top) {
    const kinds = c.kinds.join(', ');
    lines.push(`- ${c.entity} (${c.name}, ${c.themeName}): conviction ${c.convergenceScore}/100 from ${c.kinds.length} independent signals [${kinds}]${c.latestDate ? `, latest ${c.latestDate}` : ''}.`);
  }
  return lines.join('\n');
}

export interface ChatProfile {
  displayName?: string;
  experienceLevel?: string;
  tradedBefore?: string;
  /** 'conservative' | 'balanced' | 'aggressive' | 'experimental' if known. */
  riskComfort?: string;
}

/** A one-line tone instruction so answers resonate with how the user invests. */
export function deriveTone(profile?: ChatProfile): string {
  const risk = profile?.riskComfort;
  if (risk === 'conservative') return 'TONE: cautious and protective - lead with risk and downside, never pressure, prefer "consider" over "do".';
  if (risk === 'aggressive' || risk === 'experimental') return 'TONE: direct and decisive - get to the point fast, the user wants conviction, not hand-holding.';
  if (profile?.tradedBefore === 'no' || profile?.experienceLevel === 'beginner') return 'TONE: warm and plain-English - define any jargon, assume little prior knowledge.';
  if (profile?.experienceLevel === 'professional' || profile?.experienceLevel === 'advanced') return 'TONE: concise and technical - assume fluency, skip the basics.';
  return 'TONE: clear, calm and balanced.';
}

/** Compact, structured snapshot of the user's world for grounding. Numbers come from the scan. */
export function buildGrounding(data: DashboardData, now: Date): string {
  const sigBy = new Map(data.signals.map((s) => [s.symbol, s]));
  const lines: string[] = [];

  if (data.portfolio.length > 0) {
    const value = data.portfolio.reduce((sum, h) => sum + h.marketValue, 0);
    const pnl = data.portfolio.reduce((sum, h) => sum + h.unrealisedPnl, 0);
    lines.push(`HOLDINGS (book ${formatCurrency(value)}, P/L ${formatCurrency(pnl)}):`);
    for (const h of data.portfolio.slice(0, 12)) {
      const sig = sigBy.get(h.symbol);
      lines.push(`- ${h.symbol}: ${formatCurrency(h.marketValue)} (${formatSignedPercent(h.unrealisedPnlPercent)}), weight ${Math.round(h.portfolioWeight)}%${sig ? `, score ${sig.score} ${formatSignedNumber(sig.scoreDelta, 0)}, ${sig.status}` : ''}`);
    }
  } else {
    lines.push('HOLDINGS: none added.');
  }

  if (data.watchlist.length > 0) {
    lines.push('WATCHLIST:');
    for (const w of data.watchlist.slice(0, 12)) {
      lines.push(`- ${w.symbol}: score ${w.signalScore} ${formatSignedNumber(w.scoreDelta, 0)}, ${w.triggerState}, ${Math.abs(w.distanceToTarget).toFixed(1)}% from target`);
    }
  }

  const topSignals = [...data.signals].sort((a, b) => b.score - a.score).slice(0, 8);
  lines.push('TOP SIGNALS:');
  for (const s of topSignals) {
    lines.push(`- ${s.symbol}: score ${s.score} ${formatSignedNumber(s.scoreDelta, 0)}, RSI ${Math.round(s.rsi)}, MACD ${s.macdState}, vol ${s.volumeRatio.toFixed(1)}x, ${s.status}`);
  }

  const prime = derivePrimeSetups(data.signals).prime;
  if (prime.length > 0) {
    lines.push('PRIME SETUPS (strong + confirming now):');
    for (const p of prime) lines.push(`- ${p.signal.symbol}: ${p.confirming}/4 confirming - ${p.reasons.join(', ') || 'structure forming'}`);
  }

  const catalysts = deriveCatalystRadar(now).slice(0, 5);
  if (catalysts.length > 0) {
    lines.push('UPCOMING CATALYSTS:');
    for (const c of catalysts) lines.push(`- ${c.title} (${c.tier}, heat ${c.heat}, ${c.daysUntil >= 0 ? `in ${c.daysUntil}d` : 'live/just passed'}) - ${c.why}`);
  }

  // Deterministic-first grounding upgrade: join the curated editorial content layer onto the
  // user's own symbols so the AI sees thesis / bottleneck / falsifier / IPO context, not just price.
  const symbols = [
    ...data.portfolio.slice(0, 12).map((h) => h.symbol),
    ...data.watchlist.slice(0, 12).map((w) => w.symbol),
  ];
  const thematic = buildThematicContext(symbols);
  if (thematic) lines.push(thematic);

  // Flagship signals are first-class to the AI: the same lifecycle + backing + value-chain the
  // /small-caps surface shows, grounded off the live scanner scores, plus the cross-signal
  // convergence intelligence (where multiple independent signals line up right now).
  const momentumBySymbol = Object.fromEntries(data.signals.map((s) => [s.symbol, s.score]));
  const emergence = buildEmergenceGrounding(momentumBySymbol);
  if (emergence) lines.push(emergence);
  const convergence = buildConvergenceGrounding(momentumBySymbol, now.getTime());
  if (convergence) lines.push(convergence);

  return lines.join('\n');
}
