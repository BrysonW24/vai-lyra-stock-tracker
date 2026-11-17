import { AppShell } from '@/components/AppShell';
import { MarketReadView } from '@/components/updates/MarketReadView';
import { getDashboardData } from '@/lib/data';
import { loadLatestRead, updatesAvailable, type PublishedRead } from '@/lib/updates/store';

export const metadata = { title: 'Updates' };
export const dynamic = 'force-dynamic';

/**
 * Updates - the home of what Lyra writes for its readers, free and with no account: the market
 * read of the last US session, published by the writer on a GitHub runner through
 * /api/updates/publish and kept in the shared store. It is the same read for everyone; nothing on
 * this page depends on who is looking.
 */
export default async function UpdatesPage() {
  const available = updatesAvailable();
  // A store that does not answer is "no read to show", not a broken page.
  const [data, read] = await Promise.all([getDashboardData(), available ? loadLatestRead().catch(() => null as PublishedRead | null) : null]);

  return (
    <AppShell data={data}>
      <div className="space-y-3 pb-28 xl:pb-6">
        <MarketReadView read={read} available={available} />
      </div>
    </AppShell>
  );
}
