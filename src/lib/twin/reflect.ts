/**
 * Twin reflection presenter - turns the deterministic TwinProfile + stated constraints into the
 * neutral, research-only "here is what Lyra has learned about you" view. Shared by the /twin surface
 * and the read_trading_twin AI tool so both speak identically. No advice, no imperatives - a mirror.
 */
import type { TwinProfile } from '@/lib/twin/model';
import type { UserConstraints } from '@/lib/ai/user-context';
import { reconcileStatedVsRevealed, type Reconciliation } from '@/lib/twin/reconcile';
import { SIGNAL_KIND_LABEL, type SignalKind } from '@/lib/signal-intelligence';

export interface TwinReflection {
  hasEnoughData: boolean;
  headline: string;
  /** 1-4 neutral "research about you" sentences. Never advice. */
  observations: string[];
  reconciliation: Reconciliation;
  topThemes: Array<{ key: string; sharePct: number }>;
  topSymbols: Array<{ key: string; count: number }>;
  topSignalKinds: Array<{ key: SignalKind; label: string }>;
  stageLean: TwinProfile['revealedRisk']['stageLean'];
  interactions: number;
}

export function buildReflection(profile: TwinProfile, stated: UserConstraints | null): TwinReflection {
  const reconciliation = reconcileStatedVsRevealed(stated, profile.revealedRisk);

  if (!profile.hasEnoughData) {
    return {
      hasEnoughData: false,
      headline: 'Your twin is still learning',
      observations: [
        'Watch a few names, build your watchlist, and paper-trade some setups. Once there is enough history, Lyra will reflect your interests, habits, and risk posture back to you here - as research about you, never as advice.',
      ],
      reconciliation,
      topThemes: [],
      topSymbols: [],
      topSignalKinds: [],
      stageLean: profile.revealedRisk.stageLean,
      interactions: profile.interactions,
    };
  }

  const observations: string[] = [];

  const topTheme = profile.themes[0];
  if (topTheme) {
    observations.push(`You pay the most attention to ${topTheme.key} - about ${topTheme.sharePct}% of your activity.`);
  }

  if (reconciliation.gap !== 'insufficient-data') {
    observations.push(reconciliation.summary);
  }

  const late = profile.revealedRisk.lateStageChasePct;
  if (late !== null && late > 60) {
    observations.push(
      `${late}% of your entries were late-stage names (scaling/crowded). The flagship is built to find these earlier.`,
    );
  }

  const afterLoss = profile.revealedRisk.sizeAfterLossDeltaPct;
  if (afterLoss !== null && afterLoss > 20) {
    observations.push(`Your position sizes rise about ${afterLoss}% in the trade right after a losing close.`);
  }

  // Ensure there is always something concrete to show once the twin has data.
  if (observations.length < 2 && profile.symbols[0]) {
    observations.push(`${profile.symbols[0].key} is the name you have engaged with most (${profile.symbols[0].count}x).`);
  }

  const topSignalKinds = profile.signalKinds
    .slice(0, 3)
    .map((k) => ({ key: k.key, label: SIGNAL_KIND_LABEL[k.key] ?? k.key }));

  return {
    hasEnoughData: true,
    headline: 'What Lyra has learned about you',
    observations: observations.slice(0, 4),
    reconciliation,
    topThemes: profile.themes.slice(0, 4).map((t) => ({ key: t.key, sharePct: t.sharePct })),
    topSymbols: profile.symbols.slice(0, 6).map((s) => ({ key: s.key, count: s.count })),
    topSignalKinds,
    stageLean: profile.revealedRisk.stageLean,
    interactions: profile.interactions,
  };
}

/** Compact plain-text rendering for the AI tool to cite (never for the AI to rewrite as advice). */
export function renderReflectionText(r: TwinReflection): string {
  if (!r.hasEnoughData) return 'The user does not have enough history yet for a trading-twin profile.';
  const lines = [`TRADING TWIN (research about the user, from their own behaviour - cite, never turn into advice):`];
  lines.push(...r.observations.map((o) => `- ${o}`));
  if (r.topThemes.length) lines.push(`- Top themes: ${r.topThemes.map((t) => `${t.key} (${t.sharePct}%)`).join(', ')}`);
  if (r.topSignalKinds.length) lines.push(`- Trusted signal kinds: ${r.topSignalKinds.map((k) => k.label).join(', ')}`);
  if (r.stageLean) lines.push(`- Stage lean: ${r.stageLean}`);
  return lines.join('\n');
}
