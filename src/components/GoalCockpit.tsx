import Link from 'next/link';
import { ArrowUpRight, Target, ShieldAlert, TrendingUp, TrendingDown, Sparkles, CheckCircle2, Wallet, type LucideIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { GoalProgress, GoalPace } from '@/lib/goal';
import type { PortfolioAction, ActionUrgency } from '@/lib/portfolio-actions';

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
  ahead: { label: 'Ahead of pace', cls: 'border-[#1f5132] bg-[#0f2417] text-[#5fd08a]' },
  on_track: { label: 'On track', cls: 'border-[#27496b] bg-[#0d1b2b] text-[#7fb0ff]' },
  behind: { label: 'Behind pace', cls: 'border-[#9a6a1f] bg-[#2a1f0f] text-[#f3a33a]' },
  unknown: { label: 'Set a top-up for pace', cls: 'border-[#263241] bg-[#0d141c] text-[#8190a0]' },
};

const URGENCY_META: Record<ActionUrgency, { cls: string; dot: string; icon: LucideIcon; label: string }> = {
  exit: { cls: 'border-[#5c2530] bg-[#1c0f13]', dot: 'bg-[#f0758a]', icon: ShieldAlert, label: 'Exit' },
  urgent: { cls: 'border-[#5c4a25] bg-[#1c1710]', dot: 'bg-[#f3a33a]', icon: TrendingDown, label: 'Act' },
  opportunity: { cls: 'border-[#1f5132] bg-[#0f1c15]', dot: 'bg-[#43d18b]', icon: TrendingUp, label: 'Grow' },
  info: { cls: 'border-[#263241] bg-[#0d141c]', dot: 'bg-[#7fb0ff]', icon: Sparkles, label: 'Note' },
};

const KIND_ICON: Partial<Record<PortfolioAction['kind'], LucideIcon>> = {
  deploy_cash: Wallet,
  all_clear: CheckCircle2,
};

interface Props {
  goal: GoalProgress;
  actions: PortfolioAction[];
  baseCurrency?: string;
  /** True when there is no capital/holdings yet - shows a start-here nudge instead of empty stats. */
  isEmptyState?: boolean;
}

export function GoalCockpit({ goal, actions, baseCurrency = 'USD', isEmptyState }: Props) {
  const cur = (n: number) => formatCurrency(n, baseCurrency);
  const pace = PACE_META[goal.pace];
  const returnPositive = goal.totalReturnDollars >= 0;
  const lead = actions[0];

  return (
    <section className="terminal-panel glass-hero overflow-hidden rounded-md">
      {/* Goal header */}
      <div className="border-b border-[#1b2530] px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Target size={16} className="text-[#f3a33a]" />
          <h2 className="text-sm font-semibold text-[#eef3f8]">Your goal</h2>
          <span className={`ml-auto rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${pace.cls}`}>{pace.label}</span>
        </div>

        <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="font-mono text-2xl font-semibold leading-none text-[#eef3f8]">{cur(goal.equity)}</p>
            <p className="mt-1 text-[11px] text-[#8190a0]">
              of <span className="text-[#dbe5ee]">{cur(goal.target)}</span> {goal.targetIsMilestone ? 'next milestone' : 'target'}
              {' · '}
              <span className={returnPositive ? 'text-[#43d18b]' : 'text-[#f0758a]'}>
                {returnPositive ? '+' : ''}{cur(goal.totalReturnDollars)} ({goal.totalReturnPct >= 0 ? '+' : ''}{goal.totalReturnPct}%) invested
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-lg font-semibold leading-none text-[#f3a33a]">{goal.progressPct}%</p>
            <p className="mt-0.5 text-[10px] text-[#8190a0]">{cur(goal.remaining)} to go</p>
          </div>
        </div>

        {/* Progress bar from anchor to target */}
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#0d141c]">
          <div className="h-full rounded-full bg-gradient-to-r from-[#9a6a1f] to-[#f3a33a]" style={{ width: `${goal.progressPct}%` }} />
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-[#a8b5c2]">{goal.subline}</p>
      </div>

      {/* Action feed - what your money needs now */}
      <div className="px-3 py-2.5">
        <div className="mb-1.5 flex items-center gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8190a0]">What needs you now</p>
          {lead && lead.kind !== 'all_clear' && (
            <span className="rounded-full bg-[#f0758a]/15 px-1.5 py-0.5 font-mono text-[9px] text-[#f0758a]">
              {actions.filter((a) => a.urgency === 'exit' || a.urgency === 'urgent').length} to act on
            </span>
          )}
        </div>

        <ul className="space-y-1.5">
          {actions.map((a) => {
            const u = URGENCY_META[a.urgency];
            const Icon = KIND_ICON[a.kind] ?? u.icon;
            const body = (
              <div className={`flex items-start gap-2 rounded-md border p-2 ${u.cls}`}>
                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${u.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Icon size={12} className="shrink-0 text-[#c3ccd6]" />
                    <p className="text-[12px] font-semibold leading-snug text-[#eef3f8]">{a.title}</p>
                    {a.href && <ArrowUpRight size={11} className="ml-auto shrink-0 text-[#8190a0]" />}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-[#a8b5c2]">{a.detail}</p>
                </div>
              </div>
            );
            return <li key={a.id}>{a.href ? <Link href={a.href} className="block transition hover:brightness-125">{body}</Link> : body}</li>;
          })}
        </ul>

        {isEmptyState && (
          <p className="mt-2 text-[11px] leading-snug text-[#7fb0ff]">
            Add your holdings and set your available cash in settings, and this cockpit tracks your goal and flags every
            exit, risk and opportunity across your book.
          </p>
        )}

        <p className="mt-2 border-t border-[#1b2530] pt-2 text-[10px] leading-snug text-[#5a6b7d]">
          Deterministic reads on your own positions and goal - research and risk framing, not financial advice. Any trade
          is your decision, placed at your broker.
        </p>
      </div>
    </section>
  );
}
