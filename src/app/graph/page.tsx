import { Suspense } from 'react';
import { AppShell } from '@/components/AppShell';
import { InvestigationGraph } from '@/components/findings/InvestigationGraph';
import { getDashboardData } from '@/lib/data';

export default async function GraphPage() {
  const data = await getDashboardData();

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <div className="terminal-panel rounded-md px-3 py-3">
          <h1 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Investigation Graph</h1>
          <p className="mt-1 text-[11px] leading-relaxed text-[#8190a0]">
            Every finding&apos;s companies, themes, bottlenecks and buyers on one map. Shared nodes collapse, so you can see which names sit on the same supply-chain bottleneck or theme. Tap any node to investigate its evidence and connections. Research only, not advice.
          </p>
        </div>
        <Suspense fallback={<p className="text-[11px] text-[#8190a0]">Loading graph...</p>}>
          <InvestigationGraph />
        </Suspense>
      </div>
    </AppShell>
  );
}
