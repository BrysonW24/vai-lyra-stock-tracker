/**
 * Next Best Actions - a DETERMINISTIC ranker that turns the latest scan + the user's holdings,
 * watchlist and profile into a short, prioritised list of "what to do next". This is code, not the
 * model: Lyra never invents these. Each action is grounded in real data and, where it makes sense,
 * carries a reversible confirm-to-act CTA (the same add-to-watchlist the chat actions use).
 *
 * Personalised by the onboarding profile: risk comfort tunes the position-risk threshold and how
 * much new setups are emphasised; experience level decides how much hand-holding (paper-test, learn)
 * surfaces.
 */
export type NbaTone = 'urgent' | 'opportunity' | 'info';

export interface NextAction {
  id: string;
  priority: number;
  kind: string;
  tone: NbaTone;
  title: string;
  detail: string;
  symbol?: string;
  cta?: { label: string; addWatchlist?: boolean; href?: string };
}

export interface NbaSignal {
  symbol: string;
  companyName?: string;
  score: number;
  status?: string;
}
export interface NbaHolding {
  symbol: string;
  unrealisedPnl: number;
  marketValue: number;
  riskState?: string;
}
export interface NbaWatch {
  symbol: string;
  triggerState?: string;
  distanceToTarget?: number;
}
export interface NbaProfile {
  experienceLevel?: string;
  riskComfort?: string;
  watchlistCount?: number;
  portfolioCount?: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeNextBestActions(
  input: { signals: NbaSignal[]; portfolio: NbaHolding[]; watchlist: NbaWatch[]; profile?: NbaProfile | null },
  limit = 5,
): NextAction[] {
  const signals = input.signals ?? [];
  const portfolio = input.portfolio ?? [];
  const watchlist = input.watchlist ?? [];
  const profile = input.profile ?? {};
  const actions: NextAction[] = [];

  const held = new Set(portfolio.map((p) => p.symbol));
  const watched = new Set(watchlist.map((w) => w.symbol));

  const riskComfort = profile.riskComfort ?? 'balanced';
  // Conservative books flag risk sooner; aggressive/experimental give a wider leash.
  const stopPct = riskComfort === 'conservative' ? -5 : riskComfort === 'aggressive' || riskComfort === 'experimental' ? -12 : -8;
  const isBeginner = profile.experienceLevel === 'beginner';

  // 1. Position risk reviews (urgent) - holdings underwater past the comfort threshold, or flagged risk.
  for (const h of portfolio) {
    const cost = h.marketValue - h.unrealisedPnl;
    if (cost <= 0) continue; // can't compute a meaningful % from a non-positive cost basis
    const pct = (h.unrealisedPnl / cost) * 100;
    const riskFlag = !!h.riskState && /elevated|high|breach|stop|reduce/i.test(h.riskState);
    if (h.unrealisedPnl < 0 && (pct <= stopPct || riskFlag)) {
      actions.push({
        id: `risk-${h.symbol}`,
        kind: 'review_position',
        tone: 'urgent',
        priority: 100 + Math.min(40, Math.abs(pct)),
        symbol: h.symbol,
        title: `Review ${h.symbol} - down ${Math.abs(round1(pct))}%`,
        detail: `Past your ${riskComfort} comfort zone. Check whether the thesis still holds, or trim the risk.`,
        cta: { label: 'Open', href: `/tickers/${h.symbol}` },
      });
    }
  }

  // 2. Strong new setups you neither hold nor watch (opportunity).
  const strong = signals
    .filter((s) => (s.status === 'strong_setup' || s.score >= 75) && !held.has(s.symbol) && !watched.has(s.symbol))
    .sort((a, b) => b.score - a.score);
  const setupBoost = riskComfort === 'aggressive' || riskComfort === 'experimental' ? 12 : riskComfort === 'conservative' ? -12 : 0;
  for (const s of strong.slice(0, 3)) {
    actions.push({
      id: `setup-${s.symbol}`,
      kind: 'watch_setup',
      tone: 'opportunity',
      priority: 70 + s.score / 10 + setupBoost,
      symbol: s.symbol,
      title: `${s.symbol} hit a strong setup (momentum ${Math.round(s.score)})`,
      detail: `${s.companyName ?? s.symbol} is not on your watchlist yet - track it to catch the trigger.`,
      cta: { label: 'Add to watchlist', addWatchlist: true },
    });
  }

  // 3. Watchlist names at / approaching their target buy zone (opportunity).
  for (const w of watchlist) {
    if (w.triggerState === 'triggered' || w.triggerState === 'approaching') {
      const triggered = w.triggerState === 'triggered';
      actions.push({
        id: `trigger-${w.symbol}`,
        kind: 'approaching_target',
        tone: 'opportunity',
        priority: triggered ? 88 : 66,
        symbol: w.symbol,
        title: `${w.symbol} is ${triggered ? 'at' : 'approaching'} its target buy zone`,
        detail: triggered
          ? 'This is the trigger you set - review the entry.'
          : `Distance ${w.distanceToTarget != null ? round1(Math.abs(w.distanceToTarget)) + '%' : 'closing'} - the setup you were waiting for is near.`,
        cta: { label: 'Open', href: `/tickers/${w.symbol}` },
      });
    }
  }

  // 4. Paper-test before real money (beginners / conservative, when a strong setup exists).
  if (strong.length && (isBeginner || riskComfort === 'conservative')) {
    const s = strong[0];
    actions.push({
      id: `paper-${s.symbol}`,
      kind: 'paper_test',
      tone: 'info',
      priority: 50,
      symbol: s.symbol,
      title: `Paper-test ${s.symbol} before risking real money`,
      detail: 'Run it through the Paper Bot to see how the setup plays out, risk-free.',
      cta: { label: 'Paper Bot', href: '/paper-bot' },
    });
  }

  // 5. Setup gaps - empty watchlist / portfolio (mostly new users).
  if ((profile.watchlistCount ?? watchlist.length) === 0) {
    const top = signals.slice().sort((a, b) => b.score - a.score)[0];
    actions.push({
      id: 'gap-watchlist',
      kind: 'add_watchlist',
      tone: 'info',
      priority: 58,
      symbol: top?.symbol,
      title: 'Build your watchlist',
      detail: top ? `Start with ${top.symbol} (momentum ${Math.round(top.score)}), today's strongest setup.` : 'Add a name to start tracking setups.',
      cta: top ? { label: `Add ${top.symbol}`, addWatchlist: true } : { label: 'Watchlist', href: '/watchlist' },
    });
  }
  if ((profile.portfolioCount ?? portfolio.length) === 0) {
    actions.push({
      id: 'gap-portfolio',
      kind: 'add_portfolio',
      tone: 'info',
      priority: 54,
      title: 'Add your holdings',
      detail: 'Tell Lyra what you own so it can watch your real risk and P/L.',
      cta: { label: 'Portfolio', href: '/portfolio' },
    });
  }

  // Highest priority first; one action per symbol; cap at the limit.
  actions.sort((a, b) => b.priority - a.priority);
  const seen = new Set<string>();
  const out: NextAction[] = [];
  for (const a of actions) {
    const key = a.symbol ? `sym:${a.symbol}` : a.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
    if (out.length >= limit) break;
  }
  return out;
}
