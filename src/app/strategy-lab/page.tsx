import { Suspense } from 'react';
import { AppShell } from '@/components/AppShell';
import { StrategyLab } from '@/components/strategy/StrategyLab';
import { getDashboardData } from '@/lib/data';

export const metadata = { title: 'Strategy Lab' };

export default async function StrategyLabPage() {
  const data = await getDashboardData();

  return (
    <AppShell data={data}>
      <Suspense fallback={<div className="terminal-panel rounded-panel p-4 text-sm text-ink-3">Loading strategy lab...</div>}>
        <StrategyLab signals={data.signals} />
      </Suspense>
    </AppShell>
  );
}
