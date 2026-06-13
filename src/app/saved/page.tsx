import { AppShell } from '@/components/AppShell';
import { ResearchQueueView, type CurrentSnapshot } from '@/components/research/ResearchQueueView';
import { getDashboardData } from '@/lib/data';

export default async function SavedPage() {
  const data = await getDashboardData();
  const current: Record<string, CurrentSnapshot> = {};
  for (const s of data.signals) {
    current[s.symbol] = { score: s.score, scoreDelta: s.scoreDelta, close: s.close, companyName: s.companyName, status: s.status };
  }

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <ResearchQueueView current={current} />
      </div>
    </AppShell>
  );
}
