import { AppShell } from '@/components/AppShell';
import { FundamentalsView } from '@/components/fundamentals/FundamentalsView';
import { getDashboardData } from '@/lib/data';
import { getFundamentalsLive } from '@/lib/fundamentals-live';

export const metadata = { title: 'Fundamentals' };

export default async function FundamentalsPage() {
  const [data, fundamentals] = await Promise.all([getDashboardData(), getFundamentalsLive()]);

  return (
    <AppShell data={data}>
      <FundamentalsView reports={fundamentals.reports} source={fundamentals.source} updatedAt={fundamentals.updatedAt} />
    </AppShell>
  );
}
