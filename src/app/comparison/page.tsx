import { AppShell } from '@/components/AppShell';
import { ComparisonLab } from '@/components/comparison/ComparisonLab';
import { getDashboardData } from '@/lib/data';

export const metadata = { title: 'Comparison Lab' };

export default async function ComparisonPage() {
  const data = await getDashboardData();

  return (
    <AppShell data={data}>
      <ComparisonLab />
    </AppShell>
  );
}
