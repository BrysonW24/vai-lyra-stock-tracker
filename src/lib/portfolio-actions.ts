/**
 * Portfolio Actions - the deterministic "what does my money need from me RIGHT NOW" engine.
 *
 * This is the action-first, downside-aware core of the goal cockpit. It reads the engine's existing
 * per-holding risk reads (riskState, unrealised P/L, score momentum, weight) and turns them into a
 * short, ranked list of concrete moves - weighted so that PROTECTING capital (exits, cut-losses,
 * risk-downs, concentration) always outranks chasing new upside. Exits and downside are first-class,
 * not an afterthought: a broken thesis or a position through its loss line is the loudest item.
 *
 * Pure and deterministic. It never invents a number and never issues a licensed buy/sell
 * recommendation. It flags what the engine sees on YOUR positions and prompts you to DECIDE - the
 * decision, and any trade, stays yours and happens at your broker. Thresholds tune with risk comfort.
 */
import type { PortfolioHolding } from '@/types/scanner';

export type PortfolioActionKind =
  | 'exit_invalidated'
  | 'cut_loss'
  | 'reduce_risk'
  | 'take_profit'
  | 'trim_concentration'
  | 'add_opportunity'
  | 'deploy_cash'
  | 'goal_behind'
  | 'all_clear';

/** Urgency drives ordering and colour. exit/urgent = protect capital; opportunity/info = grow it. */
export type ActionUrgency = 'exit' | 'urgent' | 'opportunity' | 'info';

export interface PortfolioAction {
  id: string;
  kind: PortfolioActionKind;
  urgency: ActionUrgency;
  /** Higher = surfaced first. */
  priority: number;
  symbol?: string;
  /** Imperative, action-first title. */
  title: string;
  /** The plain-English, number-grounded reason - what the engine sees. */
  detail: string;
  /** Optional deep link (ticker detail, plan, portfolio). */
  href?: string;
}

export interface RiskThresholds {
  /** unrealised % at or below which a loser is flagged to cut. */
  cutLossPct: number;
  /** unrealised % at or above which an extended winner is flagged to bank some. */
  takeProfitPct: number;
  /** single-position weight % above which concentration is flagged. */
  maxPositionPct: number;
  /** idle-cash % of equity above which "put it to work" surfaces. */
  idleCashPct: number;
}

/** Loss tolerance widens with risk appetite; profit-taking triggers later for aggressive users. */
export function thresholdsForRisk(riskComfort?: string | null, maxPositionPct?: number | null): RiskThresholds {
  const r = (riskComfort ?? '').toLowerCase();
  const conservative = r.includes('conservative') || r.includes('low');
  const aggressive = r.includes('aggressive') || r.includes('high');
  return {
    cutLossPct: conservative ? -6 : aggressive ? -12 : -8,
    takeProfitPct: conservative ? 12 : aggressive ? 25 : 18,
    maxPositionPct: typeof maxPositionPct === 'number' && maxPositionPct > 0 ? maxPositionPct : 20,
    idleCashPct: 25,
  };
}

export interface PortfolioActionsInput {
  holdings: PortfolioHolding[];
  cashAvailable?: number | null;
  equity?: number | null;
  riskComfort?: string | null;
  maxPositionPct?: number | null;
  /** True when the goal pace is behind - surfaces a (gentle) contribution nudge. */
  goalBehind?: boolean;
}

const pct = (n: number) => `${n >= 0 ? '+' : ''}${Math.round(n * 10) / 10}%`;

/**
 * Rank the moves your portfolio needs. Protect-capital items (exit, cut, reduce, trim) are scored
 * above grow-capital items (take profit is a protect-the-gain hybrid, ranked high). Returns at most
 * `limit`; when nothing needs action it returns a single reassuring all-clear.
 */
