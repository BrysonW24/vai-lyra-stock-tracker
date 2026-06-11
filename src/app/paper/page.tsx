import { AppShell } from '@/components/AppShell';
import { PaperTradingView } from '@/components/paper/PaperTradingView';
import { getDashboardData } from '@/lib/data';
import {
  DEMO_PAPER_ACCOUNT,
  DEMO_PAPER_JOURNAL,
  DEMO_PAPER_TRADES,
  computeAccountSummary,
  computeStrategyReadiness,
} from '@/lib/paper-trading';
import { formatCurrency } from '@/lib/format';

export default async function PaperTradingPage() {
  const data = await getDashboardData();
  const summary = computeAccountSummary(DEMO_PAPER_ACCOUNT, DEMO_PAPER_TRADES);
  const readiness = computeStrategyReadiness(DEMO_PAPER_TRADES);

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <section className="terminal-panel glass-hero rounded-md p-3">
          <h1 className="text-sm font-semibold text-[#eef3f8]">Paper Trading</h1>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-[#a8b5c2]">
            A simulated account ({formatCurrency(DEMO_PAPER_ACCOUNT.startingEquity)} start) for pressure-testing
            strategy discipline before any automation is even discussable. Fills carry realistic fees and slippage,
            every entry freezes its thesis, and the readiness panel stays honest about what the sample size cannot
            prove yet.
          </p>
        </section>

        <PaperTradingView
          journal={DEMO_PAPER_JOURNAL}
          readiness={readiness}
          summary={summary}
          trades={DEMO_PAPER_TRADES}
        />

        <p className="text-[10px] text-[#6f7d8a]">
          Research only - not financial advice. All trades on this page are simulated; no live broker execution exists
          in this build.
        </p>
      </div>
    </AppShell>
  );
}
