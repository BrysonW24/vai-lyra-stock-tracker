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
  DATA: 'text-[#a8b5c2] bg-[#0d141c] border-[#263241]',
  AI: 'text-[#8aa2ff] bg-[#101a2e] border-[#8aa2ff]/30',
  CODE: 'text-[#6fb1ff] bg-[#0b1626] border-[#1d3a5a]',
  YOU: 'text-[#f3a33a] bg-[#231a08] border-[#5a4a1a]',
};

/** "What is this, and why?" - the collapsible lifecycle explainer. Pure presentational. */
export function HowItWorksPanel({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div className="terminal-panel rounded-md p-3">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 text-left">
        <Sparkles size={13} className="text-[#8aa2ff]" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#c8d3de]">What is this, and why?</span>
        <span className="ml-auto text-[10px] text-[#6f7d8a]">{open ? 'hide' : 'show'}</span>
      </button>
      {open && (
        <>
          <p className="mt-2 text-[11px] leading-relaxed text-[#a8b5c2]">
            Paper trading runs the <span className="text-[#dbe5ee]">exact AI-explained, risk-gated pipeline</span> a real bot would - but fills are <span className="text-[#43d18b]">simulated</span>, with fake money and real prices. The point: build an honest track record and trust the system <span className="text-[#dbe5ee]">before any real money is ever involved</span>. Below, propose a trade and watch each step; filled trades become positions with live P/L in your paper account.
          </p>
          <ol className="mt-3 space-y-1.5">
            {HOW_IT_WORKS.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-[#1d2733] bg-[#0b1016] text-[#8aa2ff]">
                    <Icon size={13} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-[#dbe5ee]">{i + 1}. {step.title}</span>
                      <span className={`rounded-sm border px-1 py-px text-[8px] font-semibold uppercase tracking-[0.08em] ${OWNER_TONE[step.owner]}`}>{step.owner}</span>
                    </div>
                    <p className="text-[10px] leading-snug text-[#8190a0]">{step.detail}</p>
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
