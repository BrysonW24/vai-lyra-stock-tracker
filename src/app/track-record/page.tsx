import { AppShell } from '@/components/AppShell';
import { TrackRecordView } from '@/components/track-record/TrackRecordView';
import { getDashboardData } from '@/lib/data';

export const metadata = {
  title: 'Track Record',
  description: 'How Lyra\'s signals have actually resolved - measured from real labelled outcomes, not a backtest.',
};

export default async function TrackRecordPage() {
  const data = await getDashboardData();
  return (
    <AppShell data={data}>
      <TrackRecordView />
    </AppShell>
  );
}
