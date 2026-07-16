/**
 * Stated-vs-revealed reconciliation - "the most useful thing the twin knows" (twin doc).
 *
 * Compares what the user SAID about their risk posture at onboarding (operator_profiles) with what
 * their paper trading REVEALS (the deterministic revealed-risk stats). Pure, no LLM, research-only:
 * it names the gap in neutral language and never tells the user what to do about it.
 */
import type { UserConstraints } from '@/lib/ai/user-context';
import type { RevealedRisk } from '@/lib/twin/model';

export type RiskBand = 'cautious' | 'balanced' | 'bold' | 'unknown';
export type ReconciliationGap =
  | 'aligned'
  | 'bolder-than-stated'
  | 'more-cautious-than-stated'
  | 'insufficient-data';

export interface Reconciliation {
  statedRisk: RiskBand;
  revealedRisk: RiskBand;
  gap: ReconciliationGap;
  /** One neutral, research-only sentence naming the gap. Never advice. */
  summary: string;
  /** The deterministic facts behind the verdict, for the surface to show its working. */
  factors: string[];
}

const BAND_ORDER: Record<Exclude<RiskBand, 'unknown'>, number> = { cautious: 0, balanced: 1, bold: 2 };

/** Map a free-text stated risk-comfort answer onto a band. Unknown when unrecognised/absent. */
function statedBand(riskComfort?: string): RiskBand {
  if (!riskComfort) return 'unknown';
  const s = riskComfort.toLowerCase();
  if (/(conservative|cautious|low|careful|defensive)/.test(s)) return 'cautious';
  if (/(aggressive|bold|high|risk[- ]?on|adventurous)/.test(s)) return 'bold';
  if (/(balanced|moderate|medium|neutral)/.test(s)) return 'balanced';
  return 'unknown';
}

/**
 * Derive a revealed risk band from behaviour. Needs at least a few trades to say anything honest.
 * Score in ~[-1, +1]: positive = bolder than a baseline, negative = more cautious.
 */
function revealedBand(r: RevealedRisk, maxPositionSizePct?: number | null): RiskBand {
  if (r.tradeCount < 3) return 'unknown';
  let score = 0;

  if (typeof maxPositionSizePct === 'number' && maxPositionSizePct > 0 && r.avgSizePctOfCap !== null) {
    const ratio = r.avgSizePctOfCap / maxPositionSizePct;
    if (ratio > 1.1) score += 0.4;
    else if (ratio < 0.6) score -= 0.4;
  }
  if (r.lateStageChasePct !== null) {
    if (r.lateStageChasePct > 60) score += 0.3;
    else if (r.lateStageChasePct < 30) score -= 0.2;
  }
  if (r.sizeAfterLossDeltaPct !== null) {
    if (r.sizeAfterLossDeltaPct > 20) score += 0.3;
    else if (r.sizeAfterLossDeltaPct < -10) score -= 0.1;
  }

  if (score >= 0.35) return 'bold';
  if (score <= -0.25) return 'cautious';
  return 'balanced';
}

function buildFactors(r: RevealedRisk, maxPositionSizePct?: number | null): string[] {
  const factors: string[] = [];
  if (r.avgSizePctOfCap !== null) {
    const cap =
      typeof maxPositionSizePct === 'number' && maxPositionSizePct > 0
        ? ` vs your ${maxPositionSizePct}% stated cap`
        : '';
    factors.push(`Average position ~${r.avgSizePctOfCap}% of capital${cap}.`);
  }
  if (r.lateStageChasePct !== null) {
    factors.push(`${r.lateStageChasePct}% of your entries were late-stage (scaling/crowded).`);
  }
  if (r.sizeAfterLossDeltaPct !== null && Math.abs(r.sizeAfterLossDeltaPct) >= 10) {
    const dir = r.sizeAfterLossDeltaPct > 0 ? 'larger' : 'smaller';
    factors.push(`Positions ~${Math.abs(r.sizeAfterLossDeltaPct)}% ${dir} right after a losing close.`);
  }
  return factors;
}

export function reconcileStatedVsRevealed(
  stated: Pick<UserConstraints, 'riskComfort' | 'maxPositionSizePct'> | null,
  revealed: RevealedRisk,
): Reconciliation {
  const statedRisk = statedBand(stated?.riskComfort);
  const revealed_ = revealedBand(revealed, stated?.maxPositionSizePct);
  const factors = buildFactors(revealed, stated?.maxPositionSizePct);

  let gap: ReconciliationGap;
  if (statedRisk === 'unknown' || revealed_ === 'unknown') {
    gap = 'insufficient-data';
  } else {
    const d = BAND_ORDER[revealed_] - BAND_ORDER[statedRisk];
    gap = d === 0 ? 'aligned' : d > 0 ? 'bolder-than-stated' : 'more-cautious-than-stated';
  }

  const lead = factors[0] ?? '';
  let summary: string;
  switch (gap) {
    case 'aligned':
      summary = `How you actually trade matches your stated ${statedRisk} posture.`;
      break;
    case 'bolder-than-stated':
      summary = `You describe your risk as ${statedRisk}, but your paper trading reads more ${revealed_}. ${lead}`.trim();
      break;
    case 'more-cautious-than-stated':
      summary = `You describe your risk as ${statedRisk}, but in practice you trade more ${revealed_}. ${lead}`.trim();
      break;
    default:
      summary = revealed.tradeCount < 3
        ? 'Not enough trading history yet to compare your stated posture with how you actually trade.'
        : 'Your stated risk posture is not set, so there is nothing to compare your behaviour against yet.';
  }

  return { statedRisk, revealedRisk: revealed_, gap, summary, factors };
}
