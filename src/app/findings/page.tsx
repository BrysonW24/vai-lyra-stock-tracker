import { Suspense } from 'react';
import { AppShell } from '@/components/AppShell';
import { FindingsFeed } from '@/components/findings/FindingsFeed';
import { getDashboardData } from '@/lib/data';
import { getLiveFindings } from '@/lib/findings/server';

export default async function FindingsPage() {
  const [data, liveFindings] = await Promise.all([getDashboardData(), getLiveFindings()]);

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <div className="terminal-panel rounded-md px-3 py-3">
          <h1 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe5ee]">Opportunity Findings</h1>
          <p className="mt-1 text-[11px] leading-relaxed text-[#8190a0]">
            Every surfaced setup as an investigable finding - what surfaced, why, the evidence behind it, what it connects to, and what you can do next. Tap any finding to peel back the layers. Research only, not advice.
          </p>
        </div>
        <Suspense fallback={<p className="text-[11px] text-[#8190a0]">Loading findings...</p>}>
          <FindingsFeed findings={liveFindings} />
        </Suspense>
      </div>
    </AppShell>
  );
}
