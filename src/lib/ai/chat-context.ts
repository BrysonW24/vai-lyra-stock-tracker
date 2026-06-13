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

  return lines.join('\n');
}
