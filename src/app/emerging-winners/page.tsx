import { AppShell } from '@/components/AppShell';
import { EmergingWinnerView } from '@/components/emerging-winner/EmergingWinnerView';
import { getDashboardData } from '@/lib/data';
import { loadEmergingWinnerQueue } from '@/lib/emerging-winner/load';

export const metadata = {
  title: 'Emerging Winners',
  description:
    "Small caps that structurally resemble past winners - a shadow-live, risk-gated research queue. Research, not advice.",
};

export const dynamic = 'force-dynamic';

export default async function EmergingWinnersPage() {
  const [data, queue] = await Promise.all([getDashboardData(), loadEmergingWinnerQueue()]);
  return (
    <AppShell data={data}>
      <EmergingWinnerView queue={queue} />
    </AppShell>
  );
}
