import { AppShell } from '@/components/AppShell';
import { IpoExplorer } from '@/components/ipos/IpoExplorer';
import { getDashboardData } from '@/lib/data';
import { getIposLive } from '@/lib/ipos-live';

export const metadata = { title: 'IPO Radar' };
// Explicit freshness contract: re-render at most hourly so the nightly Finnhub sync
// reaches users without relying on the page being incidentally dynamic via cookies().
export const revalidate = 3600;

export default async function IposPage() {
  const [data, ipoData] = await Promise.all([getDashboardData(), getIposLive()]);

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <IpoExplorer ipos={ipoData.ipos} source={ipoData.source} updatedAt={ipoData.updatedAt} />
      </div>
    </AppShell>
  );
}
