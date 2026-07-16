import { AppShell } from '@/components/AppShell';
import { CalculatorsView } from '@/components/calculators/CalculatorsView';
import { getDashboardData } from '@/lib/data';

export const metadata = { title: 'Calculators' };

export default async function CalculatorsPage() {
  const data = await getDashboardData();

  return (
    <AppShell data={data}>
      <CalculatorsView />
    </AppShell>
  );
}
