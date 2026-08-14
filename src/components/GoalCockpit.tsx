import Link from 'next/link';
import { ArrowUpRight, Target, ShieldAlert, TrendingUp, TrendingDown, Sparkles, CheckCircle2, Wallet, type LucideIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { GoalProgress, GoalPace } from '@/lib/goal';
import type { PortfolioAction, ActionUrgency } from '@/lib/portfolio-actions';
import type { Orientation, OrientationItem } from '@/lib/orientation';
import { GoalTargetEditor } from '@/components/GoalTargetEditor';

/**
 * GoalCockpit - the goal-oriented, action-first hero that leads the experience.
 *
 * It answers, at a glance and above everything else: where am I against my goal, and what does my
 * money need from me right now. Downside comes first - exits and cut-losses are the loudest rows -
 * because protecting capital is what makes "make money" real. Every number is deterministic; nothing
 * here is a licensed buy/sell recommendation. It flags what the engine sees on YOUR positions and
 * prompts a decision you make at your broker.
 */

const PACE_META: Record<GoalPace, { label: string; cls: string }> = {
  ahead: { label: 'Ahead of pace', cls: 'border-positive/40 bg-positive-tint text-positive' },
  on_track: { label: 'On track', cls: 'border-blue-focus/40 bg-blue-tint text-blue-info' },
  behind: { label: 'Behind pace', cls: 'border-accent-border bg-accent-tint text-accent' },
  unknown: { label: 'Set a top-up for pace', cls: 'border-line-strong bg-panel text-ink-3' },
};

const URGENCY_META: Record<ActionUrgency, { cls: string; dot: string; icon: LucideIcon; label: string }> = {
  exit: { cls: 'border-negative-soft/40 bg-negative-soft/10', dot: 'bg-negative-soft', icon: ShieldAlert, label: 'Exit' },
  urgent: { cls: 'border-accent-border/60 bg-accent-tint/60', dot: 'bg-accent', icon: TrendingDown, label: 'Act' },
  opportunity: { cls: 'border-positive/40 bg-positive-tint/70', dot: 'bg-positive', icon: TrendingUp, label: 'Grow' },
  info: { cls: 'border-line-strong bg-panel', dot: 'bg-blue-info', icon: Sparkles, label: 'Note' },
};

const KIND_ICON: Partial<Record<PortfolioAction['kind'], LucideIcon>> = {
  deploy_cash: Wallet,
  all_clear: CheckCircle2,
};

function OrientationRow({ item }: { item: OrientationItem }) {
  return (
    <Link href={`/tickers/${item.symbol}`} className="block rounded border border-line bg-panel-deep p-1.5 transition hover:brightness-125">
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[11px] font-semibold text-ink">{item.symbol}</span>
        <span className={`rounded px-1 py-px font-mono text-[8px] uppercase tracking-[0.1em] ${item.held ? 'bg-positive-tint text-positive' : 'bg-blue-tint text-blue-info'}`}>
          {item.held ? 'held' : 'watch'}
        </span>
        <span className="ml-auto truncate font-mono text-[8px] text-ink-dim">{item.sourceName}</span>
      </div>
      <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-ink-title">{item.headline}</p>
    </Link>
  );
}

interface Props {
  goal: GoalProgress;
  actions: PortfolioAction[];
  /** Two-sided news read across held + watched names. Omitted when there is nothing to show. */
  orientation?: Orientation;
  /** True when the orientation news is the bundled sample feed (demo tour only) - chips the section. */
  orientationSample?: boolean;
  baseCurrency?: string;
  /** The user's own saved target (null = milestone ladder). */
  currentTarget?: number | null;
  /** Whether the signed-in user can set/persist a target (hides the editor in demo). */
  canSetTarget?: boolean;
  /** True when there is no capital/holdings yet - shows a start-here nudge instead of empty stats. */
  isEmptyState?: boolean;
}

export function GoalCockpit({ goal, actions, orientation, orientationSample = false, baseCurrency = 'USD', currentTarget = null, canSetTarget, isEmptyState }: Props) {
  const cur = (n: number) => formatCurrency(n, baseCurrency);
  const pace = PACE_META[goal.pace];
  const returnPositive = goal.totalReturnDollars >= 0;
  const lead = actions[0];

  return (
    <section className="terminal-panel glass-hero overflow-hidden rounded-panel">
      {/* Goal header */}
      <div className="border-b border-line px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Target size={16} className="text-accent" />
          <h2 className="text-sm font-semibold text-ink">
            {goal.targetIsMilestone ? 'Your capital' : 'Your goal'}
          </h2>
          <span className={`ml-auto rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${pace.cls}`}>{pace.label}</span>
        </div>

        <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="font-mono text-2xl font-semibold leading-none text-ink">{cur(goal.equity)}</p>
            <p className="mt-1 text-[11px] text-ink-3">
              of <span className="text-ink-title">{cur(goal.target)}</span> {goal.targetIsMilestone ? 'next milestone' : 'target'}
              {' · '}
              <span className={returnPositive ? 'text-positive' : 'text-negative-soft'}>
                {returnPositive ? '+' : ''}{cur(goal.totalReturnDollars)} ({goal.totalReturnPct >= 0 ? '+' : ''}{goal.totalReturnPct}%) invested
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-lg font-semibold leading-none text-accent">{goal.progressPct}%</p>
            <p className="mt-0.5 text-[10px] text-ink-3">{cur(goal.remaining)} to go</p>
          </div>
        </div>

        {/* Progress bar from anchor to target */}
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel">
          <div className="h-full rounded-full bg-gradient-to-r from-accent-border to-accent" style={{ width: `${goal.progressPct}%` }} />
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-ink-2">{goal.subline}</p>
        {canSetTarget && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-ink-dim">
              {goal.targetIsMilestone ? 'Climbing the milestone ladder.' : 'Tracking your own target.'}
            </span>
            <GoalTargetEditor currentTarget={currentTarget} />
          </div>
        )}
      </div>

      {/* Action feed - what your money needs now */}
      <div className="px-3 py-2.5">
        <div className="mb-1.5 flex items-center gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">What needs you now</p>
          {lead && lead.kind !== 'all_clear' && (
            <span className="rounded-full bg-negative-soft/15 px-1.5 py-0.5 font-mono text-[9px] text-negative-soft">
              {actions.filter((a) => a.urgency === 'exit' || a.urgency === 'urgent').length} to act on
            </span>
          )}
        </div>

        <ul className="space-y-1.5">
          {actions.map((a) => {
            const u = URGENCY_META[a.urgency];
            const Icon = KIND_ICON[a.kind] ?? u.icon;
            const body = (
              <div className={`flex items-start gap-2 rounded-cell border p-2 ${u.cls}`}>
                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${u.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Icon size={12} className="shrink-0 text-ink-2" />
                    <p className="text-[12px] font-semibold leading-snug text-ink">{a.title}</p>
                    {a.href && <ArrowUpRight size={11} className="ml-auto shrink-0 text-ink-3" />}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-ink-2">{a.detail}</p>
                </div>
              </div>
            );
            return <li key={a.id}>{a.href ? <Link href={a.href} className="block transition hover:brightness-125">{body}</Link> : body}</li>;
          })}
        </ul>

        {/* Orientation - a true two-sided read across the names you hold AND watch: good and bad. */}
        {orientation && (orientation.opportunities.length > 0 || orientation.risks.length > 0) && (
          <div className="mt-3 border-t border-line pt-2.5">
            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
              Across your names - <span className="text-positive">{orientation.opportunities.length} good</span>,{' '}
              <span className="text-negative-soft">{orientation.risks.length} bad</span>
              {orientationSample ? (
                <span className="rounded border border-accent-border/60 bg-accent-tint px-1.5 py-0.5 text-[9px] font-medium tracking-[0.1em] text-accent">
                  Sample
                </span>
              ) : null}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-positive">
                  <TrendingUp size={11} /> Opportunities
                </p>
                <div className="space-y-1">
                  {orientation.opportunities.length ? (
                    orientation.opportunities.map((i) => <OrientationRow key={i.id} item={i} />)
                  ) : (
                    <p className="text-[10px] text-ink-dim">Nothing notably good on your names right now.</p>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-negative-soft">
                  <TrendingDown size={11} /> Risks
                </p>
                <div className="space-y-1">
                  {orientation.risks.length ? (
                    orientation.risks.map((i) => <OrientationRow key={i.id} item={i} />)
                  ) : (
                    <p className="text-[10px] text-ink-dim">Nothing notably bad on your names right now.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {isEmptyState && (
          <p className="mt-2 text-[11px] leading-snug text-blue-info">
            Add your holdings and set your available cash in settings, and this cockpit tracks your goal and flags every
            exit, risk and opportunity across your book.
          </p>
        )}

        <p className="mt-2 border-t border-line pt-2 text-[10px] leading-snug text-ink-dim">
          Deterministic reads on your own positions and capital context - research and risk framing, not financial advice.
          Any trade is your decision, placed at your broker.
        </p>
      </div>
    </section>
  );
}
