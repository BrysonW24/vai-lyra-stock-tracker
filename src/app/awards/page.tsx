import { AppShell } from '@/components/AppShell';
import { GovAwardsView } from '@/components/gov/GovAwardsView';
import { getDashboardData } from '@/lib/data';
import { resolveGovAwards } from '@/lib/ingestion/usaspending';

export const metadata = { title: 'Gov Awards' };

// Live USAspending pull is time-bounded, retried, 6h-cached and degrades to the curated sample,
// so it never throws to the page. Kept dynamic so a fresh cron-warmed cache is picked up.
export const dynamic = 'force-dynamic';

export default async function AwardsPage() {
  const [data, awards] = await Promise.all([getDashboardData(), resolveGovAwards()]);

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <GovAwardsView
          awards={awards.awards}
          source={awards.source}
          fetchedAt={awards.fetchedAt}
          liveAwardCount={awards.liveAwardCount}
        />
      </div>
    </AppShell>
  );
}
