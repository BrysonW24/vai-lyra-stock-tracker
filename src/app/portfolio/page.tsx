import { AppShell } from '@/components/AppShell';
import { PortfolioView } from '@/components/portfolio/PortfolioView';
import { getDashboardData } from '@/lib/data';

export default async function PortfolioPage() {
  const data = await getDashboardData();

  return (
    <AppShell data={data}>
      <PortfolioView data={data} />
    </AppShell>
  );
}
