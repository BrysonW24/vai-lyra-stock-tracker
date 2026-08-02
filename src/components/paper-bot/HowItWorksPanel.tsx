'use client';

import { Bot, ShieldCheck, CheckCircle2, Activity, Sparkles, Calculator, TrendingUp } from 'lucide-react';

/** The lifecycle, made legible. Each step names its OWNER so the AI/code/you split is obvious. */
const HOW_IT_WORKS: Array<{ icon: typeof Bot; title: string; detail: string; owner: 'DATA' | 'AI' | 'CODE' | 'YOU' }> = [
  { icon: Activity, title: 'Signal', detail: 'A stock shows a momentum setup in the scanner.', owner: 'DATA' },
  { icon: Sparkles, title: 'AI explains', detail: 'Lyra gives a readiness verdict + reasons + citations. Never a buy/sell instruction.', owner: 'AI' },
  { icon: Calculator, title: 'Order built', detail: 'Deterministic code sets side, quantity and price. The AI is not in this path.', owner: 'CODE' },
  { icon: ShieldCheck, title: 'Risk gate', detail: '23 pre-trade checks. Live execution is hard-blocked, always.', owner: 'CODE' },
  { icon: CheckCircle2, title: 'You approve', detail: 'Nothing fills without your tap. You are the gate.', owner: 'YOU' },
  { icon: Bot, title: 'Paper fill', detail: 'Simulated at the real price + fee + slippage. No broker. No real money.', owner: 'CODE' },
  { icon: TrendingUp, title: 'Tracked + analysed', detail: 'The fill becomes a position with live P/L you can review below.', owner: 'CODE' },
];

const OWNER_TONE: Record<string, string> = {
  DATA: 'text-ink-2 bg-panel border-line-strong',
  AI: 'text-pending bg-blue-tint border-pending/30',
  CODE: 'text-blue-info bg-blue-tint/60 border-blue-focus/40',
  YOU: 'text-accent bg-accent-tint/80 border-accent-border/60',
};

/** "What is this, and why?" - the collapsible lifecycle explainer. Pure presentational. */
export function HowItWorksPanel({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div className="terminal-panel rounded-panel p-3">
      <button type="button" onClick={onToggle} className="flex min-h-[44px] w-full items-center gap-2 text-left sm:min-h-0">
        <Sparkles size={13} className="text-pending" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-title">What is this, and why?</span>
        <span className="ml-auto text-[10px] text-ink-dim">{open ? 'hide' : 'show'}</span>
      </button>
      {open && (
        <>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-2">
            Paper trading runs the <span className="text-ink-title">exact AI-explained, risk-gated pipeline</span> a real bot would - but fills are <span className="text-positive">simulated</span>, with fake money and real prices. The point: build an honest track record and trust the system <span className="text-ink-title">before any real money is ever involved</span>. Below, propose a trade and watch each step; filled trades become positions with live P/L in your paper account.
          </p>
          <ol className="mt-3 space-y-1.5">
            {HOW_IT_WORKS.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-cell border border-line bg-chrome text-pending">
                    <Icon size={13} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-ink-title">{i + 1}. {step.title}</span>
                      <span className={`rounded-sm border px-1 py-px text-[8px] font-semibold uppercase tracking-[0.08em] ${OWNER_TONE[step.owner]}`}>{step.owner}</span>
                    </div>
                    <p className="text-[10px] leading-snug text-ink-3">{step.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
