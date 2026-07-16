import { AppShell } from '@/components/AppShell';
import { FundamentalsView } from '@/components/fundamentals/FundamentalsView';
import { getDashboardData } from '@/lib/data';
import { getDemoFundamentalReports } from '@/lib/fundamentals';

export const metadata = { title: 'Fundamentals' };

export default async function FundamentalsPage() {
  const data = await getDashboardData();
  const fundamentalReports = getDemoFundamentalReports();

  return (
    <AppShell data={data}>
      <FundamentalsView reports={fundamentalReports} />
    </AppShell>
  );
}