export function computePortfolioActions(input: PortfolioActionsInput, limit = 6): PortfolioAction[] {
  const holdings = input.holdings ?? [];
  const t = thresholdsForRisk(input.riskComfort, input.maxPositionPct);
  const actions: PortfolioAction[] = [];

  for (const h of holdings) {
    const sym = h.symbol;
    const href = `/tickers/${sym}`;
    const move = pct(h.unrealisedPnlPercent);

    // 1. Thesis broken - the loudest signal. The reason you were in it no longer holds.
    if (h.riskState === 'invalidated') {
      actions.push({
        id: `exit-${sym}`,
        kind: 'exit_invalidated',
        urgency: 'exit',
        priority: 100 + Math.abs(h.unrealisedPnlPercent),
        symbol: sym,
        title: `Exit plan on ${sym}: the setup has broken`,
        detail: `The signal that put ${sym} in your book is invalidated (${move}, score ${h.signalScore}). This is the classic "get out, the reason is gone" moment - review closing it at your broker before it costs more.`,
        href,
      });
      continue;
    }

    // 2. Through the loss line - a poor performer past where a stop would sit.
    if (h.unrealisedPnlPercent <= t.cutLossPct) {
      actions.push({
        id: `cut-${sym}`,
        kind: 'cut_loss',
        urgency: 'urgent',
        priority: 80 + Math.abs(h.unrealisedPnlPercent),
        symbol: sym,
        title: `${sym} is ${move} - past your loss line`,
        detail: `${sym} is down beyond the ${t.cutLossPct}% line for your risk profile. Decide now, before it decides for you: exit, or where exactly is your stop? A small loss taken on plan beats a large one taken on hope.`,
        href,
      });
      continue;
    }

    // 3. Risk rising on a position you still hold - trim or tighten.
    if (h.riskState === 'elevated_risk') {
      actions.push({
        id: `risk-${sym}`,
        kind: 'reduce_risk',
        urgency: 'urgent',
        priority: 70 + Math.max(0, -h.scoreDelta),
        symbol: sym,
        title: `Risk rising on ${sym} - tighten or trim`,
        detail: `The engine has ${sym} at elevated risk (${move}, score ${h.signalScore}${h.scoreDelta ? `, ${h.scoreDelta > 0 ? '+' : ''}${h.scoreDelta}` : ''}). Consider trimming back to a size you are comfortable holding through a shake-out, or tightening your exit.`,
        href,
      });
      continue;
    }

    // 4. Extended winner - protect the gain by banking some.
    if (h.riskState === 'overextended' || h.unrealisedPnlPercent >= t.takeProfitPct) {
      actions.push({
        id: `tp-${sym}`,
        kind: 'take_profit',
        urgency: 'opportunity',
        priority: 55 + Math.min(30, h.unrealisedPnlPercent),
        symbol: sym,
        title: `${sym} is ${move} and extended - bank some?`,
        detail: `${sym} is up into extended territory. Taking a portion off locks in the win and lets the rest run risk-free - a way to be greedy and safe at once. Your call, at your broker.`,
        href,
      });
      continue;
    }

    // 5. Concentration - one name too large for the book.
    if (h.portfolioWeight > t.maxPositionPct) {
      actions.push({
        id: `conc-${sym}`,
        kind: 'trim_concentration',
        urgency: 'urgent',
        priority: 60 + (h.portfolioWeight - t.maxPositionPct),
        symbol: sym,
        title: `${sym} is ${Math.round(h.portfolioWeight)}% of your book - concentrated`,
        detail: `${sym} is over your ${t.maxPositionPct}% single-position cap. One bad day in one name should not sink the whole plan - trimming back spreads the risk.`,
        href,
      });
      continue;
    }

    // 6. Fresh opportunity in a name you already hold and understand - add on strength.
    if (h.riskState === 'opportunity') {
      actions.push({
        id: `add-${sym}`,
        kind: 'add_opportunity',
        urgency: 'opportunity',
        priority: 40 + Math.max(0, h.scoreDelta),
        symbol: sym,
        title: `${sym} is setting up again (${move})`,
        detail: `The engine flags ${sym} - a name you already hold - as an opportunity (score ${h.signalScore}${h.scoreDelta ? `, ${h.scoreDelta > 0 ? '+' : ''}${h.scoreDelta}` : ''}). Size any add against your plan and concentration cap first.`,
        href,
      });
    }
  }

  // 7. Idle cash - capital that is not working toward the goal.
  const cash = Math.max(0, Number(input.cashAvailable) || 0);
  const equity = Math.max(0, Number(input.equity) || 0);
  const idleShare = equity > 0 ? (cash / equity) * 100 : 0;
  const hasProtectItem = actions.some((a) => a.urgency === 'exit' || a.urgency === 'urgent');
  if (cash > 0 && idleShare >= t.idleCashPct && !hasProtectItem) {
    actions.push({
      id: 'deploy-cash',
      kind: 'deploy_cash',
      urgency: 'info',
      priority: 30,
      title: `${Math.round(idleShare)}% of your account is idle cash`,
      detail: `Cash at rest earns nothing toward your goal. When a setup on your watchlist or the radar fits your plan, put some of it to work - sized in the Trade Plan.`,
      href: '/plan',
    });
  }

  // 8. Behind on pace - a gentle contribution nudge (only if nothing urgent is competing).
  if (input.goalBehind && !hasProtectItem) {
    actions.push({
      id: 'goal-pace',
      kind: 'goal_behind',
      urgency: 'info',
      priority: 20,
      title: 'Behind pace on your goal',
      detail: 'At your current top-up the target is a long way off. Increasing the monthly contribution moves the goal closer far more reliably than reaching for risk.',
      href: '/settings',
    });
  }

  actions.sort((a, b) => b.priority - a.priority);
  const top = actions.slice(0, limit);

  if (top.length === 0) {
    return [
      {
        id: 'all-clear',
        kind: 'all_clear',
        urgency: 'info',
        priority: 0,
        title: 'Nothing needs action - your book is within plan',
        detail: holdings.length
          ? 'No position is through a loss line, over-concentrated, or flagged for risk. Hold your plan and let the winners work.'
          : 'No open positions yet. When a setup fits your plan, size it in the Trade Plan and act at your broker.',
        href: holdings.length ? '/portfolio' : '/plan',
      },
    ];
  }
  return top;
}
